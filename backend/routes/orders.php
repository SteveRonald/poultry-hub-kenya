<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../utils/auth.php';

function handleCreateOrder() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Check if this is a direct order or cart-based order
    $isDirectOrder = isset($input['product_id']) && isset($input['quantity']);
    
    // All orders require checkout form data
    $required_fields = ['shipping_address', 'contact_phone', 'payment_method'];
    if ($isDirectOrder) {
        $required_fields[] = 'product_id';
        $required_fields[] = 'quantity';
    }
    
    // Validate required fields
    foreach ($required_fields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            http_response_code(400);
            echo json_encode(['error' => "Missing required field: $field"]);
            return;
        }
    }
    
    try {
        $pdo->beginTransaction();
        
        if ($isDirectOrder) {
            // Handle direct single-product order
            $productId = $input['product_id'];
            $quantity = (int)$input['quantity'];
            
            // Get product details
            $stmt = $pdo->prepare("
                SELECT 
                    p.id as product_id,
                    p.name as product_name,
                    p.price,
                    p.stock_quantity,
                    p.vendor_id,
                    u.full_name as vendor_name,
                    u.email as vendor_email
                FROM products p
                JOIN vendors v ON p.vendor_id = v.id
                JOIN user_profiles u ON v.user_id = u.id
                WHERE p.id = ? AND p.is_active = 1
            ");
            
            $stmt->execute([$productId]);
            $product = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$product) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                http_response_code(404);
                echo json_encode(['error' => 'Product not found or not available']);
                return;
            }
            
            // Check stock
            if ($product['stock_quantity'] < $quantity) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                http_response_code(400);
                echo json_encode(['error' => 'Insufficient stock']);
                return;
            }
            
            $orderItems = [[
                'product_id' => $product['product_id'],
                'product_name' => $product['product_name'],
                'price' => $product['price'],
                'vendor_id' => $product['vendor_id'],
                'vendor_name' => $product['vendor_name'],
                'vendor_email' => $product['vendor_email'],
                'quantity' => $quantity
            ]];
        } else {
            // Handle cart-based order
            $stmt = $pdo->prepare("
                SELECT 
                    c.id as cart_id,
                    c.quantity,
                    p.id as product_id,
                    p.name as product_name,
                    p.price,
                    p.stock_quantity,
                    p.vendor_id,
                    u.full_name as vendor_name,
                    u.email as vendor_email
                FROM cart c
                JOIN products p ON c.product_id = p.id
                JOIN vendors v ON p.vendor_id = v.id
                JOIN user_profiles u ON v.user_id = u.id
                WHERE c.user_id = ? AND p.is_active = 1
            ");
            
            $stmt->execute([$payload['user_id']]);
            $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (empty($cartItems)) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                http_response_code(400);
                echo json_encode(['error' => 'Cart is empty']);
                return;
            }
            
            // Check stock for all items
            foreach ($cartItems as $item) {
                if ($item['stock_quantity'] < $item['quantity']) {
                    if ($pdo->inTransaction()) {
                        $pdo->rollBack();
                    }
                    http_response_code(400);
                    echo json_encode(['error' => "Insufficient stock for {$item['product_name']}"]);
                    return;
                }
            }
            
            $orderItems = $cartItems;
        }
        
        // Generate order number
        $orderNumber = 'ORD-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
        
        // Get customer details from database
        $stmt = $pdo->prepare("SELECT full_name, email FROM user_profiles WHERE id = ?");
        $stmt->execute([$payload['user_id']]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $createdOrders = [];
        
        // Create one order record for each product
        foreach ($orderItems as $item) {
            $totalAmount = $item['price'] * $item['quantity'];
            
            // Check if order came from an advertisement (via session/cookie)
            // SECURITY: Sanitize and validate cookie value to prevent injection
            $advertisementId = null;
            if (isset($input['advertisement_id'])) {
                $advertisementId = filter_var($input['advertisement_id'], FILTER_SANITIZE_STRING);
                // Validate it's alphanumeric or UUID format
                if (!preg_match('/^[a-zA-Z0-9_-]+$/', $advertisementId)) {
                    $advertisementId = null;
                }
            } elseif (isset($_COOKIE['ad_click'])) {
                $cookieValue = filter_var($_COOKIE['ad_click'], FILTER_SANITIZE_STRING);
                // Validate cookie value format (alphanumeric, UUID, or similar safe format)
                if (preg_match('/^[a-zA-Z0-9_-]+$/', $cookieValue)) {
                    $advertisementId = $cookieValue;
                }
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    order_number, user_id, product_id, quantity, vendor_id, total_amount, 
                    shipping_address, contact_phone, payment_method, notes, order_type, advertisement_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $orderType = $isDirectOrder ? 'direct' : 'cart';
            
            $stmt->execute([
                $orderNumber,
                $payload['user_id'],
                $item['product_id'],
                $item['quantity'],
                $item['vendor_id'],
                $totalAmount,
                $input['shipping_address'],
                $input['contact_phone'],
                $input['payment_method'],
                $input['notes'] ?? null,
                $orderType,
                $advertisementId
            ]);
            
            $orderId = $pdo->lastInsertId();
            
            // Get the actual created_at timestamp from database to ensure timezone consistency
            $stmt = $pdo->prepare("SELECT created_at FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            $orderRecord = $stmt->fetch(PDO::FETCH_ASSOC);
            $orderCreatedAt = $orderRecord['created_at'] ?? date('Y-m-d H:i:s');
            
            // Update product stock
            $stmt = $pdo->prepare("
                UPDATE products 
                SET stock_quantity = stock_quantity - ? 
                WHERE id = ?
            ");
            $stmt->execute([$item['quantity'], $item['product_id']]);
            
            $createdOrders[] = [
                'order_id' => $orderId,
                'order_number' => $orderNumber,
                'product_id' => $item['product_id'],
                'product_name' => $item['product_name'],
                'quantity' => $item['quantity'],
                'unit_price' => $item['price'],
                'product_price' => $item['price'], // Add this for email template
                'total_amount' => $totalAmount,
                'vendor_id' => $item['vendor_id'],
                'vendor_name' => $item['vendor_name'],
                'vendor_email' => $item['vendor_email'],
                'customer_name' => $customer['full_name'] ?? 'Customer', // Add customer name
                'customer_email' => $customer['email'] ?? '', // Add customer email
                'created_at' => $orderCreatedAt, // Use actual database timestamp
                'shipping_address' => $input['shipping_address'],
                'contact_phone' => $input['contact_phone'],
                'payment_method' => $input['payment_method']
            ];
        }
        
        // Clear cart if it was a cart order
        if (!$isDirectOrder) {
            $stmt = $pdo->prepare("DELETE FROM cart WHERE user_id = ?");
            $stmt->execute([$payload['user_id']]);
        }
        
        $pdo->commit();

        // Track email sending status separately
        $customerEmailSent = false;
        $vendorEmailsSent = [];
        $emailErrors = [];

        // Send notification emails to vendors (best-effort, don't fail order)
        $vendorEmails = [];
        foreach ($createdOrders as $order) {
            if (!isset($vendorEmails[$order['vendor_id']])) {
                $vendorEmails[$order['vendor_id']] = [
                    'email' => $order['vendor_email'],
                    'name' => $order['vendor_name'],
                    'orders' => []
                ];
            }
            $vendorEmails[$order['vendor_id']]['orders'][] = $order;
        }

        foreach ($vendorEmails as $vendorId => $vendorData) {
            try {
                // Prepare items for this vendor
                $vendorItems = [];
                foreach ($vendorData['orders'] as $order) {
                    $vendorItems[] = [
                        'product_name' => $order['product_name'],
                        'quantity' => $order['quantity'],
                        'unit_price' => $order['product_price'],
                        'total_amount' => $order['total_amount']
                    ];
                }

                $vendorEmailData = [
                    'order' => [
                        'order_number' => $orderNumber,
                        'customer_name' => $vendorData['orders'][0]['customer_name'],
                        'created_at' => $vendorData['orders'][0]['created_at'],
                        'shipping_address' => $vendorData['orders'][0]['shipping_address'],
                        'contact_phone' => $vendorData['orders'][0]['contact_phone'],
                        'items' => $vendorItems
                    ],
                    'vendor' => [
                        'name' => $vendorData['name']
                    ]
                ];

                sendStyledEmail($vendorData['email'], 'vendor_notification', $vendorEmailData);
                $vendorEmailsSent[$vendorId] = true;
            } catch (Exception $vendorEmailError) {
                $vendorEmailsSent[$vendorId] = false;
                error_log("Failed to send email to vendor {$vendorId}: " . $vendorEmailError->getMessage());
                // Don't add to emailErrors - we don't want to show this to customer
            }
        }

        // Send order confirmation email to customer
        try {
            $customerEmailData = [
                'order' => [
                    'order_number' => $orderNumber,
                    'status' => 'pending',
                    'total_amount' => array_sum(array_column($createdOrders, 'total_amount')),
                    'shipping_address' => $createdOrders[0]['shipping_address'],
                    'contact_phone' => $createdOrders[0]['contact_phone'],
                    'payment_method' => $createdOrders[0]['payment_method'],
                    'created_at' => $createdOrders[0]['created_at'],
                    'items' => []
                ],
                'customer' => [
                    'name' => $createdOrders[0]['customer_name'] ?? $customer['full_name'] ?? 'Customer',
                    'email' => $createdOrders[0]['customer_email'] ?? $customer['email'] ?? ''
                ]
            ];

            // Add items to customer email data
            foreach ($createdOrders as $order) {
                $customerEmailData['order']['items'][] = [
                    'product_name' => $order['product_name'],
                    'quantity' => $order['quantity'],
                    'total_amount' => $order['total_amount'],
                    'vendor_name' => $order['vendor_name']
                ];
            }

            // Check if customer email is valid
            $customerEmail = $createdOrders[0]['customer_email'] ?? $customer['email'] ?? '';
            if (empty($customerEmail)) {
                throw new Exception('Customer email is empty or not found');
            }
            
            // Update customer email in email data if needed
            if (empty($customerEmailData['customer']['email'])) {
                $customerEmailData['customer']['email'] = $customerEmail;
            }
            
            // Attempt to send email
            $emailResult = sendStyledEmail($customerEmail, 'order_confirmation', $customerEmailData);
            
            if ($emailResult) {
                $customerEmailSent = true;
                error_log("Customer email sent successfully to: " . $customerEmail);
            } else {
                throw new Exception('Email sending returned false');
            }
        } catch (Exception $customerEmailError) {
            $customerEmailSent = false;
            $customerEmailForLog = $createdOrders[0]['customer_email'] ?? $customer['email'] ?? 'unknown';
            error_log("=== EMAIL SEND FAILURE ===");
            error_log("Customer email: {$customerEmailForLog}");
            error_log("Error message: " . $customerEmailError->getMessage());
            error_log("Stack trace: " . $customerEmailError->getTraceAsString());
            $emailErrors[] = 'Failed to send confirmation email';
        }

        // Create notifications for vendors and admins (best-effort)
        try {
            require_once __DIR__ . '/../utils/notifications.php';

            // Notify vendors about new orders
            foreach ($vendorEmails as $vendorId => $vendorData) {
                $itemsCountForVendor = count($vendorData['orders']);
                $message = "You have received a new order #{$orderNumber} with {$itemsCountForVendor} item(s). Please check your vendor dashboard.";
                notifyVendor($vendorId, $message, 'order');
            }

            // Notify all admins about new orders
            $totalItems = count($createdOrders);
            $adminMessage = "New order #{$orderNumber} has been placed with {$totalItems} item(s). Total amount: KSH " . number_format(array_sum(array_column($createdOrders, 'total_amount')), 2);
            notifyAllAdmins($adminMessage, 'order');
        } catch (Exception $notificationError) {
            error_log('Order created but notifications failed: ' . $notificationError->getMessage());
        }
        
        // Send SMS notifications (best-effort, don't fail order)
        try {
            require_once __DIR__ . '/../services/sms/SMSService.php';
            require_once __DIR__ . '/../services/sms/SMSTemplates.php';
            
            $smsService = new SMSService();
            
            // Send SMS to customer
            $customerPhone = $input['contact_phone'] ?? null;
            error_log("SMS Order Creation: Customer phone from input: " . ($customerPhone ?? 'NULL'));
            
            if ($customerPhone) {
                $customerSMSMessage = SMSTemplates::getOrderConfirmationCustomer([
                    'id' => $orderNumber,
                    'customer_name' => $createdOrders[0]['customer_name'] ?? 'Customer',
                    'total_amount' => array_sum(array_column($createdOrders, 'total_amount')),
                    'product_name' => count($createdOrders) > 1 ? count($createdOrders) . ' items' : $createdOrders[0]['product_name'],
                    'quantity' => array_sum(array_column($createdOrders, 'quantity'))
                ]);
                
                error_log("SMS Order Creation: Attempting to send SMS to: {$customerPhone}");
                error_log("SMS Order Creation: Message: " . substr($customerSMSMessage, 0, 100) . "...");
                
                $smsResult = $smsService->sendSMS($customerPhone, $customerSMSMessage, [
                    'recipient_type' => 'customer',
                    'related_order_id' => $createdOrders[0]['order_id'] ?? null,
                    'related_user_id' => $payload['user_id']
                ]);
                
                error_log("SMS Order Creation: SMS result: " . json_encode($smsResult));
            } else {
                error_log("SMS Order Creation: WARNING - No customer phone number provided in order!");
            }
            
            // Send SMS to each vendor
            foreach ($vendorEmails as $vendorId => $vendorData) {
                // Get vendor phone number
                $stmt = $pdo->prepare("SELECT phone FROM vendors WHERE id = ?");
                $stmt->execute([$vendorId]);
                $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($vendor && !empty($vendor['phone'])) {
                    $vendorOrder = $vendorData['orders'][0];
                    $vendorSMSMessage = SMSTemplates::getOrderConfirmationVendor([
                        'id' => $orderNumber,
                        'customer_name' => $vendorOrder['customer_name'] ?? 'Customer',
                        'product_name' => count($vendorData['orders']) > 1 ? count($vendorData['orders']) . ' items' : $vendorOrder['product_name'],
                        'quantity' => array_sum(array_column($vendorData['orders'], 'quantity')),
                        'total_amount' => array_sum(array_column($vendorData['orders'], 'total_amount'))
                    ]);
                    
                    $smsService->sendSMS($vendor['phone'], $vendorSMSMessage, [
                        'recipient_type' => 'vendor',
                        'related_order_id' => $vendorOrder['order_id'] ?? null,
                        'related_user_id' => $vendorId
                    ]);
                }
            }
        } catch (Exception $smsError) {
            error_log('Order created but SMS sending failed: ' . $smsError->getMessage());
            // Don't fail the order if SMS fails
        }
        
        // Determine response message based on email status
        $ordersCount = count($createdOrders);
        $ordersText = $ordersCount === 1 ? 'order' : 'orders';
        
        if (!$customerEmailSent) {
            $responseMessage = "Order sent successfully! {$ordersCount} {$ordersText} placed. However, we could not send the confirmation email. Please check your order in your dashboard.";
        } else {
            $responseMessage = "Orders created successfully! {$ordersCount} {$ordersText} placed.";
        }
        
        // Always return success if order was created, regardless of email status
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $responseMessage,
            'order_number' => $orderNumber,
            'orders' => $createdOrders,
            'total_items' => $ordersCount,
            'total_orders' => $ordersCount, // Add this for compatibility
            'customer_email_sent' => $customerEmailSent
        ]);
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create order: ' . $e->getMessage()]);
    }
}

