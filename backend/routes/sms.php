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
        
        error_log("SMS Logs API: Fetching with filters: " . json_encode($cleanFilters));
        
        $logs = $smsService->getSMSLogs($cleanFilters);
        
        // Log for debugging
        error_log("SMS Logs API: Service returned " . count($logs) . " logs");
        if (count($logs) > 0) {
            error_log("SMS Logs API: First log ID: " . $logs[0]['id']);
            error_log("SMS Logs API: First log phone: " . $logs[0]['phone']);
        } else {
            error_log("SMS Logs API: WARNING - No logs returned from service!");
        }
        
        // Ensure logs is always an array
        if (!is_array($logs)) {
            error_log("SMS Logs API: ERROR - Service did not return an array! Type: " . gettype($logs));
            $logs = [];
        }
        
        $response = [
            'success' => true,
            'logs' => $logs,
            'count' => count($logs)
        ];
        
        error_log("SMS Logs API: Sending response with " . count($logs) . " logs");
        error_log("SMS Logs API: Response JSON length: " . strlen(json_encode($response)) . " bytes");
        
        // Output JSON response (headers already set by index.php)
        // Don't use return - just echo like other routes
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        
    } catch (Exception $e) {
        http_response_code(500);
        error_log("SMS Logs API: Exception - " . $e->getMessage());
        error_log("SMS Logs API: Stack trace - " . $e->getTraceAsString());
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

