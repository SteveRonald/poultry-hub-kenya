<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

function handleGetCart() {
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
                c.id as cart_id,
                c.quantity,
                c.created_at as added_at,
                p.id as product_id,
                p.name as product_name,
                p.price,
                p.stock_quantity,
                p.unit,
                p.image_urls,
                p.category,
                v.farm_name as vendor_name,
                u.phone as vendor_phone
            FROM cart c
            JOIN products p ON c.product_id = p.id
            JOIN vendors v ON p.vendor_id = v.id
            JOIN user_profiles u ON v.user_id = u.id
            WHERE c.user_id = ? AND p.is_active = 1
            ORDER BY c.created_at DESC
        ");
        
        $stmt->execute([$payload['user_id']]);
        $cartItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate totals
        $totalItems = 0;
        $totalAmount = 0;
        
        foreach ($cartItems as &$item) {
            $item['total_price'] = $item['price'] * $item['quantity'];
            $totalItems += $item['quantity'];
            $totalAmount += $item['total_price'];
            
            // Parse image URLs
            if ($item['image_urls']) {
                $images = json_decode($item['image_urls'], true);
                $item['image_url'] = is_array($images) && count($images) > 0 ? $images[0] : null;
            } else {
                $item['image_url'] = null;
            }
        }
        
        echo json_encode([
            'items' => $cartItems,
            'summary' => [
                'total_items' => $totalItems,
                'total_amount' => $totalAmount,
                'items_count' => count($cartItems)
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log('Get cart error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch cart items']);
    }
}

function handleAddToCart() {
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
    
    $productId = $input['product_id'];
    $quantity = (int)$input['quantity'];
    
    if ($quantity <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Quantity must be greater than 0']);
        return;
    }
    
    try {
        // Check if product exists and is active
        $stmt = $pdo->prepare("SELECT id, name, price, stock_quantity FROM products WHERE id = ? AND is_active = 1");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found or not available']);
            return;
        }
        
        // Check stock availability
        if ($product['stock_quantity'] < $quantity) {
            http_response_code(400);
            echo json_encode(['error' => 'Insufficient stock. Available: ' . $product['stock_quantity']]);
            return;
        }
        
        // Check if item already exists in cart
        $stmt = $pdo->prepare("SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$payload['user_id'], $productId]);
        $existingItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existingItem) {
            // Update existing item
            $newQuantity = $existingItem['quantity'] + $quantity;
            
            if ($product['stock_quantity'] < $newQuantity) {
                http_response_code(400);
                echo json_encode(['error' => 'Insufficient stock. Available: ' . $product['stock_quantity']]);
                return;
            }
            
            $stmt = $pdo->prepare("UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$newQuantity, $existingItem['id']]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Cart updated successfully',
                'quantity' => $newQuantity
            ]);
        } else {
            // Add new item
            $stmt = $pdo->prepare("INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)");
            $stmt->execute([$payload['user_id'], $productId, $quantity]);
            
            echo json_encode([
                'success' => true,
                'message' => 'Item added to cart successfully',
                'quantity' => $quantity
            ]);
        }
        
    } catch (PDOException $e) {
        error_log('Add to cart error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add item to cart']);
    }
}

function handleUpdateCartItem() {
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
    
    if (!isset($input['cart_id']) || !isset($input['quantity'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Cart ID and quantity are required']);
        return;
    }
    
    $cartId = (int)$input['cart_id'];
    $quantity = (int)$input['quantity'];
    
    if ($quantity <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Quantity must be greater than 0']);
        return;
    }
    
    try {
        // Check if cart item exists and belongs to user
        $stmt = $pdo->prepare("
            SELECT c.id, c.product_id, p.stock_quantity 
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            WHERE c.id = ? AND c.user_id = ?
        ");
        $stmt->execute([$cartId, $payload['user_id']]);
        $cartItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$cartItem) {
            http_response_code(404);
            echo json_encode(['error' => 'Cart item not found']);
            return;
        }
        
        // Check stock availability
        if ($cartItem['stock_quantity'] < $quantity) {
            http_response_code(400);
            echo json_encode(['error' => 'Insufficient stock. Available: ' . $cartItem['stock_quantity']]);
            return;
        }
        
        // Update cart item
        $stmt = $pdo->prepare("UPDATE cart SET quantity = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$quantity, $cartId]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Cart item updated successfully',
            'quantity' => $quantity
        ]);
        
    } catch (PDOException $e) {
        error_log('Update cart item error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update cart item']);
    }
}

function handleRemoveFromCart() {
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
    
    if (!isset($input['cart_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Cart ID is required']);
        return;
    }
    
    $cartId = (int)$input['cart_id'];
    
    try {
        // Check if cart item exists and belongs to user
        $stmt = $pdo->prepare("SELECT id FROM cart WHERE id = ? AND user_id = ?");
        $stmt->execute([$cartId, $payload['user_id']]);
        $cartItem = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$cartItem) {
            http_response_code(404);
            echo json_encode(['error' => 'Cart item not found']);
            return;
        }
        
        // Remove cart item
        $stmt = $pdo->prepare("DELETE FROM cart WHERE id = ?");
        $stmt->execute([$cartId]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Item removed from cart successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Remove from cart error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to remove item from cart']);
    }
}

function handleClearCart() {
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
        $stmt = $pdo->prepare("DELETE FROM cart WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Cart cleared successfully'
        ]);
        
    } catch (PDOException $e) {
        error_log('Clear cart error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to clear cart']);
    }
}
?>
