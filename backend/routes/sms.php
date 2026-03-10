<?php
/**
 * SMS Management Routes
 * 
 * Handles SMS logs viewing for admin
 * 
 * Note: CORS headers are handled by index.php, so we don't set them here
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../services/sms/SMSService.php';

// Include admin.php to get validateAdminSession function if not already included
if (!function_exists('validateAdminSession')) {
    require_once __DIR__ . '/admin.php';
}

// Don't set headers here - they're handled by index.php
// Headers are set in index.php before routing

/**
 * Get SMS logs (Admin only)
 */
function handleGetSMSLogs() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $smsService = new SMSService();
        
        // Get filters from query parameters
        $filters = [
            'phone' => $_GET['phone'] ?? null,
            'status' => $_GET['status'] ?? null,
            'recipient_type' => $_GET['recipient_type'] ?? null,
            'related_order_id' => $_GET['order_id'] ?? null,
            'date_from' => $_GET['date_from'] ?? null,
            'date_to' => $_GET['date_to'] ?? null,
            'limit' => isset($_GET['limit']) ? (int)$_GET['limit'] : 100,
            'offset' => isset($_GET['offset']) ? (int)$_GET['offset'] : 0
        ];
        
        // Remove null/empty filters (but keep limit and offset even if 0)
        $cleanFilters = [];
        foreach ($filters as $key => $value) {
            // Keep limit and offset even if 0, remove other null/empty values
            if ($key === 'limit' || $key === 'offset') {
                $cleanFilters[$key] = $value;
            } elseif ($value !== null && $value !== '') {
                $cleanFilters[$key] = $value;
            }
        }
        
        // Ensure limit and offset are set with defaults
        if (!isset($cleanFilters['limit']) || $cleanFilters['limit'] === null) {
            $cleanFilters['limit'] = 100;
        }
        if (!isset($cleanFilters['offset']) || $cleanFilters['offset'] === null) {
            $cleanFilters['offset'] = 0;
        }
        
        // Convert to integers
        $cleanFilters['limit'] = (int)$cleanFilters['limit'];
        $cleanFilters['offset'] = (int)$cleanFilters['offset'];
        
        $logs = $smsService->getSMSLogs($cleanFilters);

        // Ensure logs is an array to avoid downstream errors
        if (!is_array($logs)) {
            error_log("SMS Logs API: Service did not return an array; returning empty list");
            $logs = [];
        }

        $response = [
            'success' => true,
            'logs' => $logs,
            'count' => count($logs)
        ];
        
        // Output JSON response (headers already set by index.php)
        // Don't use return - just echo like other routes
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("SMS Logs API: Exception - " . $e->getMessage());
        echo json_encode(['error' => 'Failed to fetch SMS logs: ' . $e->getMessage()]);
    }
}

/**
 * Get SMS statistics (Admin only)
 */
function handleGetSMSStats() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $smsService = new SMSService();
        
        require_once __DIR__ . '/../utils/security.php';
        
        $filters = [
            'date_from' => isset($_GET['date_from']) ? sanitizeInput($_GET['date_from']) : null,
            'date_to' => isset($_GET['date_to']) ? sanitizeInput($_GET['date_to']) : null
        ];
        
        // Remove null filters
        $filters = array_filter($filters, function($value) {
            return $value !== null;
        });
        
        $stats = $smsService->getSMSStatistics($filters);
        
        echo json_encode([
            'success' => true,
            'statistics' => $stats
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch SMS statistics: ' . $e->getMessage()]);
    }
}

/**
 * Get Textwave wallet balance (Admin only)
 *
 * GET /api/admin/sms/balance
 */
