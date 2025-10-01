<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';

function handleAdminLogin() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['email']) || !isset($input['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Email and password are required']);
        return;
    }
    
    $email = $input['email'];
    $password = $input['password'];
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM user_profiles WHERE email = ? AND role = 'admin'");
        $stmt->execute([$email]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$admin) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid admin credentials']);
            return;
        }
        
        // Check password
        $passwordValid = false;
        if (password_verify($password, $admin['password'])) {
            $passwordValid = true;
        } elseif ($admin['password'] === $password) {
            // Fallback for plain text passwords (for testing)
            $passwordValid = true;
        }
        
        if (!$passwordValid) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid admin credentials']);
            return;
        }
        
        // Generate session token
        $sessionToken = bin2hex(random_bytes(32));
        
        // Store session in database
        $stmt = $pdo->prepare("INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))");
        $stmt->execute([$admin['id'], $sessionToken]);
        
        echo json_encode([
            'session_token' => $sessionToken,
            'admin' => [
                'id' => $admin['id'],
                'email' => $admin['email'],
                'full_name' => $admin['full_name'],
                'role' => $admin['role']
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Admin login failed: ' . $e->getMessage()]);
    }
}

function handleAdminStats() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Get total vendors
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM vendors");
        $totalVendors = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get pending vendors
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM vendors WHERE status = 'pending'");
        $pendingVendors = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total products
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM products");
        $totalProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get pending products
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM products WHERE is_active = 0");
        $pendingProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total orders
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM orders");
        $totalOrders = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total revenue (sum of quantity * price for all orders)
        $stmt = $pdo->query("SELECT SUM(o.quantity * p.price) as total FROM orders o JOIN products p ON o.product_id = p.id");
        $totalRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
        
        // Get total users
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM user_profiles");
        $totalUsers = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total admins
        $stmt = $pdo->query("SELECT COUNT(*) as total FROM user_profiles WHERE role = 'admin'");
        $totalAdmins = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        echo json_encode([
            'totalVendors' => intval($totalVendors),
            'pendingVendors' => intval($pendingVendors),
            'totalProducts' => intval($totalProducts),
            'pendingProducts' => intval($pendingProducts),
            'totalOrders' => intval($totalOrders),
            'totalRevenue' => floatval($totalRevenue),
            'totalUsers' => intval($totalUsers),
            'totalAdmins' => intval($totalAdmins)
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats: ' . $e->getMessage()]);
    }
}

function handleAdminVendors() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT v.*, u.email, u.full_name, u.phone 
            FROM vendors v 
            JOIN user_profiles u ON v.user_id = u.id 
            ORDER BY v.created_at DESC
        ");
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
        $formattedVendors = array_map(function($vendor) {
            return [
                'id' => $vendor['id'],
                'name' => $vendor['full_name'],
                'email' => $vendor['email'],
                'phone' => $vendor['phone'],
                'farmName' => $vendor['farm_name'],
                'location' => $vendor['location'],
                'status' => $vendor['status'],
                'registrationDate' => $vendor['created_at']
            ];
        }, $vendors);
        
        echo json_encode($formattedVendors);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch vendors: ' . $e->getMessage()]);
    }
}

function handleAdminProducts() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT p.*, v.farm_name, v.location, u.full_name as vendor_name
            FROM products p 
            JOIN vendors v ON p.vendor_id = v.id 
            JOIN user_profiles u ON v.user_id = u.id
            ORDER BY p.created_at DESC
        ");
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
        $formattedProducts = array_map(function($product) {
            return [
                'id' => $product['id'],
                'name' => $product['name'],
                'description' => $product['description'],
                'vendor' => $product['vendor_name'],
                'vendorName' => $product['vendor_name'],
                'vendorLocation' => $product['location'] ?? '',
                'category' => $product['category'],
                'price' => floatval($product['price']),
                'stockQuantity' => intval($product['stock_quantity']),
                'image_urls' => $product['image_urls'],
                'status' => $product['is_active'] ? 'approved' : 'pending',
                'submissionDate' => $product['created_at']
            ];
        }, $products);
        
        echo json_encode($formattedProducts);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch products: ' . $e->getMessage()]);
    }
}

function handleAdminOrders() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT 
                o.*, 
                p.name as product_name, 
                p.price as product_price, 
                p.image_urls,
                p.description as product_description,
                u.full_name as customer_name, 
                u.email as customer_email,
                u.phone as customer_phone,
                v.farm_name as vendor_name,
                v.location as vendor_location,
                up.email as vendor_email,
                up.phone as vendor_phone
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            JOIN user_profiles u ON o.user_id = u.id
            JOIN vendors v ON p.vendor_id = v.id
            JOIN user_profiles up ON v.user_id = up.id
            ORDER BY o.created_at DESC
        ");
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response
        $formattedOrders = array_map(function($order) {
            return [
                'id' => $order['id'],
                'order_number' => $order['order_number'],
                'customer' => $order['customer_name'],
                'customer_email' => $order['customer_email'],
                'customer_phone' => $order['customer_phone'],
                'vendor' => $order['vendor_name'],
                'vendor_email' => $order['vendor_email'],
                'vendor_phone' => $order['vendor_phone'],
                'vendor_location' => $order['vendor_location'],
                'product' => $order['product_name'],
                'product_description' => $order['product_description'],
                'product_images' => $order['image_urls'],
                'quantity' => $order['quantity'],
                'unit_price' => floatval($order['product_price']),
                'amount' => floatval($order['total_amount']),
                'status' => $order['status'],
                'status_notes' => $order['status_notes'],
                'payment_method' => $order['payment_method'],
                'payment_status' => $order['payment_status'],
                'shipping_address' => $order['shipping_address'],
                'contact_phone' => $order['contact_phone'],
                'notes' => $order['notes'],
                'order_type' => $order['order_type'],
                'date' => $order['created_at'],
                'updated_at' => $order['updated_at']
            ];
        }, $orders);
        
        echo json_encode($formattedOrders);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch orders: ' . $e->getMessage()]);
    }
}

