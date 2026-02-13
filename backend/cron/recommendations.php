<?php
// Recommendation generator & email notifier

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/recommendations.php';
require_once __DIR__ . '/../routes/email_queue.php';

date_default_timezone_set('Africa/Nairobi');

function getWeeklyPeriodDates() {
    $end = new DateTime('now', new DateTimeZone('Africa/Nairobi'));
    $start = (clone $end)->modify('-7 days');
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

function getDailyPeriodDates() {
    $end = new DateTime('now', new DateTimeZone('Africa/Nairobi'));
    $start = (clone $end)->modify('-1 day');
    return [$start->format('Y-m-d'), $end->format('Y-m-d')];
}

function alreadyEmailed($scope, $scopeId, $periodType, $periodStart, $periodEnd) {
    global $pdo;
    if ($scopeId === null) {
        $stmt = $pdo->prepare("
            SELECT id FROM recommendation_logs
            WHERE scope = ? AND scope_id IS NULL
              AND period_type = ? AND period_start = ? AND period_end = ?
              AND emailed_at IS NOT NULL
            LIMIT 1
        ");
        $stmt->execute([$scope, $periodType, $periodStart, $periodEnd]);
    } else {
        $stmt = $pdo->prepare("
            SELECT id FROM recommendation_logs
            WHERE scope = ? AND scope_id = ?
              AND period_type = ? AND period_start = ? AND period_end = ?
              AND emailed_at IS NOT NULL
            LIMIT 1
        ");
        $stmt->execute([$scope, $scopeId, $periodType, $periodStart, $periodEnd]);
    }
    return (bool)$stmt->fetch();
}

function sendVendorWeeklyRecommendations() {
    global $pdo;
    [$periodStart, $periodEnd] = getWeeklyPeriodDates();

    $weekday = strtolower(getenv('RECOMMEND_VENDOR_WEEKDAY') ?: 'monday');
    $today = strtolower(date('l'));
    if ($today !== $weekday) {
        return;
    }

    $vendors = $pdo->query("
        SELECT v.id as vendor_id, u.email, u.full_name, v.farm_name
        FROM vendors v
        JOIN user_profiles u ON v.user_id = u.id
        WHERE v.status = 'approved'
    ")->fetchAll(PDO::FETCH_ASSOC);

    foreach ($vendors as $vendor) {
        $vendorId = (int)$vendor['vendor_id'];
        if (alreadyEmailed('vendor', $vendorId, 'weekly', $periodStart, $periodEnd)) {
            continue;
        }

        $metrics = buildVendorMetrics($vendorId);
        if (!shouldSendVendorRecommendation($metrics)) {
            continue;
        }

        $seedActions = buildVendorActions($metrics);
        $aiActions = generateActionsWithAI('vendor', $metrics, $seedActions);
        $actions = $aiActions['actions'];

        $emailedAt = date('Y-m-d H:i:s');
        insertRecommendationLog('vendor', $vendorId, 'weekly', $periodStart, $periodEnd, $metrics, $actions, $emailedAt);

        $summary = [
            'period_label' => 'Last 7 days',
            'revenue' => $metrics['revenue_7d'] ?? 0,
            'orders' => $metrics['orders_7d'] ?? 0,
            'growth' => $metrics['growth_pct'] !== null ? ($metrics['growth_pct'] . '%') : 'N/A'
        ];

        $templateData = [
            'vendor_name' => $vendor['full_name'] ?: $vendor['farm_name'],
            'summary' => $summary,
            'actions' => $actions
        ];

        queueEmail('vendor_recommendation', $vendor['email'], 'vendor_recommendation', $templateData, 'normal');
    }
}

function sendAdminDailyRecommendations() {
    global $pdo;
    [$periodStart, $periodEnd] = getDailyPeriodDates();

    if (alreadyEmailed('admin', null, 'daily', $periodStart, $periodEnd)) {
        return;
    }

    $metrics = buildAdminMetrics();
    $seedActions = buildAdminActions($metrics);
    $aiActions = generateActionsWithAI('admin', $metrics, $seedActions);
    $actions = $aiActions['actions'];

    $emailedAt = date('Y-m-d H:i:s');
    insertRecommendationLog('admin', null, 'daily', $periodStart, $periodEnd, $metrics, $actions, $emailedAt);

    $summary = [
        'period_label' => 'Last 24 hours',
        'revenue' => $metrics['revenue_1d'] ?? 0,
        'orders' => $metrics['orders_1d'] ?? 0,
        'growth' => $metrics['growth_pct'] !== null ? ($metrics['growth_pct'] . '%') : 'N/A'
    ];

    $templateData = [
        'summary' => $summary,
        'actions' => $actions
    ];

    $admins = $pdo->query("SELECT email FROM user_profiles WHERE role = 'admin'")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($admins as $admin) {
        queueEmail('admin_recommendation', $admin['email'], 'admin_recommendation', $templateData, 'normal');
    }
}

// Run
sendAdminDailyRecommendations();
sendVendorWeeklyRecommendations();
?>
