<?php
// Load environment variables
require_once __DIR__ . '/env_loader.php';

// Fallback .env parsing in case environment variables are not populated
$envFileValues = [];

$backendEnvPath = __DIR__ . '/../.env';
$rootEnvPath = __DIR__ . '/../../.env';
$envFileValues = parseEnvFile($backendEnvPath);
if (empty($envFileValues)) {
    $envFileValues = parseEnvFile($rootEnvPath);
}

function getEnvValue($key, $default = null) {
    global $envFileValues;
    $value = getenv($key);
    if ($value === false || $value === '') {
        if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
            $value = $_ENV[$key];
        } elseif (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
            $value = $_SERVER[$key];
        } elseif (isset($envFileValues[$key]) && $envFileValues[$key] !== '') {
            $value = $envFileValues[$key];
        }
    }
    if ($value === false || $value === '') {
        return $default;
    }
    return $value;
}

// Email Configuration Settings - Uses environment variables for security
// Create a .env file with your actual email credentials

return [
    'smtp' => [
        'host' => getEnvValue('SMTP_HOST', 'smtp.gmail.com'),
        'port' => (int)(getEnvValue('SMTP_PORT', 587)),
        'username' => getEnvValue('SMTP_USERNAME', ''),
        'password' => getEnvValue('SMTP_PASSWORD', ''),
        'encryption' => getEnvValue('SMTP_ENCRYPTION', 'tls'),
        'from_email' => getEnvValue('SMTP_FROM_EMAIL', getEnvValue('SMTP_USERNAME', '')),
        'from_name' => getEnvValue('SMTP_FROM_NAME', 'KukuSoko')
    ],
    
    'admin_email' => getEnvValue('ADMIN_EMAIL', getEnvValue('SMTP_USERNAME', '')),
    
    // For development, you can use these settings:
    'development' => [
        'use_smtp' => true, // Set to true to use SMTP for real email sending
        'log_emails' => false // Set to false to actually send emails
    ]
];
?>