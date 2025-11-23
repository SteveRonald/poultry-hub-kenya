<?php
/**
 * Product Ratings API
 * Handles creating, reading, updating, and deleting product ratings
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';

header('Content-Type: application/json');

/**
 * Create or update a product rating
 */
function handleCreateRating() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Product IDs can be strings (from uniqid()) or integers
    $productId = $input['product_id'] ?? '';
    $productId = trim($productId);
    $rating = intval($input['rating'] ?? 0);
    $reviewText = isset($input['review_text']) ? sanitizeInput($input['review_text']) : null;
    $orderId = isset($input['order_id']) ? intval($input['order_id']) : null;
    
    // Validation
    if (empty($productId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid product ID']);
        return;
    }
    
    if ($rating < 1 || $rating > 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Rating must be between 1 and 5']);
        return;
    }
    
    if ($reviewText && strlen($reviewText) > 2000) {
        http_response_code(400);
        echo json_encode(['error' => 'Review text cannot exceed 2000 characters']);
        return;
    }
    
    try {
        // Check if product exists
        $stmt = $pdo->prepare("SELECT id, vendor_id FROM products WHERE id = ? AND is_active = 1");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        // Check if user is trying to rate their own product
        $stmt = $pdo->prepare("SELECT user_id FROM vendors WHERE id = ?");
        $stmt->execute([$product['vendor_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($vendor && $vendor['user_id'] == $payload['user_id']) {
            http_response_code(403);
            echo json_encode(['error' => 'You cannot rate your own products']);
            return;
        }
        
        // Check if order_id is provided and belongs to user
        $isVerifiedPurchase = false;
        if ($orderId) {
            $stmt = $pdo->prepare("
                SELECT id, status 
                FROM orders 
                WHERE id = ? AND user_id = ? AND product_id = ?
            ");
            $stmt->execute([$orderId, $payload['user_id'], $productId]);
            $order = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($order) {
                $isVerifiedPurchase = true;
            } else {
                // Order doesn't belong to user or doesn't exist, set to null
                $orderId = null;
            }
        }
        
        // Check if rating already exists
        $stmt = $pdo->prepare("SELECT id FROM product_ratings WHERE user_id = ? AND product_id = ?");
        $stmt->execute([$payload['user_id'], $productId]);
        $existingRating = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $pdo->beginTransaction();
        
        if ($existingRating) {
            // Update existing rating
            $stmt = $pdo->prepare("
                UPDATE product_ratings 
                SET rating = ?, review_text = ?, order_id = ?, is_verified_purchase = ?, updated_at = NOW()
                WHERE id = ?
            ");
            $stmt->execute([$rating, $reviewText, $orderId, $isVerifiedPurchase ? 1 : 0, $existingRating['id']]);
            $ratingId = $existingRating['id'];
        } else {
            // Create new rating
            $stmt = $pdo->prepare("
                INSERT INTO product_ratings (product_id, user_id, order_id, rating, review_text, is_verified_purchase)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$productId, $payload['user_id'], $orderId, $rating, $reviewText, $isVerifiedPurchase ? 1 : 0]);
            $ratingId = $pdo->lastInsertId();
        }
        
        // Update product average rating and total ratings count
        updateProductRatingStats($productId);
        
        $pdo->commit();
        
        // Fetch the created/updated rating with user info
        $stmt = $pdo->prepare("
            SELECT r.*, u.full_name as user_name, u.email as user_email
            FROM product_ratings r
            JOIN user_profiles u ON r.user_id = u.id
            WHERE r.id = ?
        ");
        $stmt->execute([$ratingId]);
        $ratingData = $stmt->fetch(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => $existingRating ? 'Rating updated successfully' : 'Rating created successfully',
            'rating' => [
                'id' => $ratingData['id'],
                'product_id' => $ratingData['product_id'],
                'user_id' => $ratingData['user_id'],
                'user_name' => $ratingData['user_name'],
                'rating' => intval($ratingData['rating']),
                'review_text' => $ratingData['review_text'],
                'is_verified_purchase' => (bool)$ratingData['is_verified_purchase'],
                'created_at' => $ratingData['created_at'],
                'updated_at' => $ratingData['updated_at']
            ]
        ]);
        
    } catch (PDOException $e) {
        $pdo->rollBack();
        error_log('Rating creation error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create rating']);
    }
}

/**
 * Get ratings for a product
 */
function handleGetRatings() {
    global $pdo;
    
    $productId = isset($_GET['product_id']) ? trim($_GET['product_id']) : '';
    $page = isset($_GET['page']) ? max(1, intval($_GET['page'])) : 1;
    $limit = isset($_GET['limit']) ? min(50, max(1, intval($_GET['limit']))) : 10;
    $offset = ($page - 1) * $limit;
    
    if (empty($productId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid product ID']);
        return;
    }
    
    try {
        // Get total count
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM product_ratings WHERE product_id = ?");
        $stmt->execute([$productId]);
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Get ratings with user info
        $stmt = $pdo->prepare("
            SELECT 
                r.*,
                u.full_name as user_name,
                u.email as user_email
            FROM product_ratings r
            JOIN user_profiles u ON r.user_id = u.id
            WHERE r.product_id = ?
            ORDER BY r.is_verified_purchase DESC, r.created_at DESC
            LIMIT ? OFFSET ?
        ");
        $stmt->execute([$productId, $limit, $offset]);
        $ratings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Get average rating
        $stmt = $pdo->prepare("
            SELECT 
                AVG(rating) as average_rating,
                COUNT(*) as total_ratings,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
            FROM product_ratings
            WHERE product_id = ?
        ");
        $stmt->execute([$productId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'ratings' => array_map(function($rating) {
                return [
                    'id' => $rating['id'],
                    'user_id' => $rating['user_id'],
                    'user_name' => $rating['user_name'],
                    'rating' => intval($rating['rating']),
                    'review_text' => $rating['review_text'],
                    'is_verified_purchase' => (bool)$rating['is_verified_purchase'],
                    'created_at' => $rating['created_at'],
                    'updated_at' => $rating['updated_at']
                ];
            }, $ratings),
            'stats' => [
                'average_rating' => round(floatval($stats['average_rating']), 2),
                'total_ratings' => intval($stats['total_ratings']),
                'rating_distribution' => [
                    '5' => intval($stats['five_star']),
                    '4' => intval($stats['four_star']),
                    '3' => intval($stats['three_star']),
                    '2' => intval($stats['two_star']),
                    '1' => intval($stats['one_star'])
                ]
            ],
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => intval($total),
                'total_pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (PDOException $e) {
        error_log('Get ratings error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch ratings']);
    }
}

/**
 * Get user's rating for a product (if exists)
 */
function handleGetUserRating() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $productId = isset($_GET['product_id']) ? trim($_GET['product_id']) : '';
    
    if (empty($productId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid product ID']);
        return;
    }
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM product_ratings 
            WHERE user_id = ? AND product_id = ?
        ");
        $stmt->execute([$payload['user_id'], $productId]);
        $rating = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($rating) {
            echo json_encode([
                'rating' => [
                    'id' => $rating['id'],
                    'rating' => intval($rating['rating']),
                    'review_text' => $rating['review_text'],
                    'is_verified_purchase' => (bool)$rating['is_verified_purchase'],
                    'created_at' => $rating['created_at'],
                    'updated_at' => $rating['updated_at']
                ]
            ]);
        } else {
            echo json_encode(['rating' => null]);
        }
        
    } catch (PDOException $e) {
        error_log('Get user rating error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch rating']);
    }
}

/**
 * Delete a rating
 */
function handleDeleteRating() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $ratingId = intval($input['rating_id'] ?? 0);
    
    if ($ratingId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid rating ID']);
        return;
    }
    
    try {
        // Check if rating exists and belongs to user
        $stmt = $pdo->prepare("SELECT id, product_id FROM product_ratings WHERE id = ? AND user_id = ?");
        $stmt->execute([$ratingId, $payload['user_id']]);
        $rating = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$rating) {
            http_response_code(404);
            echo json_encode(['error' => 'Rating not found or you do not have permission to delete it']);
            return;
        }
        
        $productId = $rating['product_id'];
        
        // Delete rating
        $stmt = $pdo->prepare("DELETE FROM product_ratings WHERE id = ?");
        $stmt->execute([$ratingId]);
        
        // Update product rating stats
        updateProductRatingStats($productId);
        
        http_response_code(200);
        echo json_encode(['success' => true, 'message' => 'Rating deleted successfully']);
        
    } catch (PDOException $e) {
        error_log('Delete rating error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete rating']);
    }
}

/**
 * Update product rating statistics
 */
function updateProductRatingStats($productId) {
    global $pdo;
    
    $stmt = $pdo->prepare("
        SELECT 
            AVG(rating) as average_rating,
            COUNT(*) as total_ratings
        FROM product_ratings
        WHERE product_id = ?
    ");
    $stmt->execute([$productId]);
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $averageRating = $stats['average_rating'] ? round(floatval($stats['average_rating']), 2) : 0.00;
    $totalRatings = intval($stats['total_ratings']);
    
    $stmt = $pdo->prepare("
        UPDATE products 
        SET average_rating = ?, total_ratings = ?
        WHERE id = ?
    ");
    $stmt->execute([$averageRating, $totalRatings, $productId]);
}

// Route handling
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Ensure we're handling the ratings route
if (!isset($_GET['product_id']) && $method === 'GET' && !isset($_GET['user_rating'])) {
    // If no product_id in GET request and not user_rating, might be wrong route
    // But continue anyway as handleGetRatings will return error
}

switch ($method) {
    case 'POST':
        handleCreateRating();
        break;
    case 'GET':
        if (isset($_GET['user_rating']) && $_GET['user_rating'] == '1') {
            handleGetUserRating();
        } else {
            handleGetRatings();
        }
        break;
    case 'DELETE':
        handleDeleteRating();
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

