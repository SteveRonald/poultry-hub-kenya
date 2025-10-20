<?php
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/../utils/windows_task_manager.php';

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
        // Core backup settings
        'auto_backup_frequency',
        'auto_backup_time',
        'max_backups',
        'backup_retention_days',
        'backup_notifications',
        
        // Specific backup type settings
        'auto_local_database',
        'auto_local_files',
        'auto_local_system',
        'auto_gdrive_database',
        'auto_gdrive_files',
        'auto_gdrive_system'
    ];
            
            if (!in_array($key, $validKeys)) {
                throw new Exception("Invalid setting key: {$key}");
            }
            
            // Validate values
            switch ($key) {
        case 'backup_notifications':
        case 'auto_local_database':
        case 'auto_local_files':
        case 'auto_local_system':
        case 'auto_gdrive_database':
        case 'auto_gdrive_files':
        case 'auto_gdrive_system':
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
        
        // Test mysqldump availability (use same logic as backup)
        $mysqldumpTest = false;
        $mysqldump = 'mysqldump';
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            // Windows - try XAMPP path first
            $xamppPaths = [
                'C:\\xampp\\mysql\\bin\\mysqldump.exe',
                'C:\\wamp\\bin\\mysql\\mysql8.0.21\\bin\\mysqldump.exe',
                'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64\\bin\\mysqldump.exe'
            ];
            
            foreach ($xamppPaths as $path) {
                if (file_exists($path)) {
                    $mysqldump = $path;
                    break;
                }
            }
        }
        
        // Test if mysqldump exists and is executable
        if (file_exists($mysqldump)) {
            $mysqldumpTest = true;
            error_log("mysqldump found at: {$mysqldump}");
        } else {
            // Try system PATH as fallback
            $output = [];
            $returnCode = 0;
            exec('mysqldump --version', $output, $returnCode);
            $mysqldumpTest = ($returnCode === 0);
            error_log("mysqldump test result: " . ($mysqldumpTest ? 'PASSED' : 'FAILED') . " (return code: {$returnCode})");
        }
        
        // Test ZIP extension
        $zipTest = extension_loaded('zip');
        if (!$zipTest) {
            error_log('ZIP extension not loaded. Available extensions: ' . implode(', ', get_loaded_extensions()));
        } else {
            error_log('ZIP extension is loaded successfully');
        }
        
        // Also test if ZipArchive class exists
        $zipArchiveTest = class_exists('ZipArchive');
        error_log('ZipArchive class exists: ' . ($zipArchiveTest ? 'YES' : 'NO'));
        
        // Test email configuration
        $emailTest = false;
        try {
            require_once __DIR__ . '/../config/email.php';
            $config = getEmailConfig();
            $emailTest = !empty($config['smtp']['username']) && !empty($config['smtp']['password']);
        } catch (Exception $e) {
            error_log('Email config test failed: ' . $e->getMessage());
        }
        
        echo json_encode([
            'success' => true,
            'tests' => [
                'database_connection' => $dbTest ? 'OK' : 'FAILED',
                'backup_directory' => $dirTest ? 'OK' : 'FAILED',
                'mysqldump' => $mysqldumpTest ? 'OK' : 'FAILED',
                'zip_extension' => $zipTest ? 'OK' : 'FAILED',
                'email_configuration' => $emailTest ? 'OK' : 'FAILED'
            ],
            'all_tests_passed' => $dbTest && $dirTest && $mysqldumpTest && $zipTest && $emailTest,
            'debug_info' => [
                'mysqldump_path' => $mysqldump,
                'email_config_loaded' => $emailTest,
                'zip_extension_loaded' => $zipTest,
                'ziparchive_class_exists' => $zipArchiveTest,
                'loaded_extensions' => get_loaded_extensions()
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Connection test failed: ' . $e->getMessage()]);
    }
}

function handleTestEmail() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        require_once __DIR__ . '/../utils/email_notifications.php';
        
        // Get admin email
        $stmt = $pdo->prepare("
            SELECT u.email 
            FROM user_profiles u 
            JOIN admins a ON u.id = a.user_id 
            WHERE a.is_active = 1 
            LIMIT 1
        ");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $adminEmail = $result ? $result['email'] : null;
        
        if (!$adminEmail) {
            echo json_encode(['success' => false, 'error' => 'No admin email found']);
            return;
        }
        
        // Send test email
        $emailNotifier = new EmailNotifications();
        $result = $emailNotifier->sendBackupNotification('database', 'success', [
            'filename' => 'test_backup.sql',
            'size' => '1.5 MB',
            'type' => 'Test'
        ]);
        
        echo json_encode([
            'success' => $result,
            'message' => $result ? 'Test email sent successfully' : 'Failed to send test email',
            'admin_email' => $adminEmail
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Test email failed: ' . $e->getMessage()]);
    }
}

function handleSetupWindowsTask() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        // Get backup time from settings
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_backup_time'");
        $backupTime = $stmt->fetchColumn() ?: '18:00';
        
        // Check if any automatic backups are enabled
        $localEnabled = false;
        $gdriveEnabled = false;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_database'");
        if ($stmt->fetchColumn() === '1') $localEnabled = true;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_files'");
        if ($stmt->fetchColumn() === '1') $localEnabled = true;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_system'");
        if ($stmt->fetchColumn() === '1') $localEnabled = true;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_database'");
        if ($stmt->fetchColumn() === '1') $gdriveEnabled = true;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_files'");
        if ($stmt->fetchColumn() === '1') $gdriveEnabled = true;
        
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_system'");
        if ($stmt->fetchColumn() === '1') $gdriveEnabled = true;
        
        if (!$localEnabled && !$gdriveEnabled) {
            echo json_encode([
                'success' => false,
                'error' => 'No automatic backups are enabled. Please enable at least one backup type.'
            ]);
            return;
        }
        
        // Create Windows Task
        $taskManager = new WindowsTaskManager();
        $result = $taskManager->createOrUpdateTask($backupTime);
        
        echo json_encode($result);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to setup Windows task: ' . $e->getMessage()]);
    }
}

function handleWindowsTaskStatus() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $taskManager = new WindowsTaskManager();
        $result = $taskManager->getTaskInfo();
        
        echo json_encode($result);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get task status: ' . $e->getMessage()]);
    }
}

function handleStopWindowsTask() {
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $taskManager = new WindowsTaskManager();
        $result = $taskManager->deleteTask();
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Windows Task Scheduler task removed successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'error' => 'Failed to remove task or task did not exist'
            ]);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to remove task: ' . $e->getMessage()]);
    }
}
?>
