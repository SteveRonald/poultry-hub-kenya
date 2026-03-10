<?php
/**
 * System Logs Utility
 * Logs all user activities in the system
 */

require_once __DIR__ . '/../config/database.php';

/**
 * Generate UUID
 */
function generateLogUUID() {
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
 * Log user activity
 * 
 * @param string $userId User ID
 * @param string $userType 'vendor', 'customer', or 'admin'
 * @param string $action Action performed (e.g., 'login', 'create_product', 'place_order')
 * @param string $description Human-readable description
 * @param array $metadata Additional data (optional)
 * @return bool Success status
 */
function logActivity($userId, $userType, $action, $description, $metadata = []) {
    global $pdo;
    
    try {
        // Ensure system_logs table exists
        ensureSystemLogsTable();
        
        $logId = generateLogUUID();
        $metadataJson = !empty($metadata) ? json_encode($metadata) : null;
        $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
        
        // Handle NULL user_id for system logs
        $stmt = $pdo->prepare("
            INSERT INTO system_logs (
                id, user_id, user_type, action, description, 
                metadata, ip_address, user_agent, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        
        $stmt->execute([
            $logId,
            $userId ?: null, // Allow NULL for system logs
            $userType,
            $action,
            $description,
            $metadataJson,
            $ipAddress,
            $userAgent
        ]);
        
        return true;
    } catch (PDOException $e) {
        error_log("Failed to log activity: " . $e->getMessage());
        // Don't throw - logging failures shouldn't break the app
        return false;
    }
}

/**
 * Log a system event (wrapper).
 *
 * Supports two call signatures used across the codebase:
 * 1) logSystemEvent($action, $message = '', $metadata = [])
 * 2) logSystemEvent($userId, $userType, $action, $message = '', $metadata = [])
 *
 * @return bool
 */
function logSystemEvent() {
    $args = func_get_args();
    $argc = count($args);

    $userId = null;
    $userType = 'system';
    $action = 'event';
    $message = '';
    $metadata = [];

    if ($argc <= 3) {
        $action = isset($args[0]) ? (string)$args[0] : 'event';
        $message = isset($args[1]) ? (string)$args[1] : '';
        $metadata = isset($args[2]) ? $args[2] : [];
    } else {
        $userId = $args[0] ?? null;
        $userType = isset($args[1]) ? (string)$args[1] : 'system';
        $action = isset($args[2]) ? (string)$args[2] : 'event';
        $message = isset($args[3]) ? (string)$args[3] : '';
        $metadata = isset($args[4]) ? $args[4] : [];
    }

    if (!in_array($userType, ['vendor', 'customer', 'admin', 'system'], true)) {
        $userType = 'system';
    }

    if (!is_array($metadata)) {
        $metadata = ['value' => $metadata];
    }

    return logActivity($userId, $userType, $action, $message, $metadata);
}

/**
 * Ensure system_logs table exists
 * This is called automatically when logging, but can also be called manually
 */
function ensureSystemLogsTable() {
    global $pdo;
    
    static $tableChecked = false;
    if ($tableChecked) {
        return; // Already checked in this request
    }
    
    try {
        // Check if table exists first
        $stmt = $pdo->query("SHOW TABLES LIKE 'system_logs'");
        if ($stmt->rowCount() > 0) {
            // Table exists - check if user_id allows NULL
            $stmt = $pdo->query("SHOW COLUMNS FROM system_logs WHERE Field = 'user_id'");
            $column = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($column && $column['Null'] === 'NO') {
                // Alter table to allow NULL user_id
                $pdo->exec("ALTER TABLE system_logs MODIFY user_id VARCHAR(36) DEFAULT NULL");
                error_log("Updated system_logs table to allow NULL user_id");
            }
            
            // Check if user_type enum includes 'system'
            $stmt = $pdo->query("SHOW COLUMNS FROM system_logs WHERE Field = 'user_type'");
            $column = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($column && strpos($column['Type'], "'system'") === false) {
                $pdo->exec("ALTER TABLE system_logs MODIFY user_type ENUM('vendor', 'customer', 'admin', 'system') NOT NULL");
                error_log("Updated system_logs table to include 'system' user type");
            }
            
            $tableChecked = true;
            return; // Table exists and is updated
        }
        
        // Create table if it doesn't exist - use utf8mb4_general_ci to match other tables
        $pdo->exec("
            CREATE TABLE system_logs (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) DEFAULT NULL,
                user_type ENUM('vendor', 'customer', 'admin', 'system') NOT NULL,
                action VARCHAR(100) NOT NULL,
                description TEXT NOT NULL,
                metadata JSON,
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at DATETIME NOT NULL,
                INDEX idx_user_id (user_id),
                INDEX idx_user_type (user_type),
                INDEX idx_action (action),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        ");
        
        $tableChecked = true;
        error_log("System logs table created successfully");
    } catch (PDOException $e) {
        // Table might already exist, ignore error
        if (strpos($e->getMessage(), 'already exists') === false && 
            strpos($e->getMessage(), "Duplicate key name") === false) {
            error_log("Error creating/updating system_logs table: " . $e->getMessage());
        }
        $tableChecked = true; // Mark as checked to avoid repeated attempts
    }
}

/**
 * Get user info for logging
 */
function getUserInfoForLog($userId) {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("
            SELECT 
                u.id,
                u.email,
                u.phone,
                u.full_name,
                u.role,
                CASE 
                    WHEN u.role = 'vendor' THEN v.farm_name
                    WHEN u.role = 'admin' THEN 'Admin'
                    ELSE u.full_name
                END as display_name
            FROM user_profiles u
            LEFT JOIN vendors v ON u.id = v.user_id AND u.role = 'vendor'
            WHERE u.id = ?
        ");
        $stmt->execute([$userId]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log("Error getting user info: " . $e->getMessage());
        return null;
    }
}

?>
