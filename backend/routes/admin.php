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
        
        // Check password - only allow bcrypt hashed passwords
        $passwordValid = password_verify($password, $admin['password']);
        
        if (!$passwordValid) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid admin credentials']);
            return;
        }
        
        // Check if admin account is disabled
        if ($admin['account_status'] === 'disabled') {
            http_response_code(403);
            echo json_encode(['error' => 'Your admin account has been disabled. Please contact system administrator.']);
            return;
        }
        
        // Generate session token
        $sessionToken = bin2hex(random_bytes(32));
        
        // Store session in database
        $stmt = $pdo->prepare("INSERT INTO admin_sessions (admin_id, session_token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))");
        $stmt->execute([$admin['id'], $sessionToken]);
        
        // Get last login from admin_sessions (excluding current session)
        $stmt = $pdo->prepare("SELECT created_at as last_login FROM admin_sessions WHERE admin_id = ? AND session_token != ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$admin['id'], $sessionToken]);
        $lastSession = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $adminData = [
            'id' => $admin['id'],
            'email' => $admin['email'],
            'full_name' => $admin['full_name'],
            'role' => $admin['role'],
            'phone' => $admin['phone'],
            'created_at' => $admin['created_at'],
            'updated_at' => $admin['updated_at']
        ];
        
        if ($lastSession) {
            $adminData['last_login'] = $lastSession['last_login'];
        }
        
        echo json_encode([
            'session_token' => $sessionToken,
            'admin' => $adminData
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
        
        // Get platform commission (10% from delivered orders only)
        require_once __DIR__ . '/../utils/commission.php';
        $platformCommission = getPlatformTotalCommission();
        
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
            'totalRevenue' => floatval($platformCommission),
            'totalUsers' => intval($totalUsers),
            'totalAdmins' => intval($totalAdmins)
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch stats: ' . $e->getMessage()]);
    }
}

function handleAdminCommissionData() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        require_once __DIR__ . '/../utils/commission.php';
        
        // Get platform commission
        $platformCommission = getPlatformTotalCommission();
        
        // Get detailed commission breakdown
        $stmt = $pdo->query("
            SELECT 
                pc.order_id,
                pc.total_amount,
                pc.commission_amount,
                pc.vendor_amount,
                pc.status,
                pc.created_at,
                p.name as product_name,
                v.farm_name as vendor_name
            FROM platform_commissions pc
            JOIN orders o ON pc.order_id = o.id
            JOIN products p ON o.product_id = p.id
            LEFT JOIN vendors v ON p.vendor_id = v.id
            ORDER BY pc.created_at DESC
            LIMIT 20
        ");
        $commissionBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get vendor earnings summary
        $stmt = $pdo->query("
            SELECT 
                ve.vendor_id,
                v.farm_name as vendor_name,
                SUM(ve.net_amount) as total_earnings,
                COUNT(*) as order_count
            FROM vendor_earnings ve
            LEFT JOIN vendors v ON ve.vendor_id = v.id
            WHERE ve.status = 'confirmed'
            GROUP BY ve.vendor_id, v.farm_name
            ORDER BY total_earnings DESC
        ");
        $vendorEarnings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'platform_commission' => $platformCommission,
            'vendor_earnings_total' => $platformCommission * 9, // 90% of platform commission
            'commission_breakdown' => $commissionBreakdown,
            'vendor_earnings' => $vendorEarnings
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch commission data: ' . $e->getMessage()]);
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
                'updated_at' => $order['updated_at'],
                'last_status_updated' => $order['last_status_updated']
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
    
    // Include commission utilities
    require_once __DIR__ . '/../utils/commission.php';
    
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
        
        // Get order details including vendor_id and total_amount
        $stmt = $pdo->prepare("
            SELECT o.id, o.total_amount, p.vendor_id
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            return;
        }
        
        // Update order status
        $stmt = $pdo->prepare("
            UPDATE orders
            SET status = ?, status_notes = ?, updated_at = NOW(), last_status_updated = NOW()
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
        
        // Process commission if status is 'delivered'
        if ($newStatus === 'delivered') {
            $commissionResult = processCommission(
                $orderId,
                $order['vendor_id'],
                $order['total_amount']
            );
            
            if (!$commissionResult['success']) {
                // Log the error but don't fail the order status update
                error_log("Commission processing failed: " . $commissionResult['message']);
            }
        }
        
        // Always commit the transaction
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Order status updated successfully']);
        
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
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

function handleUpdateUser() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    // Extract user ID from the URL path
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    $path = str_replace('/poultry-hub-kenya/backend/', '', $path);
    $path = str_replace('/backend/', '', $path);
    $path = ltrim($path, '/');
    
    // Extract user ID from path like "api/admin/users/{user_id}"
    $pathParts = explode('/', $path);
    $userId = end($pathParts);
    
    if (!$userId || !is_string($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid user ID']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON data']);
        return;
    }
    
    // Validate required fields
    $allowedFields = ['email', 'full_name', 'phone', 'role'];
    $updateFields = [];
    $updateValues = [];
    
    foreach ($allowedFields as $field) {
        if (isset($input[$field])) {
            $updateFields[] = "$field = ?";
            $updateValues[] = $input[$field];
        }
    }
    
    if (empty($updateFields)) {
        http_response_code(400);
        echo json_encode(['error' => 'No valid fields to update']);
        return;
    }
    
    // Check if user exists
    try {
        $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        // Check if email is already taken by another user
        if (isset($input['email'])) {
            $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ? AND id != ?");
            $stmt->execute([$input['email'], $userId]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Email already taken by another user']);
                return;
            }
        }
        
        // Update user
        $updateValues[] = $userId; // Add user ID for WHERE clause
        $sql = "UPDATE user_profiles SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($updateValues);
        
        // Get updated user data
        $stmt = $pdo->prepare("SELECT id, email, full_name, phone, role, created_at FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        $updatedUser = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'message' => 'User updated successfully',
            'user' => $updatedUser
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update user: ' . $e->getMessage()]);
    }
}

function handleDeleteUser() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    // Extract user ID from the URL path
    $requestUri = $_SERVER['REQUEST_URI'] ?? '';
    $path = parse_url($requestUri, PHP_URL_PATH);
    $path = str_replace('/poultry-hub-kenya/backend/', '', $path);
    $path = str_replace('/backend/', '', $path);
    $path = ltrim($path, '/');
    
    // Extract user ID from path like "api/admin/users/{user_id}"
    $pathParts = explode('/', $path);
    $userId = end($pathParts);
    
    if (!$userId || !is_string($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid user ID']);
        return;
    }
    
    try {
        // Check if user exists
        $stmt = $pdo->prepare("SELECT id, role FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        // Prevent deletion of admin users
        if ($user['role'] === 'admin') {
            http_response_code(403);
            echo json_encode(['error' => 'Cannot delete admin users']);
            return;
        }
        
        // Start transaction
        $pdo->beginTransaction();
        
        // If user is a vendor, delete vendor profile first
        if ($user['role'] === 'vendor') {
            $stmt = $pdo->prepare("DELETE FROM vendors WHERE user_id = ?");
            $stmt->execute([$userId]);
        }
        
        // Delete user's orders
        $stmt = $pdo->prepare("DELETE FROM orders WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        // Delete user's cart items
        $stmt = $pdo->prepare("DELETE FROM cart WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        // Delete user's notifications
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE user_id = ?");
        $stmt->execute([$userId]);
        
        // Finally, delete the user
        $stmt = $pdo->prepare("DELETE FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        
        $pdo->commit();
        
        echo json_encode(['message' => 'User deleted successfully']);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete user: ' . $e->getMessage()]);
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
    
    // Get admin ID from JWT token
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    $adminId = $payload['user_id'];
    
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
        
        // Update vendor status with approval tracking
        $stmt = $pdo->prepare("UPDATE vendors SET status = 'approved', approved_at = NOW(), approved_by = ? WHERE id = ?");
        $stmt->execute([$adminId, $vendorId]);
        
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

function handleGetAdminProfile() {
    global $pdo;
    
    // Get Authorization header using the same method as handleUpdateAdminProfile
    $token = '';
    
    // Method 1: From getallheaders() (most reliable with Apache)
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    }
    // Method 2: From apache_request_headers()
    elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    }
    // Method 3: Direct from $_SERVER (fallback)
    elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['HTTP_AUTHORIZATION'];
    }
    // Method 4: From REDIRECT_HTTP_AUTHORIZATION (Apache rewrite fallback)
    elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    $token = preg_replace('/^Bearer\s+/i', '', $token);
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authorization token required']);
        return;
    }
    
    // Validate admin session
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }
    
    try {
        // Get admin ID from session
        $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$session) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid session']);
            return;
        }
        
        $adminId = $session['admin_id'];
        
        // Get admin profile
        $stmt = $pdo->prepare("SELECT id, full_name, email, phone, role, created_at, updated_at FROM user_profiles WHERE id = ? AND role = 'admin'");
        $stmt->execute([$adminId]);
        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$admin) {
            http_response_code(404);
            echo json_encode(['error' => 'Admin profile not found']);
            return;
        }
        
        // Get last login from admin_sessions (excluding current session)
        $stmt = $pdo->prepare("SELECT created_at as last_login FROM admin_sessions WHERE admin_id = ? AND session_token != ? ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([$adminId, $token]);
        $lastSession = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($lastSession) {
            $admin['last_login'] = $lastSession['last_login'];
        } else {
            // If no previous session found, use current session as last login
            $stmt = $pdo->prepare("SELECT created_at as last_login FROM admin_sessions WHERE admin_id = ? AND session_token = ?");
            $stmt->execute([$adminId, $token]);
            $currentSession = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($currentSession) {
                $admin['last_login'] = $currentSession['last_login'];
            }
        }
        
        echo json_encode($admin);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error getting admin profile: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to get admin profile: ' . $e->getMessage()]);
    }
}

function handleUpdateAdminProfile() {
    global $pdo;
    
    try {
        // Get Authorization header - prioritize getallheaders() as it works best with Apache
        $token = '';
        
        // Method 1: From getallheaders() (most reliable with Apache)
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            if (isset($headers['Authorization'])) {
                $token = $headers['Authorization'];
            }
        }
        // Method 2: From apache_request_headers()
        elseif (function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            if (isset($headers['Authorization'])) {
                $token = $headers['Authorization'];
            }
        }
        // Method 3: Direct from $_SERVER (fallback)
        elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $token = $_SERVER['HTTP_AUTHORIZATION'];
        }
        // Method 4: From REDIRECT_HTTP_AUTHORIZATION (Apache rewrite fallback)
        elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        
        $token = preg_replace('/^Bearer\s+/i', '', $token);
        
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Authorization token required']);
            return;
        }
        
        // Validate admin session
        if (!validateAdminSession($token)) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired session']);
            return;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON input']);
            return;
        }
        
        // Validate required fields
        if (!isset($input['full_name']) || !isset($input['email'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Full name and email are required']);
            return;
        }
        
        $full_name = trim($input['full_name']);
        $email = trim($input['email']);
        $phone = trim($input['phone'] ?? '');
        
        // Validate email format
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid email format']);
            return;
        }
        
        // Get admin ID from session
        $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$session) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid session']);
            return;
        }
        
        $adminId = $session['admin_id'];
        
        // Check if email is already taken by another user
        $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ? AND id != ?");
        $stmt->execute([$email, $adminId]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['error' => 'Email is already taken by another user']);
            return;
        }
        
        // Update admin profile
        $stmt = $pdo->prepare("UPDATE user_profiles SET full_name = ?, email = ?, phone = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$full_name, $email, $phone, $adminId]);
        
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'Admin profile not found']);
            return;
        }
        
        echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error updating admin profile: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to update profile: ' . $e->getMessage()]);
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Unexpected error updating admin profile: " . $e->getMessage());
        echo json_encode(['error' => 'An unexpected error occurred: ' . $e->getMessage()]);
    }
}