function handleUpdateOrderStatus() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $orderId = $_GET['id'] ?? null;
    
    if (!$orderId || !isset($input['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and new status are required']);
        return;
    }
    
    $newStatus = $input['status'];
    $statusNotes = $input['status_notes'] ?? null;
    
    try {
        $pdo->beginTransaction();
        
        // Update order status
        $stmt = $pdo->prepare("
            UPDATE orders
            SET status = ?, status_notes = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([$newStatus, $statusNotes, $orderId]);
        
        // Update payment status based on order status
        $paymentStatus = 'pending';
        if (in_array($newStatus, ['confirmed', 'processing', 'shipped', 'delivered'])) {
            $paymentStatus = 'paid';
        } elseif ($newStatus === 'cancelled') {
            $paymentStatus = 'cancelled';
        }
        
        $stmt = $pdo->prepare("
            UPDATE orders
            SET payment_status = ?
            WHERE id = ?
        ");
        $stmt->execute([$paymentStatus, $orderId]);
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Order status updated successfully']);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        error_log("Error updating order status: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to update order status: ' . $e->getMessage()]);
    }
}

function handleAdminUsers() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("SELECT id, email, full_name, phone, role, created_at FROM user_profiles ORDER BY created_at DESC");
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($users);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch users: ' . $e->getMessage()]);
    }
}

function handleAdminLogout() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(400);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    try {
        // Remove the session from database
        $stmt = $pdo->prepare("DELETE FROM admin_sessions WHERE session_token = ?");
        $stmt->execute([$token]);
        
        echo json_encode(['message' => 'Admin logged out successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Logout failed: ' . $e->getMessage()]);
    }
}

function handleVendorApproval() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $vendorId = $input['vendor_id'] ?? null;
    
    if (!$vendorId) {
        http_response_code(400);
        echo json_encode(['error' => 'Vendor ID is required']);
        return;
    }
    
    try {
        // Get vendor info before updating
        $stmt = $pdo->prepare("SELECT v.farm_name, u.full_name FROM vendors v JOIN user_profiles u ON v.user_id = u.id WHERE v.id = ?");
        $stmt->execute([$vendorId]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor not found']);
            return;
        }
        
        // Update vendor status
        $stmt = $pdo->prepare("UPDATE vendors SET status = 'approved' WHERE id = ?");
        $stmt->execute([$vendorId]);
        
        // Notify vendor about approval
        $vendorName = $vendor['farm_name'] ?: $vendor['full_name'];
        notifyVendor($vendorId, "Congratulations! Your vendor account '{$vendorName}' has been approved. You can now start selling products!", 'success');
        
        echo json_encode(['message' => 'Vendor approved successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to approve vendor: ' . $e->getMessage()]);
    }
}

function handleVendorRejection() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $vendorId = $input['vendor_id'] ?? null;
    $reason = $input['reason'] ?? 'Application rejected';
    
    if (!$vendorId) {
        http_response_code(400);
        echo json_encode(['error' => 'Vendor ID is required']);
        return;
    }
    
    try {
        // Get vendor info before updating
        $stmt = $pdo->prepare("SELECT v.farm_name, u.full_name FROM vendors v JOIN user_profiles u ON v.user_id = u.id WHERE v.id = ?");
        $stmt->execute([$vendorId]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor not found']);
            return;
        }
        
        // Update vendor status
        $stmt = $pdo->prepare("UPDATE vendors SET status = 'rejected' WHERE id = ?");
        $stmt->execute([$vendorId]);
        
        // Notify vendor about rejection
        $vendorName = $vendor['farm_name'] ?: $vendor['full_name'];
        notifyVendor($vendorId, "Your vendor account '{$vendorName}' has been rejected. Reason: {$reason}", 'warning');
        
        echo json_encode(['message' => 'Vendor rejected successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reject vendor: ' . $e->getMessage()]);
    }
}

function handleProductApproval() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $productId = $input['product_id'] ?? null;
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID is required']);
        return;
    }
    
    try {
        // Get product and vendor info before updating
        $stmt = $pdo->prepare("SELECT p.name, p.vendor_id FROM products p WHERE p.id = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        // Update product status
        $stmt = $pdo->prepare("UPDATE products SET is_active = 1 WHERE id = ?");
        $stmt->execute([$productId]);
        
        // Notify vendor about product approval
        notifyVendor($product['vendor_id'], "Your product '{$product['name']}' has been approved and is now live!", 'success');
        
        echo json_encode(['message' => 'Product approved successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to approve product: ' . $e->getMessage()]);
    }
}

function handleProductRejection() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $productId = $input['product_id'] ?? null;
    $reason = $input['reason'] ?? 'Product rejected';
    
    if (!$productId) {
        http_response_code(400);
        echo json_encode(['error' => 'Product ID is required']);
        return;
    }
    
    try {
        // Get product and vendor info before updating
        $stmt = $pdo->prepare("SELECT p.name, p.vendor_id FROM products p WHERE p.id = ?");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        // Update product status
        $stmt = $pdo->prepare("UPDATE products SET is_active = 0 WHERE id = ?");
        $stmt->execute([$productId]);
        
        // Notify vendor about product rejection
        notifyVendor($product['vendor_id'], "Your product '{$product['name']}' has been rejected. Reason: {$reason}", 'warning');
        
        echo json_encode(['message' => 'Product rejected successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reject product: ' . $e->getMessage()]);
    }
}

function validateAdminSession($token) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        return false;
    }
}
?>
