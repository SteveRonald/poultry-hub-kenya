<?php
/**
 * System Settings API
 * Admin-only endpoints for managing system-wide settings
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/auth.php';

header('Content-Type: application/json');

// Get all system settings (Admin only)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['key'])) {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    try {
        // Check if table exists, create if not
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'system_settings'");
        if ($tableCheck->rowCount() === 0) {
            // Create table
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS system_settings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    setting_key VARCHAR(100) UNIQUE NOT NULL,
                    setting_value TEXT NOT NULL,
                    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
                    description TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_setting_key (setting_key)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");
            
            // Insert default settings
            $pdo->exec("
                INSERT IGNORE INTO system_settings (setting_key, setting_value, setting_type, description) VALUES
                ('delivery_fee', '100', 'number', 'Default delivery fee charged on all orders (in KSH)'),
                ('platform_commission_rate', '10', 'number', 'Platform commission percentage on vendor sales'),
                ('min_withdrawal_amount', '500', 'number', 'Minimum amount vendors can withdraw (in KSH)'),
                ('free_delivery_threshold', '5000', 'number', 'Order amount above which delivery is free (in KSH, 0 to disable)')
            ");
        }
        
        $stmt = $pdo->query("
            SELECT id, setting_key, setting_value, setting_type, description, updated_at 
            FROM system_settings 
            ORDER BY setting_key
        ");
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['success' => true, 'settings' => $settings]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch settings: ' . $e->getMessage()]);
    }
    exit;
}

// Get specific setting by key (Public - for delivery fee, etc.)
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['key'])) {
    $key = $_GET['key'];
    
    // Default values for common settings
    $defaults = [
        'delivery_fee' => ['value' => 100, 'type' => 'number'],
        'free_delivery_threshold' => ['value' => 5000, 'type' => 'number'],
        'platform_commission_rate' => ['value' => 10, 'type' => 'number'],
        'min_withdrawal_amount' => ['value' => 500, 'type' => 'number']
    ];
    
    try {
        // Check if table exists
        $tableCheck = $pdo->query("SHOW TABLES LIKE 'system_settings'");
        if ($tableCheck->rowCount() === 0) {
            // Table doesn't exist, return default value
            if (isset($defaults[$key])) {
                echo json_encode([
                    'success' => true, 
                    'key' => $key,
                    'value' => $defaults[$key]['value']
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Setting not found']);
            }
            exit;
        }
        
        $stmt = $pdo->prepare("
            SELECT setting_key, setting_value, setting_type 
            FROM system_settings 
            WHERE setting_key = ?
        ");
        $stmt->execute([$key]);
        $setting = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($setting) {
            // Convert value based on type
            $value = $setting['setting_value'];
            if ($setting['setting_type'] === 'number') {
                $value = floatval($value);
            } elseif ($setting['setting_type'] === 'boolean') {
                $value = filter_var($value, FILTER_VALIDATE_BOOLEAN);
            } elseif ($setting['setting_type'] === 'json') {
                $value = json_decode($value, true);
            }
            
            echo json_encode([
                'success' => true, 
                'key' => $setting['setting_key'],
                'value' => $value
            ]);
        } else {
            // Return default if available
            if (isset($defaults[$key])) {
                echo json_encode([
                    'success' => true, 
                    'key' => $key,
                    'value' => $defaults[$key]['value']
                ]);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Setting not found']);
            }
        }
    } catch (PDOException $e) {
        // Return default on error
        if (isset($defaults[$key])) {
            echo json_encode([
                'success' => true, 
                'key' => $key,
                'value' => $defaults[$key]['value']
            ]);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch setting']);
        }
    }
    exit;
}

// Update setting (Admin only)
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['setting_key']) || !isset($data['setting_value'])) {
        http_response_code(400);
        echo json_encode(['error' => 'setting_key and setting_value are required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("
            UPDATE system_settings 
            SET setting_value = ?, updated_at = NOW() 
            WHERE setting_key = ?
        ");
        $stmt->execute([
            $data['setting_value'],
            $data['setting_key']
        ]);
        
        if ($stmt->rowCount() > 0) {
            echo json_encode([
                'success' => true, 
                'message' => 'Setting updated successfully'
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Setting not found']);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update setting']);
    }
    exit;
}

// Create new setting (Admin only)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['setting_key']) || !isset($data['setting_value'])) {
        http_response_code(400);
        echo json_encode(['error' => 'setting_key and setting_value are required']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO system_settings (setting_key, setting_value, setting_type, description) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['setting_key'],
            $data['setting_value'],
            $data['setting_type'] ?? 'string',
            $data['description'] ?? null
        ]);
        
        echo json_encode([
            'success' => true, 
            'message' => 'Setting created successfully',
            'id' => $pdo->lastInsertId()
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            http_response_code(409);
            echo json_encode(['error' => 'Setting key already exists']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to create setting']);
        }
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
