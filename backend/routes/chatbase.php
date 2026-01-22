<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

// Simple JWT implementation for Chatbase
function base64UrlEncode($data) {
    return str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($data));
}

function createJWT($payload, $secret) {
    $header = json_encode(['alg' => 'HS256', 'typ' => 'JWT']);
    $payload = json_encode($payload);

    $headerEncoded = base64UrlEncode($header);
    $payloadEncoded = base64UrlEncode($payload);

    $signature = hash_hmac('sha256', $headerEncoded . "." . $payloadEncoded, $secret, true);
    $signatureEncoded = base64UrlEncode($signature);

    return $headerEncoded . "." . $payloadEncoded . "." . $signatureEncoded;
}

// Get Chatbase JWT token for user identification
function handleGetChatbaseToken() {
    global $pdo;

    // Get token from header
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'Authorization required']);
        return;
    }

    // Verify user token
    $decoded = verifyToken($token);
    if (!$decoded) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid token']);
        return;
    }

    try {
        // Get user details
        $stmt = $pdo->prepare("SELECT id, email, full_name, role FROM user_profiles WHERE id = ?");
        $stmt->execute([$decoded->user_id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            return;
        }

        // Get Chatbase secret from environment
        $chatbaseSecret = getenv('CHATBOT_IDENTITY_SECRET');
        if (!$chatbaseSecret) {
            // Use a default secret if not set (for development)
            $chatbaseSecret = 'your-default-chatbase-secret-key';
        }

        // Create JWT payload for Chatbase
        $payload = [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'full_name' => $user['full_name'],
            'role' => $user['role'],
            'iat' => time(),
            'exp' => time() + (60 * 60) // 1 hour expiry
        ];

        // Generate JWT token using custom function
        $jwt = createJWT($payload, $chatbaseSecret);

        echo json_encode([
            'success' => true,
            'token' => $jwt
        ]);

    } catch (Exception $e) {
        error_log('Chatbase token generation error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to generate token']);
    }
}
?>
