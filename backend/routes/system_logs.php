<?php
/**
 * System Logs Routes
 * Handles fetching and filtering system logs
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/../utils/security.php';
require_once __DIR__ . '/../utils/system_logs.php';
require_once __DIR__ . '/admin.php'; // For validateAdminSession

/**
 * Get system logs with filtering
 */
function handleGetSystemLogs() {
    global $pdo;
    
    // Only admins can view system logs - use admin session validation
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Use admin session validation (not JWT)
    if (!function_exists('validateAdminSession') || !validateAdminSession($token)) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can view system logs']);
        return;
    }
    
    try {
        // Get query parameters
        $userType = isset($_GET['user_type']) ? sanitizeInput($_GET['user_type']) : null;
        $search = isset($_GET['search']) ? sanitizeInput($_GET['search']) : null;
        $action = isset($_GET['action']) ? sanitizeInput($_GET['action']) : null;
        $limit = isset($_GET['limit']) ? max(1, min(1000, intval($_GET['limit']))) : 100;
        $offset = isset($_GET['offset']) ? max(0, intval($_GET['offset'])) : 0;
        
        // Ensure table exists
        ensureSystemLogsTable();
        
        // Build query
        $query = "
            SELECT 
                sl.*,
                u.email,
                u.phone,
                u.full_name,
                CASE 
                    WHEN sl.user_type = 'vendor' THEN v.farm_name
                    WHEN sl.user_type = 'admin' THEN 'Admin'
                    WHEN sl.user_type = 'system' THEN 'System'
                    ELSE u.full_name
                END as display_name
            FROM system_logs sl
            LEFT JOIN user_profiles u ON sl.user_id = u.id
            LEFT JOIN vendors v ON u.id = v.user_id AND sl.user_type = 'vendor'
            WHERE 1=1
        ";
        
        $params = [];
        
        // Filter by user type
        if ($userType && in_array($userType, ['vendor', 'customer', 'admin', 'system'])) {
            $query .= " AND sl.user_type = ?";
            $params[] = $userType;
        }
        
        // Filter by action
        if ($action) {
            $query .= " AND sl.action = ?";
            $params[] = $action;
        }
        
        // Search by name, email, or phone
        if ($search) {
            $query .= " AND (
                u.full_name LIKE ? OR 
                u.email LIKE ? OR 
                u.phone LIKE ? OR
                v.farm_name LIKE ?
            )";
            $searchTerm = "%{$search}%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        // Get total count - build count query separately
        $countQuery = "
            SELECT COUNT(*) as total
            FROM system_logs sl
            LEFT JOIN user_profiles u ON sl.user_id = u.id
            LEFT JOIN vendors v ON u.id = v.user_id AND sl.user_type = 'vendor'
            WHERE 1=1
        ";
        $countParams = [];
        
        // Apply same filters for count
        if ($userType && in_array($userType, ['vendor', 'customer', 'admin', 'system'])) {
            $countQuery .= " AND sl.user_type = ?";
            $countParams[] = $userType;
        }
        
        if ($action) {
            $countQuery .= " AND sl.action = ?";
            $countParams[] = $action;
        }
        
        if ($search) {
            $countQuery .= " AND (
                u.full_name LIKE ? OR 
                u.email LIKE ? OR 
                u.phone LIKE ? OR
                v.farm_name LIKE ?
            )";
            $searchTerm = "%{$search}%";
            $countParams[] = $searchTerm;
            $countParams[] = $searchTerm;
            $countParams[] = $searchTerm;
            $countParams[] = $searchTerm;
        }
        
        $countStmt = $pdo->prepare($countQuery);
        $countStmt->execute($countParams);
        $total = $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Add ordering and pagination
        $query .= " ORDER BY sl.created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $stmt = $pdo->prepare($query);
        $stmt->execute($params);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Parse metadata JSON
        foreach ($logs as &$log) {
            if ($log['metadata']) {
                $log['metadata'] = json_decode($log['metadata'], true);
            }
        }
        
        echo json_encode([
            'success' => true,
            'logs' => $logs,
            'total' => (int)$total,
            'limit' => $limit,
            'offset' => $offset
        ]);
        
    } catch (PDOException $e) {
        error_log("Error fetching system logs: " . $e->getMessage());
        error_log("Query: " . ($query ?? 'N/A'));
        error_log("Params: " . print_r($params ?? [], true));
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch system logs: ' . $e->getMessage()]);
    } catch (Exception $e) {
        error_log("Error fetching system logs: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch system logs: ' . $e->getMessage()]);
    }
}

/**
 * Get available actions for filtering
 */
function handleGetLogActions() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token) {
        http_response_code(401);
        echo json_encode(['error' => 'No token provided']);
        return;
    }
    
    // Use admin session validation (not JWT)
    if (!function_exists('validateAdminSession') || !validateAdminSession($token)) {
        http_response_code(403);
        echo json_encode(['error' => 'Only admins can view system logs']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT DISTINCT action 
            FROM system_logs 
            ORDER BY action ASC
        ");
        $actions = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        echo json_encode([
            'success' => true,
            'actions' => $actions
        ]);
    } catch (PDOException $e) {
        error_log("Error fetching log actions: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch log actions']);
    }
}

?>

