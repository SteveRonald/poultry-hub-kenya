<?php
// Set timezone to Nairobi (UTC+3) for consistent date/time handling
date_default_timezone_set('Africa/Nairobi');

// Load environment variables
require_once __DIR__ . '/env_loader.php';

// Database configuration - uses environment variables for security
$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'poultry marketplace';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    
    // Set MySQL session timezone to match PHP timezone (Africa/Nairobi)
    $pdo->exec("SET time_zone = '+03:00'");
    
    // Set query timeout to prevent hanging queries
    // For MySQL 5.7.8+, use max_execution_time (in milliseconds)
    // For older versions, this will be ignored
    try {
        $pdo->exec("SET SESSION max_execution_time = 5000"); // 5 seconds
    } catch (PDOException $e) {
        // Ignore if MySQL version doesn't support max_execution_time
    }
    
    // Set wait_timeout and interactive_timeout to prevent long-running queries
    try {
        $pdo->exec("SET SESSION wait_timeout = 5");
        $pdo->exec("SET SESSION interactive_timeout = 5");
    } catch (PDOException $e) {
        // Ignore if there's an issue setting timeouts
    }
} catch (PDOException $e) {
    throw new PDOException($e->getMessage() . " (Connection failed to $host)", (int)$e->getCode());
}
?>