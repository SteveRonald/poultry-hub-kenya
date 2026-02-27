<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/system_logs.php';

// Ensure validateAdminSession is available (from admin.php)
if (!function_exists('validateAdminSession')) {
    // If not already included, we need to include admin.php
    // But to avoid duplicate function definitions, we'll check if it's needed
    // The index.php should include admin.php before this file
    // For safety, define it here if missing
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
}

/**
 * Generate UUID
 */
function generateUUID() {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Handle vendor creating an advertisement
 */
function handleCreateAdvertisement() {
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
        // Get vendor_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $vendorId = $vendor['id'];
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        if (!isset($input['product_id']) || !isset($input['tier']) || !isset($input['duration_days'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: product_id, tier, duration_days']);
            return;
        }
        
        // Validate tier
        if (!in_array($input['tier'], ['basic', 'premium'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid tier. Must be "basic" or "premium"']);
            return;
        }
        
        // Validate content duration based on tier
        $contentDuration = $input['content_duration'] ?? null;
        if ($contentDuration !== null) {
            if ($input['tier'] === 'basic' && ($contentDuration < 15 || $contentDuration > 30)) {
                http_response_code(400);
                echo json_encode(['error' => 'Basic tier ads must be between 15-30 seconds']);
                return;
            }
            if ($input['tier'] === 'premium' && $contentDuration > 60) {
                http_response_code(400);
                echo json_encode(['error' => 'Premium tier ads must be up to 60 seconds']);
                return;
            }
        }
        
        // Validate product belongs to vendor
        $stmt = $pdo->prepare("SELECT id FROM products WHERE id = ? AND vendor_id = ?");
        $stmt->execute([$input['product_id'], $vendorId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found or does not belong to you']);
            return;
        }
        
        // Calculate price
        $tierPrice = $input['tier'] === 'premium' ? 300 : 128; // KSh per day
        $durationDays = intval($input['duration_days']);
        $totalPrice = $tierPrice * $durationDays;
        
        // Set priority (premium = 100, basic = 50)
        $priority = $input['tier'] === 'premium' ? 100 : 50;
        
        // Validate discount prices if provided
        $previousPrice = isset($input['previous_price']) && $input['previous_price'] !== null 
            ? floatval($input['previous_price']) 
            : null;
        $currentPrice = isset($input['current_price']) && $input['current_price'] !== null 
            ? floatval($input['current_price']) 
            : null;
        
        // If both prices are provided, validate that current < previous
        if ($previousPrice !== null && $currentPrice !== null) {
            if ($currentPrice >= $previousPrice) {
                http_response_code(400);
                echo json_encode(['error' => 'Current price must be less than previous price for discount']);
                return;
            }
        }
        
        // Create advertisement
        $adId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO advertisements (
                id, vendor_id, product_id, tier, price, duration_days, 
                ad_image, ad_title, ad_description, priority, content_duration, 
                previous_price, current_price, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        ");
        
        $stmt->execute([
            $adId,
            $vendorId,
            $input['product_id'],
            $input['tier'],
            $totalPrice,
            $durationDays,
            $input['ad_image'] ?? null,
            $input['ad_title'] ?? null,
            $input['ad_description'] ?? null,
            $priority,
            $contentDuration,
            $previousPrice,
            $currentPrice,
        ]);
        
        // Create analytics record
        $analyticsId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO advertisement_analytics (id, advertisement_id)
            VALUES (?, ?)
        ");
        $stmt->execute([$analyticsId, $adId]);
        
        // Log advertisement creation
        logActivity(
            $payload['user_id'],
            'vendor',
            'create_advertisement',
            "Created new advertisement: {$input['ad_title']}",
            [
                'advertisement_id' => $adId,
                'tier' => $input['tier'],
                'duration_days' => $durationDays,
                'price' => $totalPrice,
                'product_id' => $input['product_id']
            ]
        );
        
        // Notify admins
        require_once __DIR__ . '/../utils/notifications.php';
        $adminMessage = "New advertisement created by vendor. Tier: {$input['tier']}, Duration: {$durationDays} days, Price: KSh " . number_format($totalPrice, 2);
        notifyAllAdmins($adminMessage, 'advertisement');
        
        echo json_encode([
            'success' => true,
            'message' => 'Advertisement created successfully. Awaiting admin approval.',
            'advertisement' => [
                'id' => $adId,
                'price' => $totalPrice,
                'status' => 'pending'
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle vendor getting their advertisements
 */
function handleGetVendorAdvertisements() {
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
        // Get vendor_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $vendorId = $vendor['id'];
        
        // Get advertisements with analytics and actual revenue from orders
        $stmt = $pdo->prepare("
            SELECT 
                a.*,
                p.name as product_name,
                p.price as product_price,
                p.image_urls as product_images,
                a.previous_price,
                a.current_price,
                COALESCE(an.views_count, 0) as views_count,
                COALESCE(an.clicks_count, 0) as clicks_count,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM orders o 
                     WHERE o.advertisement_id = a.id
                    ), 
                    COALESCE(an.orders_count, 0)
                ) as orders_count,
                COALESCE(
                    (SELECT SUM(o.total_amount) 
                     FROM orders o 
                     WHERE o.advertisement_id = a.id 
                     AND o.status = 'delivered'
                    ), 
                    COALESCE(an.revenue_generated, 0)
                ) as revenue_generated
            FROM advertisements a
            JOIN products p ON a.product_id = p.id
            LEFT JOIN advertisement_analytics an ON a.id = an.advertisement_id
            WHERE a.vendor_id = ?
            ORDER BY a.created_at DESC
        ");
        $stmt->execute([$vendorId]);
        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode($ads);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch advertisements: ' . $e->getMessage()]);
    }
}

/**
 * Handle getting advertisement analytics
 */
function handleGetAdvertisementAnalytics($adId) {
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
        // Verify ad belongs to vendor
        $stmt = $pdo->prepare("
            SELECT a.*, an.*
            FROM advertisements a
            JOIN vendors v ON a.vendor_id = v.id
            LEFT JOIN advertisement_analytics an ON a.id = an.advertisement_id
            WHERE a.id = ? AND v.user_id = ?
        ");
        $stmt->execute([$adId, $payload['user_id']]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$result) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        // Get orders from this ad
        $stmt = $pdo->prepare("
            SELECT 
                o.id,
                o.order_number,
                o.total_amount,
                o.created_at,
                p.name as product_name
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE o.advertisement_id = ?
            ORDER BY o.created_at DESC
        ");
        $stmt->execute([$adId]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Calculate actual revenue from orders (only delivered orders, same as earnings)
        $stmt = $pdo->prepare("
            SELECT COALESCE(SUM(o.total_amount), 0) as revenue_generated
            FROM orders o
            WHERE o.advertisement_id = ?
            AND o.status = 'delivered'
        ");
        $stmt->execute([$adId]);
        $revenueResult = $stmt->fetch(PDO::FETCH_ASSOC);
        $actualRevenue = floatval($revenueResult['revenue_generated'] ?? 0);
        
        // Use actual revenue from orders, fallback to analytics table if no orders
        $revenue = $actualRevenue > 0 ? $actualRevenue : floatval($result['revenue_generated'] ?? 0);
        
        // Calculate CTR
        $ctr = $result['views_count'] > 0 
            ? ($result['clicks_count'] / $result['views_count']) * 100 
            : 0;
        
        echo json_encode([
            'success' => true,
            'analytics' => [
                'views_count' => intval($result['views_count'] ?? 0),
                'clicks_count' => intval($result['clicks_count'] ?? 0),
                'ctr' => round($ctr, 2),
                'revenue_generated' => $revenue,
                'orders_count' => count($orders),
                'orders' => $orders
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch analytics: ' . $e->getMessage()]);
    }
}

/**
 * Handle admin getting all advertisements
 */
function handleGetAdminAdvertisements() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Sanitize and validate status parameter
        $status = isset($_GET['status']) ? sanitizeInput($_GET['status']) : null;
        
        // Validate status to prevent injection
        $allowedStatuses = ['pending', 'active', 'rejected', 'expired', 'all'];
        if ($status && !in_array($status, $allowedStatuses)) {
            $status = null;
        }
        
        $query = "
            SELECT 
                a.*,
                v.farm_name as vendor_name,
                p.name as product_name,
                COALESCE(an.views_count, 0) as views_count,
                COALESCE(an.clicks_count, 0) as clicks_count,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM orders o 
                     WHERE o.advertisement_id = a.id
                    ), 
                    COALESCE(an.orders_count, 0)
                ) as orders_count,
                COALESCE(
                    (
                        SELECT COALESCE(SUM(o.total_amount), 0) 
                        FROM orders o 
                        WHERE o.advertisement_id = a.id 
                        AND o.status = 'delivered'
                    ),
                    COALESCE(an.revenue_generated, 0.00)
                ) as revenue_generated
            FROM advertisements a
            JOIN vendors v ON a.vendor_id = v.id
            JOIN products p ON a.product_id = p.id
            LEFT JOIN advertisement_analytics an ON a.id = an.advertisement_id
        ";
        
        if ($status && $status !== 'all') {
            $query .= " WHERE a.status = ?";
            $stmt = $pdo->prepare($query);
            $stmt->execute([$status]);
        } else {
            $stmt = $pdo->query($query);
        }
        
        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response to ensure all fields are properly typed
        $formattedAds = array_map(function($ad) {
            return [
                'id' => $ad['id'],
                'vendor_id' => $ad['vendor_id'],
                'product_id' => $ad['product_id'],
                'vendor_name' => $ad['vendor_name'],
                'product_name' => $ad['product_name'],
                'tier' => $ad['tier'],
                'price' => floatval($ad['price']),
                'duration_days' => intval($ad['duration_days']),
                'status' => $ad['status'],
                'ad_image' => $ad['ad_image'] ?? '',
                'ad_title' => $ad['ad_title'] ?? '',
                'ad_description' => $ad['ad_description'] ?? '',
                'content_duration' => isset($ad['content_duration']) && $ad['content_duration'] !== null ? intval($ad['content_duration']) : null,
                'priority' => isset($ad['priority']) ? intval($ad['priority']) : 0,
                'start_date' => $ad['start_date'] ?? null,
                'end_date' => $ad['end_date'] ?? null,
                'created_at' => $ad['created_at'],
                'activated_at' => $ad['activated_at'] ?? null,
                'rejection_reason' => $ad['rejection_reason'] ?? null,
                'views_count' => intval($ad['views_count']),
                'clicks_count' => intval($ad['clicks_count']),
                'revenue_generated' => floatval($ad['revenue_generated']),
                'page_locations' => (function($ad) {
                    if (isset($ad['page_locations']) && !empty($ad['page_locations'])) {
                        $decoded = json_decode($ad['page_locations'], true);
                        return ($decoded !== null && is_array($decoded)) ? $decoded : ['homepage', 'products'];
                    }
                    return ['homepage', 'products'];
                })($ad),
                'previous_price' => isset($ad['previous_price']) && $ad['previous_price'] !== null ? floatval($ad['previous_price']) : null,
                'current_price' => isset($ad['current_price']) && $ad['current_price'] !== null ? floatval($ad['current_price']) : null
            ];
        }, $ads);
        
        echo json_encode($formattedAds);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch advertisements: ' . $e->getMessage()]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch advertisements: ' . $e->getMessage()]);
    }
}

/**
 * Handle admin approving/activating advertisement
 */
function handleApproveAdvertisement() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'advertisement_id is required']);
        return;
    }
    
    // Validate page_locations
    $pageLocations = $input['page_locations'] ?? ['homepage', 'products']; // Default for backward compatibility
    if (!is_array($pageLocations) || empty($pageLocations)) {
        http_response_code(400);
        echo json_encode(['error' => 'page_locations must be a non-empty array']);
        return;
    }
    
    // Validate page location values
    $validPages = ['homepage', 'products', 'blog', 'training'];
    foreach ($pageLocations as $page) {
        if (!in_array($page, $validPages)) {
            http_response_code(400);
            echo json_encode(['error' => "Invalid page location: {$page}. Valid values: " . implode(', ', $validPages)]);
            return;
        }
    }
    
    try {
        $pdo->beginTransaction();
        
        // Get admin user_id
        $adminToken = getBearerToken();
        $adminPayload = validateJWT($adminToken);
        $adminUserId = $adminPayload['user_id'] ?? null;
        
        // Get advertisement details
        $stmt = $pdo->prepare("
            SELECT a.*, v.user_id as vendor_user_id
            FROM advertisements a
            JOIN vendors v ON a.vendor_id = v.id
            WHERE a.id = ?
        ");
        $stmt->execute([$input['advertisement_id']]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        if ($ad['status'] !== 'pending') {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Advertisement is not pending approval']);
            return;
        }
        
        // Calculate start and end dates
        $startDate = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+{$ad['duration_days']} days"));
        
        // Convert page_locations array to JSON
        $pageLocationsJson = json_encode($pageLocations);
        
        // Update advertisement
        $stmt = $pdo->prepare("
            UPDATE advertisements 
            SET status = 'active', 
                start_date = ?,
                end_date = ?,
                activated_at = NOW(),
                activated_by = ?,
                page_locations = ?
            WHERE id = ?
        ");
        $stmt->execute([$startDate, $endDate, $adminUserId, $pageLocationsJson, $input['advertisement_id']]);
        
        $pdo->commit();
        
        // Log admin action
        logActivity(
            $adminUserId,
            'admin',
            'approve_advertisement',
            "Approved advertisement: {$ad['ad_title']}",
            ['advertisement_id' => $input['advertisement_id'], 'tier' => $ad['tier'], 'vendor_id' => $ad['vendor_id']]
        );
        
        // Log vendor event
        logActivity(
            $ad['vendor_user_id'],
            'vendor',
            'advertisement_approved',
            "Advertisement approved and activated",
            ['advertisement_id' => $input['advertisement_id'], 'tier' => $ad['tier']]
        );
        
        // Notify vendor
        require_once __DIR__ . '/../utils/notifications.php';
        $vendorMessage = "Your advertisement has been approved and is now active!";
        notifyVendor($ad['vendor_id'], $vendorMessage, 'advertisement');
        
        echo json_encode([
            'success' => true,
            'message' => 'Advertisement approved and activated successfully'
        ]);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to approve advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle admin rejecting advertisement
 */
function handleRejectAdvertisement() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id']) || !isset($input['rejection_reason'])) {
        http_response_code(400);
        echo json_encode(['error' => 'advertisement_id and rejection_reason are required']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT a.*, v.user_id as vendor_user_id
            FROM advertisements a
            JOIN vendors v ON a.vendor_id = v.id
            WHERE a.id = ?
        ");
        $stmt->execute([$input['advertisement_id']]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        // Update status
        $stmt = $pdo->prepare("
            UPDATE advertisements 
            SET status = 'rejected',
                ad_description = CONCAT(ad_description, '\n\nRejection Reason: ', ?)
            WHERE id = ?
        ");
        $stmt->execute([$input['rejection_reason'], $input['advertisement_id']]);
        
        // Notify vendor
        require_once __DIR__ . '/../utils/notifications.php';
        $vendorMessage = "Your advertisement was rejected. Reason: {$input['rejection_reason']}";
        notifyVendor($ad['vendor_id'], $vendorMessage, 'advertisement');
        
        echo json_encode([
            'success' => true,
            'message' => 'Advertisement rejected successfully'
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reject advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle tracking ad view
 */
function handleTrackAdView() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'advertisement_id is required']);
        return;
    }
    
    try {
        $adId = $input['advertisement_id'];
        $sessionId = $input['session_id'] ?? null;
        $userId = $input['user_id'] ?? null;
        $pageLocation = $input['page_location'] ?? 'unknown';
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        
        // Check if ad is active
        $stmt = $pdo->prepare("
            SELECT id, status, end_date 
            FROM advertisements 
            WHERE id = ? AND status = 'active' AND (end_date IS NULL OR end_date > NOW())
        ");
        $stmt->execute([$adId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found or not active']);
            return;
        }
        
        // Insert view record
        $viewId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO advertisement_views (id, advertisement_id, user_id, session_id, ip_address, page_location)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$viewId, $adId, $userId, $sessionId, $ipAddress, $pageLocation]);
        
        // Update analytics (create record if it doesn't exist)
        $stmt = $pdo->prepare("SELECT id FROM advertisement_analytics WHERE advertisement_id = ?");
        $stmt->execute([$adId]);
        $analyticsExists = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$analyticsExists) {
            // Create analytics record if it doesn't exist
            $analyticsId = generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO advertisement_analytics (id, advertisement_id, views_count, orders_count, revenue_generated, created_at, updated_at, last_viewed_at)
                VALUES (?, ?, 1, 0, 0, NOW(), NOW(), NOW())
            ");
            $stmt->execute([$analyticsId, $adId]);
        } else {
            // Update existing analytics record
            $stmt = $pdo->prepare("
                UPDATE advertisement_analytics 
                SET views_count = views_count + 1,
                    last_viewed_at = NOW(),
                    updated_at = NOW()
                WHERE advertisement_id = ?
            ");
            $stmt->execute([$adId]);
        }
        
        echo json_encode(['success' => true]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to track view: ' . $e->getMessage()]);
    }
}

/**
 * Handle tracking ad click
 */
function handleTrackAdClick() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'advertisement_id is required']);
        return;
    }
    
    try {
        $adId = $input['advertisement_id'];
        $sessionId = $input['session_id'] ?? null;
        $userId = $input['user_id'] ?? null;
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        
        // Check if ad is active and get current product_id (handles product changes during reactivation)
        $stmt = $pdo->prepare("
            SELECT a.id, a.status, a.end_date, a.product_id, p.is_active as product_is_active
            FROM advertisements a
            LEFT JOIN products p ON a.product_id = p.id
            WHERE a.id = ? AND a.status = 'active' AND (a.end_date IS NULL OR a.end_date > NOW())
        ");
        $stmt->execute([$adId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found or not active']);
            return;
        }
        
        // Check if product is still active (might have been deactivated)
        if (!$ad['product_is_active']) {
            http_response_code(404);
            echo json_encode(['error' => 'Product associated with this advertisement is no longer available']);
            return;
        }
        
        // Insert click record
        $clickId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO advertisement_clicks (id, advertisement_id, user_id, session_id, ip_address)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$clickId, $adId, $userId, $sessionId, $ipAddress]);
        
        // Update analytics (create record if it doesn't exist)
        $stmt = $pdo->prepare("SELECT id FROM advertisement_analytics WHERE advertisement_id = ?");
        $stmt->execute([$adId]);
        $analyticsExists = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$analyticsExists) {
            // Create analytics record if it doesn't exist
            $analyticsId = generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO advertisement_analytics (id, advertisement_id, views_count, clicks_count, orders_count, revenue_generated, created_at, updated_at, last_clicked_at)
                VALUES (?, ?, 0, 1, 0, 0, NOW(), NOW(), NOW())
            ");
            $stmt->execute([$analyticsId, $adId]);
        } else {
            // Update existing analytics record
            $stmt = $pdo->prepare("
                UPDATE advertisement_analytics 
                SET clicks_count = clicks_count + 1,
                    last_clicked_at = NOW(),
                    updated_at = NOW()
                WHERE advertisement_id = ?
            ");
            $stmt->execute([$adId]);
        }
        
        // Return success with current product_id (handles product changes during reactivation)
        echo json_encode([
            'success' => true,
            'product_id' => $ad['product_id']
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to track click: ' . $e->getMessage()]);
    }
}

/**
 * Handle getting active advertisements for display
 */
function handleGetActiveAdvertisements() {
    global $pdo;
    
    // Sanitize and validate GET parameters
    $limit = isset($_GET['limit']) ? max(1, min(100, intval($_GET['limit']))) : 3;
    $pageLocation = isset($_GET['page_location']) ? sanitizeInput($_GET['page_location']) : 'homepage';
    
    // Validate page location to prevent injection
    $allowedLocations = ['homepage', 'products', 'blog', 'training'];
    if (!in_array($pageLocation, $allowedLocations)) {
        $pageLocation = 'homepage';
    }
    
    try {
        // Get active ads that match the page location
        // Only show ads from approved vendors
        // page_locations is a JSON array, so we need to check if it contains the requested page_location
        $query = "
            SELECT 
                a.*,
                p.name as product_name,
                p.price as product_price,
                p.image_urls as product_images,
                a.previous_price,
                a.current_price
            FROM advertisements a
            JOIN products p ON a.product_id = p.id
            JOIN vendors v ON a.vendor_id = v.id
            WHERE a.status = 'active'
            AND v.status = 'approved'
            AND (a.end_date IS NULL OR a.end_date > NOW())
            AND JSON_CONTAINS(a.page_locations, ?)
            ORDER BY a.priority DESC, a.created_at DESC
            LIMIT ?
        ";
        
        // Convert page_location to JSON string for JSON_CONTAINS
        $pageLocationJson = json_encode($pageLocation);
        
        // First, expire any ads that have passed their end_date
        $expireStmt = $pdo->prepare("
            UPDATE advertisements 
            SET status = 'expired'
            WHERE status = 'active' 
            AND end_date IS NOT NULL 
            AND end_date < NOW()
        ");
        $expireStmt->execute();
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$pageLocationJson, $limit]);
        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Re-fetch if needed (for backward compatibility with ads that don't have page_locations set)
        if (count($ads) < $limit) {
            // Try to get ads without page_locations filter (for backward compatibility)
            // Only show ads from approved vendors
            $fallbackQuery = "
                SELECT 
                    a.*,
                    p.name as product_name,
                    p.id as product_id,
                    p.image_urls as product_images,
                    p.price as product_price,
                    a.previous_price,
                    a.current_price
                FROM advertisements a
                JOIN products p ON a.product_id = p.id
                JOIN vendors v ON a.vendor_id = v.id
                WHERE a.status = 'active'
                AND v.status = 'approved'
                AND (a.end_date IS NULL OR a.end_date > NOW())
                AND (a.page_locations IS NULL OR a.page_locations = '[]')
                AND p.is_active = 1
                ORDER BY a.priority DESC, a.created_at DESC
                LIMIT ?
            ";
            $fallbackStmt = $pdo->prepare($fallbackQuery);
            $fallbackStmt->execute([$limit - count($ads)]);
            $fallbackAds = $fallbackStmt->fetchAll(PDO::FETCH_ASSOC);
            $ads = array_merge($ads, $fallbackAds);
        }
        
        echo json_encode($ads);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch advertisements: ' . $e->getMessage()]);
    }
}

/**
 * Handle updating ad revenue when order is linked to ad
 */
function updateAdRevenue($adId, $orderAmount) {
    global $pdo;
    
    // Validate inputs
    if (empty($adId) || !is_numeric($orderAmount) || $orderAmount < 0) {
        error_log("Invalid parameters for updateAdRevenue: adId={$adId}, orderAmount={$orderAmount}");
        return false;
    }
    
    // Check if we're already in a transaction
    $inTransaction = $pdo->inTransaction();
    $transactionStarted = false;
    
    try {
        if (!$inTransaction) {
            $pdo->beginTransaction();
            $transactionStarted = true;
        }
        
        // First verify the advertisement exists
        $stmt = $pdo->prepare("SELECT id FROM advertisements WHERE id = ?");
        $stmt->execute([$adId]);
        $adExists = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$adExists) {
            error_log("Advertisement {$adId} not found when trying to update revenue");
            if ($transactionStarted) {
                $pdo->rollBack();
            }
            return false;
        }
        
        // Check if analytics record exists
        $stmt = $pdo->prepare("SELECT id FROM advertisement_analytics WHERE advertisement_id = ?");
        $stmt->execute([$adId]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$existing) {
            // Create analytics record if it doesn't exist
            $analyticsId = generateUUID();
            $stmt = $pdo->prepare("
                INSERT INTO advertisement_analytics (id, advertisement_id, revenue_generated, orders_count, created_at, updated_at)
                VALUES (?, ?, ?, 1, NOW(), NOW())
            ");
            $result = $stmt->execute([$analyticsId, $adId, $orderAmount]);
            
            if (!$result) {
                error_log("Failed to insert analytics record for ad {$adId}");
                if ($transactionStarted) {
                    $pdo->rollBack();
                }
                return false;
            }
        } else {
            // Update existing analytics record
            $stmt = $pdo->prepare("
                UPDATE advertisement_analytics 
                SET revenue_generated = revenue_generated + ?,
                    orders_count = orders_count + 1,
                    updated_at = NOW()
                WHERE advertisement_id = ?
            ");
            $result = $stmt->execute([$orderAmount, $adId]);
            
            if (!$result || $stmt->rowCount() === 0) {
                error_log("Failed to update analytics record for ad {$adId} or no rows affected");
                if ($transactionStarted) {
                    $pdo->rollBack();
                }
                return false;
            }
        }
        
        // Only commit if we started the transaction
        if ($transactionStarted) {
            $pdo->commit();
        }
        return true;
        
    } catch (PDOException $e) {
        // Only rollback if we started the transaction
        if ($transactionStarted) {
            try {
                $pdo->rollBack();
            } catch (Exception $rollbackError) {
                error_log("Error during rollback in updateAdRevenue: " . $rollbackError->getMessage());
            }
        }
        error_log("PDOException in updateAdRevenue for ad {$adId}: " . $e->getMessage());
        error_log("SQL State: " . $e->getCode());
        return false;
    } catch (Exception $e) {
        // Only rollback if we started the transaction
        if ($transactionStarted) {
            try {
                $pdo->rollBack();
            } catch (Exception $rollbackError) {
                error_log("Error during rollback in updateAdRevenue: " . $rollbackError->getMessage());
            }
        }
        error_log("Exception in updateAdRevenue for ad {$adId}: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        return false;
    }
}

/**
 * Handle vendor updating their advertisement
 */
function handleUpdateVendorAdvertisement() {
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
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Advertisement ID is required']);
        return;
    }
    
    try {
        // Get vendor_id
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$vendor) {
            http_response_code(404);
            echo json_encode(['error' => 'Vendor profile not found']);
            return;
        }
        
        $vendorId = $vendor['id'];
        $adId = $input['advertisement_id'];
        
        // Verify the ad belongs to this vendor
        $stmt = $pdo->prepare("SELECT id FROM advertisements WHERE id = ? AND vendor_id = ?");
        $stmt->execute([$adId, $vendorId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found or you do not have permission to update it']);
            return;
        }
        
        // Build update query - only allow updating specific fields
        $updateFields = [];
        $updateValues = [];
        
        // Allowed fields to update
        if (isset($input['ad_title'])) {
            $updateFields[] = "ad_title = ?";
            $updateValues[] = $input['ad_title'];
        }
        
        if (isset($input['ad_description'])) {
            $updateFields[] = "ad_description = ?";
            $updateValues[] = $input['ad_description'];
        }
        
        if (isset($input['ad_image'])) {
            $updateFields[] = "ad_image = ?";
            $updateValues[] = $input['ad_image'];
        }
        
        if (isset($input['previous_price'])) {
            $updateFields[] = "previous_price = ?";
            $updateValues[] = $input['previous_price'] !== null ? floatval($input['previous_price']) : null;
        }
        
        if (isset($input['current_price'])) {
            $updateFields[] = "current_price = ?";
            $updateValues[] = $input['current_price'] !== null ? floatval($input['current_price']) : null;
        }
        
        // Validate discount prices if both are provided
        if (isset($input['previous_price']) && isset($input['current_price'])) {
            $prevPrice = $input['previous_price'] !== null ? floatval($input['previous_price']) : null;
            $currPrice = $input['current_price'] !== null ? floatval($input['current_price']) : null;
            if ($prevPrice !== null && $currPrice !== null && $currPrice >= $prevPrice) {
                http_response_code(400);
                echo json_encode(['error' => 'Current price must be less than previous price for discount']);
                return;
            }
        }
        
        if (empty($updateFields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            return;
        }
        
        // Add advertisement_id to values for WHERE clause
        $updateValues[] = $adId;
        
        $query = "UPDATE advertisements SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $pdo->prepare($query);
        $stmt->execute($updateValues);
        
        echo json_encode(['success' => true, 'message' => 'Advertisement updated successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle admin updating advertisement
 */
function handleUpdateAdminAdvertisement() {
    global $pdo;
    
    // Validate admin session
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Check if admin session is valid
    if (!function_exists('validateAdminSession')) {
        require_once __DIR__ . '/../routes/admin.php';
    }
    $adminSession = validateAdminSession($token);
    if (!$adminSession) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid admin session']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Advertisement ID is required']);
        return;
    }
    
    try {
        $adId = $input['advertisement_id'];
        
        // Verify the ad exists
        $stmt = $pdo->prepare("SELECT id FROM advertisements WHERE id = ?");
        $stmt->execute([$adId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        // Build update query - only allow updating specific fields
        $updateFields = [];
        $updateValues = [];
        
        // Allowed fields to update
        if (isset($input['ad_title'])) {
            $updateFields[] = "ad_title = ?";
            $updateValues[] = $input['ad_title'];
        }
        
        if (isset($input['ad_description'])) {
            $updateFields[] = "ad_description = ?";
            $updateValues[] = $input['ad_description'];
        }
        
        if (isset($input['ad_image'])) {
            $updateFields[] = "ad_image = ?";
            $updateValues[] = $input['ad_image'];
        }
        
        if (isset($input['previous_price'])) {
            $updateFields[] = "previous_price = ?";
            $updateValues[] = $input['previous_price'] !== null ? floatval($input['previous_price']) : null;
        }
        
        if (isset($input['current_price'])) {
            $updateFields[] = "current_price = ?";
            $updateValues[] = $input['current_price'] !== null ? floatval($input['current_price']) : null;
        }
        
        // Validate discount prices if both are provided
        if (isset($input['previous_price']) && isset($input['current_price'])) {
            $prevPrice = $input['previous_price'] !== null ? floatval($input['previous_price']) : null;
            $currPrice = $input['current_price'] !== null ? floatval($input['current_price']) : null;
            if ($prevPrice !== null && $currPrice !== null && $currPrice >= $prevPrice) {
                http_response_code(400);
                echo json_encode(['error' => 'Current price must be less than previous price for discount']);
                return;
            }
        }
        
        if (empty($updateFields)) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid fields to update']);
            return;
        }
        
        // Add advertisement_id to values for WHERE clause
        $updateValues[] = $adId;
        
        $query = "UPDATE advertisements SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $stmt = $pdo->prepare($query);
        $stmt->execute($updateValues);
        
        echo json_encode(['success' => true, 'message' => 'Advertisement updated successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle deleting advertisement (only expired ads)
 */
function handleDeleteAdvertisement() {
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
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Advertisement ID is required']);
        return;
    }
    
    try {
        $adId = $input['advertisement_id'];
        
        // Check if ad exists and is expired
        $stmt = $pdo->prepare("
            SELECT id, status, end_date, vendor_id 
            FROM advertisements 
            WHERE id = ?
        ");
        $stmt->execute([$adId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        // Check if ad is expired
        $isExpired = false;
        if ($ad['status'] === 'expired') {
            $isExpired = true;
        } elseif ($ad['end_date'] !== null) {
            $endDate = new DateTime($ad['end_date']);
            $now = new DateTime();
            if ($endDate < $now) {
                $isExpired = true;
            }
        }
        
        if (!$isExpired) {
            http_response_code(400);
            echo json_encode(['error' => 'Only expired advertisements can be deleted']);
            return;
        }
        
        // Check permissions
        if ($payload['role'] === 'vendor') {
            // Vendor can only delete their own ads
            $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
            $stmt->execute([$payload['user_id']]);
            $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$vendor || $vendor['id'] !== $ad['vendor_id']) {
                http_response_code(403);
                echo json_encode(['error' => 'You do not have permission to delete this advertisement']);
                return;
            }
        } elseif ($payload['role'] === 'admin') {
            // Admin can delete any expired ad - check if admin session is valid
            if (!function_exists('validateAdminSession')) {
                require_once __DIR__ . '/../routes/admin.php';
            }
            $adminSession = validateAdminSession($token);
            if (!$adminSession) {
                http_response_code(401);
                echo json_encode(['error' => 'Invalid admin session']);
                return;
            }
        } else {
            http_response_code(403);
            echo json_encode(['error' => 'You do not have permission to delete advertisements']);
            return;
        }
        
        // Delete advertisement (cascade will handle analytics and clicks)
        $stmt = $pdo->prepare("DELETE FROM advertisements WHERE id = ?");
        $stmt->execute([$adId]);
        
        echo json_encode(['success' => true, 'message' => 'Advertisement deleted successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete advertisement: ' . $e->getMessage()]);
    }
}

/**
 * Handle reactivating an expired advertisement with optional edits
 * Can be called by vendor (creates pending ad) or admin (can activate directly)
 */
function handleReactivateAdvertisement() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Advertisement ID is required']);
        return;
    }
    
    // Check if user is vendor or admin
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Try to validate as JWT first (vendor)
    $payload = validateJWT($token);
    $isAdmin = false;
    $isVendor = false;
    $adminSession = null;
    
    if ($payload) {
        // JWT token - check if vendor or admin
        $isAdmin = $payload['role'] === 'admin';
        $isVendor = $payload['role'] === 'vendor';
    } else {
        // If JWT validation failed, try admin session token
        if (!function_exists('validateAdminSession')) {
            require_once __DIR__ . '/../routes/admin.php';
        }
        $adminSession = validateAdminSession($token);
        if ($adminSession) {
            $isAdmin = true;
        }
    }
    
    if (!$isAdmin && !$isVendor) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Get advertisement details
        $stmt = $pdo->prepare("
            SELECT a.*, v.user_id as vendor_user_id
            FROM advertisements a
            JOIN vendors v ON a.vendor_id = v.id
            WHERE a.id = ?
        ");
        $stmt->execute([$input['advertisement_id']]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        // Verify vendor owns the ad (if vendor is reactivating)
        // Use null-safe check to handle cases where vendor_user_id might be NULL
        if ($isVendor && (!isset($ad['vendor_user_id']) || $ad['vendor_user_id'] === null || $ad['vendor_user_id'] !== $payload['user_id'])) {
            $pdo->rollBack();
            http_response_code(403);
            echo json_encode(['error' => 'You can only reactivate your own advertisements']);
            return;
        }
        
        // Only allow reactivation of expired ads
        if ($ad['status'] !== 'expired') {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Only expired advertisements can be reactivated']);
            return;
        }
        
        // Get updated values from input (or use existing values)
        $tier = isset($input['tier']) ? $input['tier'] : $ad['tier'];
        $durationDays = isset($input['duration_days']) ? intval($input['duration_days']) : $ad['duration_days'];
        $adTitle = isset($input['ad_title']) ? sanitizeInput($input['ad_title']) : $ad['ad_title'];
        $adDescription = isset($input['ad_description']) ? sanitizeInput($input['ad_description']) : $ad['ad_description'];
        $adImage = isset($input['ad_image']) ? sanitizeInput($input['ad_image']) : $ad['ad_image'];
        $contentDuration = isset($input['content_duration']) ? intval($input['content_duration']) : $ad['content_duration'];
        $previousPrice = isset($input['previous_price']) && $input['previous_price'] !== null 
            ? floatval($input['previous_price']) 
            : $ad['previous_price'];
        $currentPrice = isset($input['current_price']) && $input['current_price'] !== null 
            ? floatval($input['current_price']) 
            : $ad['current_price'];
        // For vendors, don't allow changing page_locations (admin sets during approval)
        // For admins, allow setting page_locations
        if ($isVendor) {
            // Vendor reactivation: keep existing page_locations or use default
            if (isset($ad['page_locations']) && !empty($ad['page_locations'])) {
                $decoded = json_decode($ad['page_locations'], true);
                $pageLocations = ($decoded !== null && is_array($decoded)) ? $decoded : ['homepage', 'products'];
            } else {
                $pageLocations = ['homepage', 'products'];
            }
        } else {
            // Admin reactivation: allow setting page_locations
            if (isset($input['page_locations']) && is_array($input['page_locations'])) {
                $pageLocations = $input['page_locations'];
            } elseif (isset($ad['page_locations']) && !empty($ad['page_locations'])) {
                $decoded = json_decode($ad['page_locations'], true);
                $pageLocations = ($decoded !== null && is_array($decoded)) ? $decoded : ['homepage', 'products'];
            } else {
                $pageLocations = ['homepage', 'products'];
            }
        }
        
        // Validate tier
        if (!in_array($tier, ['basic', 'premium'])) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Invalid tier. Must be "basic" or "premium"']);
            return;
        }
        
        // Validate duration
        if ($durationDays < 1) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['error' => 'Duration must be at least 1 day']);
            return;
        }
        
        // Validate content duration based on tier
        if ($contentDuration !== null) {
            if ($tier === 'basic' && ($contentDuration < 15 || $contentDuration > 30)) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Basic tier ads must be between 15-30 seconds']);
                return;
            }
            if ($tier === 'premium' && $contentDuration > 60) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Premium tier ads must be up to 60 seconds']);
                return;
            }
        }
        
        // Validate discount prices if provided
        if ($previousPrice !== null && $currentPrice !== null) {
            if ($currentPrice >= $previousPrice) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['error' => 'Current price must be less than previous price for discount']);
                return;
            }
        }
        
        // Calculate new price based on tier and duration
        $tierPrice = $tier === 'premium' ? 300 : 128; // KSh per day
        $totalPrice = $tierPrice * $durationDays;
        
        // Set priority (premium = 100, basic = 50)
        $priority = $tier === 'premium' ? 100 : 50;
        
        // Convert page_locations to JSON
        $pageLocationsJson = json_encode($pageLocations);
        
        // Determine new status
        // If admin reactivates, can set to 'active' directly
        // If vendor reactivates, set to 'pending' for admin approval
        $newStatus = ($isAdmin && isset($input['activate_immediately']) && $input['activate_immediately']) 
            ? 'active' 
            : 'pending';
        
        // Calculate dates
        $startDate = date('Y-m-d H:i:s');
        $endDate = date('Y-m-d H:i:s', strtotime("+{$durationDays} days"));
        
        // Update advertisement
        if ($newStatus === 'active') {
            // Admin activating directly
            $stmt = $pdo->prepare("
                UPDATE advertisements 
                SET tier = ?,
                    price = ?,
                    duration_days = ?,
                    ad_title = ?,
                    ad_description = ?,
                    ad_image = ?,
                    content_duration = ?,
                    previous_price = ?,
                    current_price = ?,
                    page_locations = ?,
                    priority = ?,
                    status = 'active',
                    start_date = ?,
                    end_date = ?,
                    created_at = NOW(),
                    activated_at = NOW(),
                    activated_by = ?
                WHERE id = ?
            ");
            
            // Get admin user_id from JWT token or admin session
            $adminUserId = null;
            if ($payload && isset($payload['user_id'])) {
                $adminUserId = $payload['user_id'];
            } elseif ($adminSession) {
                // If using admin session token, we need to get admin_id from session
                // Query the admin_sessions table to get admin details
                $stmt_admin = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ?");
                $stmt_admin->execute([$token]);
                $sessionData = $stmt_admin->fetch(PDO::FETCH_ASSOC);
                if ($sessionData) {
                    $adminUserId = $sessionData['admin_id'];
                }
            }
            
            $stmt->execute([
                $tier, $totalPrice, $durationDays, $adTitle, $adDescription, $adImage,
                $contentDuration, $previousPrice, $currentPrice, $pageLocationsJson,
                $priority, $startDate, $endDate, $adminUserId, $input['advertisement_id']
            ]);
        } else {
            // Vendor reactivating (needs approval) or admin setting to pending
            $stmt = $pdo->prepare("
                UPDATE advertisements 
                SET tier = ?,
                    price = ?,
                    duration_days = ?,
                    ad_title = ?,
                    ad_description = ?,
                    ad_image = ?,
                    content_duration = ?,
                    previous_price = ?,
                    current_price = ?,
                    page_locations = ?,
                    priority = ?,
                    status = 'pending',
                    created_at = NOW(),
                    start_date = NULL,
                    end_date = NULL,
                    activated_at = NULL,
                    activated_by = NULL
                WHERE id = ?
            ");
            $stmt->execute([
                $tier, $totalPrice, $durationDays, $adTitle, $adDescription, $adImage,
                $contentDuration, $previousPrice, $currentPrice, $pageLocationsJson,
                $priority, $input['advertisement_id']
            ]);
        }
        
        $pdo->commit();
        
        // Log reactivation
        if ($isVendor) {
            logActivity(
                $ad['vendor_user_id'],
                'vendor',
                'reactivate_advertisement',
                "Reactivated advertisement: {$adTitle}",
                [
                    'advertisement_id' => $input['advertisement_id'],
                    'tier' => $tier,
                    'duration_days' => $durationDays,
                    'new_price' => $totalPrice
                ]
            );
            
            require_once __DIR__ . '/../utils/notifications.php';
            $adminMessage = "Vendor has reactivated an expired advertisement. Tier: {$tier}, Duration: {$durationDays} days, New Price: KSh " . number_format($totalPrice, 2);
            notifyAllAdmins($adminMessage, 'advertisement');
        } else {
            // Admin reactivation - get admin user_id
            $adminUserIdForLog = null;
            if ($payload && isset($payload['user_id'])) {
                $adminUserIdForLog = $payload['user_id'];
            } elseif ($adminSession) {
                // If using admin session token, get admin_id from session
                $stmt_admin = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ?");
                $stmt_admin->execute([$token]);
                $sessionData = $stmt_admin->fetch(PDO::FETCH_ASSOC);
                if ($sessionData) {
                    $adminUserIdForLog = $sessionData['admin_id'];
                }
            }
            
            if ($adminUserIdForLog) {
                logActivity(
                    $adminUserIdForLog,
                    'admin',
                    'reactivate_advertisement',
                    "Reactivated advertisement: {$adTitle}",
                    [
                        'advertisement_id' => $input['advertisement_id'],
                        'tier' => $tier,
                        'duration_days' => $durationDays,
                        'new_price' => $totalPrice,
                        'vendor_id' => $ad['vendor_id'],
                        'activated_immediately' => $newStatus === 'active'
                    ]
                );
            }
        }
        
        echo json_encode([
            'success' => true,
            'message' => $newStatus === 'active' 
                ? 'Advertisement reactivated and activated successfully' 
                : 'Advertisement reactivated and pending approval',
            'advertisement' => [
                'id' => $input['advertisement_id'],
                'status' => $newStatus,
                'price' => $totalPrice,
                'tier' => $tier,
                'duration_days' => $durationDays
            ]
        ]);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Database error in handleReactivateAdvertisement: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reactivate advertisement: ' . $e->getMessage()]);
    } catch (Exception $e) {
        $pdo->rollBack();
        error_log('Error in handleReactivateAdvertisement: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to reactivate advertisement']);
    }
}

/**
 * Handle admin disabling an active advertisement
 */
function handleDisableAdvertisement() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['advertisement_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'advertisement_id is required']);
        return;
    }
    
    try {
        $adId = $input['advertisement_id'];
        
        // Check if ad exists and is active
        $stmt = $pdo->prepare("SELECT id, status, ad_title, vendor_id FROM advertisements WHERE id = ?");
        $stmt->execute([$adId]);
        $ad = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$ad) {
            http_response_code(404);
            echo json_encode(['error' => 'Advertisement not found']);
            return;
        }
        
        if ($ad['status'] !== 'active') {
            http_response_code(400);
            echo json_encode(['error' => 'Only active advertisements can be disabled']);
            return;
        }
        
        // Update status to expired (effectively disabling it)
        $stmt = $pdo->prepare("
            UPDATE advertisements 
            SET status = 'expired',
                end_date = NOW(),
                ad_description = CONCAT(ad_description, '\n\nNote: Disabled by admin on ', NOW())
            WHERE id = ?
        ");
        $stmt->execute([$adId]);
        
        // Notify vendor
        require_once __DIR__ . '/../utils/notifications.php';
        $vendorMessage = "Your advertisement '{$ad['ad_title']}' has been disabled by an administrator.";
        notifyVendor($ad['vendor_id'], $vendorMessage, 'advertisement');
        
        // Get admin user_id for logging
        $adminUserId = null;
        $adminPayload = validateAuthToken($token);
        if ($adminPayload) {
            $adminUserId = $adminPayload['user_id'];
        }
        
        // Log admin action
        logActivity(
            $adminUserId,
            'admin',
            'disable_advertisement',
            "Disabled advertisement: {$ad['ad_title']}",
            ['advertisement_id' => $adId, 'vendor_id' => $ad['vendor_id']]
        );
        
        echo json_encode([
            'success' => true,
            'message' => 'Advertisement disabled successfully'
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to disable advertisement: ' . $e->getMessage()]);
    }
}


?>