function handleGetOrders() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT 
                o.id,
                o.order_number,
                o.product_id,
                o.quantity,
                o.total_amount,
                o.status,
                o.shipping_address,
                o.contact_phone,
                o.payment_method,
                o.payment_status,
                o.notes,
                o.order_type,
                o.created_at,
                o.last_status_updated,
                p.name as product_name,
                p.price as unit_price,
                u.full_name as vendor_name,
                u.phone as vendor_phone,
                u.email as vendor_email
            FROM orders o
            JOIN products p ON o.product_id = p.id
            JOIN vendors v ON o.vendor_id = v.id
            JOIN user_profiles u ON v.user_id = u.id
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
        ");
        
        $stmt->execute([$payload['user_id']]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Group orders by order_number
        $groupedOrders = [];
        foreach ($orders as $order) {
            $orderNumber = $order['order_number'];
            if (!isset($groupedOrders[$orderNumber])) {
                $groupedOrders[$orderNumber] = [
                    'order_number' => $orderNumber,
                    'status' => $order['status'],
                    'shipping_address' => $order['shipping_address'],
                    'contact_phone' => $order['contact_phone'],
                    'payment_method' => $order['payment_method'],
                    'payment_status' => $order['payment_status'],
                    'order_type' => $order['order_type'],
                    'created_at' => $order['created_at'],
                    'last_status_updated' => $order['last_status_updated'],
                    'items' => [],
                    'total_amount' => 0
                ];
            }
            
            $groupedOrders[$orderNumber]['items'][] = [
                'order_id' => $order['id'],
                'product_id' => $order['product_id'],
                'product_name' => $order['product_name'],
                'quantity' => $order['quantity'],
                'unit_price' => $order['unit_price'],
                'total_amount' => $order['total_amount'],
                'vendor_name' => $order['vendor_name'],
                'vendor_phone' => $order['vendor_phone'],
                'vendor_email' => $order['vendor_email']
            ];
            
            $groupedOrders[$orderNumber]['total_amount'] += $order['total_amount'];
        }
        
        echo json_encode([
            'success' => true,
            'orders' => array_values($groupedOrders)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch orders: ' . $e->getMessage()]);
    }
}

function handleUpdateOrderStatus() {
    global $pdo;
    
    // Include commission utilities
    require_once __DIR__ . '/../utils/commission.php';
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['order_id']) || !isset($input['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields: order_id, status']);
        return;
    }
    
    $validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!in_array($input['status'], $validStatuses)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid status']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Update order status
        $stmt = $pdo->prepare("
            UPDATE orders 
            SET status = ?, status_notes = ?, updated_at = NOW(), last_status_updated = NOW()
            WHERE id = ?
        ");
        
        $stmt->execute([
            $input['status'],
            $input['status_notes'] ?? null,
            $input['order_id']
        ]);
        
        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            return;
        }
        
        // Process commission if status is 'delivered'
        if ($input['status'] === 'delivered') {
            try {
                // Get order details after status update for commission processing
                $stmt = $pdo->prepare("
                    SELECT o.total_amount, o.advertisement_id, p.vendor_id
                    FROM orders o 
                    JOIN products p ON o.product_id = p.id 
                    WHERE o.id = ? AND o.status = 'delivered'
                ");
                $stmt->execute([$input['order_id']]);
                $orderForCommission = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($orderForCommission) {
                    $commissionResult = processCommission(
                        $input['order_id'],
                        $orderForCommission['vendor_id'],
                        $orderForCommission['total_amount']
                    );
                    
                    if (!$commissionResult['success']) {
                        // Log the error but don't fail the order status update
                        error_log("Commission processing failed: " . $commissionResult['message']);
                    }
                }
            } catch (Exception $commissionError) {
                // Log the error but don't fail the order status update
                error_log("Exception during commission processing for order {$input['order_id']}: " . $commissionError->getMessage());
                error_log("Stack trace: " . $commissionError->getTraceAsString());
            }
        }
        
        $pdo->commit();
        
        // Send success response FIRST before any background operations
        echo json_encode([
            'success' => true,
            'message' => 'Order status updated successfully'
        ]);
        
        // Flush output to ensure response is sent immediately
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        
        // Update ad revenue AFTER response is sent (for ad orders only)
        // This is done outside the transaction and after response is sent so it never blocks
        if ($input['status'] === 'delivered') {
            try {
                // Check if this is an ad order
                $stmt = $pdo->prepare("SELECT advertisement_id, total_amount FROM orders WHERE id = ?");
                $stmt->execute([$input['order_id']]);
                $orderCheck = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($orderCheck && $orderCheck['advertisement_id']) {
                    // Update ad revenue in a separate, non-blocking operation
                    require_once __DIR__ . '/../routes/advertisements.php';
                    $adRevenueUpdated = updateAdRevenue($orderCheck['advertisement_id'], $orderCheck['total_amount']);
                    if (!$adRevenueUpdated) {
                        error_log("Warning: Failed to update ad revenue for ad {$orderCheck['advertisement_id']} after order {$input['order_id']} was delivered");
                    }
                }
            } catch (Exception $adRevenueError) {
                // Log but don't fail - order status update already succeeded and response already sent
                error_log("Error updating ad revenue after order status update: " . $adRevenueError->getMessage());
            }
        }
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        error_log("Exception updating order status: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        echo json_encode(['error' => 'Failed to update order status: ' . $e->getMessage()]);
    }
}

