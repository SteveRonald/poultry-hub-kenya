<?php
require_once __DIR__ . '/../config/database.php';

/**
 * Google Drive backup integration
 */
class GoogleDriveBackup {
    private $pdo;
    private $clientId;
    private $clientSecret;
    private $refreshToken;
    private $accessToken;
    private $backupFolderId;
    
    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
        
        // Get Google Drive credentials from environment variables
        $this->clientId = getenv('GOOGLE_DRIVE_CLIENT_ID');
        $this->clientSecret = getenv('GOOGLE_DRIVE_CLIENT_SECRET');
        $this->refreshToken = getenv('GOOGLE_DRIVE_REFRESH_TOKEN');
        $this->backupFolderId = getenv('GOOGLE_DRIVE_BACKUP_FOLDER_ID');
        error_log('Raw folder ID from env: ' . $this->backupFolderId);
        $this->backupFolderId = $this->normalizeFolderId($this->backupFolderId);
        error_log('Normalized folder ID: ' . $this->backupFolderId);
        
        if (!$this->clientId || !$this->clientSecret || !$this->refreshToken) {
            throw new Exception('Google Drive credentials not configured. Please set GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, and GOOGLE_DRIVE_REFRESH_TOKEN environment variables.');
        }
        
        // If backup folder ID is set, validate it first, otherwise create/find one
        if ($this->backupFolderId) {
            error_log('Validating existing backup folder ID: ' . $this->backupFolderId);
            // Validate that the existing folder ID is still valid
            if (!$this->validateFolderId($this->backupFolderId)) {
                error_log('Existing backup folder ID is invalid, will create/find new one');
                $this->backupFolderId = $this->getOrCreateBackupFolder();
            } else {
                error_log('Existing backup folder ID is valid, using it');
            }
        } else {
            error_log('No backup folder ID provided, creating/finding new one');
            $this->backupFolderId = $this->getOrCreateBackupFolder();
        }
        
