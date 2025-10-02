<?php

function getEmailTemplate($type, $data = []) {
    $baseUrl = 'http://localhost/poultry-hub-kenya';
    
    switch ($type) {
        case 'order_confirmation':
            return getOrderConfirmationTemplate($data, $baseUrl);
        case 'order_status_update':
            return getOrderStatusUpdateTemplate($data, $baseUrl);
        case 'vendor_notification':
            return getVendorNotificationTemplate($data, $baseUrl);
        case 'admin_notification':
            return getAdminNotificationTemplate($data, $baseUrl);
        case 'otp_email':
            return getOTPEmailTemplate($data, $baseUrl);
        default:
            return getDefaultTemplate($data, $baseUrl);
    }
}

function getBaseTemplate($title, $content, $baseUrl) {
    return "
    <!DOCTYPE html>
    <html lang='en'>
    <head>
        <meta charset='UTF-8'>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'>
        <title>$title</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f8f9fa;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #2c5530 0%, #4a7c59 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
            }
            .header p {
                margin: 10px 0 0 0;
                opacity: 0.9;
                font-size: 16px;
            }
            .content {
                padding: 30px 20px;
            }
            .order-details {
                background-color: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
                border-left: 4px solid #2c5530;
            }
            .order-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 0;
                border-bottom: 1px solid #e9ecef;
            }
            .order-item:last-child {
                border-bottom: none;
            }
            .item-name {
                font-weight: 600;
                color: #2c5530;
            }
            .item-details {
                font-size: 14px;
                color: #6c757d;
            }
            .total-section {
                background-color: #2c5530;
                color: white;
                padding: 20px;
                border-radius: 6px;
                margin: 20px 0;
                text-align: center;
            }
            .total-amount {
                font-size: 24px;
                font-weight: bold;
                margin: 10px 0;
            }
            .status-badge {
                display: inline-block;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .status-pending {
                background-color: #fff3cd;
                color: #856404;
            }
            .status-confirmed {
                background-color: #d1ecf1;
                color: #0c5460;
            }
            .status-processing {
                background-color: #e2e3f1;
                color: #383d41;
            }
            .status-shipped {
                background-color: #cce5ff;
                color: #004085;
            }
            .status-delivered {
                background-color: #d4edda;
                color: #155724;
            }
            .status-cancelled {
                background-color: #f8d7da;
                color: #721c24;
            }
            .info-section {
                background-color: #f8f9fa;
                border-radius: 6px;
                padding: 20px;
                margin: 20px 0;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                margin: 10px 0;
                padding: 8px 0;
                border-bottom: 1px solid #e9ecef;
            }
            .info-row:last-child {
                border-bottom: none;
            }
            .info-label {
                font-weight: 600;
                color: #2c5530;
            }
            .info-value {
                color: #495057;
            }
            .footer {
                background-color: #2c5530;
                color: white;
                padding: 20px;
                text-align: center;
                font-size: 14px;
            }
            .footer a {
                color: #ffffff;
                text-decoration: none;
            }
            .footer a:hover {
                text-decoration: underline;
            }
            .button {
                display: inline-block;
                background-color: #2c5530;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 20px 0;
            }
            .button:hover {
                background-color: #1e3a21;
            }
            .highlight {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 4px;
                padding: 15px;
                margin: 15px 0;
            }
            .warning {
                background-color: #f8d7da;
                border: 1px solid #f5c6cb;
                border-radius: 4px;
                padding: 15px;
                margin: 15px 0;
                color: #721c24;
            }
            .success {
                background-color: #d4edda;
                border: 1px solid #c3e6cb;
                border-radius: 4px;
                padding: 15px;
                margin: 15px 0;
                color: #155724;
            }
        </style>
    </head>
    <body>
        <div class='container'>
            <div class='header'>
                <h1>🐔 Poultry Hub Kenya</h1>
                <p>Your Trusted Poultry Partner</p>
            </div>
            <div class='content'>
                $content
            </div>
            <div class='footer'>
                <p>© 2025 Poultry Hub Kenya. All rights reserved.</p>
                <p>Visit us at <a href='$baseUrl'>$baseUrl</a></p>
                <p>For support, contact us at support@poultryhubkenya.com</p>
            </div>
        </div>
    </body>
    </html>
    ";
}

