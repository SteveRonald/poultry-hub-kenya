<?php
// Analytics API endpoints for admin dashboard

// Include required functions from admin routes
require_once __DIR__ . '/admin.php';

function handleAdminAnalytics() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $period = $_GET['period'] ?? '30'; // Default to last 30 days
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    
    try {
        // Calculate date range
        if ($startDate && $endDate) {
            $dateCondition = "AND DATE(o.created_at) BETWEEN ? AND ?";
            $dateParams = [$startDate, $endDate];
        } else {
            $dateCondition = "AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
            $dateParams = [$period];
        }
        
        // 1. Overview Metrics
        $overview = getOverviewMetrics($pdo, $dateCondition, $dateParams);
        
        // 2. Revenue Analytics
        $revenue = getRevenueAnalytics($pdo, $dateCondition, $dateParams);
        
        // 3. Order Analytics
        $orders = getOrderAnalytics($pdo, $dateCondition, $dateParams);
        
        // 4. User Analytics
        $users = getUserAnalytics($pdo, $dateCondition, $dateParams);
        
        // 5. Product Analytics
        $products = getProductAnalytics($pdo, $dateCondition, $dateParams);
        
        // 6. Vendor Analytics
        $vendors = getVendorAnalytics($pdo, $dateCondition, $dateParams);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'overview' => $overview,
                'revenue' => $revenue,
                'orders' => $orders,
                'users' => $users,
                'products' => $products,
                'vendors' => $vendors,
                'period' => $period,
                'date_range' => [
                    'start' => $startDate,
                    'end' => $endDate
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Analytics error: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch analytics data: ' . $e->getMessage()]);
    }
}

function getOverviewMetrics($pdo, $dateCondition, $dateParams) {
    // Total Revenue
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount), 0) as total_revenue
        FROM orders o
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
    ");
    $stmt->execute($dateParams);
    $totalRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total_revenue'];
    
    // Total Orders
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total_orders
        FROM orders o
        WHERE 1=1 $dateCondition
    ");
    $stmt->execute($dateParams);
    $totalOrders = $stmt->fetch(PDO::FETCH_ASSOC)['total_orders'];
    
    // Total Customers
    $stmt = $pdo->query("SELECT COUNT(*) as total_customers FROM user_profiles WHERE role = 'customer'");
    $totalCustomers = $stmt->fetch(PDO::FETCH_ASSOC)['total_customers'];
    
    // Total Vendors
    $stmt = $pdo->query("SELECT COUNT(*) as total_vendors FROM vendors");
    $totalVendors = $stmt->fetch(PDO::FETCH_ASSOC)['total_vendors'];
    
    // Total Products
    $stmt = $pdo->query("SELECT COUNT(*) as total_products FROM products WHERE is_active = 1");
    $totalProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total_products'];
    
    // Average Order Value
    $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;
    
    return [
        'total_revenue' => floatval($totalRevenue),
        'total_orders' => intval($totalOrders),
        'total_customers' => intval($totalCustomers),
        'total_vendors' => intval($totalVendors),
        'total_products' => intval($totalProducts),
        'average_order_value' => floatval($avgOrderValue)
    ];
}

