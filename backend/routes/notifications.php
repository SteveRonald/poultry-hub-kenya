<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

function handleGetNotifications() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'No token provided']);
        exit; // Exit immediately after sending response
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid token']);
        exit; // Exit immediately after sending response
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$payload['user_id']]);
        $notifications = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode($notifications);
        exit; // Exit immediately after sending response
        
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        // Log detailed error for debugging (server-side only)
        error_log("Notifications query error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode(['error' => 'Failed to fetch notifications. Please try again later.']);
        exit; // Exit immediately after sending error
    }
}

function handleMarkAsRead() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'No token provided']);
        exit;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid token']);
        exit;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $notificationId = $input['id'] ?? null;
    
    if (!$notificationId) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Notification ID is required']);
        exit;
    }
    
    // Validate notification ID is numeric and within reasonable range
    $notificationId = filter_var($notificationId, FILTER_VALIDATE_INT, [
        'options' => [
            'min_range' => 1,
            'max_range' => 999999999
        ]
    ]);
    
    if ($notificationId === false) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Invalid notification ID']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?");
        $stmt->execute([$notificationId, $payload['user_id']]);
        
        http_response_code(200);
        header('Content-Type: application/json');
        echo json_encode(['message' => 'Notification marked as read']);
        exit;
        
    } catch (PDOException $e) {
        http_response_code(500);
        header('Content-Type: application/json');
        // Log detailed error for debugging (server-side only)
        error_log("Mark as read error: " . $e->getMessage());
        // Return generic error message to client (don't leak database details)
        echo json_encode(['error' => 'Failed to update notification. Please try again later.']);
        exit;
    }
}

function handleCreateNotification() {
    global $pdo;
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($input['user_id']) || !isset($input['message'])) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id and message are required']);
        return;
    }
    
    $userId = $input['user_id'];
    $message = $input['message'];
    
    try {
        $stmt = $pdo->prepare("INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, NOW())");
        $stmt->execute([$userId, $message]);
        
        echo json_encode(['message' => 'Notification created successfully']);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create notification: ' . $e->getMessage()]);
    }
}
?>
