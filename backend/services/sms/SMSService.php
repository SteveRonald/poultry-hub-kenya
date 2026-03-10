<?php
/**
 * SMS Service
 * 
 * Handles SMS sending, phone number normalization, and logging
 */

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/sms_config.php';
require_once __DIR__ . '/../../utils/notifications.php';

class SMSService {
    private $pdo;
    private $provider;
    
    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
        $this->provider = SMS_PROVIDER;
    }
    
    /**
     * Normalize phone number to international format (+254XXXXXXXXX)
     * Handles both 07XXXXXXXX and +254XXXXXXXXX formats
     */
    public function normalizePhoneNumber($phone) {
        if (empty($phone)) {
            return null;
        }
        
        // Remove all non-digit characters except +
        $phone = preg_replace('/[^\d+]/', '', $phone);
        
        // If starts with 0, replace with country code
        if (preg_match('/^0(\d{9})$/', $phone, $matches)) {
            $phone = SMS_DEFAULT_COUNTRY_CODE . $matches[1];
        }
        
        // If starts with country code without +, add +
        if (preg_match('/^' . SMS_DEFAULT_COUNTRY_CODE . '(\d{9})$/', $phone, $matches)) {
            $phone = '+' . SMS_DEFAULT_COUNTRY_CODE . $matches[1];
        }
        
        // If already in international format, ensure it has +
        if (preg_match('/^' . SMS_DEFAULT_COUNTRY_CODE . '(\d{9})$/', $phone)) {
            $phone = '+' . $phone;
        }
        
        // Validate final format
        if (!preg_match('/^\+' . SMS_DEFAULT_COUNTRY_CODE . '\d{9}$/', $phone)) {
            return null; // Invalid format
        }
        
        return $phone;
    }
    
    /**
     * Validate phone number
     */
    public function validatePhoneNumber($phone) {
        $normalized = $this->normalizePhoneNumber($phone);
        return $normalized !== null;
    }

    /**
     * Validate message length (Textwave limit is 1600 characters).
     */
    private function validateMessage($message) {
        if (!is_string($message) || trim($message) === '') {
            return ['success' => false, 'error' => 'Message is required', 'code' => 'VALIDATION_ERROR'];
        }

        $length = function_exists('mb_strlen') ? mb_strlen($message, 'UTF-8') : strlen($message);
        if (defined('SMS_MAX_MESSAGE_LENGTH') && $length > SMS_MAX_MESSAGE_LENGTH) {
            return [
                'success' => false,
                'error' => 'Message exceeds maximum length of ' . SMS_MAX_MESSAGE_LENGTH . ' characters',
                'code' => 'VALIDATION_ERROR'
            ];
        }

        return ['success' => true];
    }

    /**
     * Convert internal normalized phone format (+254XXXXXXXXX) to Textwave recipient format (254XXXXXXXXX).
     */
    private function toTextwaveRecipient($normalizedPhone) {
        return ltrim($normalizedPhone ?? '', '+');
    }

    /**
     * Make an HTTP request to OpenSMS API and return a normalized result array.
     *
     * OpenSMS uses Bearer token auth:
     * Authorization: Bearer <API_TOKEN>
     *
     * Base URL default: https://api.opensms.co.ke/v3
     * Endpoints used:
     * - POST /sms/send
     * - POST /sms/batch
     * - GET  /account
     */
    private function opensmsRequest($method, $path, $payload = null, $attemptedRecipientFallback = false) {
        if (empty(OPENSMS_API_TOKEN)) {
            return ['success' => false, 'error' => 'OpenSMS API token not configured. Please set OPENSMS_API_TOKEN in your .env.', 'code' => 'UNAUTHORIZED'];
        }

        $baseUrl = rtrim(OPENSMS_BASE_URL, '/');
        $url = $baseUrl . $path;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . OPENSMS_API_TOKEN,
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);


        if ($curlError) {
            error_log("SMS Service: OpenSMS CURL Error: {$curlError}");
            return ['success' => false, 'error' => 'CURL Error: ' . $curlError, 'code' => 'NETWORK_ERROR'];
        }

        $data = null;
        if (is_string($raw) && $raw !== '') {
            $data = json_decode($raw, true);
        }

        if ($raw && $data === null) {
            return [
                'success' => false,
                'error' => 'Invalid JSON response from OpenSMS',
                'code' => 'PROVIDER_ERROR',
                'http_code' => $httpCode,
                'raw' => $raw
            ];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            // Some OpenSMS endpoints return HTTP 200 even on logical errors.
            // Common shape: { "status": "error", "message": "..." }
            if (is_array($data) && (($data['status'] ?? null) === 'error' || ($data['success'] ?? null) === false)) {
                $message = $data['message'] ?? $data['error'] ?? 'OpenSMS request failed';

                // Some environments require "recipient" instead of "phone". If we detect that, retry once.
                if (
                    !$attemptedRecipientFallback
                    && is_string($message)
                    && (stripos($message, 'recipient field is required') !== false || stripos($message, 'phone field is required') !== false)
                    && is_array($payload)
                ) {
                    $fallbackPayload = $payload;
                    // Swap between phone <-> recipient depending on which one is missing.
                    if (stripos($message, 'recipient field is required') !== false) {
                        if (isset($fallbackPayload['phone']) && !isset($fallbackPayload['recipient'])) {
                            $fallbackPayload['recipient'] = $fallbackPayload['phone'];
                            unset($fallbackPayload['phone']);
                        }
                    } elseif (stripos($message, 'phone field is required') !== false) {
                        if (isset($fallbackPayload['recipient']) && !isset($fallbackPayload['phone'])) {
                            $fallbackPayload['phone'] = $fallbackPayload['recipient'];
                            unset($fallbackPayload['recipient']);
                        }
                    }
                    if (isset($fallbackPayload['messages']) && is_array($fallbackPayload['messages'])) {
                        $newMessages = [];
                        foreach ($fallbackPayload['messages'] as $m) {
                            if (!is_array($m)) continue;
                            if (stripos($message, 'recipient field is required') !== false) {
                                if (isset($m['phone']) && !isset($m['recipient'])) {
                                    $m['recipient'] = $m['phone'];
                                    unset($m['phone']);
                                }
                            } elseif (stripos($message, 'phone field is required') !== false) {
                                if (isset($m['recipient']) && !isset($m['phone'])) {
                                    $m['phone'] = $m['recipient'];
                                    unset($m['recipient']);
                                }
                            }
                            $newMessages[] = $m;
                        }
                        $fallbackPayload['messages'] = $newMessages;
                    }

                    return $this->opensmsRequest($method, $path, $fallbackPayload, true);
                }

                return [
                    'success' => false,
                    'error' => $message,
                    'code' => 'VALIDATION_ERROR',
                    'http_code' => $httpCode,
                    'response' => $data
                ];
            }

            return ['success' => true, 'http_code' => $httpCode, 'data' => $data];
        }

        // OpenSMS error shapes vary; normalize by HTTP code.
        $mappedCode = 'PROVIDER_ERROR';
        if ($httpCode === 400) $mappedCode = 'VALIDATION_ERROR';
        elseif ($httpCode === 401) $mappedCode = 'UNAUTHORIZED';
        elseif ($httpCode === 402) $mappedCode = 'INSUFFICIENT_CREDITS';
        elseif ($httpCode === 404) $mappedCode = 'NOT_FOUND';
        elseif ($httpCode === 429) $mappedCode = 'RATE_LIMIT';

        $message = $data['message'] ?? $data['error'] ?? ('OpenSMS API error (HTTP ' . $httpCode . ')');
        if ($mappedCode === 'UNAUTHORIZED') {
            $message = 'OpenSMS authentication failed. Please check OPENSMS_API_TOKEN.';
        } elseif ($mappedCode === 'INSUFFICIENT_CREDITS') {
            $message = 'Insufficient OpenSMS credits.';
        } elseif ($mappedCode === 'RATE_LIMIT') {
            $message = 'OpenSMS rate limit exceeded. Please retry later.';
        }

        // OpenSMS sometimes reports sender/originator issues as 404 with a message.
        if (is_string($message) && stripos($message, 'originator') !== false) {
            $mappedCode = 'VALIDATION_ERROR';
        }

        error_log("SMS Service: OpenSMS error {$mappedCode} (HTTP {$httpCode}) - {$message}");

        return [
            'success' => false,
            'error' => $message,
            'code' => $mappedCode,
            'http_code' => $httpCode,
            'response' => $data
        ];
    }

    /**
     * Send SMS via OpenSMS (single recipient).
     *
     * OpenSMS expects:
     * - phone: "+2547XXXXXXXX"
     * - message: "...."
     */
    private function sendViaOpenSMS($phone, $message) {
        if (!SMS_ENABLED) {
            return ['success' => false, 'error' => 'SMS is disabled'];
        }

        $messageValidation = $this->validateMessage($message);
        if (!$messageValidation['success']) {
            return $messageValidation;
        }

        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if (!$normalizedPhone) {
            return ['success' => false, 'error' => 'Invalid phone number format', 'code' => 'VALIDATION_ERROR'];
        }

        $payload = [
            'phone' => $normalizedPhone,
            'message' => $message
        ];

        // Sender ID / Originator handling:
        // OpenSMS documentation differs across endpoints/versions; different parameter names are used.
        // If OPENSMS_SENDER_ID is set, send it under common keys so the gateway can pick it up.
        if (defined('OPENSMS_SENDER_ID') && OPENSMS_SENDER_ID !== '') {
            $payload['sender_id'] = OPENSMS_SENDER_ID;
            $payload['senderId'] = OPENSMS_SENDER_ID;
            $payload['sender'] = OPENSMS_SENDER_ID;
            $payload['from'] = OPENSMS_SENDER_ID;
            $payload['originator'] = OPENSMS_SENDER_ID;
        }

        $res = $this->opensmsRequest('POST', '/sms/send', $payload);
        if (!$res['success']) {
            return $res;
        }

        $data = $res['data'] ?? [];

        // OpenSMS returns an id/message_id depending on the endpoint version; accept either.
        $messageId = $data['message_id'] ?? $data['messageId'] ?? $data['id'] ?? null;

        return [
            'success' => true,
            'message_id' => $messageId,
            'status' => $data['status'] ?? 'sent',
            'response' => $data
        ];
    }

    /**
     * Make an HTTP request to Textwave API and return a normalized result array.
     *
     * Textwave errors typically return:
     * { "status": "error", "error": "Error message", "code": "ERROR_CODE" }
     */
    private function textwaveRequest($method, $path, $payload = null, $authMode = null, $attemptedFallback = false) {
        if (empty(TEXTWAVE_API_KEY)) {
            return ['success' => false, 'error' => 'Textwave API key not configured. Please set TEXTWAVE_API_KEY in your .env.', 'code' => 'UNAUTHORIZED'];
        }

        $baseUrl = rtrim(TEXTWAVE_BASE_URL, '/');
        $url = $baseUrl . $path;

        $mode = $authMode ?: (defined('TEXTWAVE_AUTH_MODE') ? TEXTWAVE_AUTH_MODE : 'bearer');
        $mode = is_string($mode) ? strtolower(trim($mode)) : 'bearer';

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json'
        ];

        if ($mode === 'x_api_key') {
            $headers[] = 'X-API-Key: ' . TEXTWAVE_API_KEY;
        } else {
            // Default: bearer token (per Textwave docs)
            $headers[] = 'Authorization: Bearer ' . TEXTWAVE_API_KEY;
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        }

        $raw = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);


        if ($curlError) {
            error_log("SMS Service: Textwave CURL Error: {$curlError}");
            return ['success' => false, 'error' => 'CURL Error: ' . $curlError, 'code' => 'NETWORK_ERROR'];
        }

        $data = null;
        if (is_string($raw) && $raw !== '') {
            $data = json_decode($raw, true);
        }

        // Non-JSON responses (or invalid JSON) should still be handled gracefully.
        if ($raw && $data === null) {
            return [
                'success' => false,
                'error' => 'Invalid JSON response from Textwave',
                'code' => 'PROVIDER_ERROR',
                'http_code' => $httpCode,
                'raw' => $raw
            ];
        }

        if ($httpCode >= 200 && $httpCode < 300) {
            return ['success' => true, 'http_code' => $httpCode, 'data' => $data];
        }

        // Normalize common Textwave errors + map by HTTP status code.
        $providerCode = $data['code'] ?? ($data['error_code'] ?? null);
        $providerError = $data['error'] ?? ($data['message'] ?? null);

        $mappedCode = $providerCode;
        if (!$mappedCode) {
            if ($httpCode === 400) $mappedCode = 'VALIDATION_ERROR';
            elseif ($httpCode === 401) $mappedCode = 'UNAUTHORIZED';
            elseif ($httpCode === 402) $mappedCode = 'INSUFFICIENT_CREDITS';
            elseif ($httpCode === 429) $mappedCode = 'RATE_LIMIT';
            elseif ($httpCode === 404) $mappedCode = 'NOT_FOUND';
            else $mappedCode = 'PROVIDER_ERROR';
        }

        $message = $providerError ?: ('Textwave API error (HTTP ' . $httpCode . ')');
        if ($mappedCode === 'UNAUTHORIZED') {
            $message = 'Textwave authentication failed. Please check TEXTWAVE_API_KEY.';
        } elseif ($mappedCode === 'INSUFFICIENT_CREDITS') {
            $message = 'Insufficient Textwave SMS credits.';
        } elseif ($mappedCode === 'RATE_LIMIT') {
            $message = 'Textwave rate limit exceeded. Please retry later.';
        } elseif ($mappedCode === 'VALIDATION_ERROR') {
            $message = $providerError ?: 'Validation error from Textwave.';
        }

        error_log("SMS Service: Textwave error {$mappedCode} (HTTP {$httpCode}) - {$message}");

        // Fallback: some API gateways use X-API-Key instead of Bearer even when docs say Bearer.
        // If we got an auth error, try the alternate auth mode once.
        if ($mappedCode === 'UNAUTHORIZED' && !$attemptedFallback) {
            $alternate = ($mode === 'x_api_key') ? 'bearer' : 'x_api_key';
            $fallbackRes = $this->textwaveRequest($method, $path, $payload, $alternate, true);
            if ($fallbackRes['success'] ?? false) {
                return $fallbackRes;
            }
        }

        return [
            'success' => false,
            'error' => $message,
            'code' => $mappedCode,
            'http_code' => $httpCode,
            'response' => $data
        ];
    }

    /**
     * Send SMS via Textwave (single recipient).
     */
    private function sendViaTextwave($phone, $message, $options = []) {
        if (!SMS_ENABLED) {
            return ['success' => false, 'error' => 'SMS is disabled'];
        }

        $messageValidation = $this->validateMessage($message);
        if (!$messageValidation['success']) {
            return $messageValidation;
        }

        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if (!$normalizedPhone) {
            return ['success' => false, 'error' => 'Invalid phone number format', 'code' => 'VALIDATION_ERROR'];
        }

        $payload = [
            'to' => $this->toTextwaveRecipient($normalizedPhone),
            'message' => $message
        ];

        $senderId = $options['senderId'] ?? $options['sender_id'] ?? TEXTWAVE_SENDER_ID;
        if (!empty($senderId)) {
            $payload['senderId'] = $senderId;
        }

        $res = $this->textwaveRequest('POST', '/sms/send', $payload);
        if (!$res['success']) {
            return $res;
        }

        $data = $res['data'] ?? [];
        $result = $data['data']['results'][0] ?? null;

        if (!$result) {
            return [
                'success' => false,
                'error' => 'Unexpected API response from Textwave',
                'code' => 'PROVIDER_ERROR',
                'response' => $data
            ];
        }

        $status = $result['status'] ?? 'pending';
        $success = in_array($status, ['pending', 'sent', 'delivered'], true);

        return [
            'success' => $success,
            'message_id' => $result['messageId'] ?? null,
            'status' => $status,
            'response' => $data
        ];
    }
    
    /**
     * Send SMS using Africa's Talking API
     */
    private function sendViaAfricasTalking($phone, $message) {
        if (!SMS_ENABLED) {
            return ['success' => false, 'error' => 'SMS is disabled'];
        }
        
        // SECURITY: Don't log credential status to prevent information disclosure
        if (empty(AFRICASTALKING_USERNAME) || empty(AFRICASTALKING_API_KEY)) {
            error_log("SMS Service: Missing credentials - Please check your .env file configuration");
            return ['success' => false, 'error' => 'SMS credentials not configured. Please check your .env file.'];
        }
        
        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if (!$normalizedPhone) {
            return ['success' => false, 'error' => 'Invalid phone number format'];
        }
        
        // Determine if using sandbox or production based on username
        $isSandbox = strpos(strtolower(AFRICASTALKING_USERNAME), 'sandbox') !== false;
        $url = $isSandbox 
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : AFRICASTALKING_SMS_URL;
        
        $data = [
            'username' => AFRICASTALKING_USERNAME,
            'to' => $normalizedPhone,
            'message' => $message,
            'from' => AFRICASTALKING_SENDER_ID
        ];
        
        // SECURITY: Do not emit verbose debug logs in production.
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'apiKey: ' . AFRICASTALKING_API_KEY,
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        
        if ($error) {
            error_log("SMS Service: CURL Error: {$error}");
            return ['success' => false, 'error' => 'CURL Error: ' . $error];
        }
        
        // Parse response for better error messages
        $responseData = json_decode($response, true);
        
        if ($httpCode === 401) {
            $errorMsg = 'Authentication failed (HTTP 401). Please check:';
            $errorMsg .= ' 1) API Key is correct in .env file';
            $errorMsg .= ' 2) Username matches your Africa\'s Talking account';
            $errorMsg .= ' 3) Using correct endpoint (sandbox vs production)';
            if (isset($responseData['errorMessage'])) {
                $errorMsg .= ' - ' . $responseData['errorMessage'];
            }
            error_log("SMS Service: {$errorMsg}");
            error_log("SMS Service: Full response: " . $response);
            return ['success' => false, 'error' => $errorMsg, 'response' => $response];
        }
        
        if ($httpCode !== 201 && $httpCode !== 200) {
            $errorMsg = 'API Error: HTTP ' . $httpCode;
            if (isset($responseData['errorMessage'])) {
                $errorMsg .= ' - ' . $responseData['errorMessage'];
            }
            error_log("SMS Service: {$errorMsg}");
            error_log("SMS Service: Full response: " . $response);
            return ['success' => false, 'error' => $errorMsg, 'response' => $response];
        }
        
        if (isset($responseData['SMSMessageData']['Recipients'][0])) {
            $recipient = $responseData['SMSMessageData']['Recipients'][0];
            // Consider it successful if status is Success, Sent, or Queued
            // Note: DeliveryFailure in Africa's Talking dashboard doesn't always mean the SMS wasn't sent
            // It might just mean delivery confirmation wasn't received, but SMS was actually delivered
            $success = in_array($recipient['status'] ?? '', ['Success', 'Sent', 'Queued']);
            
            // Success or non-success handled by caller; avoid noisy debug logs here.
            
            return [
                'success' => $success,
                'message_id' => $recipient['messageId'] ?? null,
                'status' => $recipient['status'] ?? 'Unknown',
                'response' => $responseData
            ];
        }
        
        error_log("SMS Service: Unexpected API response from provider");
        return ['success' => false, 'error' => 'Unexpected API response', 'response' => $responseData];
    }
    
    /**
     * Send SMS
     */
    public function sendSMS($phone, $message, $options = []) {
        $recipientType = $options['recipient_type'] ?? 'customer';
        $relatedOrderId = $options['related_order_id'] ?? null;
        $relatedUserId = $options['related_user_id'] ?? null;
        
        // Intentionally avoid verbose logs for normal send operations.
        
        // Reuse an existing log entry (used by admin retry), or derive a stable ID for idempotency,
        // otherwise create a new one.
        $smsLogId = null;
        $isIdempotencyKey = false;
        if (isset($options['sms_log_id']) && is_string($options['sms_log_id']) && trim($options['sms_log_id']) !== '') {
            $smsLogId = trim($options['sms_log_id']);
        } elseif (isset($options['idempotency_key']) && is_string($options['idempotency_key']) && trim($options['idempotency_key']) !== '') {
            $isIdempotencyKey = true;
            $smsLogId = $this->uuidFromString('sms:' . trim($options['idempotency_key']));
        } else {
            $smsLogId = $this->generateUUID();
        }

        // If a stable ID was provided/derived, try updating first (idempotent).
        $reusingExistingLog =
            (isset($options['sms_log_id']) && is_string($options['sms_log_id']) && trim($options['sms_log_id']) !== '')
            || (isset($options['idempotency_key']) && is_string($options['idempotency_key']) && trim($options['idempotency_key']) !== '');

        // If an idempotency key was used, do not overwrite/re-send if the log already exists.
        // Caller can re-send explicitly via sms_log_id (admin retry).
        if ($isIdempotencyKey) {
            try {
                $stmt = $this->pdo->prepare("SELECT id, status FROM sms_logs WHERE id = ? LIMIT 1");
                $stmt->execute([$smsLogId]);
                $existing = $stmt->fetch(PDO::FETCH_ASSOC);

                if ($existing) {
                    return [
                        'success' => true,
                        'already_exists' => true,
                        'sms_log_id' => $smsLogId,
                        'status' => $existing['status'] ?? null
                    ];
                }
            } catch (Exception $e) {
                // If we can't check, proceed with best-effort behavior.
            }
        }

        // Validate message length/required.
        $messageValidation = $this->validateMessage($message);
        if (!$messageValidation['success']) {
            return array_merge($messageValidation, ['sms_log_id' => $smsLogId]);
        }

        // Normalize phone number
        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if (!$normalizedPhone) {
            $rawPhone = is_string($phone) ? trim($phone) : (string)$phone;
            error_log("SMS Service: Invalid phone number format: {$rawPhone} (original)");

            // Record a failed log entry so admins can see the reason in SMS Logs.
            try {
                if ($reusingExistingLog) {
                    $stmt = $this->pdo->prepare("
                        UPDATE sms_logs
                        SET phone = ?,
                            message = ?,
                            status = 'failed',
                            provider = ?,
                            recipient_type = ?,
                            related_order_id = ?,
                            related_user_id = ?,
                            provider_message_id = NULL,
                            provider_response = NULL,
                            error_message = ?,
                            sent_at = NULL
                        WHERE id = ?
                    ");
                    $stmt->execute([
                        $rawPhone,
                        $message,
                        $this->provider,
                        $recipientType,
                        $relatedOrderId,
                        $relatedUserId,
                        'Invalid phone number format',
                        $smsLogId
                    ]);

                    if ($stmt->rowCount() === 0) {
                        // MySQL may report 0 affected rows even when the row exists (no actual data changes).
                        $check = $this->pdo->prepare("SELECT id FROM sms_logs WHERE id = ? LIMIT 1");
                        $check->execute([$smsLogId]);
                        $reusingExistingLog = (bool)$check->fetch(PDO::FETCH_ASSOC);
                    }
                }

                if (!$reusingExistingLog) {
                    $stmt = $this->pdo->prepare("
                        INSERT INTO sms_logs (
                            id, phone, message, status, provider, recipient_type,
                            related_order_id, related_user_id, error_message, created_at
                        ) VALUES (?, ?, ?, 'failed', ?, ?, ?, ?, ?, NOW())
                    ");
                    $stmt->execute([
                        $smsLogId,
                        $rawPhone,
                        $message,
                        $this->provider,
                        $recipientType,
                        $relatedOrderId,
                        $relatedUserId,
                        'Invalid phone number format'
                    ]);
                }
            } catch (Exception $e) {
                // Don't throw; logging failures should not break the request.
                error_log("SMS Service: Failed to record invalid-phone SMS log: " . $e->getMessage());
            }

            return [
                'success' => false,
                'error' => 'Invalid phone number format',
                'code' => 'VALIDATION_ERROR',
                'sms_log_id' => $smsLogId
            ];
        }

        // Normalized phone obtained; proceed.

        // Create or reset SMS log entry
        try {
            if ($reusingExistingLog) {
                // Reset existing log to pending and clear previous provider results
                $stmt = $this->pdo->prepare("
                    UPDATE sms_logs
                    SET phone = ?,
                        message = ?,
                        status = 'pending',
                        provider = ?,
                        recipient_type = ?,
                        related_order_id = ?,
                        related_user_id = ?,
                        provider_message_id = NULL,
                        provider_response = NULL,
                        error_message = NULL,
                        sent_at = NULL
                    WHERE id = ?
                ");
                $stmt->execute([
                    $normalizedPhone,
                    $message,
                    $this->provider,
                    $recipientType,
                    $relatedOrderId,
                    $relatedUserId,
                    $smsLogId
                ]);

                if ($stmt->rowCount() === 0) {
                    // MySQL may report 0 affected rows even when the row exists (no actual data changes).
                    $check = $this->pdo->prepare("SELECT id FROM sms_logs WHERE id = ? LIMIT 1");
                    $check->execute([$smsLogId]);
                    $reusingExistingLog = (bool)$check->fetch(PDO::FETCH_ASSOC);
                }
            }

            if (!$reusingExistingLog) {
                $stmt = $this->pdo->prepare("
                    INSERT INTO sms_logs (
                        id, phone, message, status, provider, recipient_type,
                        related_order_id, related_user_id, created_at
                    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NOW())
                ");
                $stmt->execute([
                    $smsLogId,
                    $normalizedPhone,
                    $message,
                    $this->provider,
                    $recipientType,
                    $relatedOrderId,
                    $relatedUserId
                ]);

                // Notify admins that an SMS log was created
                $adminMessage = "SMS queued to {$normalizedPhone} (type: {$recipientType})";
                if ($relatedOrderId) {
                    $adminMessage .= " related_order_id={$relatedOrderId}";
                }
                notifyAllAdmins($adminMessage, 'sms');
            }
        } catch (PDOException $e) {
            error_log("SMS Service: Failed to create SMS log: " . $e->getMessage());
            return ['success' => false, 'error' => 'Failed to create SMS log'];
        }

        // Queue-only mode: create the log entry but do not dispatch to provider.
        // This enables background/cron processing, and keeps HTTP requests fast & reliable.
        if (!empty($options['queue_only'])) {
            return [
                'success' => true,
                'queued' => true,
                'status' => 'pending',
                'sms_log_id' => $smsLogId,
                'phone' => $normalizedPhone
            ];
        }
        
        // Send SMS based on provider
        $result = null;
        switch ($this->provider) {
            case 'opensms':
                $result = $this->sendViaOpenSMS($normalizedPhone, $message);
                break;
            case 'textwave':
                $result = $this->sendViaTextwave($normalizedPhone, $message, $options);
                break;
            case 'africas_talking':
                $result = $this->sendViaAfricasTalking($normalizedPhone, $message);
                break;
            default:
                $result = ['success' => false, 'error' => 'Unknown SMS provider'];
        }
        
        // Update SMS log with result
        try {
            $status = 'failed';
            if (($result['success'] ?? false) === true) {
                if ($this->provider === 'textwave') {
                    $twStatus = $result['status'] ?? null;
                    $status = in_array($twStatus, ['pending', 'sent', 'delivered'], true) ? $twStatus : 'sent';
                } elseif ($this->provider === 'opensms') {
                    $osStatus = $result['status'] ?? null;
                    $status = in_array($osStatus, ['queued', 'pending', 'sent', 'delivered'], true) ? $osStatus : 'sent';
                } else {
                    $status = 'sent';
                }
            }
            $providerMessageId = $result['message_id'] ?? null;
            $providerResponse = json_encode($result);
            $errorMessage = $result['error'] ?? null;
            $sentAt = (($result['success'] ?? false) === true) ? date('Y-m-d H:i:s') : null;
            
            $stmt = $this->pdo->prepare("
                UPDATE sms_logs 
                SET status = ?, 
                    provider_message_id = ?, 
                    provider_response = ?, 
                    error_message = ?,
                    sent_at = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $status,
                $providerMessageId,
                $providerResponse,
                $errorMessage,
                $sentAt,
                $smsLogId
            ]);
        } catch (PDOException $e) {
            error_log("SMS Service: Failed to update SMS log: " . $e->getMessage());
        }
        
        return array_merge($result, ['sms_log_id' => $smsLogId]);
    }

    /**
     * Process pending SMS logs (intended for cron/background workers).
     */
    public function processPendingSMS($limit = 20) {
        $limit = is_numeric($limit) ? (int)$limit : 20;
        if ($limit <= 0) $limit = 20;

        $processed = 0;
        $successful = 0;
        $failed = 0;

        try {
            $stmt = $this->pdo->prepare("
                SELECT id, phone, message, recipient_type, related_order_id, related_user_id
                FROM sms_logs
                WHERE status = 'pending'
                ORDER BY created_at ASC
                LIMIT ?
            ");
            $stmt->execute([$limit]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as $row) {
                $processed++;
                $res = $this->sendSMS($row['phone'], $row['message'], [
                    'sms_log_id' => $row['id'], // reuse existing log entry
                    'recipient_type' => $row['recipient_type'] ?? 'customer',
                    'related_order_id' => $row['related_order_id'] ?? null,
                    'related_user_id' => $row['related_user_id'] ?? null
                ]);

                if (!($res['success'] ?? false)) {
                    $failed++;
                } else {
                    $successful++;
                }
            }
        } catch (Exception $e) {
            return [
                'processed' => $processed,
                'successful' => $successful,
                'failed' => $failed,
                'error' => $e->getMessage()
            ];
        }

        return [
            'processed' => $processed,
            'successful' => $successful,
            'failed' => $failed
        ];
    }

    /**
     * Send bulk SMS via Textwave (multiple recipients in a single API call).
     *
     * Notes:
     * - Creates one log entry per recipient in sms_logs (same as sendSMS).
     * - Returns sms_log_ids keyed by normalized phone (+254...).
     */
    public function sendBulkSMS($phones, $message, $options = []) {
        if (!SMS_ENABLED) {
            return ['success' => false, 'error' => 'SMS is disabled'];
        }

        if (!is_array($phones) || count($phones) === 0) {
            return ['success' => false, 'error' => 'Phones must be a non-empty array', 'code' => 'VALIDATION_ERROR'];
        }

        if (!in_array($this->provider, ['textwave', 'opensms'], true)) {
            return ['success' => false, 'error' => 'Bulk SMS is only supported for Textwave/OpenSMS providers', 'code' => 'PROVIDER_ERROR'];
        }

        $messageValidation = $this->validateMessage($message);
        if (!$messageValidation['success']) {
            return $messageValidation;
        }

        $recipientType = $options['recipient_type'] ?? 'customer';
        $relatedOrderId = $options['related_order_id'] ?? null;
        $relatedUserId = $options['related_user_id'] ?? null;

        $normalizedPhones = [];
        $invalidPhones = [];
        foreach ($phones as $phone) {
            $normalized = $this->normalizePhoneNumber($phone);
            if (!$normalized) {
                $invalidPhones[] = $phone;
                continue;
            }
            $normalizedPhones[] = $normalized;
        }

        if (!empty($invalidPhones)) {
            return [
                'success' => false,
                'error' => 'One or more phone numbers are invalid',
                'code' => 'VALIDATION_ERROR',
                'invalid_phones' => $invalidPhones
            ];
        }

        // Create a log per recipient (pending)
        $smsLogIdsByPhone = [];
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO sms_logs (
                    id, phone, message, status, provider, recipient_type,
                    related_order_id, related_user_id, created_at
                ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, NOW())
            ");

            foreach ($normalizedPhones as $normalizedPhone) {
                $smsLogId = $this->generateUUID();
                $stmt->execute([
                    $smsLogId,
                    $normalizedPhone,
                    $message,
                    $this->provider,
                    $recipientType,
                    $relatedOrderId,
                    $relatedUserId
                ]);
                $smsLogIdsByPhone[$normalizedPhone] = $smsLogId;
            }
        } catch (PDOException $e) {
            error_log("SMS Service: Failed to create bulk SMS logs: " . $e->getMessage());
            return ['success' => false, 'error' => 'Failed to create SMS logs'];
        }

        $res = null;
        $providerResponse = null;

        if ($this->provider === 'opensms') {
            $messages = [];
            foreach ($normalizedPhones as $normalizedPhone) {
                $entry = [
                    'phone' => $normalizedPhone,
                    'message' => $message
                ];

                if (defined('OPENSMS_SENDER_ID') && OPENSMS_SENDER_ID !== '') {
                    $entry['sender_id'] = OPENSMS_SENDER_ID;
                    $entry['senderId'] = OPENSMS_SENDER_ID;
                    $entry['sender'] = OPENSMS_SENDER_ID;
                    $entry['from'] = OPENSMS_SENDER_ID;
                    $entry['originator'] = OPENSMS_SENDER_ID;
                }

                $messages[] = $entry;
            }

            $payload = ['messages' => $messages];
            $res = $this->opensmsRequest('POST', '/sms/batch', $payload);
            $providerResponse = $res['success'] ? ($res['data'] ?? []) : ($res['response'] ?? ['error' => $res['error'] ?? 'Unknown error', 'code' => $res['code'] ?? null]);
        } else {
            $to = array_map([$this, 'toTextwaveRecipient'], $normalizedPhones);
            $payload = [
                'to' => $to,
                'message' => $message
            ];

            $senderId = $options['senderId'] ?? $options['sender_id'] ?? TEXTWAVE_SENDER_ID;
            if (!empty($senderId)) {
                $payload['senderId'] = $senderId;
            }

            $res = $this->textwaveRequest('POST', '/sms/send', $payload);
            $providerResponse = $res['success'] ? ($res['data'] ?? []) : ($res['response'] ?? ['error' => $res['error'] ?? 'Unknown error', 'code' => $res['code'] ?? null]);
        }

        // Update logs based on response (even on failure, store response).

        if (!$res['success']) {
            // Mark all as failed with the same error since we don't have per-recipient results.
            try {
                $stmt = $this->pdo->prepare("
                    UPDATE sms_logs
                    SET status = 'failed',
                        provider_response = ?,
                        error_message = ?
                    WHERE id = ?
                ");
                foreach ($smsLogIdsByPhone as $smsLogId) {
                    $stmt->execute([json_encode($providerResponse), $res['error'] ?? 'Failed to send', $smsLogId]);
                }
            } catch (PDOException $e) {
                error_log("SMS Service: Failed to update bulk SMS logs after provider failure: " . $e->getMessage());
            }

            return array_merge($res, ['sms_log_ids' => $smsLogIdsByPhone]);
        }

        $resultsByPhone = [];
        if ($this->provider === 'opensms') {
            // OpenSMS batch response can vary; try common shapes.
            $results = $providerResponse['data'] ?? $providerResponse['results'] ?? $providerResponse['messages'] ?? [];
            if (is_array($results)) {
                foreach ($results as $r) {
                    $phoneKey = $r['phone'] ?? $r['recipient'] ?? null;
                    if (!$phoneKey) continue;
                    $resultsByPhone[$phoneKey] = $r;
                }
            }
        } else {
            $results = $providerResponse['data']['results'] ?? [];
            foreach ($results as $r) {
                if (!isset($r['phone'])) continue;
                $resultsByPhone[$r['phone']] = $r;
            }
        }

        // Update each log with its result (if present)
        try {
            $stmt = $this->pdo->prepare("
                UPDATE sms_logs
                SET status = ?,
                    provider_message_id = ?,
                    provider_response = ?,
                    error_message = ?,
                    sent_at = ?
                WHERE id = ?
            ");

            foreach ($smsLogIdsByPhone as $normalizedPhone => $smsLogId) {
                $recipientKey = $this->provider === 'opensms'
                    ? $normalizedPhone
                    : $this->toTextwaveRecipient($normalizedPhone); // 254...
                $r = $resultsByPhone[$recipientKey] ?? null;

                $status = 'failed';
                $providerMessageId = null;
                $errorMessage = null;
                $sentAt = null;

                if ($r) {
                    if ($this->provider === 'opensms') {
                        $providerMessageId = $r['message_id'] ?? $r['messageId'] ?? $r['id'] ?? null;
                        $pStatus = $r['status'] ?? 'sent';
                        $isOk = !in_array($pStatus, ['failed', 'error'], true);
                        $status = $isOk ? 'sent' : 'failed';
                        $errorMessage = $isOk ? null : ($r['error'] ?? $r['message'] ?? 'Failed');
                        $sentAt = $isOk ? date('Y-m-d H:i:s') : null;
                    } else {
                        $twStatus = $r['status'] ?? 'pending';
                        $providerMessageId = $r['messageId'] ?? null;
                        $isOk = in_array($twStatus, ['pending', 'sent', 'delivered'], true);

                        $status = $isOk ? $twStatus : 'failed';
                        $errorMessage = $isOk ? null : ($r['error'] ?? 'Failed');
                        $sentAt = $isOk ? date('Y-m-d H:i:s') : null;
                    }
                } else {
                    $errorMessage = 'Missing per-recipient result from provider';
                }

                $stmt->execute([
                    $status,
                    $providerMessageId,
                    json_encode(['provider' => 'textwave', 'result' => $r, 'response' => $providerResponse]),
                    $errorMessage,
                    $sentAt,
                    $smsLogId
                ]);
            }
        } catch (PDOException $e) {
            error_log("SMS Service: Failed to update bulk SMS logs: " . $e->getMessage());
        }

        $success = true;
        if ($this->provider === 'textwave') {
            $totalFailed = $providerResponse['data']['totalFailed'] ?? null;
            $success = ($totalFailed === null) ? true : ((int)$totalFailed === 0);
        }

        return [
            'success' => $success,
            'status' => $providerResponse['status'] ?? 'success',
            'response' => $providerResponse,
            'sms_log_ids' => $smsLogIdsByPhone
        ];
    }

    /**
     * Check SMS balance (Textwave).
     */
    public function checkSMSBalance() {
        if ($this->provider === 'opensms') {
            return $this->opensmsRequest('GET', '/account');
        }

        if ($this->provider === 'textwave') {
            return $this->textwaveRequest('GET', '/wallet/balance');
        }

        return ['success' => false, 'error' => 'Balance check is only supported for OpenSMS/Textwave providers', 'code' => 'PROVIDER_ERROR'];
    }

    /**
     * Retrieve delivery status for a sent message (Textwave).
     *
     * @param string $messageId The messageId returned by sendSMS/sendBulkSMS.
     */
    public function getDeliveryStatus($messageId) {
        if ($this->provider === 'textwave') {
            if (!is_string($messageId) || trim($messageId) === '') {
                return ['success' => false, 'error' => 'messageId is required', 'code' => 'VALIDATION_ERROR'];
            }

            $path = '/sms/' . rawurlencode($messageId);
            return $this->textwaveRequest('GET', $path);
        }

        if ($this->provider === 'opensms') {
            // OpenSMS delivery reports are typically handled via webhooks; a polling endpoint is not documented
            // in the public guide. Return a clear, actionable error.
            return [
                'success' => false,
                'error' => 'OpenSMS delivery status polling is not configured. Use OpenSMS delivery report webhooks to update sms_logs.',
                'code' => 'NOT_SUPPORTED'
            ];
        }

        return ['success' => false, 'error' => 'Delivery status is not supported for this provider', 'code' => 'PROVIDER_ERROR'];
    }
    
    /**
     * Generate UUID
     */
    private function generateUUID() {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    private function uuidFromString($value) {
        $hash = sha1((string)$value);
        return sprintf(
            '%s-%s-%s-%s-%s',
            substr($hash, 0, 8),
            substr($hash, 8, 4),
            substr($hash, 12, 4),
            substr($hash, 16, 4),
            substr($hash, 20, 12)
        );
    }
    
    /**
     * Get SMS logs
     */
    public function getSMSLogs($filters = []) {
        $where = ['1=1'];
        $params = [];
        
        if (isset($filters['phone'])) {
            $where[] = "phone = ?";
            $params[] = $filters['phone'];
        }
        
        if (isset($filters['status'])) {
            $where[] = "status = ?";
            $params[] = $filters['status'];
        }
        
        if (isset($filters['recipient_type'])) {
            $where[] = "recipient_type = ?";
            $params[] = $filters['recipient_type'];
        }
        
        if (isset($filters['related_order_id'])) {
            $where[] = "related_order_id = ?";
            $params[] = $filters['related_order_id'];
        }
        
        if (isset($filters['date_from'])) {
            $where[] = "created_at >= ?";
            $params[] = $filters['date_from'];
        }
        
        if (isset($filters['date_to'])) {
            $where[] = "created_at <= ?";
            $params[] = $filters['date_to'];
        }
        
        $limit = $filters['limit'] ?? 100;
        $offset = $filters['offset'] ?? 0;
        
        $sql = "SELECT * FROM sms_logs WHERE " . implode(' AND ', $where) . " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    /**
     * Get SMS statistics
     */
    public function getSMSStatistics($filters = []) {
        $where = ['1=1'];
        $params = [];
        
        if (isset($filters['date_from'])) {
            $where[] = "created_at >= ?";
            $params[] = $filters['date_from'];
        }
        
        if (isset($filters['date_to'])) {
            $where[] = "created_at <= ?";
            $params[] = $filters['date_to'];
        }
        
        $sql = "
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN recipient_type = 'customer' THEN 1 ELSE 0 END) as to_customers,
                SUM(CASE WHEN recipient_type = 'vendor' THEN 1 ELSE 0 END) as to_vendors
            FROM sms_logs 
            WHERE " . implode(' AND ', $where);
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }
}

