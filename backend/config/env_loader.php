<?php
/**
 * Environment Variables Loader
 * Loads environment variables from .env file
 */

function loadEnv($path) {
    if (!file_exists($path)) {
        return false;
    }

    // If this PHP process has already loaded .env before, allow overrides so changes to .env take effect
    // without requiring a web server restart (common in XAMPP/mod_php setups).
    $allowOverride = getenv('DOTENV_LOADED') === '1';
    
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
            
            // Set environment variable:
            // - On first load: only if missing or empty
            // - On subsequent loads in the same PHP process: always override from .env
            $existing = getenv($key);
            if ($allowOverride || $existing === false || $existing === '') {
                putenv("$key=$value");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }

    // Mark this process as having loaded .env so subsequent requests can override with updated file values.
    if (!$allowOverride) {
        putenv('DOTENV_LOADED=1');
        $_ENV['DOTENV_LOADED'] = '1';
        $_SERVER['DOTENV_LOADED'] = '1';
    }

    return true;
}

// Load environment variables from .env file
$envPath = __DIR__ . '/../.env'; // Look in backend directory
if (file_exists($envPath)) {
    loadEnv($envPath);
} else {
    // Fallback to root directory
    $rootEnvPath = __DIR__ . '/../../.env';
    if (file_exists($rootEnvPath)) {
        loadEnv($rootEnvPath);
    } else {
        // Fallback to env.example for development
        $examplePath = __DIR__ . '/../../env.example';
        if (file_exists($examplePath)) {
            loadEnv($examplePath);
        }
    }
}
?>
