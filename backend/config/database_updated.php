<?php
// Load environment variables
require_once __DIR__ . '/env_loader.php';

// Database configuration - uses environment variables for security
$host = getenv('DB_HOST') ?: 'localhost';
$dbname = getenv('DB_NAME') ?: 'poultry marketplace';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASSWORD') ?: '';
$charset = 'utf8mb4';

// Debug mode for deployment (remove in production)
$debug = false; // Set to false in production

if ($debug) {
    echo "<!-- Debug Info:\n";
    echo "DB_HOST: " . ($host ?: 'NOT SET') . "\n";
    echo "DB_NAME: " . ($dbname ?: 'NOT SET') . "\n";
    echo "DB_USER: " . ($username ?: 'NOT SET') . "\n";
    echo "DB_PASSWORD: " . ($password ? 'SET' : 'NOT SET') . "\n";
    echo "-->\n";
}

$dsn = "mysql:host=$host;dbname=$dbname;charset=$charset";

try {
    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 30, // 30 second timeout
    ]);
    
    if ($debug) {
        echo "<!-- Database connected successfully -->\n";
    }
    
} catch (PDOException $e) {
    if ($debug) {
        echo "<!-- Database connection failed: " . htmlspecialchars($e->getMessage()) . " -->\n";
        echo "<!-- DSN: " . htmlspecialchars($dsn) . " -->\n";
    }
    
    // Log error for debugging
    error_log("Database connection failed: " . $e->getMessage());
    error_log("DSN: " . $dsn);
    
    // Return a proper error response
    http_response_code(500);
    if ($debug) {
        die(json_encode([
            'error' => 'Database connection failed',
            'message' => $e->getMessage(),
            'debug' => [
                'host' => $host,
                'dbname' => $dbname,
                'username' => $username,
                'password_set' => !empty($password)
            ]
        ]));
    } else {
        die(json_encode([
            'error' => 'Database connection failed',
            'message' => 'Please check your database configuration'
        ]));
    }
}
?>