function getRevenueAnalytics($pdo, $dateCondition, $dateParams) {
    // Daily Revenue Trend
    $stmt = $pdo->prepare("
        SELECT 
            DATE(o.created_at) as date,
            SUM(o.total_amount) as daily_revenue
        FROM orders o
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY DATE(o.created_at)
        ORDER BY date ASC
    ");
    $stmt->execute($dateParams);
    $dailyRevenue = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Revenue by Payment Method
    $stmt = $pdo->prepare("
        SELECT 
            o.payment_method,
            SUM(o.total_amount) as revenue
        FROM orders o
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY o.payment_method
    ");
    $stmt->execute($dateParams);
    $revenueByPayment = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'daily_trend' => $dailyRevenue,
        'by_payment_method' => $revenueByPayment
    ];
}

function getOrderAnalytics($pdo, $dateCondition, $dateParams) {
    // Daily Order Trend
    $stmt = $pdo->prepare("
        SELECT 
            DATE(o.created_at) as date,
            COUNT(*) as daily_orders
        FROM orders o
        WHERE 1=1 $dateCondition
        GROUP BY DATE(o.created_at)
        ORDER BY date ASC
    ");
    $stmt->execute($dateParams);
    $dailyOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Order Status Distribution
    $stmt = $pdo->prepare("
        SELECT 
            o.status,
            COUNT(*) as count
        FROM orders o
        WHERE 1=1 $dateCondition
        GROUP BY o.status
    ");
    $stmt->execute($dateParams);
    $orderStatus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'daily_trend' => $dailyOrders,
        'status_distribution' => $orderStatus
    ];
}

function getUserAnalytics($pdo, $dateCondition, $dateParams) {
    // Customer Registration Trend
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as daily_registrations
        FROM user_profiles 
        WHERE role = 'customer' 
        AND DATE(created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$_GET['period'] ?? '30']);
    $customerRegistrations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Vendor Registration Trend
    $stmt = $pdo->prepare("
        SELECT 
            DATE(created_at) as date,
            COUNT(*) as daily_registrations
        FROM vendors 
        WHERE DATE(created_at) >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$_GET['period'] ?? '30']);
    $vendorRegistrations = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Active Users (users who made orders in the period)
    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT o.user_id) as active_customers
        FROM orders o
        WHERE 1=1 $dateCondition
    ");
    $stmt->execute($dateParams);
    $activeCustomers = $stmt->fetch(PDO::FETCH_ASSOC)['active_customers'];
    
    return [
        'customer_registrations' => $customerRegistrations,
        'vendor_registrations' => $vendorRegistrations,
        'active_customers' => intval($activeCustomers)
    ];
}

