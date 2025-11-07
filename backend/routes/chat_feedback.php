<?php
/**
 * Chatbot Feedback API
 * Handles user feedback for chatbot learning
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/chatbot_learning.php';

header('Content-Type: application/json');

/**
 * Handle feedback submission
 */
function handleFeedback() {
    global $pdo;
    
    $method = $_SERVER['REQUEST_METHOD'];
    
    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        $messageId = sanitizeInput($input['message_id'] ?? '');
        $conversationId = sanitizeInput($input['conversation_id'] ?? '');
        $feedbackType = sanitizeInput($input['feedback_type'] ?? ''); // positive, negative, correction
        $userCorrection = sanitizeInput($input['user_correction'] ?? null);
        $expectedIntent = sanitizeInput($input['expected_intent'] ?? null);
        
        // Get user ID if logged in
        $userId = null;
        $token = getBearerToken();
        if ($token) {
            $payload = validateJWT($token);
            if ($payload) {
                $userId = $payload['user_id'] ?? null;
            }
        }
        
        if (empty($messageId) || empty($conversationId) || empty($feedbackType)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            return;
        }
        
        if (!in_array($feedbackType, ['positive', 'negative', 'correction'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid feedback type']);
            return;
        }
        
        $feedbackId = recordFeedback($messageId, $conversationId, $userId, $feedbackType, $userCorrection, $expectedIntent);
        
        if ($feedbackId) {
            echo json_encode([
                'success' => true,
                'message' => 'Feedback recorded successfully',
                'feedback_id' => $feedbackId
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to record feedback']);
        }
        
    } elseif ($method === 'GET') {
        // Get learning statistics (admin only)
        $token = getBearerToken();
        if (!$token) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            return;
        }
        
        $payload = validateJWT($token);
        if (!$payload) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid token']);
            return;
        }
        
        // Check if admin (you can add admin check here)
        $stats = getLearningStatistics();
        
        echo json_encode([
            'success' => true,
            'statistics' => $stats
        ]);
    }
}

handleFeedback();
?>

