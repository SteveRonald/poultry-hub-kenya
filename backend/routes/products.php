<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/url_helper.php';

function handleGetProducts() {
    global $pdo;
    
    $search = $_GET['search'] ?? '';
    $category = $_GET['category'] ?? '';
    $location = $_GET['location'] ?? '';
    
    try {
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
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Image URL fixing is now handled by the url_helper utility

        // Format the response to match frontend expectations
        $formatted_products = array_map(function($product) {
            $imageUrl = $product['image_urls'] ? json_decode($product['image_urls'], true)[0] : null;
            
            return [
                'id' => $product['id'],
                'name' => $product['name'],
                'description' => $product['description'],
                'category' => $product['category'],
                'price' => floatval($product['price']),
                'stock_quantity' => intval($product['stock_quantity']),
                'unit' => $product['unit'],
                'image_url' => fixImageUrl($imageUrl),
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
?>
