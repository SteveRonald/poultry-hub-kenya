<?php
require_once __DIR__ . '/../utils/google_drive_backup.php';
require_once __DIR__ . '/../utils/auth.php';
require_once __DIR__ . '/admin.php';

/**
 * Handle Google Drive backup API requests
 */

// Local helper to robustly extract Bearer token for Google Drive backup routes only
function getGDBearerToken() {
    $headers = [];
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
    }
    if ((!$headers || count($headers) === 0) && function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
    }

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

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Bearer\s(\S+)/', $auth, $matches)) {
            return $matches[1];
        }
    }

    // SECURITY: Validate and sanitize token from GET parameter
    if (isset($_GET['token']) && is_string($_GET['token'])) {
        $token = filter_var($_GET['token'], FILTER_SANITIZE_STRING);
        // Validate token format (alphanumeric, base64-like, or UUID) and reasonable length
        if (preg_match('/^[a-zA-Z0-9._-]+$/', $token) && strlen($token) > 10 && strlen($token) < 2000) {
            return $token;
        }
    }

    return null;
}

function handleGoogleDriveUpload() {
    global $pdo;
    
    $token = getGDBearerToken();
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
        $googleDriveBackup = new GoogleDriveBackup();
        $filepath = __DIR__ . '/../../backups/' . $filename;
        
        if (!file_exists($filepath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Backup file not found']);
            return;
        }
        
        $backupType = $_POST['backup_type'] ?? 'database';
        $result = $googleDriveBackup->uploadBackup($filepath, $filename, $backupType);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Google Drive upload failed: ' . $e->getMessage()]);
    }
}

function handleGoogleDriveList() {
    global $pdo;
    
    error_log('Google Drive list API called');
    
    $token = getGDBearerToken();
    if (!$token || !validateAdminSession($token)) {
        error_log('Google Drive list: Unauthorized access attempt');
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    error_log('Google Drive list: Admin session validated successfully');
    
    try {
        error_log('Google Drive list: Creating GoogleDriveBackup object');
        $googleDriveBackup = new GoogleDriveBackup();
        
        error_log('Google Drive list: Calling listBackups method');
        $result = $googleDriveBackup->listBackups();
        
        error_log('Google Drive list: listBackups completed, success: ' . ($result['success'] ? 'true' : 'false'));
        
        if ($result['success']) {
            error_log('Google Drive list: Returning success response with ' . count($result['files']) . ' files');
            echo json_encode($result);
        } else {
            error_log('Google Drive list: Returning error response: ' . $result['message']);
            http_response_code(500);
            echo json_encode($result);
        }
    } catch (Exception $e) {
        error_log('Google Drive list exception: ' . $e->getMessage());
        error_log('Google Drive list stack trace: ' . $e->getTraceAsString());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to list Google Drive backups: ' . $e->getMessage()]);
    }
}

function handleGoogleDriveDelete() {
    global $pdo;
    
    $token = getGDBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    $fileId = $input['file_id'] ?? ($_GET['file_id'] ?? null);
    
    // SECURITY: Validate and sanitize file ID to prevent injection
    if ($fileId) {
        $fileId = filter_var($fileId, FILTER_SANITIZE_STRING);
        // Validate file ID format (Google Drive file IDs are alphanumeric)
        if (!preg_match('/^[a-zA-Z0-9_-]+$/', $fileId) || strlen($fileId) > 100) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file ID format']);
            return;
        }
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'File ID is required']);
        return;
    }
    
    try {
        $googleDriveBackup = new GoogleDriveBackup();
        $result = $googleDriveBackup->deleteBackup($fileId);
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete Google Drive backup', 'details' => $e->getMessage()]);
    }
}

function handleGoogleDriveTest() {
    global $pdo;
    
    $token = getGDBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $googleDriveBackup = new GoogleDriveBackup();
        $result = $googleDriveBackup->testConnection();
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Google Drive connection test failed: ' . $e->getMessage()]);
    }
}

function handleGoogleDriveLogs() {
    global $pdo;
    
    $token = getGDBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $stmt = $pdo->query("
            SELECT * FROM google_drive_logs 
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
        echo json_encode(['error' => 'Failed to get Google Drive logs: ' . $e->getMessage()]);
    }
}

function handleGoogleDriveFolderInfo() {
    global $pdo;
    
    $token = getGDBearerToken();
    if (!$token || !validateAdminSession($token)) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        return;
    }
    
    try {
        $googleDriveBackup = new GoogleDriveBackup();
        $result = $googleDriveBackup->getBackupFolderInfo();
        
        if ($result['success']) {
            echo json_encode($result);
        } else {
            http_response_code(500);
            echo json_encode($result);
        }
    } catch (Exception $e) {
        error_log('Google Drive folder info error: ' . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to get folder info: ' . $e->getMessage()]);
    }
}
?>