function handleUpdateCustomerShippingAddress() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'customer') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid customer token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    // Sanitize order ID from GET parameter
    require_once __DIR__ . '/../utils/security.php';
    $orderId = isset($_GET['id']) ? sanitizeInput($_GET['id']) : null;
    
    if (!$orderId || !isset($input['shipping_address'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and shipping address are required']);
        return;
    }
    
    $newShippingAddress = trim($input['shipping_address']);
    
    if (empty($newShippingAddress)) {
        http_response_code(400);
        echo json_encode(['error' => 'Shipping address cannot be empty']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Verify that the order belongs to this customer and is still pending
        $stmt = $pdo->prepare("
            SELECT id, order_number, status 
            FROM orders 
            WHERE id = ? AND user_id = ? AND status = 'pending'
        ");
        $stmt->execute([$orderId, $payload['user_id']]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            http_response_code(403);
            echo json_encode(['error' => 'Order not found, does not belong to you, or is no longer pending']);
            return;
        }
        
        // Update shipping address for all orders with the same order_number
        $stmt = $pdo->prepare("
            UPDATE orders
            SET shipping_address = ?, updated_at = NOW()
            WHERE order_number = ?
        ");
        $stmt->execute([$newShippingAddress, $order['order_number']]);
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Shipping address updated successfully']);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        error_log("Error updating shipping address: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to update shipping address: ' . $e->getMessage()]);
    }
}
?>
