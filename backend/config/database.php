<?php
// Database configuration for Render deployment
// Supports both local development and production

function getDatabaseConfig() {
    // Check if we're on Render (production)
    if (getenv('DATABASE_URL')) {
        // Parse Render PostgreSQL URL
        $url = parse_url(getenv('DATABASE_URL'));
        
        return [
            'host' => $url['host'],
            'port' => $url['port'] ?? 5432,
            'dbname' => ltrim($url['path'], '/'),
            'username' => $url['user'],
            'password' => $url['pass'],
            'charset' => 'utf8',
            'driver' => 'pgsql' // PostgreSQL for Render
        ];
    } else {
        // Local development (XAMPP MySQL)
        return [
            'host' => 'localhost',
            'port' => 3306,
            'dbname' => 'poultry marketplace',
            'username' => 'root',
            'password' => '',
            'charset' => 'utf8',
            'driver' => 'mysql' // MySQL for local development
        ];
    }
}

// Create PDO connection
function createDatabaseConnection() {
    $config = getDatabaseConfig();
    
    $dsn = $config['driver'] . ':host=' . $config['host'] . 
           ';port=' . $config['port'] . 
           ';dbname=' . $config['dbname'] . 
           ';charset=' . $config['charset'];
    
    try {
        $pdo = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        
        return $pdo;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        throw new Exception("Database connection failed");
    }
}

// Global database connection
$pdo = createDatabaseConnection();
?>