<?php
/**
 * OrderNotificationService
 *
 * Central place for sending/queueing order-related notifications (email + SMS).
 *
 * Design goals:
 * - Keep route handlers thin (no "one function doing everything")
 * - Best-effort notifications (never break order creation/status updates)
 * - Idempotent SMS queueing (avoid duplicates on retries)
 */

require_once __DIR__ . '/../sms/SMSService.php';
require_once __DIR__ . '/../sms/SMSTemplates.php';
require_once __DIR__ . '/../../utils/system_logs.php';

class OrderNotificationService {
    /**
     * Queue/send notifications after order creation.
     *
     * @param PDO   $pdo
     * @param array $createdOrders Array of created order rows (from orders.php)
     * @param array $vendorGroups  Map vendorId => ['orders'=>[], 'vendor_name'=>?, 'vendor_email'=>?]
     * @param array $context       ['order_number'=>string, 'customer_id'=>?, 'checkout_phone'=>?, 'customer_profile_phone'=>?]
     */
    public static function orderCreated($pdo, $createdOrders, $vendorGroups, $context = []) {
        if (!is_array($createdOrders) || empty($createdOrders)) {
            return;
        }

        $orderNumber = $context['order_number'] ?? ($createdOrders[0]['order_number'] ?? null);
        if (!$orderNumber) {
            $orderNumber = (string)($createdOrders[0]['id'] ?? 'N/A');
        }

        $idempotencyGroup = $context['idempotency_group'] ?? $orderNumber;

        logSystemEvent('order_created_notifications', 'Order notifications triggered', [
            'order_number' => $orderNumber,
            'idempotency_group' => $idempotencyGroup,
            'items_count' => count($createdOrders),
            'vendors_count' => is_array($vendorGroups) ? count($vendorGroups) : 0
        ]);

        // Queue emails (existing implementation)
        try {
            require_once __DIR__ . '/../../routes/email_queue.php';

            foreach ($createdOrders as $order) {
                if (!empty($order['order_id']) && !empty($order['vendor_id'])) {
                    queueVendorOrderNotification($order['order_id'], $order['vendor_id']);
                }
            }

            if (!empty($createdOrders[0]['order_id'])) {
                queueOrderConfirmationEmail($createdOrders[0]['order_id']);
            }
        } catch (Exception $e) {
            error_log('OrderNotificationService: email queueing failed: ' . $e->getMessage());
            logSystemEvent('order_email_queue_failed', 'Failed to queue order emails', [
                'order_number' => $orderNumber,
                'error' => $e->getMessage()
            ]);
        }

        // Queue/send SMS
        try {
            $smsService = new SMSService();

            $customerId = $context['customer_id'] ?? null;
            $checkoutPhone = $context['checkout_phone'] ?? null;
            $profilePhone = $context['customer_profile_phone'] ?? null;

            $customerPhone = $checkoutPhone;
            if ($customerPhone && !$smsService->validatePhoneNumber($customerPhone)) {
                $customerPhone = $profilePhone ?: $customerPhone;
            }
            if (!$customerPhone) {
                $customerPhone = $profilePhone;
            }

            if ($customerPhone) {
                $customerMessage = SMSTemplates::getOrderConfirmationCustomer([
                    'id' => $orderNumber,
                    'customer_name' => $createdOrders[0]['customer_name'] ?? 'Customer',
                    'total_amount' => array_sum(array_column($createdOrders, 'total_amount')),
                    'delivery_fee' => array_sum(array_column($createdOrders, 'delivery_fee')),
                    'items' => $createdOrders
                ]);

                self::queueThenMaybeSendSMS($smsService, $customerPhone, $customerMessage, [
                    'idempotency_key' => 'order_create:customer:' . $idempotencyGroup,
                    'recipient_type' => 'customer',
                    'related_order_id' => $createdOrders[0]['order_id'] ?? null,
                    'related_user_id' => $customerId
                ]);
            }

            foreach ($vendorGroups as $vendorId => $vendorData) {
                $vendorId = (string)$vendorId;
                $vendorPhone = self::getVendorPhone($pdo, $vendorId);
                if (!$vendorPhone) {
                    self::notifyAdmins("Vendor SMS skipped: missing phone for vendor_id={$vendorId} (order={$orderNumber}).");
                    continue;
                }

                $vendorOrders = $vendorData['orders'] ?? [];
                if (!is_array($vendorOrders) || empty($vendorOrders)) {
                    continue;
                }

                $vendorOrder = $vendorOrders[0];
                $vendorName = $vendorData['vendor_name'] ?? ($vendorOrder['vendor_name'] ?? 'Vendor');

                $vendorMessage = SMSTemplates::getOrderConfirmationVendor([
                    'id' => $orderNumber,
                    'vendor_name' => $vendorName,
                    'items' => $vendorOrders
                ]);

                self::queueThenMaybeSendSMS($smsService, $vendorPhone, $vendorMessage, [
                    'idempotency_key' => 'order_create:vendor:' . $idempotencyGroup . ':' . $vendorId,
                    'recipient_type' => 'vendor',
                    'related_order_id' => $vendorOrder['order_id'] ?? null,
                    'related_user_id' => $vendorId
                ]);
            }
        } catch (Exception $e) {
            error_log('OrderNotificationService: SMS queue/send failed: ' . $e->getMessage());
            logSystemEvent('order_sms_queue_failed', 'Failed to queue/send order SMS', [
                'order_number' => $orderNumber,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Queue/send notifications after an order status change.
     *
     * @param PDO    $pdo
     * @param array  $orderForSMS Order row (must include order_number, user_id, vendor_id)
     * @param string $newStatus
     */
    public static function orderStatusChanged($pdo, $orderForSMS, $newStatus) {
        if (!is_array($orderForSMS) || empty($orderForSMS)) {
            return;
        }

        // Avoid SMS wastage: only send SMS when the status becomes "delivered".
        if (strtolower((string)$newStatus) !== 'delivered') {
            return;
        }

        logSystemEvent('order_delivered_sms_triggered', 'Order delivered SMS triggered', [
            'order_id' => $orderForSMS['id'] ?? null,
            'order_number' => $orderForSMS['order_number'] ?? null
        ]);

        try {
            $smsService = new SMSService();
            $orderNumber = $orderForSMS['order_number'] ?? ($orderForSMS['id'] ?? 'N/A');
            $orderId = $orderForSMS['id'] ?? null;

            $customerName = $orderForSMS['customer_name'] ?? 'Customer';
            $customerPhone = $orderForSMS['customer_phone'] ?? null;
            if (!$customerPhone && isset($orderForSMS['phone'])) {
                $customerPhone = $orderForSMS['phone'];
            }

            $vendorId = $orderForSMS['vendor_id'] ?? null;

            if ($customerPhone) {
                $deliveryCustomerMessage = SMSTemplates::getDeliveryConfirmationCustomer([
                    'id' => $orderNumber,
                    'customer_name' => $customerName,
                    'total_amount' => $orderForSMS['total_amount'] ?? 0,
                    'shipping_address' => $orderForSMS['shipping_address'] ?? null
                ]);

                self::queueThenMaybeSendSMS($smsService, $customerPhone, $deliveryCustomerMessage, [
                    'idempotency_key' => 'order_delivered:customer:' . $orderId,
                    'recipient_type' => 'customer',
                    'related_order_id' => $orderId,
                    'related_user_id' => $orderForSMS['user_id'] ?? null
                ]);
            }

            if (!empty($vendorId)) {
                $vendorPhone = self::getVendorPhone($pdo, (string)$vendorId);
                if ($vendorPhone) {
                    $deliveryVendorMessage = SMSTemplates::getDeliveryConfirmationVendor([
                        'id' => $orderNumber,
                        'vendor_name' => $orderForSMS['vendor_name'] ?? 'Vendor',
                        'total_amount' => $orderForSMS['total_amount'] ?? 0
                    ]);

                    self::queueThenMaybeSendSMS($smsService, $vendorPhone, $deliveryVendorMessage, [
                        'idempotency_key' => 'order_delivered:vendor:' . $orderId,
                        'recipient_type' => 'vendor',
                        'related_order_id' => $orderId,
                        'related_user_id' => $vendorId
                    ]);
                }
            }
        } catch (Exception $e) {
            error_log('OrderNotificationService: orderStatusChanged failed: ' . $e->getMessage());
            logSystemEvent('order_delivered_sms_failed', 'Order delivered SMS failed', [
                'order_id' => $orderForSMS['id'] ?? null,
                'error' => $e->getMessage()
            ]);
        }
    }

    private static function queueThenMaybeSendSMS($smsService, $phone, $message, $options) {
        // Always queue first (idempotent). Then optionally send immediately in the same request.
        $queued = $smsService->sendSMS($phone, $message, array_merge($options, ['queue_only' => true]));

        if (!(defined('SMS_SEND_IMMEDIATELY') && SMS_SEND_IMMEDIATELY)) {
            return $queued;
        }

        // If this idempotency key already exists and was already sent, do nothing.
        if (($queued['already_exists'] ?? false) && in_array(($queued['status'] ?? ''), ['sent', 'delivered'], true)) {
            return $queued;
        }

        // Send now using the same sms_log_id (so logs stay consistent).
        $smsLogId = $queued['sms_log_id'] ?? null;
        if (is_string($smsLogId) && trim($smsLogId) !== '') {
            return $smsService->sendSMS($phone, $message, array_merge($options, ['sms_log_id' => $smsLogId]));
        }

        return $queued;
    }

    private static function getVendorPhone($pdo, $vendorId) {
        try {
            $stmt = $pdo->prepare("
                SELECT COALESCE(v.phone, up.phone) AS phone
                FROM vendors v
                LEFT JOIN user_profiles up ON v.user_id = up.id
                WHERE v.id = ?
            ");
            $stmt->execute([$vendorId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row['phone'] ?? null;
        } catch (Exception $e) {
            return null;
        }
    }

    private static function notifyAdmins($message) {
        try {
            require_once __DIR__ . '/../../utils/notifications.php';
            notifyAllAdmins($message, 'sms');
        } catch (Exception $e) {
            // Ignore admin notification failures
        }
    }
}
