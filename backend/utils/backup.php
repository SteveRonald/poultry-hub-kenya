<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/email_notifications.php';

/**
 * Database backup utility
 */
class BackupManager {
    private $pdo;
    private $backupDir;
    private $maxBackups;
    
    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
        $this->backupDir = __DIR__ . '/../../backups';
        $this->maxBackups = 30; // Keep last 30 backups
        
        // Set timezone to Nairobi (UTC+3)
        date_default_timezone_set('Africa/Nairobi');
        
        // Create backup directory if it doesn't exist
        if (!is_dir($this->backupDir)) {
            mkdir($this->backupDir, 0755, true);
        }
    }
    
    /**
     * Create a complete database backup
     */
    public function createDatabaseBackup($type = 'manual') {
        try {
            $timestamp = date('Y-m-d_H-i-s');
            $filename = "db_backup_{$type}_{$timestamp}.sql";
            $filepath = $this->backupDir . '/' . $filename;
            
            // Get database configuration
            $host = getenv('DB_HOST') ?: 'localhost';
            $username = getenv('DB_USER') ?: 'root';
            $password = getenv('DB_PASSWORD') ?: '';
            $database = getenv('DB_NAME') ?: 'poultry marketplace';
            
            // Create mysqldump command
            // Try to find mysqldump in common locations
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
            
            // SECURITY: Use escapeshellarg() to prevent command injection
            $mysqldumpEscaped = escapeshellarg($mysqldump);
            $hostEscaped = escapeshellarg($host);
            $usernameEscaped = escapeshellarg($username);
            $databaseEscaped = escapeshellarg($database);
            $filepathEscaped = escapeshellarg($filepath);
            
            // Build command safely - password should be passed via .my.cnf or environment variable for security
            // Using -p without value will prompt, but we'll use environment variable approach
            $command = "{$mysqldumpEscaped} -h {$hostEscaped} -u {$usernameEscaped}";
            
            // SECURITY: Use environment variable for password instead of command line
            // Password in command line can be visible in process list
            $env = $_ENV;
            if (!empty($password)) {
                // Set password via environment variable (more secure)
                putenv("MYSQL_PWD=" . $password);
            }
            $command .= " {$databaseEscaped} > {$filepathEscaped} 2>&1";
            
            // Execute backup
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);
            
            // Clear password from environment after use
            if (!empty($password)) {
                putenv("MYSQL_PWD");
            }
            
            if ($returnCode === 0 && file_exists($filepath)) {
                // Compress the backup
                $this->compressBackup($filepath);
                
                // Clean old backups
                $this->cleanOldBackups();
                
                // Log the backup
                $this->logBackup($filename, $type, 'success', 'Database backup completed successfully');
                
                // Send email notification
                $emailNotifier = new EmailNotifications();
                $emailNotifier->sendBackupNotification('database', 'success', [
                    'filename' => $filename,
                    'size' => $this->formatBytes(filesize($filepath)),
                    'type' => ucfirst($type)
                ]);
                
                return [
                    'success' => true,
                    'message' => 'Database backup created successfully',
                    'filename' => $filename,
                    'filepath' => $filepath,
                    'size' => filesize($filepath)
                ];
            } else {
                $this->logBackup($filename, $type, 'error', 'Failed to create database backup');
                
                // Send email notification for failure
                $emailNotifier = new EmailNotifications();
                $emailNotifier->sendBackupNotification('database', 'error', [
                    'type' => ucfirst($type),
                    'error' => 'Failed to create database backup'
                ]);
                
                return [
                    'success' => false,
                    'message' => 'Failed to create database backup'
                ];
            }
            
        } catch (Exception $e) {
            $this->logBackup('', $type, 'error', 'Exception: ' . $e->getMessage());
            
            // Send email notification for exception
            $emailNotifier = new EmailNotifications();
            $emailNotifier->sendBackupNotification('database', 'error', [
                'type' => ucfirst($type),
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'message' => 'Backup failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Create a file backup (uploads, images, etc.)
     */
    public function createFileBackup($type = 'manual') {
        try {
            // Check if ZIP extension is available
            if (!extension_loaded('zip') || !class_exists('ZipArchive')) {
                throw new Exception('ZIP extension is not available. Please enable the ZIP extension in PHP.');
            }
            
            $timestamp = date('Y-m-d_H-i-s');
            $filename = "files_backup_{$type}_{$timestamp}.zip";
            $filepath = $this->backupDir . '/' . $filename;
            
            // Directories to backup
            $directories = [
                'uploads' => __DIR__ . '/../../uploads',
                'public' => __DIR__ . '/../../public',
                'src' => __DIR__ . '/../../src'
            ];
            
            // Create ZIP archive
            $zip = new ZipArchive();
            if ($zip->open($filepath, ZipArchive::CREATE) !== TRUE) {
                throw new Exception('Cannot create ZIP file');
            }
            
            foreach ($directories as $name => $dir) {
                if (is_dir($dir)) {
                    $this->addDirectoryToZip($zip, $dir, $name);
                }
            }
            
            $zip->close();
            
            // Clean old backups
            $this->cleanOldBackups();
            
            // Log the backup
            $this->logBackup($filename, $type, 'success', 'File backup completed successfully');
            
            // Send email notification
            $emailNotifier = new EmailNotifications();
            $emailNotifier->sendBackupNotification('files', 'success', [
                'filename' => $filename,
                'size' => $this->formatBytes(filesize($filepath)),
                'type' => ucfirst($type)
            ]);
            
            return [
                'success' => true,
                'message' => 'File backup created successfully',
                'filename' => $filename,
                'filepath' => $filepath,
                'size' => filesize($filepath)
            ];
            
        } catch (Exception $e) {
            $this->logBackup('', $type, 'error', 'Exception: ' . $e->getMessage());
            
            // Send email notification for exception
            $emailNotifier = new EmailNotifications();
            $emailNotifier->sendBackupNotification('files', 'error', [
                'type' => ucfirst($type),
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'message' => 'File backup failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Create a complete system backup (database + files)
     */
    public function createSystemBackup($type = 'manual') {
        try {
            // Check if ZIP extension is available
            if (!extension_loaded('zip') || !class_exists('ZipArchive')) {
                throw new Exception('ZIP extension is not available. Please enable the ZIP extension in PHP.');
            }
            
            $timestamp = date('Y-m-d_H-i-s');
            $filename = "system_backup_{$type}_{$timestamp}.zip";
            $filepath = $this->backupDir . '/' . $filename;
            
            // Create database backup first
            $dbBackup = $this->createDatabaseBackup($type);
            if (!$dbBackup['success']) {
                throw new Exception('Database backup failed: ' . $dbBackup['message']);
            }
            
            // Create ZIP archive
            $zip = new ZipArchive();
            if ($zip->open($filepath, ZipArchive::CREATE) !== TRUE) {
                throw new Exception('Cannot create ZIP file');
            }
            
            // Add database backup to ZIP
            $zip->addFile($dbBackup['filepath'], 'database/' . basename($dbBackup['filepath']));
            
            // Add files to ZIP
            $directories = [
                'uploads' => __DIR__ . '/../../uploads',
                'public' => __DIR__ . '/../../public',
                'src' => __DIR__ . '/../../src',
                'backend' => __DIR__ . '/../..'
            ];
            
            foreach ($directories as $name => $dir) {
                if (is_dir($dir)) {
                    $this->addDirectoryToZip($zip, $dir, $name);
                }
            }
            
            $zip->close();
            
            // Remove individual database backup file
            if (file_exists($dbBackup['filepath'])) {
                unlink($dbBackup['filepath']);
            }
            
            // Clean old backups
            $this->cleanOldBackups();
            
            // Log the backup
            $this->logBackup($filename, $type, 'success', 'System backup completed successfully');
            
            // Send email notification
            $emailNotifier = new EmailNotifications();
            $emailNotifier->sendBackupNotification('system', 'success', [
                'filename' => $filename,
                'size' => $this->formatBytes(filesize($filepath)),
                'type' => ucfirst($type)
            ]);
            
            return [
                'success' => true,
                'message' => 'System backup created successfully',
                'filename' => $filename,
                'filepath' => $filepath,
                'size' => filesize($filepath)
            ];
            
        } catch (Exception $e) {
            $this->logBackup('', $type, 'error', 'Exception: ' . $e->getMessage());
            
            // Send email notification for exception
            $emailNotifier = new EmailNotifications();
            $emailNotifier->sendBackupNotification('system', 'error', [
                'type' => ucfirst($type),
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'message' => 'System backup failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * List all available backups
     */
    public function listBackups() {
        try {
            $backups = [];
            $files = glob($this->backupDir . '/*.{sql,zip}', GLOB_BRACE);
            
            foreach ($files as $file) {
                $backups[] = [
                    'filename' => basename($file),
                    'filepath' => $file,
                    'size' => filesize($file),
                    'created' => date('Y-m-d H:i:s', filemtime($file)),
                    'type' => $this->getBackupType($file)
                ];
            }
            
            // Sort by creation time (newest first)
            usort($backups, function($a, $b) {
                return strtotime($b['created']) - strtotime($a['created']);
            });
            
            return $backups;
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to list backups: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Download a backup file
     */
    public function downloadBackup($filename) {
        try {
            $filepath = $this->backupDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Backup file not found');
            }
            
            // Set headers for download
            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . filesize($filepath));
            header('Cache-Control: must-revalidate');
            header('Pragma: public');
            
            // Output file
            readfile($filepath);
            exit;
            
        } catch (Exception $e) {
            http_response_code(404);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
    
    /**
     * Delete a backup file
     */
    public function deleteBackup($filename) {
        try {
            $filepath = $this->backupDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Backup file not found');
            }
            
            if (unlink($filepath)) {
                $this->logBackup($filename, 'manual', 'deleted', 'Backup file deleted');
                return [
                    'success' => true,
                    'message' => 'Backup deleted successfully'
                ];
            } else {
                throw new Exception('Failed to delete backup file');
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Failed to delete backup: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Restore from backup
     */
    public function restoreFromBackup($filename, $type = 'database') {
        try {
            $filepath = $this->backupDir . '/' . $filename;
            
            if (!file_exists($filepath)) {
                throw new Exception('Backup file not found');
            }
            
            if ($type === 'database') {
                return $this->restoreDatabase($filepath);
            } elseif ($type === 'files') {
                return $this->restoreFiles($filepath);
            } else {
                throw new Exception('Invalid restore type');
            }
            
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Restore failed: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Private helper methods
     */
    private function addDirectoryToZip($zip, $dir, $zipDir = '') {
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
        
        foreach ($files as $name => $file) {
            if (!$file->isDir()) {
                $filePath = $file->getRealPath();
                $relativePath = $zipDir . '/' . substr($filePath, strlen($dir) + 1);
                $zip->addFile($filePath, $relativePath);
            }
        }
    }
    
    private function compressBackup($filepath) {
        // If the file is already compressed or small, skip compression
        if (filesize($filepath) < 1024 * 1024) { // Less than 1MB
            return;
        }
        
        $compressedPath = $filepath . '.gz';
        $fp_in = fopen($filepath, 'rb');
        $fp_out = gzopen($compressedPath, 'wb9');
        
        if ($fp_in && $fp_out) {
            while (!feof($fp_in)) {
                gzwrite($fp_out, fread($fp_in, 1024 * 512));
            }
            fclose($fp_in);
            gzclose($fp_out);
            
            // Remove original file
            unlink($filepath);
        }
    }
    
    private function cleanOldBackups() {
        $files = glob($this->backupDir . '/*.{sql,zip}', GLOB_BRACE);
        
        if (count($files) <= $this->maxBackups) {
            return;
        }
        
        // Sort by modification time
        usort($files, function($a, $b) {
            return filemtime($a) - filemtime($b);
        });
        
        // Remove oldest files
        $filesToRemove = array_slice($files, 0, count($files) - $this->maxBackups);
        foreach ($filesToRemove as $file) {
            unlink($file);
        }
    }
    
    private function logBackup($filename, $type, $status, $message) {
        try {
            $stmt = $this->pdo->prepare("
                INSERT INTO backup_logs (file_name, type, created_at) 
                VALUES (?, ?, NOW())
            ");
            $stmt->execute([$filename, $type]);
        } catch (Exception $e) {
            error_log("Failed to log backup: " . $e->getMessage());
        }
    }
    
    private function getBackupType($filepath) {
        $filename = basename($filepath);
        if (strpos($filename, 'system_backup') === 0) {
            return 'system';
        } elseif (strpos($filename, 'db_backup') === 0) {
            return 'database';
        } elseif (strpos($filename, 'files_backup') === 0) {
            return 'files';
        }
        return 'unknown';
    }
    
    private function restoreDatabase($filepath) {
        // Implementation for database restore
        // This is a complex operation that should be done carefully
        throw new Exception('Database restore not implemented yet');
    }
    
    private function restoreFiles($filepath) {
        // Implementation for file restore
        // This is a complex operation that should be done carefully
        throw new Exception('File restore not implemented yet');
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
