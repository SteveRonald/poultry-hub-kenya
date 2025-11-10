<?php
/**
 * Database reconnection utility
 * Handles MySQL "server has gone away" errors by reconnecting
 */

function reconnectDatabase() {
    global $pdo;
    
    // Close existing connection if it exists
    $pdo = null;
    
    // Reload database configuration
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
        
        // Set MySQL session timezone
        $pdo->exec("SET time_zone = '+03:00'");
        
        // Set timeouts to allow longer connections
        try {
            $pdo->exec("SET SESSION wait_timeout = 300");
            $pdo->exec("SET SESSION interactive_timeout = 300");
        } catch (PDOException $e) {
            // Ignore if there's an issue setting timeouts
        }
        
        return $pdo;
    } catch (PDOException $e) {
        error_log("Failed to reconnect to database: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Check if MySQL error is a connection loss error
 */
function isConnectionLostError($errorMessage) {
    return strpos($errorMessage, '2006') !== false || 
           strpos($errorMessage, 'MySQL server has gone away') !== false ||
           strpos($errorMessage, 'Lost connection') !== false ||
           strpos($errorMessage, 'server has gone away') !== false;
}

?>
