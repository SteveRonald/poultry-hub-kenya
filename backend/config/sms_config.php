<?php
/**
 * SMS Configuration
 * 
 * Configure your SMS provider settings here
 */

// Load environment variables
require_once __DIR__ . '/env_loader.php';

// SMS Feature Toggle
define('SMS_ENABLED', getenv('SMS_ENABLED') === 'true' || getenv('SMS_ENABLED') === '1');

// SMS Provider (currently only 'africas_talking' is supported)
define('SMS_PROVIDER', getenv('SMS_PROVIDER') ?: 'africas_talking');

// Africa's Talking Configuration
define('AFRICASTALKING_USERNAME', getenv('AFRICASTALKING_USERNAME') ?: '');
define('AFRICASTALKING_API_KEY', getenv('AFRICASTALKING_API_KEY') ?: '');
define('AFRICASTALKING_SENDER_ID', getenv('AFRICASTALKING_SENDER_ID') ?: 'KUKUSOKO');

// SMS Settings
define('SMS_SEND_IMMEDIATELY', true); // Send SMS immediately (not queued)
define('SMS_RETRY_ATTEMPTS', 3); // Number of retry attempts for failed SMS
define('SMS_RETRY_DELAY', 60); // Delay in seconds between retries

// SMS Limits (optional - set to 0 for unlimited)
define('SMS_DAILY_LIMIT', 0); // Daily SMS limit (0 = unlimited)
define('SMS_MONTHLY_LIMIT', 0); // Monthly SMS limit (0 = unlimited)

// Default country code for phone number normalization
define('SMS_DEFAULT_COUNTRY_CODE', '254'); // Kenya country code

// SMS API Endpoint
// Note: The service will automatically detect sandbox vs production based on username
// If username contains "sandbox", it will use sandbox endpoint
define('AFRICASTALKING_SMS_URL', 'https://api.africastalking.com/version1/messaging');
define('AFRICASTALKING_SANDBOX_URL', 'https://api.sandbox.africastalking.com/version1/messaging');

