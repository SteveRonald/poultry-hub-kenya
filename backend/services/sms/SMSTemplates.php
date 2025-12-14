<?php
/**
 * SMS Templates
 * 
 * Manages SMS message templates for different scenarios
 */

class SMSTemplates {
    
    /**
     * Get order confirmation SMS for customer
     */
    public static function getOrderConfirmationCustomer($order) {
        $orderId = $order['id'] ?? 'N/A';
        $customerName = $order['customer_name'] ?? 'Customer';
        $totalAmount = number_format($order['total_amount'] ?? 0, 2);
        $productName = $order['product_name'] ?? 'product';
        $quantity = $order['quantity'] ?? 1;
        
        $message = "Hello {$customerName}, your order #{$orderId} has been confirmed. ";
        $message .= "Product: {$productName} x{$quantity}. ";
        $message .= "Total: KES {$totalAmount}. ";
        $message .= "Thank you for shopping with Poultry Hub Kenya!";
        
        return $message;
    }
    
    /**
     * Get order confirmation SMS for vendor
     */
    public static function getOrderConfirmationVendor($order) {
        $orderId = $order['id'] ?? 'N/A';
        $customerName = $order['customer_name'] ?? 'Customer';
        $productName = $order['product_name'] ?? 'product';
        $quantity = $order['quantity'] ?? 1;
        $totalAmount = number_format($order['total_amount'] ?? 0, 2);
        
        $message = "New order #{$orderId} received! ";
        $message .= "Customer: {$customerName}. ";
        $message .= "Product: {$productName} x{$quantity}. ";
        $message .= "Total: KES {$totalAmount}. ";
        $message .= "Please check your dashboard for details.";
        
        return $message;
    }
    
    /**
     * Get order status update SMS for customer
     */
    public static function getOrderStatusUpdateCustomer($order) {
        $orderId = $order['id'] ?? 'N/A';
        $customerName = $order['customer_name'] ?? 'Customer';
        $status = ucfirst($order['status'] ?? 'updated');
        
        $message = "Hello {$customerName}, your order #{$orderId} status has been updated to: {$status}. ";
        $message .= "Thank you for shopping with Poultry Hub Kenya!";
        
        return $message;
    }
    
    /**
     * Get order status update SMS for vendor
     */
    public static function getOrderStatusUpdateVendor($order) {
        $orderId = $order['id'] ?? 'N/A';
        $status = ucfirst($order['status'] ?? 'updated');
        
        $message = "Order #{$orderId} status updated to: {$status}. ";
        $message .= "Please check your dashboard for details.";
        
        return $message;
    }
    
    /**
     * Get delivery confirmation SMS for customer
     */
    public static function getDeliveryConfirmationCustomer($order) {
        $orderId = $order['id'] ?? 'N/A';
        $customerName = $order['customer_name'] ?? 'Customer';
        $totalAmount = number_format($order['total_amount'] ?? 0, 2);
        
        $message = "Hello {$customerName}, your order #{$orderId} has been delivered successfully! ";
        $message .= "Total: KES {$totalAmount}. ";
        $message .= "Thank you for shopping with KukuSoko! We hope to serve you again soon.";
        
        return $message;
    }
    
    /**
     * Get delivery confirmation SMS for vendor
     */
    public static function getDeliveryConfirmationVendor($order) {
        $orderId = $order['id'] ?? 'N/A';
        $totalAmount = number_format($order['total_amount'] ?? 0, 2);
        
        $message = "Order #{$orderId} has been marked as delivered. ";
        $message .= "Total: KES {$totalAmount}. ";
        $message .= "Payment will be processed according to your payment schedule.";
        
        return $message;
    }
    
    /**
     * Get custom SMS message
     */
    public static function getCustomMessage($template, $variables = []) {
        $message = $template;
        foreach ($variables as $key => $value) {
            $message = str_replace('{' . $key . '}', $value, $message);
        }
        return $message;
    }
}

