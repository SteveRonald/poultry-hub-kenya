<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

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
    
    $user_id = $_GET['user_id'] ?? $payload['user_id'];
    
    try {
        $sql = "SELECT o.*, p.name as product_name, v.farm_name as vendor_name 
                FROM orders o 
                JOIN products p ON o.product_id = p.id 
                JOIN vendors v ON p.vendor_id = v.id 
                WHERE o.user_id = ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$user_id]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($orders);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch orders: ' . $e->getMessage()]);
    }
}

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
    
    if (!isset($input['product_id']) || !isset($input['quantity'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID and quantity are required']);
        return;
    }
    
    $user_id = $payload['user_id'];
    $product_id = $input['product_id'];
    $quantity = intval($input['quantity']);
    
    try {
        // Check if product exists and has enough stock
        $stmt = $pdo->prepare("SELECT stock_quantity FROM products WHERE id = ?");
        $stmt->execute([$product_id]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        if ($product['stock_quantity'] < $quantity) {
            http_response_code(400);
            echo json_encode(['error' => 'Insufficient stock']);
            return;
        }
        
        // Create order
        $order_id = uniqid();
        $stmt = $pdo->prepare("INSERT INTO orders (id, user_id, product_id, quantity, status) VALUES (?, ?, ?, ?, 'pending')");
        $stmt->execute([$order_id, $user_id, $product_id, $quantity]);
        
        // Update stock
        $stmt = $pdo->prepare("UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?");
        $stmt->execute([$quantity, $product_id]);
        
        http_response_code(201);
        echo json_encode(['message' => 'Order created successfully', 'order_id' => $order_id]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create order: ' . $e->getMessage()]);
    }
}
?>
