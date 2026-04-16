<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/system_logs.php';
require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

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

        // Load current order state for transition-based commission handling.
        $stmt = $pdo->prepare("\n            SELECT o.status, o.total_amount, p.vendor_id\n            FROM orders o\n            JOIN products p ON o.product_id = p.id\n            WHERE o.id = ?\n            FOR UPDATE\n        ");
        $stmt->execute([$input['order_id']]);
        $currentOrder = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$currentOrder) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            return;
        }

        $oldStatus = $currentOrder['status'];
        
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
        
        // Get customer details from database (phone is used as SMS fallback if checkout phone is invalid)
        $stmt = $pdo->prepare("SELECT full_name, email, phone FROM user_profiles WHERE id = ?");
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
                $advertisementId = filter_var($input['advertisement_id'], FILTER_SANITIZE_FULL_SPECIAL_CHARS);
                // Validate it's alphanumeric or UUID format
                if (!preg_match('/^[a-zA-Z0-9_-]+$/', $advertisementId)) {
                    $advertisementId = null;
                }
            } elseif (isset($_COOKIE['ad_click'])) {
                $cookieValue = filter_var($_COOKIE['ad_click'], FILTER_SANITIZE_FULL_SPECIAL_CHARS);
                // Validate cookie value format (alphanumeric, UUID, or similar safe format)
                if (preg_match('/^[a-zA-Z0-9_-]+$/', $cookieValue)) {
                    $advertisementId = $cookieValue;
                }
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    order_number, user_id, product_id, quantity, vendor_id, subtotal, total_amount, 
                    delivery_fee, shipping_address, contact_phone, payment_method, payment_account_number, 
                    notes, order_type, advertisement_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            
            $orderType = $isDirectOrder ? 'direct' : 'cart';
            $deliveryFee = 0; // Direct orders from this endpoint don't handle delivery fee (usually for simple orders)
            
            $stmt->execute([
                $orderNumber,
                $payload['user_id'],
                $item['product_id'],
                $item['quantity'],
                $item['vendor_id'],
                $totalAmount, // Subtotal is same as total if fee is 0
                $totalAmount,
                $deliveryFee,
                $input['shipping_address'],
                $input['contact_phone'],
                $input['payment_method'],
                $input['payment_account_number'] ?? null,
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
                'delivery_fee' => $deliveryFee,
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

        // Group created orders per vendor (used for vendor notifications/SMS)
        $vendorEmails = [];
        foreach ($createdOrders as $order) {
            $vendorId = $order['vendor_id'] ?? null;
            if (!$vendorId) {
                continue;
            }
            if (!isset($vendorEmails[$vendorId])) {
                $vendorEmails[$vendorId] = [
                    'orders' => [],
                    'vendor_name' => $order['vendor_name'] ?? null,
                    'vendor_email' => $order['vendor_email'] ?? null
                ];
            }
            $vendorEmails[$vendorId]['orders'][] = $order;
        }

        // Respond immediately after the order is created.
        // Notifications (email/SMS/in-app) are best-effort and should never block the user.
        $ordersCount = count($createdOrders);
        $ordersText = $ordersCount === 1 ? 'order' : 'orders';
        $responseMessage = "Orders created successfully! {$ordersCount} {$ordersText} placed.";

        // Allow the script to continue sending notifications even if the client navigates away.
        // This is important in SPA flows where the browser may close the connection right after
        // receiving the JSON response.
        if (function_exists('ignore_user_abort')) {
            ignore_user_abort(true);
        }
        if (function_exists('set_time_limit')) {
            @set_time_limit(60);
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $responseMessage,
            'order_number' => $orderNumber,
            'orders' => $createdOrders,
            'total_items' => $ordersCount,
            'total_orders' => $ordersCount, // Add this for compatibility
            'customer_email_sent' => true // email is queued best-effort
        ]);

        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        } else {
            // Best-effort flush for non-FPM setups (e.g., Apache/mod_php on XAMPP).
            if (function_exists('ob_get_level') && ob_get_level() > 0) {
                @ob_end_flush();
            }
            if (function_exists('flush')) {
                @flush();
            }
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

        // Queue/send emails + SMS via a dedicated service (best-effort)
        try {
            require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

                call_user_func(['OrderNotificationService', 'orderCreated'], $pdo, $createdOrders, $vendorEmails, [
                'order_number' => $orderNumber,
                'customer_id' => $payload['user_id'] ?? null,
                'checkout_phone' => $input['contact_phone'] ?? null,
                'customer_profile_phone' => $customer['phone'] ?? null
            ]);
        } catch (Exception $notifyError) {
            error_log('Order created but notifications failed: ' . $notifyError->getMessage());
        }

        return;
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
                p.image_urls,
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
            
            // Safely decode product images
            $productImages = [];
            if (!empty($order['image_urls'])) {
                $decoded = json_decode($order['image_urls'], true);
                $productImages = ($decoded !== null && is_array($decoded)) ? $decoded : [];
            }
            
            $groupedOrders[$orderNumber]['items'][] = [
                'order_id' => $order['id'],
                'product_id' => $order['product_id'],
                'product_name' => $order['product_name'],
                'product_images' => $productImages,
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

        // Reverse financial records only when moving away from delivered.
        if ($oldStatus === 'delivered' && $input['status'] !== 'delivered') {
            try {
                reverseWalletEarning($currentOrder['vendor_id'], $input['order_id']);
            } catch (Exception $walletReverseError) {
                error_log("Wallet reversal failed for order {$input['order_id']}: " . $walletReverseError->getMessage());
            }

            $reverseResult = reverseCommissionForOrder(
                $input['order_id'],
                $currentOrder['vendor_id'],
                $currentOrder['total_amount']
            );
            if (!$reverseResult['success']) {
                error_log("Commission reversal failed for order {$input['order_id']}: " . ($reverseResult['message'] ?? 'Unknown error'));
            }
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
