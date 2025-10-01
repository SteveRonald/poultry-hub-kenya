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
                'total_amount' => $totalAmount,
                'vendor_id' => $item['vendor_id'],
                'vendor_name' => $item['vendor_name'],
                'vendor_email' => $item['vendor_email']
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
            $vendorSubject = "New Order Received - " . $orderNumber;
            $vendorMessage = "
            <html>
            <head>
                <title>New Order Notification</title>
            </head>
            <body>
                <h2>New Order Received</h2>
                <p>You have received a new order from PoultryConnect Kenya.</p>
                <p><strong>Order Number:</strong> $orderNumber</p>
                <p><strong>Items:</strong></p>
                <ul>";
            
            $totalAmount = 0;
            foreach ($vendorData['orders'] as $order) {
                $vendorMessage .= "<li>{$order['product_name']} x {$order['quantity']} = KSH " . number_format($order['total_amount'], 2) . "</li>";
                $totalAmount += $order['total_amount'];
            }
            
            $vendorMessage .= "
                </ul>
                <p><strong>Total Amount:</strong> KSH " . number_format($totalAmount, 2) . "</p>
                <p>Please log in to your vendor dashboard to view order details and update status.</p>
                <hr>
                <p><em>PoultryConnect Kenya</em></p>
            </body>
            </html>";
            
            sendEmail($vendorData['email'], $vendorSubject, $vendorMessage);
        }
        
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
?>

