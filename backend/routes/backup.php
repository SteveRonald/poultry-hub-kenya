<?php
require_once __DIR__ . '/../utils/backup.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/admin.php';

/**
 * Handle backup API requests
 */

// Local helper to robustly extract Bearer token for backup routes only
function getBackupBearerToken() {
    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    }
    if ((!$headers || count($headers) === 0) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
    }

    // Try common header locations/case variants
    $candidates = [
        'Authorization' => null,
        'authorization' => null,
    ];

    foreach ($candidates as $key => $_) {
        if (isset($headers[$key])) {
            $auth = $headers[$key];
            if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
                return $matches[1];
            }
        }
    }

    // Fallback to server var sometimes set by web servers
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
            return $matches[1];
        }
    }

    // Final fallback: allow explicit token query for this route only
    if (isset($_GET['token']) && is_string($_GET['token']) && $_GET['token'] !== '') {
        return $_GET['token'];
    }

    return null;
}

function handleCreateBackup() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $backupType = $input['type'] ?? 'system'; // system, database, files
    $triggerType = $input['trigger'] ?? 'manual'; // manual, scheduled
    
    try {
        $backupManager = new BackupManager();
        
        switch ($backupType) {
            case 'database':
                $result = $backupManager->createDatabaseBackup($triggerType);
                break;
            case 'files':
                $result = $backupManager->createFileBackup($triggerType);
                break;
            case 'system':
            default:
                $result = $backupManager->createSystemBackup($triggerType);
                break;
        }
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Backup failed: ' . $e->getMessage()]);
    }
}

function handleListBackups() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $backupManager = new BackupManager();
        $backups = $backupManager->listBackups();
        
        echo json_encode([
            'success' => true,
            'backups' => $backups
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to list backups: ' . $e->getMessage()]);
    }
}

function handleDownloadBackup() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $filename = $_GET['filename'] ?? null;
    
    if (!$filename) {
        http_response_code(400);
        echo json_encode(['error' => 'Filename is required']);
        return;
    }
    
    // Validate filename to prevent directory traversal
    if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        return;
    }
    
    try {
        $backupManager = new BackupManager();
        $backupManager->downloadBackup($filename);
        
    } catch (Exception $e) {
        http_response_code(404);
        echo json_encode(['error' => $e->getMessage()]);
    }
}

function handleDeleteBackup() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $filename = $input['filename'] ?? null;
    
    if (!$filename) {
        http_response_code(400);
        echo json_encode(['error' => 'Filename is required']);
        return;
    }
    
    // Validate filename to prevent directory traversal
    if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        return;
    }
    
    try {
        $backupManager = new BackupManager();
        $result = $backupManager->deleteBackup($filename);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete backup: ' . $e->getMessage()]);
    }
}

function handleBackupStatus() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $backupManager = new BackupManager();
        $backups = $backupManager->listBackups();
        
        // Calculate backup statistics
        $totalBackups = count($backups);
        $totalSize = 0;
        $backupTypes = [];
        
        foreach ($backups as $backup) {
            $totalSize += $backup['size'];
            $type = $backup['type'];
            $backupTypes[$type] = ($backupTypes[$type] ?? 0) + 1;
        }
        
        // Get backup directory info
        $backupDir = __DIR__ . '/../../backups';
        $diskSpace = disk_free_space($backupDir);
        $diskTotal = disk_total_space($backupDir);
        
        echo json_encode([
            'success' => true,
            'status' => [
                'total_backups' => $totalBackups,
                'total_size' => $totalSize,
                'total_size_mb' => round($totalSize / (1024 * 1024), 2),
                'backup_types' => $backupTypes,
                'disk_free' => $diskSpace,
                'disk_free_mb' => round($diskSpace / (1024 * 1024), 2),
                'disk_total' => $diskTotal,
                'disk_total_mb' => round($diskTotal / (1024 * 1024), 2),
                'disk_usage_percent' => round((($diskTotal - $diskSpace) / $diskTotal) * 100, 2)
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get backup status: ' . $e->getMessage()]);
    }
}

function handleRestoreBackup() {
    global $pdo;
    
    $token = getBackupBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $filename = $input['filename'] ?? null;
    $restoreType = $input['restore_type'] ?? 'database';
    
    if (!$filename) {
        http_response_code(400);
        echo json_encode(['error' => 'Filename is required']);
        return;
    }
    
    // Validate filename to prevent directory traversal
    if (strpos($filename, '..') !== false || strpos($filename, '/') !== false) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid filename']);
        return;
    }
    
    try {
        $backupManager = new BackupManager();
        $result = $backupManager->restoreFromBackup($filename, $restoreType);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Restore failed: ' . $e->getMessage()]);
    }
}

function handleBackupLogs() {
    global $pdo;
    
    $token = getBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT * FROM backup_logs 
            ORDER BY created_at DESC 
            LIMIT 100
        ");
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode([
            'success' => true,
            'logs' => $logs
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get backup logs: ' . $e->getMessage()]);
    }
}
?>
