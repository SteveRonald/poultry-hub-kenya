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
                http_response_code(404);
                echo json_encode(['error' => 'Product not found or not available']);
                return;
            }
            
            // Check stock
            if ($product['stock_quantity'] < $quantity) {
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
                http_response_code(400);
                echo json_encode(['error' => 'Cart is empty']);
                return;
            }
            
            // Check stock for all items
            foreach ($cartItems as $item) {
                if ($item['stock_quantity'] < $item['quantity']) {
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
            
            $stmt = $pdo->prepare("
                INSERT INTO orders (
                    order_number, user_id, product_id, quantity, vendor_id, total_amount, 
                    shipping_address, contact_phone, payment_method, notes, order_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                $orderType
            ]);
            
            $orderId = $pdo->lastInsertId();
            
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
                'created_at' => date('Y-m-d H:i:s'), // Add current timestamp
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
        
        // Send notification emails to vendors
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
        }
        
        // Send order confirmation email to customer
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
                'name' => $createdOrders[0]['customer_name']
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
        
        sendStyledEmail($createdOrders[0]['customer_email'], 'order_confirmation', $customerEmailData);

        // Create notifications for vendors and admins
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
        
        echo json_encode([
            'success' => true,
            'message' => 'Orders created successfully',
            'order_number' => $orderNumber,
            'orders' => $createdOrders,
            'total_items' => count($createdOrders)
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
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
                p.name as product_name,
                p.price as unit_price,
                u.full_name as vendor_name,
                u.phone as vendor_phone
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
                'vendor_phone' => $order['vendor_phone']
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
        $stmt = $pdo->prepare("
            UPDATE orders 
            SET status = ?, status_notes = ?, updated_at = NOW()
            WHERE id = ?
        ");
        
        $stmt->execute([
            $input['status'],
            $input['status_notes'] ?? null,
            $input['order_id']
        ]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'Order status updated successfully'
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
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
    $orderId = $_GET['id'] ?? null;
    
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
