<?php
// Database configuration for InfinityFree
$host = 'sql303.infinityfree.com';
$dbname = 'if0_40167313_poultrymarketplace';
$username = 'if0_40167313';
$password = 'your_actual_password'; // Replace with your real InfinityFree password
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 30,
    ]);
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    http_response_code(500);
    die(json_encode([
        'error' => 'Database connection failed',
        'message' => 'Please check your database configuration'
    ]));
}
?>
