<?php
/**
 * Paystack Webhook Handler - Production-Grade Payment Processing
 *
 * This replaces manual payment verification with reliable webhook-based processing.
 * Webhooks are the source of truth for payment status.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/paystack_config.php';
require_once __DIR__ . '/../routes/email_queue.php';
require_once __DIR__ . '/../utils/system_logs.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

/**
 * Handle Paystack webhook events
 * This is called by Paystack when payment events occur
 */
function handlePaystackWebhook() {
    try {
        // Get raw POST data
        $payload = file_get_contents('php://input');
        $headers = getallheaders();

        // Log webhook attempt
        logSystemEvent('webhook_received', 'Paystack webhook received', [
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'content_length' => strlen($payload),
            'headers' => $headers
        ]);

        // Verify webhook signature
        if (!verifyPaystackWebhook($payload, $headers)) {
            http_response_code(401);
            echo json_encode(['status' => 'error', 'message' => 'Invalid signature']);
            logSystemEvent('webhook_invalid_signature', 'Webhook signature verification failed');
            exit;
        }

        // Parse webhook data
        $webhookData = json_decode($payload, true);
        if (!$webhookData || !isset($webhookData['event'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid webhook data']);
            logSystemEvent('webhook_invalid_data', 'Webhook contains invalid JSON or missing event');
            exit;
        }

        $event = $webhookData['event'];
        $eventData = $webhookData['data'] ?? [];

        logSystemEvent('webhook_event', "Processing webhook event: {$event}", [
            'event' => $event,
            'reference' => $eventData['reference'] ?? 'unknown'
        ]);

        // Route to appropriate handler
        switch ($event) {
            case 'charge.success':
                handleChargeSuccess($eventData);
                break;

            case 'charge.failed':
                handleChargeFailed($eventData);
                break;

            case 'transfer.success':
            case 'transfer.failed':
            case 'transfer.reversed':
                // Handle transfer events if you implement payouts
                handleTransferEvent($event, $eventData);
                break;

            default:
                // Log unknown events but don't fail
                logSystemEvent('webhook_unknown_event', "Unknown webhook event: {$event}", [
                    'event' => $event,
                    'data' => $eventData
                ]);
                break;
        }

        // Always respond with 200 to acknowledge receipt
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Webhook processed']);

    } catch (Exception $e) {
        logSystemEvent('webhook_error', 'Webhook processing failed', [
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);

        // Still return 200 to prevent Paystack retries
        http_response_code(200);
        echo json_encode(['status' => 'error', 'message' => 'Internal processing error']);
    }
}

/**
 * Verify Paystack webhook signature
 */
function verifyPaystackWebhook($payload, $headers) {
    $signature = $headers['X-Paystack-Signature'] ?? $headers['x-paystack-signature'] ?? '';

    if (empty($signature)) {
        return false;
    }

    // Get Paystack secret key
    $secret = getenv('PAYSTACK_SECRET_KEY') ?: PAYSTACK_SECRET_KEY ?? '';

    if (empty($secret)) {
        logSystemEvent('webhook_config_error', 'Paystack secret key not configured');
        return false;
    }

    // Compute expected signature
    $expectedSignature = hash_hmac('sha512', $payload, $secret);

    // Use timing-safe comparison
    return hash_equals($expectedSignature, $signature);
}

/**
 * Handle successful charge event (payment completed)
 */
function handleChargeSuccess($eventData) {
    global $pdo;

    $reference = $eventData['reference'] ?? '';
    $amount = $eventData['amount'] ?? 0;
    $status = $eventData['status'] ?? '';

    if (empty($reference) || $status !== 'success') {
        logSystemEvent('webhook_invalid_charge', 'Invalid charge success data', [
            'reference' => $reference,
            'status' => $status,
            'amount' => $amount
        ]);
        return;
    }

    // Use database transaction for atomicity
    $pdo->beginTransaction();

    try {
        // Lock payment record to prevent concurrent processing
        $stmt = $pdo->prepare("
            SELECT * FROM payment_transactions
            WHERE paystack_reference = ? OR transaction_reference = ?
            FOR UPDATE
        ");
        $stmt->execute([$reference, $reference]);
        $payment = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$payment) {
            logSystemEvent('webhook_payment_not_found', 'Payment not found for reference', [
                'reference' => $reference
            ]);
            $pdo->rollBack();
            return;
        }

        // Idempotency check - if already processed, exit gracefully
        if ($payment['payment_status'] === 'success') {
            logSystemEvent('webhook_idempotent', 'Payment already processed successfully', [
                'reference' => $reference,
                'payment_id' => $payment['id']
            ]);
            $pdo->commit();
            return;
        }

        // Update payment status
        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET
                payment_status = 'success',
                paystack_transaction_id = ?,
                paystack_paid_at = ?,
                gateway_response = ?,
                updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([
            $eventData['id'],
            date('Y-m-d H:i:s', strtotime($eventData['paid_at'] ?? 'now')),
            json_encode($eventData),
            $payment['id']
        ]);

        logSystemEvent('webhook_payment_updated', 'Payment status updated to success', [
            'payment_id' => $payment['id'],
            'reference' => $reference
        ]);

        // Create orders from checkout data (from payment metadata)
        $orderIds = createOrdersFromPayment($payment, $eventData);

        if (empty($orderIds)) {
            logSystemEvent('webhook_no_orders_created', 'No orders created from payment', [
                'payment_id' => $payment['id'],
                'reference' => $reference
            ]);
            $pdo->rollBack();
            return;
        }

        // Clear cart only after successful order creation
        clearUserCart($payment['user_id']);

        // Queue email notifications (background processing)
        queueOrderEmails($orderIds);

        // Update order payment status
        updateOrderPaymentStatus($orderIds, $reference, 'paid');

        $pdo->commit();

        logSystemEvent('webhook_charge_success_completed', 'Charge success webhook processed successfully', [
            'payment_id' => $payment['id'],
            'reference' => $reference,
            'order_count' => count($orderIds),
            'order_ids' => $orderIds
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        logSystemEvent('webhook_charge_success_error', 'Charge success processing failed', [
            'reference' => $reference,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        throw $e;
    }
}

/**
 * Create orders from payment data
 */
function createOrdersFromPayment($payment, $eventData = null) {
    global $pdo;

    try {
        // Get checkout data from payment metadata (stored during initialization)
        $checkoutData = null;

        if (!empty($payment['metadata'])) {
            $metadata = json_decode($payment['metadata'], true);
            if (isset($metadata['checkout_data'])) {
                $checkoutData = $metadata['checkout_data'];
            }
        }

        // Fallback: try to get from checkout_sessions table if it exists
        if (!$checkoutData) {
            $checkoutData = getPendingCheckoutData($payment['paystack_reference'] ?: $payment['transaction_reference']);
        }

        // Final fallback: try to reconstruct from event data (limited info)
        if (!$checkoutData && $eventData) {
            $checkoutData = [
                'items' => [], // Can't reconstruct full items from webhook
                'shipping_address' => 'From Webhook Fallback',
                'contact_phone' => 'From Webhook Fallback',
                'notes' => 'Order created via webhook - checkout data unavailable',
                'payment_method' => $eventData['channel'] ?? 'card'
            ];
        }

        if (!$checkoutData) {
            logSystemEvent('webhook_no_checkout_data', 'No checkout data available for order creation', [
                'payment_id' => $payment['id'],
                'reference' => $payment['paystack_reference'] ?: $payment['transaction_reference']
            ]);
            return [];
        }

        $orderIds = [];

        // Create one order record for each product
        foreach ($checkoutData['items'] as $item) {
            $orderNumber = 'ORD-' . date('YmdHis') . '-' . strtoupper(substr(uniqid(), 0, 4));

            // Get vendor ID from product
            $vendorStmt = $pdo->prepare("SELECT vendor_id FROM products WHERE id = ?");
            $vendorStmt->execute([$item['product_id']]);
            $vendorData = $vendorStmt->fetch(PDO::FETCH_ASSOC);
            $vendorId = $vendorData['vendor_id'] ?? null;

            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    user_id, product_id, quantity, status, total_amount,
                    payment_status, payment_transaction_id, payment_reference,
                    payment_completed_at, payment_method, payment_account_number,
                    shipping_address, contact_phone, notes, order_type,
                    order_number, vendor_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");

            $stmt->execute([
                $payment['user_id'],
                $item['product_id'],
                $item['quantity'],
                'confirmed', // Auto-confirm on successful payment
                $item['price'] * $item['quantity'],
                'paid',
                $payment['paystack_transaction_id'],
                $payment['paystack_reference'],
                $payment['payment_method'] ?? 'card',
                $payment['payment_account_number'] ?? null,
                $checkoutData['shipping_address'],
                $checkoutData['contact_phone'],
                $checkoutData['notes'] ?? 'Order from webhook',
                'cart',
                $orderNumber,
                $vendorId
            ]);

            $orderIds[] = $pdo->lastInsertId();
        }

        logSystemEvent('webhook_orders_created', 'Orders created from payment', [
            'payment_id' => $payment['id'],
            'order_ids' => $orderIds,
            'item_count' => count($checkoutData['items'])
        ]);

        return $orderIds;

    } catch (Exception $e) {
        logSystemEvent('webhook_order_creation_error', 'Failed to create orders from payment', [
            'payment_id' => $payment['id'],
            'error' => $e->getMessage()
        ]);
        throw $e;
    }
}

/**
 * Clear user cart after successful payment
 */
function clearUserCart($userId) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("DELETE FROM cart WHERE user_id = ?");
        $stmt->execute([$userId]);

        $affectedRows = $stmt->rowCount();

        logSystemEvent('webhook_cart_cleared', 'User cart cleared after successful payment', [
            'user_id' => $userId,
            'items_removed' => $affectedRows
        ]);

    } catch (Exception $e) {
        logSystemEvent('webhook_cart_clear_error', 'Failed to clear user cart', [
            'user_id' => $userId,
            'error' => $e->getMessage()
        ]);
        // Don't throw - cart clearing failure shouldn't break the payment
    }
}

/**
 * Queue email notifications for orders
 */
function queueOrderEmails($orderIds) {
    foreach ($orderIds as $orderId) {
        // Queue customer confirmation email
        queueOrderConfirmationEmail($orderId);

        // Queue vendor notifications
        queueVendorEmailsForOrder($orderId);
    }
}

/**
 * Queue vendor emails for a specific order
 */
function queueVendorEmailsForOrder($orderId) {
    global $pdo;

    try {
        // Get all vendors for this order
        $stmt = $pdo->prepare("
            SELECT DISTINCT vendor_id
            FROM orders
            WHERE id = ? AND vendor_id IS NOT NULL
        ");
        $stmt->execute([$orderId]);
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($vendors as $vendor) {
            queueVendorOrderNotification($orderId, $vendor['vendor_id']);
        }

    } catch (Exception $e) {
        logSystemEvent('webhook_vendor_email_queue_error', 'Failed to queue vendor emails', [
            'order_id' => $orderId,
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * Update order payment status
 */
function updateOrderPaymentStatus($orderIds, $paymentReference, $status) {
    global $pdo;

    try {
        $placeholders = str_repeat('?,', count($orderIds) - 1) . '?';
        $stmt = $pdo->prepare("
            UPDATE orders
            SET payment_status = ?, updated_at = NOW()
            WHERE id IN ({$placeholders})
        ");

        $params = [$status];
        $params = array_merge($params, $orderIds);

        $stmt->execute($params);

        logSystemEvent('webhook_order_status_updated', 'Order payment status updated', [
            'order_ids' => $orderIds,
            'status' => $status,
            'payment_reference' => $paymentReference
        ]);

    } catch (Exception $e) {
        logSystemEvent('webhook_order_status_update_error', 'Failed to update order payment status', [
            'order_ids' => $orderIds,
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * Get pending checkout data for payment reference (with local development fallback)
 */
function getPendingCheckoutData($paymentReference) {
    global $pdo;

    // Check if checkout_sessions table exists (for backward compatibility)
    try {
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'checkout_sessions'");
        $tableExists = $tableCheck->fetch();

        if (!$tableExists) {
            logSystemEvent('webhook_no_checkout_table', 'checkout_sessions table does not exist - using fallback', [
                'payment_reference' => $paymentReference
            ]);
            return getCheckoutDataFromPayment($paymentReference);
        }
    } catch (Exception $e) {
        // Table doesn't exist or can't be checked
        return getCheckoutDataFromPayment($paymentReference);
    }

    try {
        $stmt = $pdo->prepare("
            SELECT checkout_data
            FROM checkout_sessions
            WHERE payment_reference = ? AND status = 'active' AND expires_at > NOW()
        ");
        $stmt->execute([$paymentReference]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($session) {
            $checkoutData = json_decode($session['checkout_data'], true);

            // Mark session as completed
            $updateStmt = $pdo->prepare("
                UPDATE checkout_sessions
                SET status = 'completed', updated_at = NOW()
                WHERE payment_reference = ?
            ");
            $updateStmt->execute([$paymentReference]);

            return $checkoutData;
        }

        logSystemEvent('webhook_no_checkout_session', 'No active checkout session found', [
            'payment_reference' => $paymentReference
        ]);

        return null;

    } catch (Exception $e) {
        logSystemEvent('webhook_checkout_data_error', 'Failed to retrieve checkout data', [
            'payment_reference' => $paymentReference,
            'error' => $e->getMessage()
        ]);
        return null;
    }
}

/**
 * Fallback: Get checkout data from payment transaction (for local development)
 * This recreates the checkout data from stored payment metadata
 */
function getCheckoutDataFromPayment($paymentReference) {
    global $pdo;

    try {
        // This is a fallback for when checkout_sessions table doesn't exist
        // In production, always use checkout_sessions table
        logSystemEvent('webhook_fallback_checkout', 'Using payment fallback for checkout data', [
            'payment_reference' => $paymentReference
        ]);

        // For now, return a basic structure - in real implementation,
        // you'd need to store this data in payment_transactions metadata
        // or reconstruct from order data

        return [
            'items' => [], // Would need to be stored in payment metadata
            'shipping_address' => 'From Payment Fallback',
            'contact_phone' => 'From Payment Fallback',
            'notes' => 'Webhook fallback processing',
            'payment_method' => 'card'
        ];

    } catch (Exception $e) {
        logSystemEvent('webhook_fallback_error', 'Payment fallback failed', [
            'payment_reference' => $paymentReference,
            'error' => $e->getMessage()
        ]);
        return null;
    }
}

/**
 * Handle failed charge events
 */
function handleChargeFailed($eventData) {
    $reference = $eventData['reference'] ?? '';

    // Update payment status to failed
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            UPDATE payment_transactions SET
                payment_status = 'failed',
                gateway_response = ?,
                updated_at = NOW()
            WHERE paystack_reference = ? OR transaction_reference = ?
        ");
        $stmt->execute([
            json_encode($eventData),
            $reference,
            $reference
        ]);

        logSystemEvent('webhook_charge_failed', 'Charge failed webhook processed', [
            'reference' => $reference
        ]);

    } catch (Exception $e) {
        logSystemEvent('webhook_charge_failed_error', 'Failed to process charge failed webhook', [
            'reference' => $reference,
            'error' => $e->getMessage()
        ]);
    }
}

/**
 * Handle transfer events (for future payout implementation)
 */
function handleTransferEvent($event, $eventData) {
    logSystemEvent('webhook_transfer_event', "Transfer event received: {$event}", [
        'event' => $event,
        'reference' => $eventData['reference'] ?? 'unknown'
    ]);
}
?>
