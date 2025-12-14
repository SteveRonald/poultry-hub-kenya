<?php
// Simple JWT implementation for PHP
function generateJWT($user_id, $email, $role) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode([
        'user_id' => $user_id,
        'email' => $email,
        'role' => $role,
        'exp' => time() + (24 * 60 * 60) // 24 hours
    ]);
    
    $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    // JWT Secret Key MUST be set in .env file for security
    $secretKey = getenv('JWT_SECRET_KEY');
    if (empty($secretKey)) {
        error_log('SECURITY ERROR: JWT_SECRET_KEY not set in .env file');
        throw new Exception('JWT secret key not configured. Please set JWT_SECRET_KEY in your .env file.');
    }
    
    // Ensure secret key is at least 32 characters for security
    if (strlen($secretKey) < 32) {
        error_log('SECURITY WARNING: JWT_SECRET_KEY is too short (minimum 32 characters recommended)');
    }
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, $secretKey, true);
    $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

function validateJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    $header = $parts[0];
    $payload = $parts[1];
    $signature = $parts[2];
    
    // Verify signature
    // JWT Secret Key MUST be set in .env file for security
    $secretKey = getenv('JWT_SECRET_KEY');
    if (empty($secretKey)) {
        error_log('SECURITY ERROR: JWT_SECRET_KEY not set in .env file');
        return false;
    }
    $expectedSignature = hash_hmac('sha256', $header . "." . $payload, $secretKey, true);
    $expectedSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($expectedSignature));
    
    if (!hash_equals($signature, $expectedSignature)) {
        return false;
    }
    
    // Decode payload
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
    
    // Check expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        return false;
    }
    
    return $payload;
}

function getBearerToken() {
    // Try PHP's getallheaders first (case can vary by server)
    $headers = function_exists('getallheaders') ? getallheaders() : [];

    // Normalize header keys to lowercase for robust lookup
    $normalizedHeaders = [];
    foreach ($headers as $key => $value) {
        $normalizedHeaders[strtolower($key)] = $value;
    }

    // Preferred: Authorization header
    $authHeader = $normalizedHeaders['authorization'] ?? null;

    // Fallback 1: Apache/Nginx often forwards to HTTP_AUTHORIZATION
    if (!$authHeader && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
    }

    // Fallback 2: Some environments expose REDIRECT_HTTP_AUTHORIZATION
    if (!$authHeader && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    }

    if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        return $matches[1];
    }

    return null;
}

/**
 * Validate authentication token - supports both JWT (for customers/vendors) and session tokens (for admins)
 * Returns user payload with user_id and role, or false on failure
 */
function validateAuthToken($token) {
    global $pdo;
    
    if (!$token) {
        return false;
    }
    
    // First, try to validate as JWT (for customers/vendors)
    $jwtPayload = validateJWT($token);
    if ($jwtPayload) {
        return $jwtPayload;
    }
    
    // If JWT validation fails, try to validate as admin session token
    try {
        // First check if it's a valid session token format (64 hex characters)
        if (strlen($token) === 64 && ctype_xdigit($token)) {
            $stmt = $pdo->prepare("
                SELECT s.admin_id, u.role, u.email, u.full_name
                FROM admin_sessions s
                JOIN user_profiles u ON s.admin_id = u.id
                WHERE s.session_token = ? AND s.expires_at > NOW() AND u.role = 'admin'
            ");
            $stmt->execute([$token]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($session) {
                // Return in same format as JWT payload
                return [
                    'user_id' => $session['admin_id'],
                    'email' => $session['email'],
                    'role' => $session['role'],
                    'exp' => time() + (24 * 60 * 60) // Session expires in 24 hours
                ];
            }
        }
    } catch (PDOException $e) {
        error_log("Error validating admin session: " . $e->getMessage());
    }
    
    return false;
}
?>
