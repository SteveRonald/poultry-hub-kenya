<?php
// Paystack Payment Gateway Configuration
// Load environment variables
require_once __DIR__ . '/env_loader.php';

// Paystack API Configuration
define('PAYSTACK_PUBLIC_KEY', getenv('PAYSTACK_PUBLIC_KEY') ?: '');
define('PAYSTACK_SECRET_KEY', getenv('PAYSTACK_SECRET_KEY') ?: '');
define('PAYSTACK_BASE_URL', 'https://api.paystack.co');
define('PAYSTACK_WEBHOOK_SECRET', getenv('PAYSTACK_WEBHOOK_SECRET') ?: '');

// Paystack API Endpoints
define('PAYSTACK_INIT_TRANSACTION', PAYSTACK_BASE_URL . '/transaction/initialize');
define('PAYSTACK_VERIFY_TRANSACTION', PAYSTACK_BASE_URL . '/transaction/verify/');
define('PAYSTACK_CHARGE_AUTHORIZATION', PAYSTACK_BASE_URL . '/transaction/charge_authorization');
define('PAYSTACK_CREATE_TRANSFER_RECIPIENT', PAYSTACK_BASE_URL . '/transferrecipient');
define('PAYSTACK_INITIATE_TRANSFER', PAYSTACK_BASE_URL . '/transfer');
define('PAYSTACK_LIST_BANKS', PAYSTACK_BASE_URL . '/bank');

// Currency and Country Settings
define('PAYSTACK_CURRENCY', 'KES'); // Kenyan Shillings
define('PAYSTACK_COUNTRY', 'KE'); // Kenya

// Transaction Settings
define('PAYSTACK_TRANSACTION_PREFIX', 'PHK-'); // Poultry Hub Kenya prefix
define('PAYSTACK_CALLBACK_URL', getenv('APP_URL') . '/api/payments/paystack/callback');
define('PAYSTACK_WEBHOOK_URL', getenv('APP_URL') . '/api/payments/paystack/webhook');

// Platform fees and commissions
define('PAYSTACK_PLATFORM_FEE_PERCENTAGE', 1.5); // 1.5% Paystack fee
define('PAYSTACK_PLATFORM_COMMISSION', 10.0); // 10% platform commission

// Timeout settings (in seconds)
define('PAYSTACK_REQUEST_TIMEOUT', 30);
define('PAYSTACK_TRANSACTION_TIMEOUT', 900); // 15 minutes

// Validation functions
function validatePaystackConfig() {
    $errors = [];

    if (empty(PAYSTACK_PUBLIC_KEY)) {
        $errors[] = 'PAYSTACK_PUBLIC_KEY is not configured';
    }

    if (empty(PAYSTACK_SECRET_KEY)) {
        $errors[] = 'PAYSTACK_SECRET_KEY is not configured';
    }

    if (empty(PAYSTACK_WEBHOOK_SECRET)) {
        $errors[] = 'PAYSTACK_WEBHOOK_SECRET is not configured';
    }

    return $errors;
}

function getPaystackHeaders() {
    return [
        'Authorization: Bearer ' . PAYSTACK_SECRET_KEY,
        'Content-Type: application/json',
        'Cache-Control: no-cache'
    ];
}

function sendPaystackJsonRequest($url, array $payload) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, getPaystackHeaders());
    curl_setopt($ch, CURLOPT_TIMEOUT, PAYSTACK_REQUEST_TIMEOUT);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    return [
        'http_code' => $httpCode,
        'response' => json_decode($response, true),
        'raw_response' => $response,
        'curl_error' => $curlError
    ];
}

function sendPaystackGetRequest($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPGET, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, getPaystackHeaders());
    curl_setopt($ch, CURLOPT_TIMEOUT, PAYSTACK_REQUEST_TIMEOUT);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    return [
        'http_code' => $httpCode,
        'response' => json_decode($response, true),
        'raw_response' => $response,
        'curl_error' => $curlError
    ];
}

function formatPaystackTransferAmount($amount) {
    return (int) round(floatval($amount) * 100);
}

function generatePaystackReference($orderId = null) {
    $prefix = PAYSTACK_TRANSACTION_PREFIX;
    $timestamp = date('YmdHis');
    $random = strtoupper(substr(md5(uniqid(mt_rand(), true)), 0, 6));

    if ($orderId) {
        return $prefix . $orderId . '-' . $timestamp . '-' . $random;
    }

    return $prefix . $timestamp . '-' . $random;
}
?>
