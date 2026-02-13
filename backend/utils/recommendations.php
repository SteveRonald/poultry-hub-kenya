<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/ai/RecommendationsAI.php';

function getOrderStatusesForAnalytics() {
    return ['confirmed', 'processing', 'shipped', 'delivered'];
}

function buildVendorMetrics($vendorId) {
    global $pdo;
    $statuses = getOrderStatusesForAnalytics();
    $placeholders = implode(',', array_fill(0, count($statuses), '?'));

    $now = new DateTime('now', new DateTimeZone('Africa/Nairobi'));
    $start = (clone $now)->modify('-7 days')->format('Y-m-d H:i:s');
    $prevStart = (clone $now)->modify('-14 days')->format('Y-m-d H:i:s');
    $prevEnd = (clone $now)->modify('-7 days')->format('Y-m-d H:i:s');

    // Revenue + orders for last 7 days
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
        FROM orders
        WHERE vendor_id = ? AND status IN ($placeholders) AND created_at >= ?
    ");
    $stmt->execute(array_merge([$vendorId], $statuses, [$start]));
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    // Revenue + orders for previous 7 days
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
        FROM orders
        WHERE vendor_id = ? AND status IN ($placeholders) AND created_at BETWEEN ? AND ?
    ");
    $stmt->execute(array_merge([$vendorId], $statuses, [$prevStart, $prevEnd]));
    $previous = $stmt->fetch(PDO::FETCH_ASSOC);

    $revenue7d = (float)$current['revenue'];
    $orders7d = (int)$current['orders'];
    $revenuePrev7d = (float)$previous['revenue'];
    $growthPct = $revenuePrev7d > 0 ? (($revenue7d - $revenuePrev7d) / $revenuePrev7d) * 100 : null;

    // Top products (last 7 days)
    $stmt = $pdo->prepare("
        SELECT p.id, p.name, SUM(o.quantity) as units, SUM(o.total_amount) as revenue
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.vendor_id = ? AND o.status IN ($placeholders) AND o.created_at >= ?
        GROUP BY p.id, p.name
        ORDER BY revenue DESC
        LIMIT 3
    ");
    $stmt->execute(array_merge([$vendorId], $statuses, [$start]));
    $topProducts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Low stock risk (use 30d avg sales)
    $stmt = $pdo->prepare("
        SELECT p.id, p.name, p.stock_quantity,
               COALESCE(SUM(o.quantity),0) as units_30d
        FROM products p
        LEFT JOIN orders o ON o.product_id = p.id
            AND o.vendor_id = ?
            AND o.status IN ($placeholders)
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        WHERE p.vendor_id = ?
        GROUP BY p.id, p.name, p.stock_quantity
        ORDER BY p.stock_quantity ASC
        LIMIT 10
    ");
    $stmt->execute(array_merge([$vendorId], $statuses, [$vendorId]));
    $lowStock = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $avgDaily = (float)$row['units_30d'] / 30.0;
        $riskDays = $avgDaily > 0 ? ($row['stock_quantity'] / $avgDaily) : null;
        if ($row['stock_quantity'] <= 5 || ($riskDays !== null && $riskDays <= 7)) {
            $lowStock[] = [
                'id' => $row['id'],
                'name' => $row['name'],
                'stock_quantity' => (int)$row['stock_quantity'],
                'avg_daily_sales' => round($avgDaily, 2),
                'stock_days' => $riskDays !== null ? round($riskDays, 1) : null
            ];
        }
    }

    return [
        'period' => 'last_7_days',
        'revenue_7d' => $revenue7d,
        'orders_7d' => $orders7d,
        'revenue_prev_7d' => $revenuePrev7d,
        'growth_pct' => $growthPct !== null ? round($growthPct, 2) : null,
        'top_products' => $topProducts,
        'low_stock' => $lowStock,
        'no_sales_7d' => $orders7d === 0
    ];
}

function buildAdminMetrics() {
    global $pdo;
    $statuses = getOrderStatusesForAnalytics();
    $placeholders = implode(',', array_fill(0, count($statuses), '?'));

    $now = new DateTime('now', new DateTimeZone('Africa/Nairobi'));
    $start = (clone $now)->modify('-1 day')->format('Y-m-d H:i:s');
    $prevStart = (clone $now)->modify('-2 days')->format('Y-m-d H:i:s');
    $prevEnd = (clone $now)->modify('-1 day')->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
        FROM orders
        WHERE status IN ($placeholders) AND created_at >= ?
    ");
    $stmt->execute(array_merge($statuses, [$start]));
    $current = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(total_amount),0) as revenue, COUNT(*) as orders
        FROM orders
        WHERE status IN ($placeholders) AND created_at BETWEEN ? AND ?
    ");
    $stmt->execute(array_merge($statuses, [$prevStart, $prevEnd]));
    $previous = $stmt->fetch(PDO::FETCH_ASSOC);

    $revenue1d = (float)$current['revenue'];
    $orders1d = (int)$current['orders'];
    $revenuePrev1d = (float)$previous['revenue'];
    $growthPct = $revenuePrev1d > 0 ? (($revenue1d - $revenuePrev1d) / $revenuePrev1d) * 100 : null;

    // Top vendors (last 7 days)
    $stmt = $pdo->prepare("
        SELECT v.id as vendor_id, u.full_name as vendor_name, v.farm_name, SUM(o.total_amount) as revenue
        FROM orders o
        JOIN vendors v ON o.vendor_id = v.id
        JOIN user_profiles u ON v.user_id = u.id
        WHERE o.status IN ($placeholders) AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY v.id, u.full_name, v.farm_name
        ORDER BY revenue DESC
        LIMIT 5
    ");
    $stmt->execute($statuses);
    $topVendors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Top categories (last 7 days)
    $stmt = $pdo->prepare("
        SELECT p.category, SUM(o.total_amount) as revenue, SUM(o.quantity) as units
        FROM orders o
        JOIN products p ON o.product_id = p.id
        WHERE o.status IN ($placeholders) AND o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY p.category
        ORDER BY revenue DESC
        LIMIT 5
    ");
    $stmt->execute($statuses);
    $topCategories = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Stockout risk count
    $stmt = $pdo->query("
        SELECT COUNT(*) as risk_count
        FROM products
        WHERE stock_quantity <= 5
    ");
    $riskCount = (int)$stmt->fetch(PDO::FETCH_ASSOC)['risk_count'];

    return [
        'period' => 'last_1_day',
        'revenue_1d' => $revenue1d,
        'orders_1d' => $orders1d,
        'revenue_prev_1d' => $revenuePrev1d,
        'growth_pct' => $growthPct !== null ? round($growthPct, 2) : null,
        'top_vendors' => $topVendors,
        'top_categories' => $topCategories,
        'stockout_risk_count' => $riskCount
    ];
}

function buildVendorActions($metrics) {
    $actions = [];

    if (!empty($metrics['low_stock'])) {
        $top = $metrics['low_stock'][0];
        $actions[] = [
            'title' => "Restock {$top['name']}",
            'reason' => 'Low stock risk based on recent sales velocity.',
            'priority' => 'high'
        ];
    }

    if ($metrics['no_sales_7d']) {
        $actions[] = [
            'title' => 'Improve listing visibility',
            'reason' => 'No sales in the last 7 days. Update photos, description, or run a promotion.',
            'priority' => 'high'
        ];
    }

    if ($metrics['growth_pct'] !== null && $metrics['growth_pct'] <= -30) {
        $actions[] = [
            'title' => 'Review pricing and promotions',
            'reason' => 'Sales dropped significantly compared to the previous week.',
            'priority' => 'medium'
        ];
    }

    if ($metrics['growth_pct'] !== null && $metrics['growth_pct'] >= 25) {
        $actions[] = [
            'title' => 'Keep momentum on best sellers',
            'reason' => 'Strong week-over-week growth. Ensure top products stay in stock.',
            'priority' => 'medium'
        ];
    }

    if (empty($actions)) {
        $actions[] = [
            'title' => 'Maintain current strategy',
            'reason' => 'Sales are stable. Monitor stock levels and customer feedback.',
            'priority' => 'low'
        ];
    }

    return $actions;
}

function buildAdminActions($metrics) {
    $actions = [];

    if (!empty($metrics['top_categories'])) {
        $top = $metrics['top_categories'][0];
        $actions[] = [
            'title' => "Feature {$top['category']} category",
            'reason' => 'Category is leading revenue in the last 7 days.',
            'priority' => 'medium'
        ];
    }

    if (($metrics['stockout_risk_count'] ?? 0) > 0) {
        $actions[] = [
            'title' => 'Notify vendors about low stock',
            'reason' => 'Multiple products are at stockout risk.',
            'priority' => 'high'
        ];
    }

    if ($metrics['growth_pct'] !== null && $metrics['growth_pct'] <= -20) {
        $actions[] = [
            'title' => 'Investigate revenue decline',
            'reason' => 'Daily revenue dropped vs previous day.',
            'priority' => 'high'
        ];
    }

    if ($metrics['growth_pct'] !== null && $metrics['growth_pct'] >= 20) {
        $actions[] = [
            'title' => 'Highlight growth trends',
            'reason' => 'Revenue increased significantly vs previous day.',
            'priority' => 'medium'
        ];
    }

    if (empty($actions)) {
        $actions[] = [
            'title' => 'Continue monitoring',
            'reason' => 'No major anomalies detected in daily metrics.',
            'priority' => 'low'
        ];
    }

    return $actions;
}

function generateActionsWithAI($scope, $metrics, $seedActions) {
    $ai = new RecommendationsAI();
    if (!$ai->isEnabled()) {
        return ['success' => false, 'actions' => $seedActions];
    }

    $result = $ai->generateRecommendations($scope, $metrics, $seedActions);
    if ($result['success']) {
        return ['success' => true, 'actions' => $result['actions']];
    }

    return ['success' => false, 'actions' => $seedActions];
}

function shouldSendVendorRecommendation($metrics) {
    $goodSales = ($metrics['growth_pct'] !== null && $metrics['growth_pct'] >= 25) || ($metrics['revenue_7d'] >= 5000);
    $risk = $metrics['no_sales_7d'] || !empty($metrics['low_stock']) || ($metrics['growth_pct'] !== null && $metrics['growth_pct'] <= -30);
    return $goodSales || $risk;
}

function shouldSendAdminRecommendation($metrics) {
    return true; // Daily admin summary always
}

function insertRecommendationLog($scope, $scopeId, $periodType, $periodStart, $periodEnd, $metrics, $actions, $emailedAt = null) {
    global $pdo;
    $stmt = $pdo->prepare("
        INSERT INTO recommendation_logs (
            scope, scope_id, period_type, period_start, period_end,
            metrics_json, actions_json, emailed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $stmt->execute([
        $scope,
        $scopeId,
        $periodType,
        $periodStart,
        $periodEnd,
        json_encode($metrics),
        json_encode($actions),
        $emailedAt
    ]);
    return $pdo->lastInsertId();
}

function getLatestRecommendation($scope, $scopeId = null) {
    global $pdo;
    if ($scopeId === null) {
        $stmt = $pdo->prepare("
            SELECT * FROM recommendation_logs
            WHERE scope = ?
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute([$scope]);
    } else {
        $stmt = $pdo->prepare("
            SELECT * FROM recommendation_logs
            WHERE scope = ? AND scope_id = ?
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $stmt->execute([$scope, $scopeId]);
    }
    return $stmt->fetch(PDO::FETCH_ASSOC);
}
?>
