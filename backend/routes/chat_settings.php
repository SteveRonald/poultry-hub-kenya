<?php
/**
 * Chat Settings Routes
 * Handles language preference updates for logged-in users
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/env_loader.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/faq_cache.php';

header('Content-Type: application/json');

/**
 * Update user's language preference
 * Requires authentication
 */
function handleUpdateLanguagePreference() {
    global $pdo;
    
    // Only allow POST requests
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        return;
    }
    
    // Check authentication
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
        return;
    }
    
    $userId = $payload['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'User ID not found in token']);
        return;
    }
    
    // Get language from request
    $input = json_decode(file_get_contents('php://input'), true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON input']);
        return;
    }
    
    $language = $input['language'] ?? null;
    if (!$language || !in_array($language, ['en', 'sw'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid language. Must be "en" or "sw"']);
        return;
    }
    
    // Update user's language preference
    $success = updateUserLanguagePreference($userId, $language);
    
    if ($success) {
        echo json_encode([
            'success' => true,
            'message' => 'Language preference updated successfully',
            'language' => $language
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to update language preference']);
    }
}

/**
 * Get user's language preference
 * Requires authentication
 */
function handleGetLanguagePreference() {
    // Check authentication
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Authentication required']);
        return;
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Invalid or expired token']);
        return;
    }
    
    $userId = $payload['user_id'] ?? null;
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'User ID not found in token']);
        return;
    }
    
    // Get user's language preference
    $language = getUserLanguagePreference($userId);
    
    echo json_encode([
        'success' => true,
        'language' => $language
    ]);
}

?>