        error_log('Final backup folder ID: ' . $this->backupFolderId);
    }
    
    /**
     * Upload a backup file to Google Drive
     */
    public function uploadBackup($filepath, $filename, $backupType = 'database') {
        try {
            // Get access token
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                throw new Exception('Failed to get Google Drive access token');
            }
            
            // Get or create subfolder based on backup type
            $subfolderId = $this->getOrCreateSubfolder($backupType);
            
            // Upload file to Google Drive
            $fileId = $this->uploadFile($filepath, $filename, $accessToken, $subfolderId);
            
            if ($fileId) {
                // Log the upload
                $this->logGoogleDriveUpload($filename, $fileId, 'success', 'File uploaded successfully');
                
                // Send email notification for successful Google Drive upload
                try {
                    require_once __DIR__ . '/email_notifications.php';
                    $emailNotifications = new EmailNotifications();
                    $emailNotifications->sendBackupNotification($backupType, 'success', [
                        'filename' => $filename,
                        'size' => file_exists($filepath) ? $this->formatBytes(filesize($filepath)) : 'Unknown',
                        'message' => 'Backup uploaded to Google Drive successfully',
                        'location' => 'Google Drive Cloud Storage'
                    ]);
                } catch (Exception $emailError) {
                    error_log('Failed to send Google Drive upload email notification: ' . $emailError->getMessage());
                }
                
                return [
                    'success' => true,
                    'message' => 'Backup uploaded to Google Drive successfully',
                    'file_id' => $fileId,
                    'filename' => $filename
                ];
            } else {
                throw new Exception('Failed to upload file to Google Drive');
            }
            
        } catch (Exception $e) {
            $this->logGoogleDriveUpload($filename, '', 'error', 'Upload failed: ' . $e->getMessage());
            
            // Send email notification for failed Google Drive upload
            try {
                require_once __DIR__ . '/email_notifications.php';
                $emailNotifications = new EmailNotifications();
                $emailNotifications->sendBackupNotification($backupType, 'error', [
                    'filename' => $filename,
                    'size' => file_exists($filepath) ? $this->formatBytes(filesize($filepath)) : 'Unknown',
                    'message' => 'Google Drive upload failed: ' . $e->getMessage(),
                    'location' => 'Google Drive Cloud Storage'
                ]);
            } catch (Exception $emailError) {
                error_log('Failed to send Google Drive upload error email notification: ' . $emailError->getMessage());
            }
            
            return [
                'success' => false,
                'message' => 'Google Drive upload failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * List files in Google Drive backup folder
     */
    public function listBackups() {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                throw new Exception('Failed to get Google Drive access token');
            }
            
            $files = $this->listDriveFiles($accessToken);
            
            return [
                'success' => true,
                'files' => $files
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to list Google Drive backups: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Delete a backup from Google Drive
     */
    public function deleteBackup($fileId) {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                throw new Exception('Failed to get Google Drive access token');
            }
            
            $success = $this->deleteDriveFile($fileId, $accessToken);
            
            if ($success) {
                $this->logGoogleDriveUpload('', $fileId, 'deleted', 'File deleted successfully');
                
                return [
                    'success' => true,
                    'message' => 'Backup deleted from Google Drive successfully'
                ];
            } else {
                throw new Exception('Failed to delete file from Google Drive');
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Google Drive delete failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Validate if a folder ID exists and is accessible
     */
    private function validateFolderId($folderId) {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                error_log('No access token available for folder validation');
                return false;
            }
            
            // SECURITY: Don't log access token even partially
            error_log("Validating folder ID: {$folderId}");
            
            $url = "https://www.googleapis.com/drive/v3/files/{$folderId}?fields=id,name,mimeType";
            
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json'
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            error_log("Folder validation response code: {$httpCode}");
            error_log("Folder validation response: " . $response);
            
            if ($httpCode === 200) {
                $data = json_decode($response, true);
                // Check if it's actually a folder
                $isValid = isset($data['mimeType']) && $data['mimeType'] === 'application/vnd.google-apps.folder';
                error_log("Folder is valid: " . ($isValid ? 'YES' : 'NO'));
                return $isValid;
            }
            
            error_log("Folder validation failed with HTTP code: {$httpCode}");
            return false;
        } catch (Exception $e) {
            error_log('Failed to validate folder ID: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Get or create subfolder based on backup type
     */
    private function getOrCreateSubfolder($backupType) {
        $subfolderName = $this->getSubfolderName($backupType);
        
        // Use the existing backup folder ID (not create a new one)
        $mainFolderId = $this->backupFolderId;
        
        error_log("Looking for subfolder '{$subfolderName}' in main folder '{$mainFolderId}'");
        
        // Check if subfolder already exists
        $existingSubfolder = $this->findFolderByName($subfolderName, $mainFolderId);
        if ($existingSubfolder) {
            error_log("Found existing subfolder: " . $existingSubfolder['id']);
            return $existingSubfolder['id'];
        }
        
        // Create the subfolder
        error_log("Creating new subfolder '{$subfolderName}' in main folder '{$mainFolderId}'");
        return $this->createSubfolder($subfolderName, $mainFolderId);
    }
    
    /**
     * Get subfolder name based on backup type
     */
    private function getSubfolderName($backupType) {
        switch ($backupType) {
            case 'database':
                return 'database';
            case 'files':
                return 'systemFiles';
            case 'system':
                return 'fullSystem';
            default:
                return 'database';
        }
    }
    
    /**
     * Find folder by name within a parent folder
     */
    private function findFolderByName($folderName, $parentId) {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            return null;
        }
        
        // Use proper URL encoding for the folder name
        $encodedFolderName = urlencode($folderName);
        $url = "https://www.googleapis.com/drive/v3/files?q=name%3D'{$encodedFolderName}'%20and%20parents%20in%20'{$parentId}'%20and%20mimeType%3D'application/vnd.google-apps.folder'%20and%20trashed%3Dfalse";
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $data = json_decode($response, true);
            if (!empty($data['files'])) {
                return $data['files'][0];
            }
        }
        
        return null;
    }
    
    /**
     * Create a subfolder within the main backup folder
     */
    private function createSubfolder($folderName, $parentId) {
        $accessToken = $this->getAccessToken();
        if (!$accessToken) {
            throw new Exception('Failed to get access token for creating subfolder');
        }
        
        $metadata = [
            'name' => $folderName,
            'mimeType' => 'application/vnd.google-apps.folder',
            'parents' => [$parentId]
        ];
        
        $url = 'https://www.googleapis.com/drive/v3/files';
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($metadata));
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200) {
            $data = json_decode($response, true);
            return $data['id'];
        } else {
            throw new Exception('Failed to create subfolder: ' . $response);
        }
    }

    /**
     * Get or create backup folder in Google Drive
     */
    public function getOrCreateBackupFolder() {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                throw new Exception('Failed to get access token');
            }
            
            // First, try to find existing backup folder
            $folderId = $this->findBackupFolder($accessToken);
            
            if (!$folderId) {
                // Create new backup folder
                $folderId = $this->createBackupFolder($accessToken);
            }
            
            return $folderId;
            
        } catch (Exception $e) {
            error_log('Failed to get or create backup folder: ' . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Get backup folder information
     */
    public function getBackupFolderInfo() {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                return [
                    'success' => false,
                    'message' => 'Failed to get access token'
                ];
            }
            
            if (!$this->backupFolderId) {
                return [
                    'success' => false,
                    'message' => 'No backup folder configured'
                ];
            }
            
            // Get folder information
            $url = 'https://www.googleapis.com/drive/v3/files/' . $this->backupFolderId . '?fields=id,name,createdTime,modifiedTime';
            
            $options = [
                'http' => [
                    'header' => 'Authorization: Bearer ' . $accessToken,
                    'method' => 'GET'
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($url, false, $context);
            
            if ($result === FALSE) {
                return [
                    'success' => false,
                    'message' => 'Failed to get folder information'
                ];
            }
            
            $response = json_decode($result, true);
            
            return [
                'success' => true,
                'folder' => $response
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to get backup folder info: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Normalize a Google Drive folder ID input. Accepts raw ID or a full URL.
     */
    private function normalizeFolderId($value) {
        if (!$value) {
            return null;
        }
        $value = trim($value);

        // If it's a full Drive URL like https://drive.google.com/drive/folders/{id}?usp=...
        if (strpos($value, 'drive.google.com') !== false) {
            // Try to extract from "/folders/{id}"
            if (preg_match('#/folders/([A-Za-z0-9_-]+)#', $value, $m)) {
                return $m[1];
            }
            // Some links may be in the form .../open?id={id}
            if (preg_match('#[?&]id=([A-Za-z0-9_-]+)#', $value, $m)) {
                return $m[1];
            }
            // As a last resort, strip query string and take last path segment
            $parts = parse_url($value);
            if (!empty($parts['path'])) {
                $segments = array_values(array_filter(explode('/', $parts['path'])));
                $candidate = end($segments);
                if ($candidate && preg_match('#^[A-Za-z0-9_-]{10,}$#', $candidate)) {
                    return $candidate;
                }
            }
            return null;
        }

        // If it looks like a valid Drive file/folder ID, accept it
        if (preg_match('#^[A-Za-z0-9_-]{10,}$#', $value)) {
            return $value;
        }

        return null;
    }
    
    /**
     * Test Google Drive connection
     */
    public function testConnection() {
        try {
            $accessToken = $this->getAccessToken();
            if (!$accessToken) {
                return [
                    'success' => false,
                    'message' => 'Failed to get access token. Please check your Google Drive credentials.'
                ];
            }
            
            // Test by listing files
            $files = $this->listDriveFiles($accessToken);
            
            return [
                'success' => true,
                'message' => 'Google Drive connection successful',
                'file_count' => count($files)
            ];
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Google Drive connection failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Private helper methods
     */
    private function getAccessToken() {
        try {
            $url = 'https://oauth2.googleapis.com/token';
            $data = [
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token'
            ];
            
            $options = [
                'http' => [
                    'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                    'method' => 'POST',
                    'content' => http_build_query($data)
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($url, false, $context);
            
            if ($result === FALSE) {
                return false;
            }
            
            $response = json_decode($result, true);
            return $response['access_token'] ?? false;
            
        } catch (Exception $e) {
            error_log('Google Drive token refresh failed: ' . $e->getMessage());
            return false;
        }
    }
    
    private function uploadFile($filepath, $filename, $accessToken, $parentId = null) {
        try {
            // Get file metadata
            $fileSize = filesize($filepath);
            $fileContent = file_get_contents($filepath);
            
            // Create upload session
            $uploadUrl = $this->createUploadSession($filename, $fileSize, $accessToken, $parentId);
            if (!$uploadUrl) {
                return false;
            }
            
            // Upload file content
            $options = [
                'http' => [
                    'header' => [
                        'Authorization: Bearer ' . $accessToken,
                        'Content-Length: ' . $fileSize,
                        'Content-Type: application/octet-stream'
                    ],
                    'method' => 'PATCH',
                    'content' => $fileContent
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($uploadUrl, false, $context);
            
            if ($result === FALSE) {
                return false;
            }
            
            $response = json_decode($result, true);
            return $response['id'] ?? false;
            
        } catch (Exception $e) {
            error_log('Google Drive file upload failed: ' . $e->getMessage());
            return false;
        }
    }
    
    private function createUploadSession($filename, $fileSize, $accessToken, $parentId = null) {
        try {
            $parentFolderId = $parentId ?: $this->backupFolderId;
            $metadata = [
                'name' => $filename,
                'parents' => [$parentFolderId] // Use the specified parent folder ID
            ];
            
            $options = [
                'http' => [
                    'header' => [
                        'Authorization: Bearer ' . $accessToken,
                        'Content-Type: application/json',
                        'X-Upload-Content-Type: application/octet-stream',
                        'X-Upload-Content-Length: ' . $fileSize
                    ],
                    'method' => 'POST',
                    'content' => json_encode($metadata)
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', false, $context);
            
            if ($result === FALSE) {
                return false;
            }
            
            // Extract upload URL from response headers
            $headers = $http_response_header ?? [];
            foreach ($headers as $header) {
                if (strpos($header, 'Location:') === 0) {
                    return trim(substr($header, 9));
                }
            }
            
            return false;
            
        } catch (Exception $e) {
            error_log('Google Drive upload session creation failed: ' . $e->getMessage());
            return false;
        }
    }
    
    private function listDriveFiles($accessToken) {
        try {
            $allFiles = [];
            
            // First, get files directly in the main backup folder
            $url = 'https://www.googleapis.com/drive/v3/files?q=parents%20in%20%22' . $this->backupFolderId . '%22&fields=files(id,name,size,createdTime,modifiedTime,mimeType,parents)';
            
            $options = [
                'http' => [
                    'header' => 'Authorization: Bearer ' . $accessToken,
                    'method' => 'GET'
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($url, false, $context);
            
            if ($result !== FALSE) {
                $response = json_decode($result, true);
                $files = $response['files'] ?? [];
                $allFiles = array_merge($allFiles, $files);
                error_log('Found ' . count($files) . ' files in main backup folder');
            }
            
            // Then, get subfolders and files in subfolders
            $subfolders = [];
            foreach ($allFiles as $file) {
                if ($file['mimeType'] === 'application/vnd.google-apps.folder') {
                    $subfolders[] = $file['id'];
                }
            }
            
            // Get files in each subfolder
            foreach ($subfolders as $subfolderId) {
                $subfolderUrl = 'https://www.googleapis.com/drive/v3/files?q=parents%20in%20%22' . $subfolderId . '%22&fields=files(id,name,size,createdTime,modifiedTime,mimeType,parents)';
                
                $context = stream_context_create($options);
                $result = file_get_contents($subfolderUrl, false, $context);
                
                if ($result !== FALSE) {
                    $response = json_decode($result, true);
                    $subfolderFiles = $response['files'] ?? [];
                    $allFiles = array_merge($allFiles, $subfolderFiles);
                    error_log('Found ' . count($subfolderFiles) . ' files in subfolder ' . $subfolderId);
                }
            }
            
            // Filter out folders and only return actual files
            $actualFiles = [];
            foreach ($allFiles as $file) {
                if ($file['mimeType'] !== 'application/vnd.google-apps.folder') {
                    // Format the file data for the frontend
                    $actualFiles[] = [
                        'id' => $file['id'],
                        'name' => $file['name'],
                        'size' => isset($file['size']) ? (int)$file['size'] : 0,
                        'createdTime' => $file['createdTime'],
                        'modifiedTime' => $file['modifiedTime']
                    ];
                }
            }
            
            error_log('Found ' . count($actualFiles) . ' actual files (excluding folders)');
            return $actualFiles;
            
        } catch (Exception $e) {
            error_log('Google Drive file listing failed: ' . $e->getMessage());
            return [];
        }
    }
    
    private function deleteDriveFile($fileId, $accessToken) {
        try {
            $url = 'https://www.googleapis.com/drive/v3/files/' . $fileId;
            
            $options = [
                'http' => [
                    'header' => 'Authorization: Bearer ' . $accessToken,
                    'method' => 'DELETE'
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($url, false, $context);
            
            return $result !== FALSE;
            
        } catch (Exception $e) {
            error_log('Google Drive file deletion failed: ' . $e->getMessage());
            return false;
        }
    }
    
    private function findBackupFolder($accessToken) {
        try {
            $url = 'https://www.googleapis.com/drive/v3/files?q=name%3D%22KukuSoko%20Backups%22%20and%20mimeType%3D%22application%2Fvnd.google-apps.folder%22&fields=files(id,name)';
            
            $options = [
                'http' => [
                    'header' => 'Authorization: Bearer ' . $accessToken,
                    'method' => 'GET'
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents($url, false, $context);
            
            if ($result === FALSE) {
                return null;
            }
            
            $response = json_decode($result, true);
            $files = $response['files'] ?? [];
            
            // Return the first folder found
            return !empty($files) ? $files[0]['id'] : null;
            
        } catch (Exception $e) {
            error_log('Failed to find backup folder: ' . $e->getMessage());
            return null;
        }
    }
    
    private function createBackupFolder($accessToken) {
        try {
            $metadata = [
                'name' => 'KukuSoko Backups',
                'mimeType' => 'application/vnd.google-apps.folder'
            ];
            
            $options = [
                'http' => [
                    'header' => [
                        'Authorization: Bearer ' . $accessToken,
                        'Content-Type: application/json'
                    ],
                    'method' => 'POST',
                    'content' => json_encode($metadata)
                ]
            ];
            
            $context = stream_context_create($options);
            $result = file_get_contents('https://www.googleapis.com/drive/v3/files', false, $context);
            
            if ($result === FALSE) {
                return null;
            }
            
            $response = json_decode($result, true);
            return $response['id'] ?? null;
            
        } catch (Exception $e) {
            error_log('Failed to create backup folder: ' . $e->getMessage());
            return null;
        }
    }
    
    private function logGoogleDriveUpload($filename, $fileId, $status, $message) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO google_drive_logs (filename, file_id, status, message, created_at) 
                VALUES (?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$filename, $fileId, $status, $message]);
        } catch (Exception $e) {
            error_log("Failed to log Google Drive upload: " . $e->getMessage());
        }
    }
    
    /**
     * Format bytes to human readable format
     */
    private function formatBytes($bytes, $precision = 2) {
        $units = array('B', 'KB', 'MB', 'GB', 'TB');
        
        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }
        
        return round($bytes, $precision) . ' ' . $units[$i];
    }
}
?>
