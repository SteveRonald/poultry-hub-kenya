<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/notifications.php';

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
        
        // Get advertisements with analytics
        $stmt = $pdo->prepare("
            SELECT 
                a.*,
                p.name as product_name,
                p.price as product_price,
                p.image_urls as product_images,
                a.previous_price,
                a.current_price,
                an.views_count,
                an.clicks_count,
                an.revenue_generated,
                an.orders_count
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
        
        // Calculate CTR
        $ctr = $result['views_count'] > 0 
            ? ($result['clicks_count'] / $result['views_count']) * 100 
            : 0;
        
        echo json_encode([
            'success' => true,
            'analytics' => [
                'views_count' => intval($result['views_count']),
                'clicks_count' => intval($result['clicks_count']),
                'ctr' => round($ctr, 2),
                'revenue_generated' => floatval($result['revenue_generated']),
                'orders_count' => intval($result['orders_count']),
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
        $status = $_GET['status'] ?? null;
        
        $query = "
            SELECT 
                a.*,
                v.farm_name as vendor_name,
                p.name as product_name,
                COALESCE(an.views_count, 0) as views_count,
                COALESCE(an.clicks_count, 0) as clicks_count,
                COALESCE(an.revenue_generated, 0.00) as revenue_generated
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
                'page_locations' => isset($ad['page_locations']) ? json_decode($ad['page_locations'], true) : ['homepage', 'products'],
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
        
        // Update analytics
        $stmt = $pdo->prepare("
            UPDATE advertisement_analytics 
            SET views_count = views_count + 1,
                last_viewed_at = NOW(),
                updated_at = NOW()
            WHERE advertisement_id = ?
        ");
        $stmt->execute([$adId]);
        
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
        
        // Insert click record
        $clickId = generateUUID();
        $stmt = $pdo->prepare("
            INSERT INTO advertisement_clicks (id, advertisement_id, user_id, session_id, ip_address)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$clickId, $adId, $userId, $sessionId, $ipAddress]);
        
        // Update analytics
        $stmt = $pdo->prepare("
            UPDATE advertisement_analytics 
            SET clicks_count = clicks_count + 1,
                last_clicked_at = NOW(),
                updated_at = NOW()
            WHERE advertisement_id = ?
        ");
        $stmt->execute([$adId]);
        
        echo json_encode(['success' => true]);
        
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
    
    $limit = intval($_GET['limit'] ?? 3);
    $pageLocation = $_GET['page_location'] ?? 'homepage';
    
    try {
        // Get active ads that match the page location
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
            WHERE a.status = 'active'
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
                WHERE a.status = 'active'
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
    
    try {
        $pdo->beginTransaction();
        
        // Update analytics revenue and order count
        $stmt = $pdo->prepare("
            UPDATE advertisement_analytics 
            SET revenue_generated = revenue_generated + ?,
                orders_count = orders_count + 1,
                updated_at = NOW()
            WHERE advertisement_id = ?
        ");
        $stmt->execute([$orderAmount, $adId]);
        
        $pdo->commit();
        return true;
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log("Error updating ad revenue: " . $e->getMessage());
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

?>