function validateAdminSession($token) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        return $stmt->fetch() !== false;
    } catch (PDOException $e) {
        error_log("Error validating admin session: " . $e->getMessage());
        return false;
    }
}

function handleDeleteContactMessage() {
    global $pdo;
    
    // Get Authorization header
    $token = '';
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    $token = preg_replace('/^Bearer\s+/i', '', $token);
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authorization token required']);
        return;
    }
    
    // Validate admin session
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Contact message ID is required']);
        return;
    }
    
    $messageId = $input['id'];
    
    try {
        // Check if message exists
        $stmt = $pdo->prepare("SELECT id FROM contact_messages WHERE id = ?");
        $stmt->execute([$messageId]);
        
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Contact message not found']);
            return;
        }
        
        // Delete the message
        $stmt = $pdo->prepare("DELETE FROM contact_messages WHERE id = ?");
        $stmt->execute([$messageId]);
        
        echo json_encode(['success' => true, 'message' => 'Contact message deleted successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error deleting contact message: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete contact message: ' . $e->getMessage()]);
    }
}

function handleDeleteOrder() {
    global $pdo;
    
    // Get Authorization header
    $token = '';
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    $token = preg_replace('/^Bearer\s+/i', '', $token);
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authorization token required']);
        return;
    }
    
    // Validate admin session
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID is required']);
        return;
    }
    
    $orderId = $input['id'];
    
    try {
        // Check if order exists
        $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Order not found']);
            return;
        }
        
        // Delete the order directly (no order_items table exists)
        $stmt = $pdo->prepare("DELETE FROM orders WHERE id = ?");
        $stmt->execute([$orderId]);
        
        echo json_encode(['success' => true, 'message' => 'Order deleted successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error deleting order: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete order: ' . $e->getMessage()]);
    }
}

