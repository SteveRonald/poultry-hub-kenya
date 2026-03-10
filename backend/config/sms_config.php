<?php

// Load environment variables
require_once __DIR__ . '/env_loader.php';

// SMS Feature Toggle
define('SMS_ENABLED', getenv('SMS_ENABLED') === 'true' || getenv('SMS_ENABLED') === '1');

// SMS Provider
// Supported: 'opensms', 'textwave', 'africas_talking' (legacy fallback)
// NOTE: Default is now OpenSMS so the only required manual step is setting OPENSMS_API_TOKEN.
define('SMS_PROVIDER', getenv('SMS_PROVIDER') ?: 'opensms');

// Provider-agnostic settings
define('SMS_MAX_MESSAGE_LENGTH', 1600); // Textwave max length (characters)

// OpenSMS Configuration
// Docs: https://opensms.co.ke/docs/guide/code-examples
// Default REST base URL (can be overridden with OPENSMS_BASE_URL).
// Use the endpoint from your OpenSMS dashboard (commonly https://www.opensms.co.ke/api/v3).
define('OPENSMS_API_TOKEN', trim(getenv('OPENSMS_API_TOKEN') ?: ''));
define('OPENSMS_BASE_URL', rtrim(trim(getenv('OPENSMS_BASE_URL') ?: 'https://www.opensms.co.ke/api/v3'), '/'));
// Sender ID / Originator (optional but often required). Example: OPENSMS
define('OPENSMS_SENDER_ID', trim(getenv('OPENSMS_SENDER_ID') ?: ''));

// Textwave Configuration
define('TEXTWAVE_API_KEY', trim(getenv('TEXTWAVE_API_KEY') ?: ''));
define('TEXTWAVE_BASE_URL', rtrim(trim(getenv('TEXTWAVE_BASE_URL') ?: 'https://api.textwave.co.ke/v1'), '/'));
// senderId is optional on Textwave; leave empty to use Textwave default sender.
define('TEXTWAVE_SENDER_ID', trim(getenv('TEXTWAVE_SENDER_ID') ?: ''));

// Textwave auth mode (legacy)
define('TEXTWAVE_AUTH_MODE', strtolower(trim(getenv('TEXTWAVE_AUTH_MODE') ?: 'bearer')));

// Africa's Talking Configuration (legacy fallback)
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