function getOrderConfirmationTemplate($data, $baseUrl) {
    $order = $data['order '];
    $customer = $data['customer '];
    
    $statusClass = 'status-' . strtolower($order['status']);
    $statusBadge = "<span class='status-badge $statusClass'>" . ucfirst($order['status']) . "</span>";
    
    $itemsHtml = '';
    if (isset($order['items']) && is_array($order['items'])) {
        foreach ($order['items'] as $item) {
            $itemsHtml .= "
                <div class='order-item'>
                    <div>
                        <div class='item-name'>{$item['product_name ']}</div>
                        <div class='item-details'>Vendor: {$item['vendor_name ']}</div>
                    </div>
                    <div style='text-align: right;'>
                        <div>Qty: {$item['quantity']}</div>
                        <div>KSH " . number_format($item['total_amount '], 2) . "</div>
                    </div>
                </div>
            ";
        }
    }
    
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>Order Confirmation</h2>
        <p>Dear {$customer['name']},</p>
        <p>Thank you for your order! We have received your order and it is being processed.</p>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Order Details</h3>
            <div class='info-row'>
                <span class='info-label'>Order Number: </span>
                <span class='info-value'>#{$order['order_number']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Order Date: </span>
                <span class='info-value'>" . date('F j, Y \a\t g:i A', strtotime($order['created_at'])) . "</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Status: </span>
                <span class='info-value'>$statusBadge</span>
            </div>
        </div>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Order Items</h3>
            $itemsHtml
        </div>
        
        <div class='total-section'>
            <div>Total Amount </div>
            <div class='total-amount'>KSH " . number_format($order['total_amount'], 2) . "</div>
        </div>
        
        <div class='info-section'>
            <h3 style='color: #2c5530; margin-top: 0;'>Shipping Information</h3>
            <div class='info-row'>
                <span class='info-label'>Address:</span>
                <span class='info-value'>{$order['shipping_address']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Contact Phone:</span>
                <span class='info-value'>{$order['contact_phone']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Payment Method: </span>
                <span class='info-value'>" . ucfirst($order[' payment_method']) . "</span>
            </div>
        </div>
        
        <div class='highlight'>
            <strong>📋 What's Next?</strong><br>
            • Your order is being reviewed by our team<br>
            • You will receive updates as your order progresses<br>
            • You can track your order status in your dashboard
        </div>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='$baseUrl/dashboard' class='button'>View Order Details</a>
        </div>
        
        <p>If you have any questions about your order, please don't hesitate to contact us.</p>
        <p>Thank you for choosing Poultry Hub Kenya!</p>
    ";
    
    return getBaseTemplate('Order Confirmation - Poultry Hub Kenya', $content, $baseUrl);
}

function getOrderStatusUpdateTemplate($data, $baseUrl) {
    $order = $data['order'];
    $customer = $data['customer'];
    $oldStatus = $data['old_status'] ?? 'pending';
    $newStatus = $order['status'];
    
    $statusClass = 'status-' . strtolower($newStatus);
    $statusBadge = "<span class='status-badge $statusClass'>" . ucfirst($newStatus) . "</span>";
    
    $statusMessages = [
        'confirmed' => 'Your order has been confirmed and is being prepared.',
        'processing' => 'Your order is being processed and prepared for shipping.',
        'shipped' => 'Your order has been shipped and is on its way to you.',
        'delivered' => 'Your order has been delivered successfully.',
        'cancelled' => 'Your order has been cancelled.'
    ];
    
    $statusMessage = $statusMessages[$newStatus] ?? 'Your order status has been updated.';
    
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>Order Status Update</h2>
        <p>Dear {$customer['name']},</p>
        <p>We have an update regarding your order #{$order['order_number']}.</p>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Status Update</h3>
            <div class='info-row'>
                <span class='info-label'>Order Number:</span>
                <span class='info-value'>#{$order['order_number']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Previous Status:</span>
                <span class='info-value'>" . ucfirst($oldStatus) . "</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>New Status:</span>
                <span class='info-value'>$statusBadge</span>
            </div>
        </div>
        
        <div class='success'>
            <strong>✅ $statusMessage</strong>
        </div>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='$baseUrl/dashboard' class='button'>View Order Details</a>
        </div>
        
        <p>Thank you for your patience and for choosing Poultry Hub Kenya!</p>
    ";
    
    return getBaseTemplate('Order Status Update - Poultry Hub Kenya', $content, $baseUrl);
}

function getVendorNotificationTemplate($data, $baseUrl) {
    $order = $data['order'];
    $vendor = $data['vendor'];
    
    // Build items HTML for vendor's products only
    $itemsHtml = '';
    $totalAmount = 0;
    if (isset($order['items']) && is_array($order['items'])) {
        foreach ($order['items'] as $item) {
            $itemsHtml .= "
                <div class='order-item'>
                    <div>
                        <div class='item-name'>{$item['product_name']}</div>
                        <div class='item-details'>Quantity: {$item['quantity']}</div>
                    </div>
                    <div style='text-align: right;'>
                        <div>Unit Price: KSH " . number_format($item['unit_price'], 2) . "</div>
                        <div>Total: KSH " . number_format($item['total_amount'], 2) . "</div>
                    </div>
                </div>
            ";
            $totalAmount += $item['total_amount'];
        }
    }
    
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>New Order Received</h2>
        <p>Dear {$vendor['name']},</p>
        <p>You have received a new order for your products!</p>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Order Information</h3>
            <div class='info-row'>
                <span class='info-label'>Order Number:</span>
                <span class='info-value'>#{$order['order_number']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Customer:</span>
                <span class='info-value'>{$order['customer_name']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Order Date:</span>
                <span class='info-value'>" . date('F j, Y \a\t g:i A', strtotime($order['created_at'])) . "</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Shipping Address:</span>
                <span class='info-value'>{$order['shipping_address']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Contact Phone:</span>
                <span class='info-value'>{$order['contact_phone']}</span>
            </div>
        </div>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Order Items</h3>
            $itemsHtml
        </div>
        
        <div class='total-section'>
            <div>Total Amount for Your Products</div>
            <div class='total-amount'>KSH " . number_format($totalAmount, 2) . "</div>
        </div>
        
        <div class='highlight'>
            <strong>📋 Action Required:</strong><br>
            • Please review the order details in your vendor dashboard<br>
            • Confirm the order and update its status<br>
            • Prepare the items for shipping
        </div>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='$baseUrl/vendor-dashboard' class='button'>View Order in Dashboard</a>
        </div>
        
        <p>Thank you for being part of Poultry Hub Kenya!</p>
    ";
    
    return getBaseTemplate('New Order - Poultry Hub Kenya', $content, $baseUrl);
}

function getAdminNotificationTemplate($data, $baseUrl) {
    $order = $data['order'];
    
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>New Order Notification</h2>
        <p>Dear Admin,</p>
        <p>A new order has been placed on the platform.</p>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Order Summary</h3>
            <div class='info-row'>
                <span class='info-label'>Order Number:</span>
                <span class='info-value'>#{$order['order_number']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Customer:</span>
                <span class='info-value'>{$order['customer_name']}</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Total Amount:</span>
                <span class='info-value'>KSH " . number_format($order['total_amount'], 2) . "</span>
            </div>
            <div class='info-row'>
                <span class='info-label'>Order Date:</span>
                <span class='info-value'>" . date('F j, Y \a\t g:i A', strtotime($order['created_at'])) . "</span>
            </div>
        </div>
        
        <div style='text-align: center; margin: 30px 0;'>
            <a href='$baseUrl/admin-dashboard' class='button'>View Order in Admin Dashboard</a>
        </div>
        
        <p>Please monitor the order processing and ensure timely delivery.</p>
    ";
    
    return getBaseTemplate('New Order Alert - Poultry Hub Kenya', $content, $baseUrl);
}

function getOTPEmailTemplate($data, $baseUrl) {
    $otp = $data['otp'];
    $userName = $data['user_name'] ?? 'User';
    
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>Password Reset Request</h2>
        <p>Dear $userName,</p>
        <p>You have requested to reset your password for your Poultry Hub Kenya account.</p>
        
        <div class='order-details'>
            <h3 style='color: #2c5530; margin-top: 0;'>Your OTP Code</h3>
            <div style='text-align: center; margin: 20px 0;'>
                <div style='background-color: #2c5530; color: white; padding: 20px; border-radius: 8px; display: inline-block;'>
                    <div style='font-size: 32px; font-weight: bold; letter-spacing: 8px;'>$otp</div>
                </div>
            </div>
        </div>
        
        <div class='warning'>
            <strong>⚠️ Important Security Information:</strong><br>
            • This OTP code will expire in 10 minutes<br>
            • Do not share this code with anyone<br>
            • If you did not request this password reset, please ignore this email<br>
            • Our team will never ask for your OTP code
        </div>
        
        <div class='highlight'>
            <strong>🔐 How to use this OTP:</strong><br>
            1. Go to the password reset page<br>
            2. Enter your email address<br>
            3. Enter the OTP code above<br>
            4. Create your new password
        </div>
        
        <p>If you have any questions or need assistance, please contact our support team.</p>
        <p>Thank you for choosing Poultry Hub Kenya!</p>
    ";
    
    return getBaseTemplate('Password Reset OTP - Poultry Hub Kenya', $content, $baseUrl);
}

function getDefaultTemplate($data, $baseUrl) {
    $content = "
        <h2 style='color: #2c5530; margin-top: 0;'>Notification from Poultry Hub Kenya</h2>
        <p>Hello,</p>
        <p>This is a notification from Poultry Hub Kenya.</p>
        <p>Thank you for using our platform!</p>
    ";
    
    return getBaseTemplate('Notification - Poultry Hub Kenya', $content, $baseUrl);
}

?>
