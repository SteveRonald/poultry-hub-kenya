<?php
// Health check endpoint for Railway
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

echo json_encode([
    'status' => 'OK',
    'timestamp' => date('Y-m-d H:i:s'),
    'service' => 'Poultry Hub Kenya API',
    'version' => '1.0.0',
    'environment' => $_ENV['NODE_ENV'] ?? 'production'
]);
?>
