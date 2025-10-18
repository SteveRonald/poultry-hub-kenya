<?php
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/admin.php';

/**
 * Handle backup settings API requests
 */

function handleGetBackupSettings() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("SELECT setting_key, setting_value FROM backup_settings");
        $settings = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        echo json_encode([
            'success' => true,
            'settings' => $settings
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get backup settings: ' . $e->getMessage()]);
    }
}

function handleUpdateBackupSettings() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid settings data']);
        return;
    }
    
    try {
        $pdo->beginTransaction();
        
        foreach ($input as $key => $value) {
            // Validate setting keys
            $validKeys = [
                'auto_backup_enabled',
                'auto_backup_frequency',
                'auto_backup_time',
                'max_backups',
                'backup_retention_days',
                'backup_notifications'
            ];
            
            if (!in_array($key, $validKeys)) {
                throw new Exception("Invalid setting key: {$key}");
            }
            
            // Validate values
            switch ($key) {
                case 'auto_backup_enabled':
                case 'backup_notifications':
                    if (!in_array($value, ['0', '1'])) {
                        throw new Exception("Invalid value for {$key}: {$value}");
                    }
                    break;
                case 'auto_backup_frequency':
                    if (!in_array($value, ['hourly', 'daily', 'weekly', 'monthly'])) {
                        throw new Exception("Invalid frequency: {$value}");
                    }
                    break;
                case 'auto_backup_time':
                    if (!preg_match('/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/', $value)) {
                        throw new Exception("Invalid time format: {$value}");
                    }
                    break;
                case 'max_backups':
                case 'backup_retention_days':
                    if (!is_numeric($value) || $value < 1) {
                        throw new Exception("Invalid numeric value for {$key}: {$value}");
                    }
                    break;
            }
            
            $stmt = $pdo->prepare("
                INSERT INTO backup_settings (setting_key, setting_value) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->execute([$key, $value]);
        }
        
        $pdo->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Backup settings updated successfully'
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update settings: ' . $e->getMessage()]);
    }
}

function handleTestBackupConnection() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Test database connection
        $stmt = $pdo->query("SELECT 1");
        $dbTest = $stmt->fetch();
        
        // Test backup directory
        $backupDir = __DIR__ . '/../../backups';
        $dirTest = is_dir($backupDir) && is_writable($backupDir);
        
        // Test mysqldump availability
        $mysqldumpTest = false;
        $output = [];
        $returnCode = 0;
        exec('mysqldump --version', $output, $returnCode);
        $mysqldumpTest = ($returnCode === 0);
        
        // Test ZIP extension
        $zipTest = extension_loaded('zip');
        
        echo json_encode([
            'success' => true,
            'tests' => [
                'database_connection' => $dbTest ? 'OK' : 'FAILED',
                'backup_directory' => $dirTest ? 'OK' : 'FAILED',
                'mysqldump' => $mysqldumpTest ? 'OK' : 'FAILED',
                'zip_extension' => $zipTest ? 'OK' : 'FAILED'
            ],
            'all_tests_passed' => $dbTest && $dirTest && $mysqldumpTest && $zipTest
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Connection test failed: ' . $e->getMessage()]);
    }
}
?>
