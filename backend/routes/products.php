<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/security.php';

function handleGetProducts() {
    global $pdo;
    
    // Sanitize GET parameters to prevent XSS and SQL injection
    $search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : '';
    $category = isset($_GET['category']) ? sanitizeInput($_GET['category']) : '';
    $location = isset($_GET['location']) ? sanitizeInput($_GET['location']) : '';
    $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 0;
    if ($limit <= 0) {
        $limit = 0;
    } else {
        $limit = max(1, min(200, $limit));
    }
    
    try {
        // Prefer created_at ordering when available, else fall back to id.
        $orderBy = 'p.id DESC';
        try {
            $colStmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'created_at'");
            if ($colStmt && $colStmt->rowCount() > 0) {
                $orderBy = 'p.created_at DESC';
            }
        } catch (Exception $e) {
            // ignore and keep fallback
        }

        $sql = "SELECT p.*, v.farm_name, v.location as vendor_location 
                FROM products p 
                JOIN vendors v ON p.vendor_id = v.id 
                WHERE p.is_active = 1 AND v.status = 'approved'";
        
        $params = [];
        
        if (!empty($search)) {
            $sql .= " AND (p.name LIKE ? OR v.farm_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }
        
        if (!empty($category) && $category !== 'all') {
            $sql .= " AND p.category = ?";
            $params[] = $category;
        }
        
        if (!empty($location) && $location !== 'all') {
            $sql .= " AND v.location = ?";
            $params[] = $location;
        }

        $sql .= " ORDER BY {$orderBy}";
        if ($limit > 0) {
            $sql .= " LIMIT {$limit}";
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format the response to match frontend expectations
        $formatted_products = array_map(function($product) {
            return [
                'id' => $product['id'],
                'name' => $product['name'],
                'description' => $product['description'],
                'category' => $product['category'],
                'price' => floatval($product['price']),
                'stock_quantity' => intval($product['stock_quantity']),
                'minimum_order_quantity' => isset($product['minimum_order_quantity']) ? intval($product['minimum_order_quantity']) : 1,
                'unit' => $product['unit'],
                'image_url' => $product['image_urls'] ? json_decode($product['image_urls'], true)[0] : null,
                'image_urls' => $product['image_urls'],
                'average_rating' => isset($product['average_rating']) ? floatval($product['average_rating']) : 0.00,
                'total_ratings' => isset($product['total_ratings']) ? intval($product['total_ratings']) : 0,
                'vendor_profiles' => [
                    'farm_name' => $product['farm_name'],
                    'location' => $product['vendor_location']
                ]
            ];
        }, $products);
        
        echo json_encode($formatted_products);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch products: ' . $e->getMessage()]);
    }
}

/**
 * Handle getting a single product by ID
 */
function handleGetProduct($productId = null) {
    global $pdo;
    
    // Get product ID from parameter or URL path
    if ($productId === null) {
        $path = $_SERVER['REQUEST_URI'] ?? '';
        // Extract product ID from path like /api/products/{id}
        if (preg_match('#/api/products/([^/?]+)#', $path, $matches)) {
            $productId = $matches[1];
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Product ID is required']);
            return;
        }
    }
    
    // Product IDs can be either integers or hex strings (from uniqid())
    // Sanitize but keep as string for database query
    $productId = trim($productId);
    if (empty($productId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid product ID']);
        return;
    }
    
    try {
        // Product IDs can be either integers or hex strings (from uniqid())
        // Use the productId as-is (string or int) for the query
        $stmt = $pdo->prepare("
            SELECT p.*, v.farm_name, v.location as vendor_location, v.user_id as vendor_user_id
            FROM products p 
            JOIN vendors v ON p.vendor_id = v.id 
            WHERE p.id = ? AND p.is_active = 1 AND v.status = 'approved'
        ");
        $stmt->execute([$productId]);
        $product = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$product) {
            http_response_code(404);
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        // Parse image_urls safely
        $imageUrls = [];
        if (!empty($product['image_urls'])) {
            $decoded = json_decode($product['image_urls'], true);
            if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                $imageUrls = $decoded;
            } else {
                // If JSON decode fails, try to treat as single string
                $imageUrls = [$product['image_urls']];
            }
        }
        
        // Format the response
        $formatted_product = [
            'id' => strval($product['id']), // Ensure ID is string for consistency
            'name' => $product['name'] ?? '',
            'description' => $product['description'] ?? '',
            'category' => $product['category'] ?? '',
            'price' => floatval($product['price'] ?? 0),
            'stock_quantity' => intval($product['stock_quantity'] ?? 0),
            'minimum_order_quantity' => isset($product['minimum_order_quantity']) ? intval($product['minimum_order_quantity']) : 1,
            'unit' => $product['unit'] ?? '',
            'image_urls' => $imageUrls,
            'average_rating' => isset($product['average_rating']) && $product['average_rating'] !== null ? floatval($product['average_rating']) : 0.00,
            'total_ratings' => isset($product['total_ratings']) && $product['total_ratings'] !== null ? intval($product['total_ratings']) : 0,
            'vendor_profiles' => [
                'id' => intval($product['vendor_id'] ?? 0),
                'farm_name' => $product['farm_name'] ?? '',
                'location' => $product['vendor_location'] ?? '',
                'user_id' => isset($product['vendor_user_id']) && $product['vendor_user_id'] !== null ? intval($product['vendor_user_id']) : null
            ]
        ];
        
        header('Content-Type: application/json');
        echo json_encode($formatted_product, JSON_UNESCAPED_SLASHES);
        
    } catch (PDOException $e) {
        error_log('Product fetch error: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Failed to fetch product. Please try again later.']);
    } catch (Exception $e) {
        error_log('Product fetch error: ' . $e->getMessage());
        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'An error occurred while fetching the product.']);
    }
}
?>
