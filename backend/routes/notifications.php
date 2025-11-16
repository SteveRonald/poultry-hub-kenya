<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
// Admin session validation helper is defined in admin.php; include it if available
if (file_exists(__DIR__ . '/admin.php')) {
    require_once __DIR__ . '/admin.php';
}

/**
 * Attempt to authenticate request using either user JWT or admin session token.
 * Returns an associative array: ['user_id' => int, 'is_admin' => bool] or null on failure.
 */
function getAuthenticatedUser() {
    global $pdo;

    $token = getBearerToken();
    if (!$token) {
        return null;
    }

    // Try JWT (regular users)
    $payload = validateJWT($token);
    if ($payload && isset($payload['user_id'])) {
        return ['user_id' => $payload['user_id'], 'is_admin' => false];
    }

    // Fallback: try admin session token
    if (function_exists('validateAdminSession') && validateAdminSession($token)) {
        try {
            $stmt = $pdo->prepare("SELECT admin_id FROM admin_sessions WHERE session_token = ? AND expires_at > NOW()");
            $stmt->execute([$token]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && isset($row['admin_id'])) {
                return ['user_id' => $row['admin_id'], 'is_admin' => true];
            }
        } catch (PDOException $e) {
            error_log('getAuthenticatedUser admin session lookup error: ' . $e->getMessage());
            return null;
        }
    }

    return null;
}

function handleGetNotifications() {
    global $pdo;
    
    $auth = getAuthenticatedUser();
    if (!$auth) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$auth['user_id']]);
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
    
    $auth = getAuthenticatedUser();
    if (!$auth) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized']);
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
        $stmt->execute([$notificationId, $auth['user_id']]);
        
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

function handleDeleteNotification() {
    global $pdo;

    $auth = getAuthenticatedUser();
    if (!$auth) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    // Extract notification id from URL
    $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
    $notificationId = end($pathParts);

    // Validate numeric
    $notificationId = filter_var($notificationId, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 999999999]
    ]);

    if ($notificationId === false) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid notification id']);
        return;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM notifications WHERE id = ? AND user_id = ?");
        $stmt->execute([$notificationId, $auth['user_id']]);

        if ($stmt->rowCount() > 0) {
            echo json_encode(['success' => true, 'message' => 'Notification deleted']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Notification not found']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        error_log('Delete notification error: ' . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete notification']);
    }
}
?>
