<?php
/**
 * Environment Variables Loader
 * Loads environment variables from .env file
 */

function loadEnv($path) {
    if (!file_exists($path)) {
        return false;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    
    foreach ($lines as $line) {
        // Skip comments
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse key=value pairs
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            
            // Set environment variable if not already set
            if (!getenv($key)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
    
    return true;
}

// Load environment variables from .env file
// For InfinityFree deployment, .env should be in htdocs root
$envPath = __DIR__ . '/../.env'; // htdocs/.env
if (file_exists($envPath)) {
    loadEnv($envPath);
} else {
    // Fallback to backend directory (for development)
    $backendEnvPath = __DIR__ . '/.env';
    if (file_exists($backendEnvPath)) {
        loadEnv($backendEnvPath);
    }
}
?>
