<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';
require_once __DIR__ . '/../utils/system_logs.php';
require_once __DIR__ . '/../utils/commission.php';
require_once __DIR__ . '/../utils/wallet.php';
require_once __DIR__ . '/../services/notifications/OrderNotificationService.php';

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
        
        // Get products with order counts
        $stmt = $pdo->prepare("\n            SELECT p.*, 
                   COALESCE(order_counts.order_count, 0) as order_count
            FROM products p
            LEFT JOIN (
                SELECT product_id, COUNT(DISTINCT id) as order_count
                FROM orders
                WHERE status != 'cancelled'
                GROUP BY product_id
            ) order_counts ON p.id = order_counts.product_id
            WHERE p.vendor_id = ? 
            ORDER BY p.created_at DESC
        ");
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
    
    // Validate description length
    $config = require __DIR__ . '/../config/ai_config.php';
    $minChars = $config['limits']['description_length']['min_characters'] ?? 30;
    $maxChars = $config['limits']['description_length']['max_characters'] ?? 2500;
    $description = trim($input['description']);
    $charCount = strlen($description);
    
    if ($charCount < $minChars) {
        http_response_code(400);
        echo json_encode([
            'error' => "Description is too short. Minimum {$minChars} characters required. Current: {$charCount} characters."
        ]);
        return;
    }
    
    if ($charCount > $maxChars) {
        http_response_code(400);
        echo json_encode([
            'error' => "Description is too long. Maximum {$maxChars} characters allowed. Current: {$charCount} characters."
        ]);
        return;
    }
    
    // Validate images (all images should be verified - this is handled during upload)
    // But we can add an extra check here if needed
    $imageUrls = $input['image_urls'] ?? [];
    if (empty($imageUrls) || !is_array($imageUrls)) {
        http_response_code(400);
        echo json_encode(['error' => 'At least one verified image is required']);
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
        
        // Normalize category to match database enum
        require_once __DIR__ . '/../utils/category_mapper.php';
        $normalizedCategory = normalizeCategory($input['category']);
        
        // Store AI verification data if images were uploaded
        // Images are automatically verified during upload, so if we have image URLs,
        // they have already been verified by AI
        $aiVerified = 0;
        $aiConfidence = null;
        $aiAnalysisData = null;
        $aiVerifiedAt = null;
        
        if (!empty($input['image_urls']) && is_array($input['image_urls']) && count($input['image_urls']) > 0) {
            // Mark as verified since images passed verification during upload
            $aiVerified = 1;
            $aiVerifiedAt = date('Y-m-d H:i:s');
            
            // Store AI analysis data if provided (from image verification)
            if (isset($input['ai_analysis']) && is_array($input['ai_analysis'])) {
                // Store the full analysis data
                $aiAnalysisData = json_encode($input['ai_analysis'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
                
                // Extract confidence score
                $aiConfidence = isset($input['ai_analysis']['confidence']) 
                    ? (float)$input['ai_analysis']['confidence'] 
                    : null;
                
                // Ensure confidence is between 0 and 1
                if ($aiConfidence !== null) {
                    $aiConfidence = max(0, min(1, $aiConfidence));
                }
            } else {
                // If no analysis data provided, set default confidence
                // (images were verified, so we assume they passed with good confidence)
                $aiConfidence = 0.8; // Default confidence for verified images
            }
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO products (
                id, vendor_id, name, description, price, category, stock_quantity, 
                minimum_order_quantity, image_urls, is_active, ai_verified, ai_confidence, ai_analysis_data, ai_verified_at
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $productId,
            $vendor['id'],
            $input['name'],
            $input['description'],
            $input['price'],
            $normalizedCategory,
            $input['stock_quantity'] ?? 0,
            $input['minimum_order_quantity'] ?? 1,
            json_encode($input['image_urls'] ?? []),
            $aiVerified,
            $aiConfidence,
            $aiAnalysisData,
            $aiVerifiedAt
        ]);
        
        // Get vendor name for notification
        $stmt = $pdo->prepare("SELECT v.farm_name, u.full_name FROM vendors v JOIN user_profiles u ON v.user_id = u.id WHERE v.id = ?");
        $stmt->execute([$vendor['id']]);
        $vendorInfo = $stmt->fetch(PDO::FETCH_ASSOC);
        
        // Notify admins about new product
        $vendorName = $vendorInfo['farm_name'] ?: $vendorInfo['full_name'];
        notifyAllAdmins("New product submitted: '{$input['name']}' by {$vendorName}", 'info');
        
        // Log product creation
        logActivity(
            $payload['user_id'],
            'vendor',
            'create_product',
            "Created new product: {$input['name']}",
            ['product_id' => $productId, 'category' => $normalizedCategory, 'price' => $input['price']]
        );
        
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
        
        $params = [
            $input['name'],
            $input['description'],
            $input['price'],
            $input['category'],
            $input['stock_quantity'] ?? 0,
            $input['minimum_order_quantity'] ?? 1,
            json_encode($input['image_urls'] ?? []),
        ];

        $setClauses = [
            "name = ?",
            "description = ?",
            "price = ?",
            "category = ?",
            "stock_quantity = ?",
            "minimum_order_quantity = ?",
            "image_urls = ?",
        ];

        if (isset($input['ai_analysis']) && is_array($input['ai_analysis'])) {
            $aiAnalysisData = json_encode($input['ai_analysis'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $aiConfidence = isset($input['ai_analysis']['confidence'])
                ? (float)$input['ai_analysis']['confidence']
                : 0.8;
            $aiConfidence = max(0, min(1, $aiConfidence));

            $setClauses[] = "ai_verified = ?";
            $setClauses[] = "ai_confidence = ?";
            $setClauses[] = "ai_analysis_data = ?";
            $setClauses[] = "ai_verified_at = ?";

            $params[] = 1;
            $params[] = $aiConfidence;
            $params[] = $aiAnalysisData;
            $params[] = date('Y-m-d H:i:s');
        }

        $params[] = $productId;

        $stmt = $pdo->prepare("
            UPDATE products 
            SET " . implode(', ', $setClauses) . ", updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute($params);
        
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
        
        // Get pending orders for this vendor's products
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as total 
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE p.vendor_id = ? AND o.status = 'pending'
        ");
        $stmt->execute([$vendorId]);
        $pendingOrders = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get total revenue from confirmed orders only
        $stmt = $pdo->prepare("
            SELECT SUM(o.subtotal) as total 
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
        ");
        $stmt->execute([$vendorId]);
        $totalRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;
        
        echo json_encode([
            'totalProducts' => intval($totalProducts),
            'activeProducts' => intval($activeProducts),
            'pendingProducts' => intval($pendingProducts),
            'totalOrders' => intval($totalOrders),
            'pendingOrders' => intval($pendingOrders),
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
            SELECT 
                o.*, 
                o.subtotal as order_subtotal,
                p.name as product_name, 
                p.price as product_price,
                p.image_urls,
                p.description as product_description,
                u.full_name as customer_name, 
                u.email as customer_email,
                u.phone as customer_phone
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
                'order_number' => $order['order_number'],
                'customer' => $order['customer_name'],
                'customer_email' => $order['customer_email'],
                'customer_phone' => $order['customer_phone'],
                'product' => $order['product_name'],
                'product_description' => $order['product_description'],
                'product_images' => $order['image_urls'],
                'quantity' => intval($order['quantity']),
                'unit_price' => floatval($order['product_price']),
                'total' => floatval($order['order_subtotal']),
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
        echo json_encode(['error' => 'Failed to fetch vendor orders: ' . $e->getMessage()]);
    }
}

function handleUpdateVendorOrderStatus() {
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
    if (!$payload || $payload['role'] !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
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
    $warehouseId = $input['warehouse_id'] ?? null;

    // Delivery confirmation is platform-controlled and must be done by admin only.
    if ($newStatus === 'delivered') {
        http_response_code(403);
        echo json_encode(['error' => 'Only admin can mark an order as delivered']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
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
        
        // Verify that the order belongs to this vendor and get order details
        $stmt = $pdo->prepare("
            SELECT o.id, o.status, o.total_amount 
            FROM orders o 
            JOIN products p ON o.product_id = p.id 
            WHERE o.id = ? AND p.vendor_id = ?
        ");
        $stmt->execute([$orderId, $vendorId]);
        $order = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$order) {
            http_response_code(403);
            echo json_encode(['error' => 'Order not found or you do not have permission to update this order']);
            return;
        }
        
        // Update order status and warehouse_id
        $stmt = $pdo->prepare("
            UPDATE orders
            SET status = ?, status_notes = ?, warehouse_id = ?, updated_at = NOW(), last_status_updated = NOW()
            WHERE id = ?
        ");
        $result = $stmt->execute([$newStatus, $statusNotes, $warehouseId, $orderId]);
        
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
                reverseWalletEarning($vendorId, $orderId);
            } catch (Exception $walletReverseError) {
                error_log("Wallet reversal failed for order {$orderId}: " . $walletReverseError->getMessage());
            }

            // Check if earnings exist for this order

            $reverseResult = reverseCommissionForOrder($orderId, $vendorId, $order['total_amount']);
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
                            $vendorId,
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
        
        // Notify customer and admins about order status change
        require_once __DIR__ . '/../utils/notifications.php';
        
        // Get order details for notifications
        $stmt = $pdo->prepare("
            SELECT o.user_id, o.order_number, p.name as product_name, u.full_name as customer_name
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
            
            // Notify admins
            $adminMessage = "Vendor updated order #{$orderDetails['order_number']} status to '{$newStatus}' for customer '{$orderDetails['customer_name']}'";
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
                SELECT o.*, u.full_name as customer_name, u.phone as customer_phone, u.email as customer_email
                FROM orders o
                JOIN user_profiles u ON o.user_id = u.id
                WHERE o.id = ?
            ");
            $stmt->execute([$orderId]);
            $orderForSMS = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($orderForSMS) {
                // Ensure vendor_id exists for service (vendors.php already has $vendorId)
                $orderForSMS['vendor_id'] = $vendorId;
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
        error_log("Error updating vendor order status: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        echo json_encode(['error' => 'Failed to update order status: ' . $e->getMessage()]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        error_log("Exception updating vendor order status: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        echo json_encode(['error' => 'Failed to update order status: ' . $e->getMessage()]);
    }
}

function handleUpdateVendorProfile() {
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
    
    $userId = $payload['user_id'];
    
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON data']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Update user_profiles table
        $userFields = [];
        $userValues = [];
        
        if (isset($input['full_name'])) {
            $userFields[] = "full_name = ?";
            $userValues[] = trim($input['full_name']);
        }
        
        if (isset($input['phone'])) {
            // Check if phone is already taken by another user
            $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE phone = ? AND id != ?");
            $stmt->execute([$input['phone'], $userId]);
            if ($stmt->fetch()) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Phone number is already taken by another user']);
                return;
            }
            $userFields[] = "phone = ?";
            $userValues[] = trim($input['phone']);
        }
        
        if (isset($input['email'])) {
            // Check if email is already taken by another user
            $stmt = $pdo->prepare("SELECT id FROM user_profiles WHERE email = ? AND id != ?");
            $stmt->execute([$input['email'], $userId]);
            if ($stmt->fetch()) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Email is already taken by another user']);
                return;
            }
            $userFields[] = "email = ?";
            $userValues[] = trim($input['email']);
        }
        
        if (!empty($userFields)) {
            $userFields[] = "updated_at = NOW()";
            $userValues[] = $userId;
            
            $stmt = $pdo->prepare("UPDATE user_profiles SET " . implode(', ', $userFields) . " WHERE id = ?");
            $stmt->execute($userValues);
        }
        
        // Update vendors table
        $vendorFields = [];
        $vendorValues = [];
        
        if (isset($input['farm_name'])) {
            // Check if farm name is already taken by another vendor
            $stmt = $pdo->prepare("SELECT v.id FROM vendors v WHERE v.farm_name = ? AND v.user_id != ?");
            $stmt->execute([$input['farm_name'], $userId]);
            if ($stmt->fetch()) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Farm name is already taken by another vendor']);
                return;
            }
            $vendorFields[] = "farm_name = ?";
            $vendorValues[] = trim($input['farm_name']);
        }
        
        if (isset($input['farm_description'])) {
            $vendorFields[] = "farm_description = ?";
            $vendorValues[] = trim($input['farm_description']);
        }
        
        if (isset($input['location'])) {
            $vendorFields[] = "location = ?";
            $vendorValues[] = trim($input['location']);
        }
        
        // Handle location IDs (county, constituency, ward)
        if (isset($input['county_id'])) {
            $vendorFields[] = "county_id = ?";
            $vendorValues[] = $input['county_id'] ? (int)$input['county_id'] : null;
        }
        
        if (isset($input['constituency_id'])) {
            $vendorFields[] = "constituency_id = ?";
            $vendorValues[] = $input['constituency_id'] ? (int)$input['constituency_id'] : null;
        }
        
        if (isset($input['ward_id'])) {
            $vendorFields[] = "ward_id = ?";
            $vendorValues[] = $input['ward_id'] ? (int)$input['ward_id'] : null;
        }
        
        if (isset($input['id_number'])) {
            // Check if ID number is already taken by another vendor
            $stmt = $pdo->prepare("SELECT v.id FROM vendors v WHERE v.id_number = ? AND v.user_id != ?");
            $stmt->execute([$input['id_number'], $userId]);
            if ($stmt->fetch()) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'ID number is already taken by another vendor']);
                return;
            }
            $vendorFields[] = "id_number = ?";
            $vendorValues[] = trim($input['id_number']);
        }
        
        if (!empty($vendorFields)) {
            $vendorFields[] = "updated_at = NOW()";
            $vendorValues[] = $userId;
            
            $stmt = $pdo->prepare("UPDATE vendors SET " . implode(', ', $vendorFields) . " WHERE user_id = ?");
            $stmt->execute($vendorValues);
        }
        
        $pdo->commit();
        echo json_encode(['success' => true, 'message' => 'Profile updated successfully']);
        
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        error_log("Error updating vendor profile: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to update profile: ' . $e->getMessage()]);
    }
}

function handleGetVendorPayoutAccount() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload || ($payload['role'] ?? '') !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ? LIMIT 1");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }

        $vendorId = $vendor['id'];
        $stmt = $pdo->prepare("\n            SELECT method, account_name, provider_name, provider_code, account_last4, paystack_recipient_code, created_at, updated_at\n            FROM vendor_payout_accounts\n            WHERE vendor_id = ? AND is_active = 1\n            ORDER BY id DESC\n            LIMIT 1\n        ");
        $stmt->execute([$vendorId]);
        $account = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$account) {
            echo json_encode([
                'success' => true,
                'has_account' => false,
                'payout_account' => null
            ]);
            return;
        }

        echo json_encode([
            'success' => true,
            'has_account' => true,
            'payout_account' => [
                'method' => $account['method'],
                'account_name' => $account['account_name'],
                'provider_name' => $account['provider_name'],
                'provider_code' => $account['provider_code'],
                'account_last4' => $account['account_last4'],
                'account_number_masked' => '******' . $account['account_last4'],
                'paystack_recipient_code' => $account['paystack_recipient_code'],
                'created_at' => $account['created_at'],
                'updated_at' => $account['updated_at']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch payout account: ' . $e->getMessage()]);
    }
}

function handleGetVendorPayoutProviders() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload || ($payload['role'] ?? '') !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }

    $method = strtolower(trim($_GET['method'] ?? 'bank'));

    try {
        if ($method === 'mobile_money') {
            echo json_encode([
                'success' => true,
                'providers' => [
                    ['name' => 'Safaricom M-Pesa', 'code' => 'MPESA'],
                    ['name' => 'Airtel Money', 'code' => 'AIRTEL_MONEY']
                ]
            ]);
            return;
        }

        $response = listPaystackBanks('kenya');
        $api = $response['response'] ?? [];

        if (empty($api['status']) || !isset($api['data']) || !is_array($api['data'])) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Failed to fetch payout providers',
                'details' => $api['message'] ?? ($response['curl_error'] ?? 'Unknown API error')
            ]);
            return;
        }

        $providers = [];
        foreach ($api['data'] as $bank) {
            $isActive = isset($bank['active']) ? (bool)$bank['active'] : true;
            if (!$isActive) {
                continue;
            }

            $providers[] = [
                'name' => $bank['name'] ?? '',
                'code' => $bank['code'] ?? ''
            ];
        }

        echo json_encode([
            'success' => true,
            'providers' => $providers
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch payout providers: ' . $e->getMessage()]);
    }
}

function handleUpsertVendorPayoutAccount() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }

    $payload = validateJWT($token);
    if (!$payload || ($payload['role'] ?? '') !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid vendor token']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        return;
    }

    $method = strtolower(trim($input['method'] ?? ''));
    $accountName = trim($input['account_name'] ?? '');
    $providerName = trim($input['provider_name'] ?? '');
    $providerCode = trim($input['provider_code'] ?? '');
    $accountNumber = preg_replace('/\s+/', '', trim($input['account_number'] ?? ''));
    $digitsOnly = preg_replace('/\D+/', '', $accountNumber);

    if (!in_array($method, ['bank', 'mobile_money'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'method must be bank or mobile_money']);
        return;
    }

    if ($accountName === '' || $providerName === '' || $accountNumber === '') {
        http_response_code(400);
        echo json_encode(['error' => 'account_name, provider_name, and account_number are required']);
        return;
    }

    if (strlen($accountNumber) < 6) {
        http_response_code(400);
        echo json_encode(['error' => 'account_number appears invalid']);
        return;
    }

    if ($method === 'bank' && $providerCode === '') {
        http_response_code(400);
        echo json_encode(['error' => 'provider_code (bank code) is required for bank payouts']);
        return;
    }

    // Prevent accidental bank/mobile mismatch from being saved.
    if ($method === 'bank') {
        $looksLikeMobile = preg_match('/^(254|0)?[17]\d{8}$/', $digitsOnly) === 1;
        if ($looksLikeMobile) {
            http_response_code(400);
            echo json_encode(['error' => 'Bank method selected, but account number looks like a mobile number. Please enter a valid bank account number.']);
            return;
        }
    }

    if ($method === 'mobile_money') {
        $isLocal = preg_match('/^0[17]\d{8}$/', $digitsOnly) === 1;
        $isIntl = preg_match('/^254[17]\d{8}$/', $digitsOnly) === 1;
        if (!$isLocal && !$isIntl) {
            http_response_code(400);
            echo json_encode(['error' => 'Mobile money number format is invalid. Use 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX.']);
            return;
        }
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ? LIMIT 1");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }

        $vendorId = $vendor['id'];

        $recipientPayload = [
            'type' => $method === 'bank' ? 'nuban' : 'mobile_money',
            'name' => $accountName,
            'account_number' => $accountNumber,
            'currency' => 'KES',
            'description' => 'Vendor payout account (' . $vendorId . ')'
        ];

        if ($method === 'bank' && $providerCode !== '') {
            $recipientPayload['bank_code'] = $providerCode;
        }

        $recipientResponse = createPaystackTransferRecipient($recipientPayload);
        $recipientData = $recipientResponse['response'] ?? [];

        if (empty($recipientData['status']) || empty($recipientData['data']['recipient_code'])) {
            http_response_code(400);
            echo json_encode([
                'error' => 'Failed to create transfer recipient with Paystack',
                'details' => $recipientData['message'] ?? ($recipientResponse['curl_error'] ?? 'Unknown API error'),
                'paystack_response' => $recipientData
            ]);
            return;
        }

        $recipientCode = $recipientData['data']['recipient_code'];
        $maskedData = maskAccountNumber($accountNumber);
        $encryptedAccountNumber = encryptPayoutAccountNumber($accountNumber);

        $pdo->beginTransaction();

        $deactivateStmt = $pdo->prepare("UPDATE vendor_payout_accounts SET is_active = 0, updated_at = NOW() WHERE vendor_id = ?");
        $deactivateStmt->execute([$vendorId]);

        $insertStmt = $pdo->prepare("\n            INSERT INTO vendor_payout_accounts\n                (vendor_id, method, account_name, provider_name, provider_code, account_number_encrypted, account_last4, paystack_recipient_code, is_active)\n            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)\n        ");
        $insertStmt->execute([
            $vendorId,
            $method,
            $accountName,
            $providerName,
            $providerCode !== '' ? $providerCode : null,
            $encryptedAccountNumber,
            $maskedData['last4'],
            $recipientCode
        ]);

        upsertVendorRecipientCode($vendorId, $recipientCode);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Payout account saved successfully',
            'payout_account' => [
                'method' => $method,
                'account_name' => $accountName,
                'provider_name' => $providerName,
                'provider_code' => $providerCode !== '' ? $providerCode : null,
                'account_last4' => $maskedData['last4'],
                'account_number_masked' => $maskedData['masked'],
                'paystack_recipient_code' => $recipientCode
            ]
        ]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save payout account: ' . $e->getMessage()]);
    }
}

function handleGetVendorEarnings() {
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

        // Total net earnings from delivered orders only.
        $stmt = $pdo->prepare("\n            SELECT COALESCE(SUM(o.total_amount - COALESCE(o.commission_amount, 0)), 0) as total_earnings
            FROM orders o
            WHERE o.vendor_id = ? AND o.status = 'delivered'
        ");
        $stmt->execute([$vendorId]);
        $totalEarningsResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $totalEarnings = floatval($totalEarningsResult['total_earnings'] ?? 0);

        // Earnings breakdown from delivered orders only.
        $stmt = $pdo->prepare("\n            SELECT
                o.id as order_id,
                o.created_at as order_date,
                p.name as product_name,
                o.quantity,
                o.total_amount as order_total,
                COALESCE(o.commission_amount, 0) as commission_amount,
                (o.total_amount - COALESCE(o.commission_amount, 0)) as net_amount
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.vendor_id = ? AND o.status = 'delivered'
            ORDER BY COALESCE(o.last_status_updated, o.created_at) DESC, o.id DESC
            LIMIT 20
        ");
        $stmt->execute([$vendorId]);
        $earningsBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Informational ad-attributed metrics (delivered orders only).
        $stmt = $pdo->prepare("\n            SELECT
                COALESCE(SUM(o.total_amount), 0) as ad_revenue,
                COALESCE(SUM(o.total_amount - COALESCE(o.commission_amount, 0)), 0) as ad_earnings
            FROM orders o
            WHERE o.vendor_id = ?
              AND o.status = 'delivered'
              AND o.advertisement_id IS NOT NULL
        ");
        $stmt->execute([$vendorId]);
        $adMetrics = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $adRevenue = floatval($adMetrics['ad_revenue'] ?? 0);
        $adEarnings = floatval($adMetrics['ad_earnings'] ?? 0);

        // Get per-ad revenue breakdown (only delivered orders).
        $stmt = $pdo->prepare("\n            SELECT 
                a.id as ad_id,
                a.ad_title,
                COALESCE(SUM(o.total_amount), 0) as revenue_generated
            FROM advertisements a
            LEFT JOIN orders o ON a.id = o.advertisement_id 
                AND o.status = 'delivered'
            WHERE a.vendor_id = ?
            GROUP BY a.id, a.ad_title
            ORDER BY revenue_generated DESC
        ");
        $stmt->execute([$vendorId]);
        $adRevenueBreakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'total_earnings' => $totalEarnings,
            'earnings_breakdown' => $earningsBreakdown,
            'ad_revenue' => $adRevenue,
            'ad_earnings' => $adEarnings,
            'ads_attributed_order_value' => $adRevenue,
            'ads_attributed_received_amount' => $adEarnings,
            'ad_revenue_breakdown' => $adRevenueBreakdown
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch vendor earnings: ' . $e->getMessage()]);
    }
}
?>
