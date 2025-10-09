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
    
    $secretKey = getenv('JWT_SECRET_KEY') ?: 'poultry-hub-kenya-secure-key-' . hash('sha256', __DIR__ . date('Y-m-d'));
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
    $secretKey = getenv('JWT_SECRET_KEY') ?: 'poultry-hub-kenya-secure-key-' . hash('sha256', __DIR__ . date('Y-m-d'));
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
    $headers = getallheaders();
    if (isset($headers['Authorization'])) {
        $auth = $headers['Authorization'];
        if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
            return $matches[1];
        }
    }
    return null;
}
?>
