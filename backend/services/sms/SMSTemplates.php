<?php
/**
 * SMS Templates
 * 
 * Manages SMS message templates for different scenarios.
 *
 * Guidelines:
 * - Keep messages short and clear (transactional).
 * - Avoid special characters that can break GSM encoding where possible.
 * - Use consistent branding and formatting.
 */

class SMSTemplates {

    private const BRAND_NAME = 'Kukusoko(Kenya)';
    private const CURRENCY = 'KES';
    private const MAX_ITEMS_IN_LIST = 3;

    private static function safeString($value, $fallback) {
        $value = is_string($value) ? trim($value) : $value;
        return ($value === null || $value === '' || $value === false) ? $fallback : $value;
    }

    private static function formatMoney($amount) {
        $amount = is_numeric($amount) ? (float)$amount : 0.0;
        return number_format($amount, 2);
    }

    private static function oneLine($message) {
        $message = preg_replace("/\\s+/", " ", (string)$message);
        return trim($message);
    }

    private static function resolveOrderId($order) {
        return self::safeString(
            $order['order_id'] ?? $order['order_number'] ?? $order['id'] ?? null,
            'N/A'
        );
    }

    private static function resolveItemsList($order) {
        // Preferred: pre-built items string.
        if (isset($order['items_list']) && is_string($order['items_list']) && trim($order['items_list']) !== '') {
            return self::oneLine($order['items_list']);
        }

        // Optional: build from an array of order items.
        if (isset($order['items']) && is_array($order['items']) && !empty($order['items'])) {
            $parts = [];
            $count = 0;

            foreach ($order['items'] as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $name = self::safeString($item['product_name'] ?? null, null);
                if ($name === null) {
                    continue;
                }

                $qty = (int)($item['quantity'] ?? 1);
                $parts[] = "{$name} x{$qty}";
                $count++;

                if ($count >= self::MAX_ITEMS_IN_LIST) {
                    break;
                }
            }

            $remaining = count($order['items']) - $count;
            if ($remaining > 0) {
                $parts[] = "+{$remaining} more";
            }

            $list = implode(', ', $parts);
            // Hard safety cap to avoid overly long SMS.
            if (strlen($list) > 160) {
                $list = substr($list, 0, 157) . '...';
            }

            return self::oneLine($list);
        }

        // Fallback: single item fields.
        $productName = self::safeString($order['product_name'] ?? null, 'items');
        $quantity = (int)($order['quantity'] ?? 1);
        return self::oneLine("{$productName} x{$quantity}");
    }
    
    /**
     * Customer: order placed/received.
     */
    public static function getOrderConfirmationCustomer($order) {
        $orderId = self::resolveOrderId($order);
        $customerName = self::safeString($order['customer_name'] ?? null, 'Customer');
        $totalAmount = self::formatMoney($order['total_amount'] ?? 0);
        $itemsList = self::resolveItemsList($order);

        $deliveryFeeText = '';
        if (array_key_exists('delivery_fee', $order)) {
            $deliveryFee = self::formatMoney($order['delivery_fee'] ?? 0);
            $deliveryFeeText = " (delivery fee " . self::CURRENCY . " {$deliveryFee})";
        }

        $message = "Hello {$customerName}, your order {$orderId} from " . self::BRAND_NAME . " has been placed successfully. ";
        $message .= "Items: {$itemsList}. ";
        $message .= "Total paid: " . self::CURRENCY . " {$totalAmount}{$deliveryFeeText}. ";
        $message .= "We will notify you when your order status changes.";

        return self::oneLine($message);
    }
    
    /**
     * Vendor: new order received.
     */
    public static function getOrderConfirmationVendor($order) {
        $orderId = self::resolveOrderId($order);
        $vendorName = self::safeString($order['vendor_name'] ?? null, 'Vendor');
        $itemsList = self::resolveItemsList($order);

        $message = "Hello {$vendorName}, you have received a new order {$orderId} from " . self::BRAND_NAME . ". ";
        $message .= "Items: {$itemsList}. ";
        $message .= "Please prepare for pickup/delivery.";

        return self::oneLine($message);
    }
    
    /**
     * Customer: order status update.
     */
    public static function getOrderStatusUpdateCustomer($order) {
        $orderId = self::resolveOrderId($order);
        $customerName = self::safeString($order['customer_name'] ?? null, 'Customer');
        $status = self::safeString($order['status'] ?? null, 'updated');
        $status = ucfirst(strtolower($status));

        $message = "Hello {$customerName}, your order {$orderId} status has been updated to: {$status}. ";
        $message .= "Thank you for shopping with " . self::BRAND_NAME . ".";

        return self::oneLine($message);
    }
    
    /**
     * Vendor: order status update.
     */
    public static function getOrderStatusUpdateVendor($order) {
        $orderId = self::resolveOrderId($order);
        $vendorName = self::safeString($order['vendor_name'] ?? null, 'Vendor');
        $status = self::safeString($order['status'] ?? null, 'updated');
        $status = ucfirst(strtolower($status));

        $message = "Hello {$vendorName}, order {$orderId} updated to '{$status}'.";

        return self::oneLine($message);
    }
    
    /**
     * Customer: delivery confirmation.
     */
    public static function getDeliveryConfirmationCustomer($order) {
        $orderId = self::resolveOrderId($order);
        $customerName = self::safeString($order['customer_name'] ?? null, 'Customer');
        $totalAmount = self::formatMoney($order['total_amount'] ?? 0);
        $shippingAddress = self::safeString($order['shipping_address'] ?? null, '');

        $pickupText = '';
        if ($shippingAddress !== '') {
            // Checkout stores pickup stations like: "Pickup at: NAME - ADDRESS"
            if (stripos($shippingAddress, 'pickup at:') === 0) {
                $pickupText = " Please pick your order at {$shippingAddress}.";
            } else {
                $pickupText = " Delivery/pickup: {$shippingAddress}.";
            }
        }

        $message = "Hello {$customerName}, your order {$orderId} has been delivered. ";
        $message .= "Total: " . self::CURRENCY . " {$totalAmount}. ";
        $message .= trim($pickupText) . " Thank you for choosing " . self::BRAND_NAME . "!";

        return self::oneLine($message);
    }
    
    /**
     * Vendor: delivery confirmation.
     */
    public static function getDeliveryConfirmationVendor($order) {
        $orderId = self::resolveOrderId($order);
        $vendorName = self::safeString($order['vendor_name'] ?? null, 'Vendor');
        $totalAmount = self::formatMoney($order['total_amount'] ?? 0);

        $message = "Hello {$vendorName}, order {$orderId} delivered. ";
        $message .= "Total: " . self::CURRENCY . " {$totalAmount}. ";
        $message .= self::BRAND_NAME . ".";

        return self::oneLine($message);
    }
    
    /**
     * Get custom SMS message
     */
    public static function getCustomMessage($template, $variables = []) {
        $message = $template;
        foreach ($variables as $key => $value) {
            $message = str_replace('{' . $key . '}', $value, $message);
        }
        return self::oneLine($message);
    }
}
