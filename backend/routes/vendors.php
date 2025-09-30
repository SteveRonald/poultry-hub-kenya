<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';

function handleGetVendors() {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT v.*, u.email, u.full_name, u.phone 
                              FROM vendors v 
                              JOIN user_profiles u ON v.user_id = u.id 
                              WHERE v.status = 'approved'");
        $stmt->execute();
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($vendors);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch vendors: ' . $e->getMessage()]);
    }
}

function handleGetVendorProducts() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    try {
        // Get vendor_id from vendors table using user_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $stmt = $pdo->prepare("SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC");
        $stmt->execute([$vendor['id']]);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($products);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch products: ' . $e->getMessage()]);
    }
}

function handleCreateProduct() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['name']) || !isset($input['description']) || !isset($input['price']) || !isset($input['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Name, description, price, and category are required']);
        return;
    }
    
    $productId = uniqid();
    
    try {
        // Get vendor_id from vendors table using user_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO products (id, vendor_id, name, description, price, category, stock_quantity, image_urls, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        ");
        $stmt->execute([
            $productId,
            $vendor['id'],
            $input['name'],
            $input['description'],
            $input['price'],
            $input['category'],
            $input['stock_quantity'] ?? 0,
            json_encode($input['image_urls'] ?? [])
        ]);
        
        // Get vendor name for notification
        $stmt = $pdo->prepare("SELECT v.farm_name, u.full_name FROM vendors v JOIN user_profiles u ON v.user_id = u.id WHERE v.id = ?");
        $stmt->execute([$vendor['id']]);
        $vendorInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Notify admins about new product
        $vendorName = $vendorInfo['farm_name'] ?: $vendorInfo['full_name'];
        notifyAllAdmins("New product submitted: '{$input['name']}' by {$vendorName}", 'info');
        
        echo json_encode([
            'message' => 'Product created successfully',
            'product_id' => $productId
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create product: ' . $e->getMessage()]);
    }
}

function handleUpdateProduct() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['name']) || !isset($input['description']) || !isset($input['price']) || !isset($input['category'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Name, description, price, and category are required']);
        return;
    }
    
    // Get product ID from URL path
    $pathParts = explode('/', $_SERVER['REQUEST_URI']);
    $productId = end($pathParts);
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID is required']);
        return;
    }
    
    try {
        // Verify the product belongs to this vendor
        $stmt = $pdo->prepare("
            SELECT p.id, p.vendor_id 
            FROM products p 
            JOIN vendors v ON p.vendor_id = v.id 
            WHERE p.id = ? AND v.user_id = ?
        ");
        $stmt->execute([$productId, $payload['user_id']]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found or access denied']);
            return;
        }
        
        // Update the product
        $stmt = $pdo->prepare("
            UPDATE products 
            SET name = ?, description = ?, price = ?, category = ?, stock_quantity = ?, image_urls = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([
            $input['name'],
            $input['description'],
            $input['price'],
            $input['category'],
            $input['stock_quantity'] ?? 0,
            json_encode($input['image_urls'] ?? []),
            $productId
        ]);
        
        echo json_encode(['message' => 'Product updated successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update product: ' . $e->getMessage()]);
    }
}

function handleDeleteProduct() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    // Get product ID from URL path
    $pathParts = explode('/', $_SERVER['REQUEST_URI']);
    $productId = end($pathParts);
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID is required']);
        return;
    }
    
    try {
        // Verify the product belongs to this vendor
        $stmt = $pdo->prepare("
            SELECT p.id, p.vendor_id 
            FROM products p 
            JOIN vendors v ON p.vendor_id = v.id 
            WHERE p.id = ? AND v.user_id = ?
        ");
        $stmt->execute([$productId, $payload['user_id']]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found or access denied']);
            return;
        }
        
        // Delete the product
        $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
        $stmt->execute([$productId]);
        
        echo json_encode(['message' => 'Product deleted successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete product: ' . $e->getMessage()]);
    }
}

function handleGetVendorStats() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    try {
        // Get vendor_id from vendors table using user_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $vendorId = $vendor['id'];
        
        // Get total products
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM products WHERE vendor_id = ?");
        $stmt->execute([$vendorId]);
        $totalProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get active products
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM products WHERE vendor_id = ? AND is_active = 1");
        $stmt->execute([$vendorId]);
        $activeProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get pending products
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM products WHERE vendor_id = ? AND is_active = 0");
        $stmt->execute([$vendorId]);
        $pendingProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total orders for this vendor's products
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as total 
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE p.vendor_id = ?
        ");
        $stmt->execute([$vendorId]);
        $totalOrders = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total revenue
        $stmt = $pdo->prepare("
            SELECT SUM(o.quantity * p.price) as total 
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE p.vendor_id = ?
        ");
        $stmt->execute([$vendorId]);
        $totalRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
        
        echo json_encode([
            'totalProducts' => intval($totalProducts),
            'activeProducts' => intval($activeProducts),
            'pendingProducts' => intval($pendingProducts),
            'totalOrders' => intval($totalOrders),
            'totalRevenue' => floatval($totalRevenue)
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch vendor stats: ' . $e->getMessage()]);
    }
}

function handleGetVendorOrders() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }
    
    try {
        // Get vendor_id from vendors table using user_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $vendorId = $vendor['id'];
        
        // Get orders for this vendor's products
        $stmt = $pdo->prepare("
            SELECT o.*, p.name as product_name, u.full_name as customer_name, u.email as customer_email
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            JOIN user_profiles u ON o.user_id = u.id
            WHERE p.vendor_id = ?
            ORDER BY o.created_at DESC
        ");
        $stmt->execute([$vendorId]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
        $formattedOrders = array_map(function($order) {
            return [
                'id' => $order['id'],
                'customer' => $order['customer_name'],
                'customerEmail' => $order['customer_email'],
                'product' => $order['product_name'],
                'quantity' => intval($order['quantity']),
                'status' => $order['status'],
                'date' => $order['created_at']
            ];
        }, $orders);
        
        echo json_encode($formattedOrders);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch vendor orders: ' . $e->getMessage()]);
    }
}
?>
