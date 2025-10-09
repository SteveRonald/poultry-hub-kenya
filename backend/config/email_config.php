<?php
// Load environment variables
require_once __DIR__ . '/env_loader.php';

// Email Configuration Settings - Uses environment variables for security
// Create a .env file with your actual email credentials

return [
    'smtp' => [
        'host' => getenv('SMTP_HOST') ?: 'smtp.gmail.com',
        'port' => (int)(getenv('SMTP_PORT') ?: 587),
        'username' => getenv('SMTP_USERNAME') ?: '',
        'password' => getenv('SMTP_PASSWORD') ?: '',
        'encryption' => getenv('SMTP_ENCRYPTION') ?: 'tls',
        'from_email' => getenv('SMTP_FROM_EMAIL') ?: getenv('SMTP_USERNAME') ?: '',
        'from_name' => getenv('SMTP_FROM_NAME') ?: 'Poultry Hub Kenya'
    ],
    
    'admin_email' => getenv('ADMIN_EMAIL') ?: getenv('SMTP_USERNAME') ?: '',
    
    // For development, you can use these settings:
    'development' => [
        'use_smtp' => true, // Set to true to use SMTP for real email sending
        'log_emails' => false // Set to false to actually send emails
    ]
];
?>
