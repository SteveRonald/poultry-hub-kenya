<?php
// Simple CORS test file
header('Access-Control-Allow-Origin: https://poultryhubkenya.netlify.app');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Origin, Content-Type, Authorization, Cache-Control, Pragma, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

echo json_encode([
    'message' => 'CORS test successful',
    'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'not_set',
    'host' => $_SERVER['HTTP_HOST'] ?? 'not_set',
    'method' => $_SERVER['REQUEST_METHOD'] ?? 'not_set',
    'timestamp' => date('Y-m-d H:i:s'),
    'server' => $_SERVER['SERVER_NAME'] ?? 'not_set'
]);
?>