function getProductAnalytics($pdo, $dateCondition, $dateParams) {
    // Top Selling Products
    $stmt = $pdo->prepare("
        SELECT 
            p.name as product_name,
            SUM(o.quantity) as total_quantity,
            SUM(o.total_amount) as total_revenue,
            COUNT(o.id) as order_count
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY p.id, p.name
        ORDER BY total_revenue DESC
        LIMIT 10
    ");
    $stmt->execute($dateParams);
    $topProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Products by Category
    $stmt = $pdo->prepare("
        SELECT 
            p.category,
            COUNT(DISTINCT p.id) as product_count,
            SUM(o.total_amount) as category_revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY p.category
        ORDER BY category_revenue DESC
    ");
    $stmt->execute($dateParams);
    $productsByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'top_selling' => $topProducts,
        'by_category' => $productsByCategory
    ];
}

function getVendorAnalytics($pdo, $dateCondition, $dateParams) {
    // Top Performing Vendors
    $stmt = $pdo->prepare("
        SELECT 
            u.full_name as vendor_name,
            v.farm_name,
            COUNT(o.id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            AVG(o.total_amount) as avg_order_value
        FROM orders o
        JOIN vendors v ON o.vendor_id = v.id
        JOIN user_profiles u ON v.user_id = u.id
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY v.id, u.full_name, v.farm_name
        ORDER BY total_revenue DESC
        LIMIT 10
    ");
    $stmt->execute($dateParams);
    $topVendors = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Vendor Status Distribution
    $stmt = $pdo->query("
        SELECT 
            status,
            COUNT(*) as count
        FROM vendors 
        GROUP BY status
    ");
    $vendorStatus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'top_performing' => $topVendors,
        'status_distribution' => $vendorStatus
    ];
}

function handleVendorAnalytics() {
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
    
    $period = $_GET['period'] ?? '30'; // Default to last 30 days
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;
    
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
        
        // Calculate date range
        if ($startDate && $endDate) {
            $dateCondition = "AND DATE(o.created_at) BETWEEN ? AND ?";
            $dateParams = [$startDate, $endDate];
        } else {
            $dateCondition = "AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)";
            $dateParams = [$period];
        }
        
        // 1. Overview Metrics
        $overview = getVendorOverviewMetrics($pdo, $vendorId, $dateCondition, $dateParams);
        
        // 2. Sales Analytics
        $sales = getVendorSalesAnalytics($pdo, $vendorId, $dateCondition, $dateParams);
        
        // 3. Product Analytics
        $products = getVendorProductAnalytics($pdo, $vendorId, $dateCondition, $dateParams);
        
        // 4. Customer Analytics
        $customers = getVendorCustomerAnalytics($pdo, $vendorId, $dateCondition, $dateParams);
        
        // 5. Order Analytics
        $orders = getVendorOrderAnalytics($pdo, $vendorId, $dateCondition, $dateParams);
        
        echo json_encode([
            'success' => true,
            'data' => [
                'overview' => $overview,
                'sales' => $sales,
                'products' => $products,
                'customers' => $customers,
                'orders' => $orders,
                'period' => $period,
                'date_range' => [
                    'start' => $startDate,
                    'end' => $endDate
                ]
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Vendor Analytics error: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch vendor analytics data: ' . $e->getMessage()]);
    }
}

function getVendorOverviewMetrics($pdo, $vendorId, $dateCondition, $dateParams) {
    // Total Revenue
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $totalRevenue = $stmt->fetch(PDO::FETCH_ASSOC)['total_revenue'];
    
    // Total Orders
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as total_orders
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? $dateCondition
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $totalOrders = $stmt->fetch(PDO::FETCH_ASSOC)['total_orders'];
    
    // Total Products
    $stmt = $pdo->prepare("SELECT COUNT(*) as total_products FROM products WHERE vendor_id = ?");
    $stmt->execute([$vendorId]);
    $totalProducts = $stmt->fetch(PDO::FETCH_ASSOC)['total_products'];
    
    // Active Products
    $stmt = $pdo->prepare("SELECT COUNT(*) as active_products FROM products WHERE vendor_id = ? AND is_active = 1");
    $stmt->execute([$vendorId]);
    $activeProducts = $stmt->fetch(PDO::FETCH_ASSOC)['active_products'];
    
    // Unique Customers
    $stmt = $pdo->prepare("
        SELECT COUNT(DISTINCT o.user_id) as unique_customers
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? $dateCondition
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $uniqueCustomers = $stmt->fetch(PDO::FETCH_ASSOC)['unique_customers'];
    
    // Average Order Value
    $avgOrderValue = $totalOrders > 0 ? $totalRevenue / $totalOrders : 0;
    
    return [
        'total_revenue' => floatval($totalRevenue),
        'total_orders' => intval($totalOrders),
        'total_products' => intval($totalProducts),
        'active_products' => intval($activeProducts),
        'unique_customers' => intval($uniqueCustomers),
        'average_order_value' => floatval($avgOrderValue)
    ];
}

function getVendorSalesAnalytics($pdo, $vendorId, $dateCondition, $dateParams) {
    // Daily Sales Trend
    $stmt = $pdo->prepare("
        SELECT 
            DATE(o.created_at) as date,
            SUM(o.total_amount) as daily_revenue,
            COUNT(o.id) as daily_orders
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY DATE(o.created_at)
        ORDER BY date ASC
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $dailySales = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Sales by Payment Method
    $stmt = $pdo->prepare("
        SELECT 
            o.payment_method,
            SUM(o.total_amount) as revenue,
            COUNT(o.id) as order_count
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY o.payment_method
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $salesByPayment = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'daily_trend' => $dailySales,
        'by_payment_method' => $salesByPayment
    ];
}

function getVendorProductAnalytics($pdo, $vendorId, $dateCondition, $dateParams) {
    // Top Selling Products
    $stmt = $pdo->prepare("
        SELECT 
            p.name as product_name,
            p.category,
            SUM(o.quantity) as total_quantity,
            SUM(o.total_amount) as total_revenue,
            COUNT(o.id) as order_count,
            AVG(o.total_amount) as avg_order_value
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY p.id, p.name, p.category
        ORDER BY total_revenue DESC
        LIMIT 10
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $topProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Product Performance by Category
    $stmt = $pdo->prepare("
        SELECT 
            p.category,
            COUNT(DISTINCT p.id) as product_count,
            SUM(o.total_amount) as category_revenue,
            SUM(o.quantity) as total_quantity
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('confirmed', 'processing', 'shipped', 'delivered') 
        $dateCondition
        GROUP BY p.category
        ORDER BY category_revenue DESC
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $productsByCategory = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Stock Levels
    $stmt = $pdo->prepare("
        SELECT 
            name,
            stock_quantity,
            price,
            is_active
        FROM products 
        WHERE vendor_id = ?
        ORDER BY stock_quantity ASC
    ");
    $stmt->execute([$vendorId]);
    $stockLevels = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    return [
        'top_selling' => $topProducts,
        'by_category' => $productsByCategory,
        'stock_levels' => $stockLevels
    ];
}

function getVendorCustomerAnalytics($pdo, $vendorId, $dateCondition, $dateParams) {
    // Customer Order Distribution
    $stmt = $pdo->prepare("
        SELECT 
            u.full_name as customer_name,
            u.email as customer_email,
            COUNT(o.id) as order_count,
            SUM(o.total_amount) as total_spent,
            MAX(o.created_at) as last_order_date
        FROM orders o
        JOIN products p ON o.product_id = p.id
        JOIN user_profiles u ON o.user_id = u.id
        WHERE p.vendor_id = ? $dateCondition
        GROUP BY o.user_id, u.full_name, u.email
        ORDER BY total_spent DESC
        LIMIT 10
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $topCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Repeat Customers
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as repeat_customers
        FROM (
            SELECT o.user_id
            FROM orders o
            JOIN products p ON o.product_id = p.id
            WHERE p.vendor_id = ? $dateCondition
            GROUP BY o.user_id
            HAVING COUNT(o.id) > 1
        ) as repeat_customers
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $repeatCustomers = $stmt->fetch(PDO::FETCH_ASSOC)['repeat_customers'];
    
    // New vs Returning Customers
    $stmt = $pdo->prepare("
        SELECT 
            CASE 
                WHEN COUNT(o.id) = 1 THEN 'New'
                ELSE 'Returning'
            END as customer_type,
            COUNT(DISTINCT o.user_id) as customer_count
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? $dateCondition
        GROUP BY o.user_id
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $customerTypes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $newCustomers = 0;
    $returningCustomers = 0;
    foreach ($customerTypes as $type) {
        if ($type['customer_type'] === 'New') {
            $newCustomers = $type['customer_count'];
        } else {
            $returningCustomers = $type['customer_count'];
        }
    }
    
    return [
        'top_customers' => $topCustomers,
        'repeat_customers' => intval($repeatCustomers),
        'new_customers' => $newCustomers,
        'returning_customers' => $returningCustomers
    ];
}

function getVendorOrderAnalytics($pdo, $vendorId, $dateCondition, $dateParams) {
    // Order Status Distribution
    $stmt = $pdo->prepare("
        SELECT 
            o.status,
            COUNT(*) as count,
            SUM(o.total_amount) as total_amount
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? $dateCondition
        GROUP BY o.status
        ORDER BY count DESC
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $orderStatus = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Average Order Processing Time (simplified)
    $stmt = $pdo->prepare("
        SELECT 
            AVG(TIMESTAMPDIFF(HOUR, o.created_at, o.updated_at)) as avg_processing_hours
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE p.vendor_id = ? AND o.status IN ('delivered', 'shipped') 
        $dateCondition
    ");
    $stmt->execute(array_merge([$vendorId], $dateParams));
    $avgProcessingTime = $stmt->fetch(PDO::FETCH_ASSOC)['avg_processing_hours'] ?? 0;
    
    return [
        'status_distribution' => $orderStatus,
        'avg_processing_time_hours' => floatval($avgProcessingTime)
    ];
}

?>
