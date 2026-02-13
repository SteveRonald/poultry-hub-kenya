<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/recommendations.php';

function handleGetVendorRecommendations() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $payload = validateAuthToken($token);
    if (!$payload || ($payload['role'] ?? '') !== 'vendor') {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT id FROM vendors WHERE user_id = ?");
        $stmt->execute([$payload['user_id']]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$vendor) {
            echo json_encode(['success' => true, 'recommendation' => null]);
            return;
        }

        $latest = getLatestRecommendation('vendor', (int)$vendor['id']);
        if (!$latest) {
            echo json_encode(['success' => true, 'recommendation' => null]);
            return;
        }

        echo json_encode([
            'success' => true,
            'recommendation' => [
                'id' => $latest['id'],
                'scope' => $latest['scope'],
                'period_type' => $latest['period_type'],
                'period_start' => $latest['period_start'],
                'period_end' => $latest['period_end'],
                'metrics' => json_decode($latest['metrics_json'], true),
                'actions' => json_decode($latest['actions_json'], true),
                'emailed_at' => $latest['emailed_at'],
                'created_at' => $latest['created_at']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch recommendations']);
    }
}

function handleGetAdminRecommendations() {
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    $admin = validateAdminSession($token);
    if (!$admin) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    try {
        $latest = getLatestRecommendation('admin');
        if (!$latest) {
            echo json_encode(['success' => true, 'recommendation' => null]);
            return;
        }

        echo json_encode([
            'success' => true,
            'recommendation' => [
                'id' => $latest['id'],
                'scope' => $latest['scope'],
                'period_type' => $latest['period_type'],
                'period_start' => $latest['period_start'],
                'period_end' => $latest['period_end'],
                'metrics' => json_decode($latest['metrics_json'], true),
                'actions' => json_decode($latest['actions_json'], true),
                'emailed_at' => $latest['emailed_at'],
                'created_at' => $latest['created_at']
            ]
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch recommendations']);
    }
}
?>