function handleToggleUserAccountStatus() {
    global $pdo;
    
    // Get Authorization header
    $token = '';
    
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            $token = $headers['Authorization'];
        }
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }
    
    $token = preg_replace('/^Bearer\s+/i', '', $token);
    
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authorization token required']);
        return;
    }
    
    // Validate admin session
    if (!validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['user_id']) || !isset($input['action'])) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID and action are required']);
        return;
    }
    
    $userId = $input['user_id'];
    $action = $input['action']; // 'disable' or 'enable'
    
    if (!in_array($action, ['disable', 'enable'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action. Must be disable or enable']);
        return;
    }
    
    try {
        // Get current admin ID to prevent self-disabling
        $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$session) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid session']);
            return;
        }
        
        $adminId = $session['admin_id'];
        
        // Prevent admin from disabling themselves
        if ($userId === $adminId) {
            http_response_code(400);
            echo json_encode(['error' => 'You cannot disable your own account']);
            return;
        }
        
        // Check if user exists
        $stmt = $pdo->prepare("SELECT id, role FROM user_profiles WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }
        
        $newStatus = $action === 'disable' ? 'disabled' : 'active';
        
        // Update user_profiles table
        $stmt = $pdo->prepare("UPDATE user_profiles SET account_status = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$newStatus, $userId]);
        
        // If user is a vendor, also update vendors table
        if ($user['role'] === 'vendor') {
            $stmt = $pdo->prepare("UPDATE vendors SET account_status = ?, updated_at = NOW() WHERE user_id = ?");
            $stmt->execute([$newStatus, $userId]);
        }
        
        $actionText = $action === 'disable' ? 'disabled' : 'enabled';
        echo json_encode([
            'success' => true, 
            'message' => "User account has been {$actionText} successfully",
            'new_status' => $newStatus
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error toggling user account status: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to update account status: ' . $e->getMessage()]);
    }
}
?>
