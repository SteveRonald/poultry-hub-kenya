<?php
// Email Configuration Settings
// Update these settings with your actual email credentials

return [
    'smtp' => [
        'host' => 'smtp.gmail.com', // Your SMTP server
        'port' => 587,
        'username' => 'okothroni863@gmail.com', // Your email address
        'password' => 'lmag tcnr iyki avzx', // Your email password or app password
        'encryption' => 'tls', // tls or ssl
        'from_email' => 'okothroni863@gmail.com',
        'from_name' => 'PoultryConnect Kenya'
    ],
    
    'admin_email' => 'okothroni863@gmail.com', // Admin email for notifications
    
    // For development, you can use these settings:
    'development' => [
        'use_smtp' => true, // Set to true to use SMTP for real email sending
        'log_emails' => false // Set to false to actually send emails
    ]
];
?>