function handleGetSMSBalance() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    try {
        $smsService = new SMSService();
        $result = $smsService->checkSMSBalance();

        if (!($result['success'] ?? false)) {
            $code = $result['code'] ?? null;
            if ($code === 'VALIDATION_ERROR') http_response_code(400);
            elseif ($code === 'UNAUTHORIZED') http_response_code(401);
            elseif ($code === 'INSUFFICIENT_CREDITS') http_response_code(402);
            elseif ($code === 'NOT_FOUND') http_response_code(404);
            elseif ($code === 'RATE_LIMIT') http_response_code(429);
            else http_response_code(500);

            echo json_encode([
                'success' => false,
                'error' => $result['error'] ?? 'Failed to fetch balance',
                'code' => $code,
                'details' => $result['response'] ?? null
            ]);
            return;
        }

        echo json_encode([
            'success' => true,
            'data' => $result['data'] ?? null
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    } catch (Exception $e) {
        http_response_code(500);
        error_log("SMS Balance API: Exception - " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to fetch SMS balance']);
    }
}

/**
 * Get delivery status for a messageId (Admin only)
 *
 * GET /api/admin/sms/status/:messageId
 */
function handleGetSMSDeliveryStatus($messageId) {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }

    try {
        require_once __DIR__ . '/../utils/security.php';
        $messageId = sanitizeInput($messageId);

        $smsService = new SMSService();
        $result = $smsService->getDeliveryStatus($messageId);

        if (!($result['success'] ?? false)) {
            $code = $result['code'] ?? null;
            if ($code === 'VALIDATION_ERROR') http_response_code(400);
            elseif ($code === 'UNAUTHORIZED') http_response_code(401);
            elseif ($code === 'INSUFFICIENT_CREDITS') http_response_code(402);
            elseif ($code === 'NOT_FOUND') http_response_code(404);
            elseif ($code === 'RATE_LIMIT') http_response_code(429);
            else http_response_code(500);

            echo json_encode([
                'success' => false,
                'error' => $result['error'] ?? 'Failed to fetch delivery status',
                'code' => $code,
                'details' => $result['response'] ?? null
            ]);
            return;
        }

        echo json_encode([
            'success' => true,
            'data' => $result['data'] ?? null
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    } catch (Exception $e) {
        http_response_code(500);
        error_log("SMS Delivery Status API: Exception - " . $e->getMessage());
        echo json_encode(['success' => false, 'error' => 'Failed to fetch delivery status']);
    }
}

/**
 * Delete SMS log (Admin only)
 */
function handleDeleteSMSLog() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        
        // Get SMS ID from URL path
        $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
        $smsId = end($pathParts);
        
        // If SMS ID is 'retry' or 'delete', get the previous part
        if ($smsId === 'retry' || $smsId === 'delete') {
            $smsId = prev($pathParts);
        }
        
        require_once __DIR__ . '/../utils/security.php';
        $smsId = sanitizeInput($smsId);
        
        // Delete the SMS log
        $stmt = $pdo->prepare("DELETE FROM sms_logs WHERE id = ?");
        $stmt->execute([$smsId]);
        
        if ($stmt->rowCount() > 0) {
            http_response_code(200);
            echo json_encode([
                'success' => true,
                'message' => 'SMS log deleted successfully'
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'SMS log not found']);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Delete SMS log error: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to delete SMS log: ' . $e->getMessage()]);
    }
}

/**
 * Retry sending SMS (Admin only)
 */
function handleRetrySMS() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);

        // Help diagnose Authorization header forwarding issues in local dev without leaking secrets in production.
        $isLocal = in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true);
        if ($isLocal) {
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            $serverAuth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? null);
            $headerAuth = $headers['Authorization'] ?? ($headers['authorization'] ?? null);
            $auth = $headerAuth ?: $serverAuth;

            echo json_encode([
                'error' => 'Unauthorized',
                'debug' => [
                    'has_authorization_header' => (bool)$auth,
                    'authorization_header_prefix' => is_string($auth) ? substr($auth, 0, 24) : null,
                    'token_length' => is_string($token) ? strlen($token) : 0,
                    'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? null,
                    'request_uri' => $_SERVER['REQUEST_URI'] ?? null
                ]
            ]);
            return;
        }

        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        
        // Get SMS ID from URL path
        $pathParts = explode('/', trim($_SERVER['REQUEST_URI'], '/'));
        // Find the SMS ID before 'retry'
        $retryIndex = array_search('retry', $pathParts);
        $smsId = $pathParts[$retryIndex - 1] ?? null;
        
        require_once __DIR__ . '/../utils/security.php';
        $smsId = sanitizeInput($smsId);
        
        // Get the SMS log
        $stmt = $pdo->prepare("SELECT * FROM sms_logs WHERE id = ?");
        $stmt->execute([$smsId]);
        $smsLog = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$smsLog) {
            http_response_code(404);
            echo json_encode(['error' => 'SMS log not found']);
            return;
        }
        
        // Retry sending the SMS
        $smsService = new SMSService();
        $result = $smsService->sendSMS($smsLog['phone'], $smsLog['message'], [
            // Reuse the same log entry (don't create a new one on retry)
            'sms_log_id' => $smsId,
            'recipient_type' => $smsLog['recipient_type'],
            'related_order_id' => $smsLog['related_order_id'],
            'related_user_id' => $smsLog['related_user_id']
        ]);

        // If provider failed, return a non-2xx status so the admin UI shows an error toast.
        if (!($result['success'] ?? false)) {
            $code = $result['code'] ?? null;
            if ($code === 'VALIDATION_ERROR') http_response_code(400);
            elseif ($code === 'UNAUTHORIZED') http_response_code(401);
            elseif ($code === 'INSUFFICIENT_CREDITS') http_response_code(402);
            elseif ($code === 'NOT_FOUND') http_response_code(404);
            elseif ($code === 'RATE_LIMIT') http_response_code(429);
            else http_response_code(500);
        } else {
            http_response_code(200);
        }
        
        echo json_encode([
            'success' => (bool)($result['success'] ?? false),
            'message' => 'SMS retry completed',
            'sms_log_id' => $smsId,
            'status' => $result['status'] ?? (($result['success'] ?? false) ? 'sent' : 'failed'),
            'provider_message_id' => $result['message_id'] ?? null,
            'error' => $result['error'] ?? null
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("Retry SMS error: " . $e->getMessage());
        echo json_encode(['error' => 'Failed to retry SMS: ' . $e->getMessage()]);
    }
}

