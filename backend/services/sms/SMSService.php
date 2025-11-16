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
        curl_close($ch);
        
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
        
        // Normalize phone number
        $normalizedPhone = $this->normalizePhoneNumber($phone);
        if (!$normalizedPhone) {
            error_log("SMS Service: Invalid phone number format: $phone (original)");
            return ['success' => false, 'error' => 'Invalid phone number format'];
        }
        
        // Normalized phone obtained; proceed.
        
        // Generate SMS log ID
        $smsLogId = $this->generateUUID();
        
        // Create SMS log entry
        try {
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
        } catch (PDOException $e) {
            error_log("SMS Service: Failed to create SMS log: " . $e->getMessage());
            return ['success' => false, 'error' => 'Failed to create SMS log'];
        }
        
        // Send SMS based on provider
        $result = null;
        switch ($this->provider) {
            case 'africas_talking':
                $result = $this->sendViaAfricasTalking($normalizedPhone, $message);
                break;
            default:
                $result = ['success' => false, 'error' => 'Unknown SMS provider'];
        }
        
        // Update SMS log with result
        try {
            $status = $result['success'] ? 'sent' : 'failed';
            $providerMessageId = $result['message_id'] ?? null;
            $providerResponse = json_encode($result);
            $errorMessage = $result['error'] ?? null;
            $sentAt = $result['success'] ? date('Y-m-d H:i:s') : null;
            
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

