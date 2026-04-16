<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';
require_once __DIR__ . '/../utils/system_logs.php';
require_once __DIR__ . '/../utils/wallet.php';
require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

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
        
        // Check password - support both bcrypt hashed passwords and plain text (for migration)
        $passwordValid = false;
        $storedPassword = $admin['password'] ?? '';
        
        // First try bcrypt verification (check if it looks like a bcrypt hash)
        if (!empty($storedPassword) && strlen($storedPassword) >= 60 && substr($storedPassword, 0, 4) === '$2y$') {
            $passwordValid = password_verify($password, $storedPassword);
        }
        
        // Fallback: check if password matches plain text (legacy) and rehash
        if (!$passwordValid && !empty($storedPassword) && $password === $storedPassword) {
            $passwordValid = true;
            // Rehash the password with bcrypt for security
            $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
            $updateStmt = $pdo->prepare("UPDATE user_profiles SET password = ? WHERE id = ?");
            $updateStmt->execute([$hashedPassword, $admin['id']]);
            error_log("Admin password rehashed for user ID: " . $admin['id']);
        }
        
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
        
        // Get advertisement revenue (total paid by vendors for ads)
        $stmt = $pdo->query("SELECT COALESCE(SUM(price), 0) as total FROM advertisements WHERE status IN ('pending', 'active', 'expired')");
        $adRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
        
        // Total platform revenue = commission + advertisement revenue
        $totalPlatformRevenue = floatval($platformCommission) + floatval($adRevenue);
        
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
            'totalRevenue' => $totalPlatformRevenue,
            'commissionRevenue' => floatval($platformCommission),
            'advertisementRevenue' => floatval($adRevenue),
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
        
        // Calculate total paid to vendors - sum all net_amount from vendor_earnings
        $stmt = $pdo->query("
            SELECT COALESCE(SUM(net_amount), 0) as total_paid
            FROM vendor_earnings
            WHERE status = 'confirmed'
        ");
        $vendorEarningsTotal = $stmt->fetch(PDO::FETCH_ASSOC)['total_paid'] ?? 0;
        
        echo json_encode([
            'success' => true,
            'platform_commission' => $platformCommission,
            'vendor_earnings_total' => floatval($vendorEarningsTotal), // Total actually paid to vendors
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
            SELECT 
                v.*, 
                u.email, 
                u.full_name, 
                u.phone,
                c.county_name,
                con.constituency_name,
                w.ward_name,
                (SELECT COUNT(*) FROM products WHERE vendor_id = v.id) as product_count
            FROM vendors v 
            JOIN user_profiles u ON v.user_id = u.id 
            LEFT JOIN counties c ON v.county_id = c.county_id
            LEFT JOIN constituencies con ON v.constituency_id = con.constituency_id
            LEFT JOIN wards w ON v.ward_id = w.ward_id
            ORDER BY v.created_at DESC
        ");
        $vendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response with all registration fields
        $formattedVendors = array_map(function($vendor) {
            return [
                'id' => $vendor['id'],
                'user_id' => $vendor['user_id'],
                'name' => $vendor['full_name'],
                'email' => $vendor['email'],
                'phone' => $vendor['phone'],
                'farmName' => $vendor['farm_name'],
                'farm_name' => $vendor['farm_name'],
                'farm_description' => $vendor['farm_description'] ?? '',
                'location' => $vendor['location'],
                'id_number' => $vendor['id_number'] ?? null,
                'county_id' => $vendor['county_id'] ?? null,
                'county_name' => $vendor['county_name'] ?? null,
                'constituency_id' => $vendor['constituency_id'] ?? null,
                'constituency_name' => $vendor['constituency_name'] ?? null,
                'ward_id' => $vendor['ward_id'] ?? null,
                'ward_name' => $vendor['ward_name'] ?? null,
                'status' => $vendor['status'],
                'registrationDate' => $vendor['created_at'],
                'created_at' => $vendor['created_at'],
                'product_count' => intval($vendor['product_count'] ?? 0),
                'productCount' => intval($vendor['product_count'] ?? 0)
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
                'subtotal' => floatval($order['subtotal']),
                'delivery_fee' => floatval($order['delivery_fee']),
                'amount' => floatval($order['total_amount']),
                'status' => $order['status'],
                'status_notes' => $order['status_notes'],
                'payment_method' => $order['payment_method'],
                'payment_account_number' => $order['payment_account_number'] ?? null,
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
    // Sanitize order ID from GET parameter
    require_once __DIR__ . '/../utils/security.php';
    $orderId = isset($_GET['id']) ? sanitizeInput($_GET['id']) : null;
    
    if (!$orderId || !isset($input['status'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Order ID and new status are required']);
        return;
    }
    
    $newStatus = $input['status'];
    $statusNotes = $input['status_notes'] ?? null;
    
    try {
        $pdo->beginTransaction();
        
        // Get order details including current status, vendor_id and total_amount
        $stmt = $pdo->prepare("
            SELECT o.id, o.status, o.total_amount, p.vendor_id
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
        $result = $stmt->execute([$newStatus, $statusNotes, $orderId]);
        
        // Check if update was successful
        $rowsAffected = $stmt->rowCount();
        if ($rowsAffected === 0) {
            // Check if order exists but status is already the same
            $stmt = $pdo->prepare("SELECT status FROM orders WHERE id = ?");
            $stmt->execute([$orderId]);
            $existingOrder = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$existingOrder) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Order not found']);
                return;
            } else if ($existingOrder['status'] === $newStatus) {
                // Status is already set to this value, commit and return success
                $pdo->commit();
                echo json_encode([
                    'success' => true, 
                    'message' => 'Order status is already set to ' . $newStatus
                ]);
                return;
            } else {
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode(['error' => 'Failed to update order status']);
                return;
            }
        }
        
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
        
        // Get current status before update to handle reversals
        $oldStatus = $order['status'];
        
        // If changing FROM delivered to another status, reverse commission/earnings
        if ($oldStatus === 'delivered' && $newStatus !== 'delivered') {
            // Reverse wallet earning/commission ledger for this delivered order.
            try {
                reverseWalletEarning($order['vendor_id'], $orderId);
            } catch (Exception $walletReverseError) {
                error_log("Wallet reversal failed for order {$orderId}: " . $walletReverseError->getMessage());
            }

            $reverseResult = reverseCommissionForOrder($orderId, $order['vendor_id'], $order['total_amount']);
            if (!$reverseResult['success']) {
                error_log("Commission reversal failed for order {$orderId}: " . ($reverseResult['message'] ?? 'Unknown error'));
            } else {
                error_log("Reversed commission/earnings for order {$orderId} (status changed from delivered to {$newStatus})");
            }
        }
        
        // Process commission if status is 'delivered'
        if ($newStatus === 'delivered') {
            try {
                // Check if commission already processed (to avoid duplicates)
                $stmt = $pdo->prepare("SELECT id FROM vendor_earnings WHERE order_id = ?");
                $stmt->execute([$orderId]);
                $existingEarning = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$existingEarning) {
                    // Verify order is actually delivered before processing commission
                    $stmt = $pdo->prepare("
                        SELECT o.total_amount, o.status, o.advertisement_id
                        FROM orders o
                        WHERE o.id = ? AND o.status = 'delivered'
                    ");
                    $stmt->execute([$orderId]);
                    $deliveredOrder = $stmt->fetch(PDO::FETCH_ASSOC);
                    
                    if ($deliveredOrder) {
                        $commissionResult = processCommission(
                            $orderId,
                            $order['vendor_id'],
                            $deliveredOrder['total_amount']
                        );
                        
                        if (!$commissionResult['success']) {
                            // Log the error but don't fail the order status update
                            error_log("Commission processing failed for order {$orderId}: " . $commissionResult['message']);
                        } else {
                            error_log("Commission processed successfully for order {$orderId}");
                        }
                    } else {
                        error_log("Order {$orderId} status update to delivered failed or order not found");
                    }
                } else {
                    error_log("Commission already processed for order {$orderId}, skipping");
                }
            } catch (Exception $commissionError) {
                // Log the error but don't fail the order status update
                error_log("Exception during commission processing for order {$orderId}: " . $commissionError->getMessage());
                error_log("Stack trace: " . $commissionError->getTraceAsString());
            }
        }
        
        // Notify customer and vendor about order status change
        require_once __DIR__ . '/../utils/notifications.php';
        
        // Get order details for notifications
        $stmt = $pdo->prepare("
            SELECT o.user_id, o.vendor_id, o.order_number, p.name as product_name, u.full_name as customer_name
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            JOIN user_profiles u ON o.user_id = u.id
            WHERE o.id = ?
        ");
        $stmt->execute([$orderId]);
        $orderDetails = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($orderDetails) {
            // Notify customer
            $customerMessage = "Your order #{$orderDetails['order_number']} status has been updated to: {$newStatus}";
            notifyUser($orderDetails['user_id'], $customerMessage, 'order');
            
            // Notify vendor
            if ($orderDetails['vendor_id']) {
                $vendorMessage = "Order #{$orderDetails['order_number']} for '{$orderDetails['product_name']}' status updated to: {$newStatus}";
                notifyVendor($orderDetails['vendor_id'], $vendorMessage, 'order');
            }
            
            // Notify other admins
            $adminMessage = "Order #{$orderDetails['order_number']} status changed to '{$newStatus}' for customer '{$orderDetails['customer_name']}'";
            notifyAllAdmins($adminMessage, 'order');
        }
        
        // Always commit the transaction
        $pdo->commit();
        
        // Send success response FIRST before any background operations
        echo json_encode(['success' => true, 'message' => 'Order status updated successfully']);
        
        // Flush output to ensure response is sent immediately
        if (function_exists('fastcgi_finish_request')) {
            fastcgi_finish_request();
        }
        
        // Queue/send SMS notifications via a dedicated service (best-effort, don't fail status update)
        try {
            require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

            $stmt = $pdo->prepare("
                SELECT o.*, u.full_name as customer_name, u.phone as customer_phone, u.email as customer_email, p.vendor_id
                FROM orders o
                JOIN user_profiles u ON o.user_id = u.id
                JOIN products p ON o.product_id = p.id
                WHERE o.id = ?
            ");
            $stmt->execute([$orderId]);
            $orderForSMS = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($orderForSMS) {
                call_user_func(['OrderNotificationService', 'orderStatusChanged'], $pdo, $orderForSMS, $newStatus);
            }
        } catch (Exception $smsError) {
            error_log('Order status updated but SMS queue/send failed: ' . $smsError->getMessage());
        }
        
        // Update ad revenue AFTER response is sent (for ad orders only)
        // This is done outside the transaction and after response is sent so it never blocks
        if ($newStatus === 'delivered') {
            try {
                // Check if this is an ad order
                $stmt = $pdo->prepare("SELECT advertisement_id, total_amount FROM orders WHERE id = ?");
                $stmt->execute([$orderId]);
                $orderCheck = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if ($orderCheck && $orderCheck['advertisement_id']) {
                    // Update ad revenue in a separate, non-blocking operation
                    require_once __DIR__ . '/../routes/advertisements.php';
                    $adRevenueUpdated = updateAdRevenue($orderCheck['advertisement_id'], $orderCheck['total_amount']);
                    if (!$adRevenueUpdated) {
                        error_log("Warning: Failed to update ad revenue for ad {$orderCheck['advertisement_id']} after order {$orderId} was delivered");
                    }
                }
            } catch (Exception $adRevenueError) {
                // Log but don't fail - order status update already succeeded and response already sent
                error_log("Error updating ad revenue after order status update: " . $adRevenueError->getMessage());
            }
        }
        
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        error_log("Error updating order status: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        echo json_encode(['error' => 'Failed to update order status: ' . $e->getMessage()]);
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
    
    // Get admin ID from active session token
    $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
    $stmt->execute([$token]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$session) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid or expired session']);
        return;
    }
    $adminId = $session['admin_id'];
    
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
        
        // Notify other admins about vendor approval
        require_once __DIR__ . '/../utils/notifications.php';
        notifyAllAdmins("Vendor '{$vendorName}' has been approved and can now sell products", 'success');
        
        // Get vendor user_id for logging
        $stmt = $pdo->prepare("SELECT user_id FROM vendors WHERE id = ?");
        $stmt->execute([$vendorId]);
        $vendorUser = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Log admin action
        logActivity(
            $adminId,
            'admin',
            'approve_vendor',
            "Approved vendor: {$vendorName}",
            ['vendor_id' => $vendorId, 'vendor_user_id' => ($vendorUser && isset($vendorUser['user_id'])) ? $vendorUser['user_id'] : null]
        );
        
        // Log vendor event
        if ($vendorUser && isset($vendorUser['user_id'])) {
            logActivity(
                $vendorUser['user_id'],
                'vendor',
                'vendor_approved',
                "Vendor account approved by admin",
                ['vendor_id' => $vendorId, 'approved_by' => $adminId]
            );
        }
        
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
        
        // Get admin ID from session
        $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        $adminId = ($session && isset($session['admin_id'])) ? $session['admin_id'] : null;
        
        // Update vendor status
        $stmt = $pdo->prepare("UPDATE vendors SET status = 'rejected', rejected_at = NOW(), rejected_by = ? WHERE id = ?");
        $stmt->execute([$adminId, $vendorId]);
        
        // Notify vendor about rejection
        $vendorName = $vendor['farm_name'] ?: $vendor['full_name'];
        notifyVendor($vendorId, "Your vendor account '{$vendorName}' has been rejected. Reason: {$reason}", 'warning');
        
        // Get vendor user_id for logging
        $stmt = $pdo->prepare("SELECT user_id FROM vendors WHERE id = ?");
        $stmt->execute([$vendorId]);
        $vendorUser = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Log admin action
        if ($adminId) {
            logActivity(
                $adminId,
                'admin',
                'reject_vendor',
                "Rejected vendor: {$vendorName}",
                ['vendor_id' => $vendorId, 'reason' => $reason, 'vendor_user_id' => ($vendorUser && isset($vendorUser['user_id'])) ? $vendorUser['user_id'] : null]
            );
        }
        
        // Log vendor event
        if ($vendorUser && isset($vendorUser['user_id'])) {
            logActivity(
                $vendorUser['user_id'],
                'vendor',
                'vendor_rejected',
                "Vendor account rejected by admin",
                ['vendor_id' => $vendorId, 'reason' => $reason, 'rejected_by' => $adminId]
            );
        }
        
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
        
        // Notify other admins about product approval
        require_once __DIR__ . '/../utils/notifications.php';
        notifyAllAdmins("Product '{$product['name']}' has been approved and is now live", 'success');
        
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

// validateAdminSession is now defined in utils/auth.php - removed duplicate

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

function handleBulkDeleteOrders() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized or invalid session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['ids']) || !is_array($input['ids'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Array of Order IDs is required']);
        return;
    }
    
    $orderIds = $input['ids'];
    if (empty($orderIds)) {
        echo json_encode(['success' => true, 'message' => 'No orders selected for deletion', 'count' => 0]);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Create placeholders for the IN clause (?, ?, ?)
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
        
        $sql = "DELETE FROM orders WHERE id IN ($placeholders)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($orderIds);
        
        $count = $stmt->rowCount();
        $pdo->commit();
        
        echo json_encode([
            'success' => true, 
            'message' => "Successfully deleted $count orders",
            'count' => $count
        ]);
        
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to bulk delete orders: ' . $e->getMessage()]);
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

function handleValidateAdminSession() {
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
    
    try {
        $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
        $stmt->execute([$token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$session) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid or expired admin session']);
            return;
        }
        
        echo json_encode([
            'admin_id' => $session['admin_id'],
            'user_id' => $session['admin_id'],
            'valid' => true
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        error_log("Error validating admin session: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to validate session']);
    }
}

function handleAdminWalletReport() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $periodType = $_GET['period_type'] ?? 'monthly';
    if (!in_array($periodType, ['daily', 'weekly', 'monthly', 'yearly'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid period_type. Use daily, weekly, monthly, or yearly']);
        return;
    }

    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;

    try {
        $report = getWalletReportByPeriod($periodType, $startDate, $endDate);
        echo json_encode(['success' => true, 'report' => $report]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch wallet report: ' . $e->getMessage()]);
    }
}

function handleAdminWalletTransactions() {
    global $pdo;

    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $vendorId = $_GET['vendor_id'] ?? null;
    $status = $_GET['status'] ?? null;
    $type = $_GET['type'] ?? null;
    $limit = intval($_GET['limit'] ?? 100);
    $limit = min(max($limit, 1), 500);

    try {
        $where = [];
        $params = [];

        if ($vendorId) {
            $where[] = 'wt.vendor_id = ?';
            $params[] = $vendorId;
        }
        if ($status) {
            $where[] = 'wt.status = ?';
            $params[] = $status;
        }
        if ($type) {
            $where[] = 'wt.type = ?';
            $params[] = $type;
        }

        $whereSql = empty($where) ? '' : ('WHERE ' . implode(' AND ', $where));
        $sql = "
            SELECT
                wt.*,
                v.farm_name,
                o.order_number
            FROM wallet_transactions wt
            JOIN vendors v ON v.id = wt.vendor_id
            LEFT JOIN orders o ON o.id = wt.order_id
            {$whereSql}
            ORDER BY wt.created_at DESC
            LIMIT {$limit}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode(['success' => true, 'transactions' => $rows]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch wallet transactions: ' . $e->getMessage()]);
    }
}

function handleAdminPayouts() {
    global $pdo;

    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $status = $_GET['status'] ?? null;
    $vendorId = $_GET['vendor_id'] ?? null;
    $periodType = $_GET['period_type'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    $limit = intval($_GET['limit'] ?? 100);
    $limit = min(max($limit, 1), 500);

    try {
        $where = [];
        $params = [];

        if ($status) {
            $where[] = 'p.status = ?';
            $params[] = $status;
        }
        if ($vendorId) {
            $where[] = 'p.vendor_id = ?';
            $params[] = $vendorId;
        }

        if ($periodType) {
            if (!in_array($periodType, ['daily', 'weekly', 'monthly', 'yearly', 'manual'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid period_type']);
                return;
            }

            [$rangeStart, $rangeEnd] = getWalletPeriodRange($periodType, $startDate, $endDate);
            $where[] = 'p.start_date = ?';
            $where[] = 'p.end_date = ?';
            $params[] = $rangeStart;
            $params[] = $rangeEnd;

            // For non-manual views, keep rows for the same logical period type.
            if ($periodType !== 'manual') {
                $where[] = 'p.period_type = ?';
                $params[] = $periodType;
            }
        }

        $whereSql = empty($where) ? '' : ('WHERE ' . implode(' AND ', $where));
        $sql = "
            SELECT
                p.*,
                v.farm_name,
                COALESCE(vpa.paystack_recipient_code, r.paystack_recipient_code) as paystack_recipient_code,
                vpa.method as payout_method,
                vpa.provider_name as payout_provider_name,
                vpa.account_last4 as payout_account_last4
            FROM payouts p
            JOIN vendors v ON v.id = p.vendor_id
            LEFT JOIN vendor_transfer_recipients r ON r.vendor_id = p.vendor_id
            LEFT JOIN (
                SELECT vpa1.vendor_id, vpa1.method, vpa1.provider_name, vpa1.account_last4, vpa1.paystack_recipient_code
                FROM vendor_payout_accounts vpa1
                INNER JOIN (
                    SELECT vendor_id, MAX(id) as max_id
                    FROM vendor_payout_accounts
                    WHERE is_active = 1
                    GROUP BY vendor_id
                ) vpa2 ON vpa2.max_id = vpa1.id
            ) vpa ON vpa.vendor_id = p.vendor_id
            {$whereSql}
            ORDER BY p.created_at DESC
            LIMIT {$limit}
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        echo json_encode([
            'success' => true,
            'payouts' => $rows,
            'period_type' => $periodType,
            'start_date' => $rangeStart ?? null,
            'end_date' => $rangeEnd ?? null
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch payouts: ' . $e->getMessage()]);
    }
}

function handleAdminSetVendorRecipientCode() {
    global $pdo;

    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $vendorId = $input['vendor_id'] ?? null;
    $vendorEmail = trim($input['vendor_email'] ?? '');
    $recipientCode = trim($input['paystack_recipient_code'] ?? '');

    if ((!$vendorId && $vendorEmail === '') || $recipientCode === '') {
        http_response_code(400);
        echo json_encode(['error' => 'vendor_email (or vendor_id) and paystack_recipient_code are required']);
        return;
    }

    try {
        if ($vendorEmail !== '') {
            $stmt = $pdo->prepare("\n                SELECT v.id\n                FROM vendors v\n                JOIN user_profiles u ON u.id = v.user_id\n                WHERE LOWER(u.email) = LOWER(?)\n                LIMIT 1\n            ");
            $stmt->execute([$vendorEmail]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$vendor) {
                http_response_code(404);
                echo json_encode(['error' => 'Vendor not found for the provided email']);
                return;
            }
            $vendorId = $vendor['id'];
        } else {
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE id = ?");
            $stmt->execute([$vendorId]);
            if (!$stmt->fetch(PDO::FETCH_ASSOC)) {
                http_response_code(404);
                echo json_encode(['error' => 'Vendor not found']);
                return;
            }
        }

        upsertVendorRecipientCode($vendorId, $recipientCode);
        echo json_encode(['success' => true, 'message' => 'Recipient code saved successfully']);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save recipient code: ' . $e->getMessage()]);
    }
}

function handleAdminProcessManualPayouts() {
    global $pdo;

    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $periodType = $input['period_type'] ?? 'manual';
    $startDate = $input['start_date'] ?? null;
    $endDate = $input['end_date'] ?? null;
    $autoTransfer = !isset($input['auto_transfer']) || boolval($input['auto_transfer']);
    $vendorIds = isset($input['vendor_ids']) && is_array($input['vendor_ids']) ? $input['vendor_ids'] : [];

    if (!in_array($periodType, ['daily', 'weekly', 'monthly', 'yearly', 'manual'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid period_type']);
        return;
    }

    [$rangeStart, $rangeEnd] = getWalletPeriodRange($periodType, $startDate, $endDate);

    try {
        $where = [];
        $params = [$rangeStart, $rangeEnd, $rangeStart, $rangeEnd, $periodType];

        if (!empty($vendorIds)) {
            $placeholders = implode(',', array_fill(0, count($vendorIds), '?'));
            $where[] = "v.id IN ({$placeholders})";
            $params = array_merge($params, $vendorIds);
        }

        $whereSql = empty($where) ? '' : ('WHERE ' . implode(' AND ', $where));

        $sql = "
            SELECT
                v.id as vendor_id,
                v.farm_name,
                u.email,
                COALESCE(pe.period_earned, 0) as period_earned,
                COALESCE(pp.period_payouts, 0) as period_payouts,
                GREATEST(COALESCE(pe.period_earned, 0) - COALESCE(pp.period_payouts, 0), 0) as payout_amount
            FROM vendors v
            JOIN user_profiles u ON u.id = v.user_id
            LEFT JOIN (
                SELECT vendor_id, COALESCE(SUM(net_amount), 0) as period_earned
                FROM vendor_earnings
                WHERE status = 'confirmed'
                  AND DATE(COALESCE(confirmed_at, created_at)) BETWEEN ? AND ?
                GROUP BY vendor_id
            ) pe ON pe.vendor_id = v.id
            LEFT JOIN (
                SELECT vendor_id, COALESCE(SUM(amount), 0) as period_payouts
                FROM payouts
                WHERE start_date = ?
                  AND end_date = ?
                  AND period_type = ?
                  AND status IN ('pending', 'approved', 'paid')
                GROUP BY vendor_id
            ) pp ON pp.vendor_id = v.id
            {$whereSql}
            HAVING payout_amount > 0
            ORDER BY payout_amount DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $wallets = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $results = [];

        foreach ($wallets as $walletRow) {
            $vendorId = $walletRow['vendor_id'];
            $amount = round(floatval($walletRow['payout_amount'] ?? 0), 2);

            if ($amount <= 0) {
                continue;
            }

            $pdo->beginTransaction();

            $existingStmt = $pdo->prepare("\n                SELECT id, status FROM payouts\n                WHERE vendor_id = ? AND period_type = ? AND start_date = ? AND end_date = ?\n                  AND status IN ('pending', 'approved', 'paid')\n                ORDER BY id DESC\n                LIMIT 1\n                FOR UPDATE\n            ");
            $existingStmt->execute([$vendorId, $periodType, $rangeStart, $rangeEnd]);
            $existingPayout = $existingStmt->fetch(PDO::FETCH_ASSOC);

            if ($existingPayout) {
                $pdo->commit();
                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'skipped',
                    'reason' => 'Payout already exists for selected period',
                    'payout_id' => intval($existingPayout['id'])
                ];
                continue;
            }

            $insertStmt = $pdo->prepare("\n                INSERT INTO payouts (vendor_id, amount, period_type, start_date, end_date, status)\n                VALUES (?, ?, ?, ?, ?, 'pending')\n            ");
            $insertStmt->execute([$vendorId, $amount, $periodType, $rangeStart, $rangeEnd]);
            $payoutId = intval($pdo->lastInsertId());

            $transferReference = 'PAYOUT-' . $payoutId . '-' . date('YmdHis');

            $updateRefStmt = $pdo->prepare("UPDATE payouts SET paystack_transfer_reference = ? WHERE id = ?");
            $updateRefStmt->execute([$transferReference, $payoutId]);

            $pdo->commit();

            if (!$autoTransfer) {
                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'pending',
                    'reason' => 'Payout created but transfer not initiated',
                    'payout_id' => $payoutId,
                    'reference' => $transferReference,
                    'amount' => $amount
                ];
                continue;
            }

            $recipientCode = getVendorRecipientCode($vendorId);
            if (!$recipientCode) {
                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'pending',
                    'reason' => 'Missing Paystack recipient code',
                    'payout_id' => $payoutId,
                    'reference' => $transferReference,
                    'amount' => $amount
                ];
                continue;
            }

            $transferResponse = createPaystackTransfer(
                $amount,
                $recipientCode,
                $transferReference,
                'Vendor payout for ' . $periodType . ' period'
            );

            $successfulTransfer = !empty($transferResponse['response']['status']);

            $pdo->beginTransaction();

            $payoutLockStmt = $pdo->prepare("SELECT * FROM payouts WHERE id = ? FOR UPDATE");
            $payoutLockStmt->execute([$payoutId]);
            $payout = $payoutLockStmt->fetch(PDO::FETCH_ASSOC);

            if (!$payout) {
                $pdo->rollBack();
                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'failed',
                    'reason' => 'Payout record disappeared before settlement',
                    'payout_id' => $payoutId
                ];
                continue;
            }

            if ($successfulTransfer) {
                $wallet = getVendorWallet($vendorId, true);
                $balanceBefore = floatval($wallet['available_balance'] ?? 0);
                $settledAmount = round(floatval($payout['amount']), 2);
                $balanceAfter = $balanceBefore - $settledAmount;

                $ledgerCheckStmt = $pdo->prepare("\n                    SELECT id FROM wallet_transactions\n                    WHERE vendor_id = ? AND reference = ? AND type = 'payout'\n                    LIMIT 1\n                ");
                $ledgerCheckStmt->execute([$vendorId, $transferReference]);
                $existingLedger = $ledgerCheckStmt->fetch(PDO::FETCH_ASSOC);

                if (!$existingLedger) {
                    $insertLedgerStmt = $pdo->prepare("\n                        INSERT INTO wallet_transactions\n                            (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)\n                        VALUES (?, NULL, 'payout', ?, ?, ?, 'paid', ?)\n                    ");
                    $insertLedgerStmt->execute([
                        $vendorId,
                        $settledAmount,
                        $balanceBefore,
                        $balanceAfter,
                        $transferReference
                    ]);

                    $walletUpdateStmt = $pdo->prepare("\n                        UPDATE vendor_wallet\n                        SET available_balance = GREATEST(available_balance - ?, 0),\n                            total_withdrawn = total_withdrawn + ?,\n                            updated_at = NOW()\n                        WHERE vendor_id = ?\n                    ");
                    $walletUpdateStmt->execute([$settledAmount, $settledAmount, $vendorId]);
                }

                $updatePayoutStmt = $pdo->prepare("\n                    UPDATE payouts\n                    SET status = 'paid',\n                        failure_reason = NULL,\n                        last_error_code = NULL,\n                        updated_at = NOW()\n                    WHERE id = ?\n                ");
                $updatePayoutStmt->execute([$payoutId]);

                $pdo->commit();

                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'paid',
                    'payout_id' => $payoutId,
                    'reference' => $transferReference,
                    'amount' => $amount,
                    'paystack_response' => $transferResponse['response'] ?? null
                ];
            } else {
                $failureReason = $transferResponse['response']['message'] ?? $transferResponse['curl_error'] ?? 'Transfer failed';
                $failureCode = $transferResponse['response']['code'] ?? null;

                $updatePayoutStmt = $pdo->prepare("\n                    UPDATE payouts\n                    SET status = 'failed',\n                        failure_reason = ?,\n                        last_error_code = ?,\n                        updated_at = NOW()\n                    WHERE id = ?\n                ");
                $updatePayoutStmt->execute([$failureReason, $failureCode, $payoutId]);
                $pdo->commit();

                $results[] = [
                    'vendor_id' => $vendorId,
                    'vendor_name' => $walletRow['farm_name'],
                    'vendor_email' => $walletRow['email'] ?? null,
                    'status' => 'failed',
                    'reason' => $failureReason,
                    'payout_id' => $payoutId,
                    'reference' => $transferReference,
                    'amount' => $amount,
                    'paystack_response' => $transferResponse['response'] ?? null
                ];
            }
        }

        echo json_encode([
            'success' => true,
            'period_type' => $periodType,
            'start_date' => $rangeStart,
            'end_date' => $rangeEnd,
            'results' => $results
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to process manual payouts: ' . $e->getMessage()]);
    }
}

function handleAdminRetryFailedPayout() {
    global $pdo;

    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $payoutId = intval($input['payout_id'] ?? 0);

    if ($payoutId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Valid payout_id is required']);
        return;
    }

    try {
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("\n            SELECT
                p.*,
                v.farm_name,
                u.email,
                COALESCE(vpa.paystack_recipient_code, r.paystack_recipient_code) as paystack_recipient_code
            FROM payouts p
            JOIN vendors v ON v.id = p.vendor_id
            JOIN user_profiles u ON u.id = v.user_id
            LEFT JOIN vendor_transfer_recipients r ON r.vendor_id = p.vendor_id
            LEFT JOIN (
                SELECT vpa1.vendor_id, vpa1.paystack_recipient_code
                FROM vendor_payout_accounts vpa1
                INNER JOIN (
                    SELECT vendor_id, MAX(id) as max_id
                    FROM vendor_payout_accounts
                    WHERE is_active = 1
                    GROUP BY vendor_id
                ) vpa2 ON vpa2.max_id = vpa1.id
            ) vpa ON vpa.vendor_id = p.vendor_id
            WHERE p.id = ?
            FOR UPDATE
        ");
        $stmt->execute([$payoutId]);
        $payout = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$payout) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Payout not found']);
            return;
        }

        if ($payout['status'] !== 'failed') {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Only failed payouts can be retried']);
            return;
        }

        $recipientCode = trim((string)($payout['paystack_recipient_code'] ?? ''));
        if ($recipientCode === '') {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Missing Paystack recipient code for this vendor']);
            return;
        }

        $newReference = 'PAYOUT-' . $payoutId . '-RETRY-' . date('YmdHis');
        $amount = round(floatval($payout['amount'] ?? 0), 2);
        if ($amount <= 0) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Invalid payout amount']);
            return;
        }

        $pdo->commit();

        $transferResponse = createPaystackTransfer(
            $amount,
            $recipientCode,
            $newReference,
            'Retry payout for ' . ($payout['period_type'] ?? 'manual') . ' period'
        );

        $successfulTransfer = !empty($transferResponse['response']['status']);
        $failureReason = $transferResponse['response']['message'] ?? $transferResponse['curl_error'] ?? 'Transfer failed';
        $failureCode = $transferResponse['response']['code'] ?? null;

        $pdo->beginTransaction();

        $lockStmt = $pdo->prepare("SELECT * FROM payouts WHERE id = ? FOR UPDATE");
        $lockStmt->execute([$payoutId]);
        $lockedPayout = $lockStmt->fetch(PDO::FETCH_ASSOC);

        if (!$lockedPayout) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Payout not found during retry']);
            return;
        }

        if ($successfulTransfer) {
            $wallet = getVendorWallet($lockedPayout['vendor_id'], true);
            $balanceBefore = floatval($wallet['available_balance'] ?? 0);
            $balanceAfter = $balanceBefore - $amount;

            $ledgerCheckStmt = $pdo->prepare("\n                SELECT id FROM wallet_transactions
                WHERE vendor_id = ? AND reference = ? AND type = 'payout'
                LIMIT 1
            ");
            $ledgerCheckStmt->execute([$lockedPayout['vendor_id'], $newReference]);
            $existingLedger = $ledgerCheckStmt->fetch(PDO::FETCH_ASSOC);

            if (!$existingLedger) {
                $insertLedgerStmt = $pdo->prepare("\n                    INSERT INTO wallet_transactions
                        (vendor_id, order_id, type, amount, balance_before, balance_after, status, reference)
                    VALUES (?, NULL, 'payout', ?, ?, ?, 'paid', ?)
                ");
                $insertLedgerStmt->execute([
                    $lockedPayout['vendor_id'],
                    $amount,
                    $balanceBefore,
                    $balanceAfter,
                    $newReference
                ]);

                $walletUpdateStmt = $pdo->prepare("\n                    UPDATE vendor_wallet
                    SET available_balance = GREATEST(available_balance - ?, 0),
                        total_withdrawn = total_withdrawn + ?,
                        updated_at = NOW()
                    WHERE vendor_id = ?
                ");
                $walletUpdateStmt->execute([$amount, $amount, $lockedPayout['vendor_id']]);
            }

            $updatePayoutStmt = $pdo->prepare("\n                UPDATE payouts
                SET status = 'paid',
                    paystack_transfer_reference = ?,
                    failure_reason = NULL,
                    last_error_code = NULL,
                    retry_count = retry_count + 1,
                    last_retry_at = NOW(),
                    updated_at = NOW()
                WHERE id = ?
            ");
            $updatePayoutStmt->execute([$newReference, $payoutId]);

            $pdo->commit();
            echo json_encode([
                'success' => true,
                'status' => 'paid',
                'message' => 'Payout retried successfully',
                'payout_id' => $payoutId,
                'reference' => $newReference,
                'vendor_name' => $payout['farm_name'] ?? null,
                'vendor_email' => $payout['email'] ?? null,
                'amount' => $amount,
                'paystack_response' => $transferResponse['response'] ?? null
            ]);
            return;
        }

        $updateFailedStmt = $pdo->prepare("\n            UPDATE payouts
            SET status = 'failed',
                paystack_transfer_reference = ?,
                failure_reason = ?,
                last_error_code = ?,
                retry_count = retry_count + 1,
                last_retry_at = NOW(),
                updated_at = NOW()
            WHERE id = ?
        ");
        $updateFailedStmt->execute([$newReference, $failureReason, $failureCode, $payoutId]);

        $pdo->commit();
        echo json_encode([
            'success' => false,
            'status' => 'failed',
            'message' => 'Retry attempt failed',
            'reason' => $failureReason,
            'payout_id' => $payoutId,
            'reference' => $newReference,
            'vendor_name' => $payout['farm_name'] ?? null,
            'vendor_email' => $payout['email'] ?? null,
            'amount' => $amount,
            'paystack_response' => $transferResponse['response'] ?? null
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to retry payout: ' . $e->getMessage()]);
    }
}
?>
