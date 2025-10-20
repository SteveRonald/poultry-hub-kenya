<?php
/**
 * Scheduled backup script
 * This script should be run via cron job
 * Example cron entry: 0 2 * * * php /path/to/scheduled_backup.php
 */

// Set timezone to Nairobi (UTC+3)
date_default_timezone_set('Africa/Nairobi');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/backup.php';
require_once __DIR__ . '/../utils/google_drive_backup.php';

try {
    // Check which local backup types are enabled (new specific settings)
    $localBackupTypes = [];
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_database'");
    if ($stmt->fetchColumn() === '1') {
        $localBackupTypes[] = 'database';
    }
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_files'");
    if ($stmt->fetchColumn() === '1') {
        $localBackupTypes[] = 'files';
    }
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_local_system'");
    if ($stmt->fetchColumn() === '1') {
        $localBackupTypes[] = 'system';
    }
    
    // Check which Google Drive upload types are enabled (new specific settings)
    $gdriveUploadTypes = [];
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_database'");
    if ($stmt->fetchColumn() === '1') {
        $gdriveUploadTypes[] = 'database';
    }
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_files'");
    if ($stmt->fetchColumn() === '1') {
        $gdriveUploadTypes[] = 'files';
    }
    
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_gdrive_system'");
    if ($stmt->fetchColumn() === '1') {
        $gdriveUploadTypes[] = 'system';
    }
    
    // Note: Legacy settings have been removed in favor of specific backup type settings
    
    if (empty($localBackupTypes) && empty($gdriveUploadTypes)) {
        echo "No backup types are enabled for automatic backup. Exiting.\n";
        exit(0);
    }
    
    // Get backup frequency
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_backup_frequency'");
    $frequency = $stmt->fetchColumn() ?: 'daily';
    
    // Get last backup time
    $stmt = $pdo->query("
        SELECT MAX(created_at) as last_backup 
        FROM backup_logs 
        WHERE type = 'scheduled'
    ");
    $lastBackup = $stmt->fetchColumn();
    
    // Check if backup is needed
    $backupNeeded = false;
    $now = new DateTime();
    
    if (!$lastBackup) {
        // No previous backup, create one
        $backupNeeded = true;
    } else {
        $lastBackupTime = new DateTime($lastBackup);
        $interval = $now->diff($lastBackupTime);
        
        switch ($frequency) {
            case 'hourly':
                $backupNeeded = $interval->h >= 1;
                break;
            case 'daily':
                $backupNeeded = $interval->days >= 1;
                break;
            case 'weekly':
                $backupNeeded = $interval->days >= 7;
                break;
            case 'monthly':
                $backupNeeded = $interval->m >= 1;
                break;
            default:
                $backupNeeded = $interval->days >= 1;
                break;
        }
    }
    
    if (!$backupNeeded) {
        echo "Backup not needed at this time. Last backup: {$lastBackup}\n";
        exit(0);
    }
    
    // Create local backups for each enabled type
    echo "Starting scheduled backup...\n";
    $backupManager = new BackupManager();
    $results = [];
    
    // Process local backups
    foreach ($localBackupTypes as $backupType) {
        echo "Creating local {$backupType} backup...\n";
        
        switch ($backupType) {
            case 'database':
                $result = $backupManager->createDatabaseBackup('scheduled');
                break;
            case 'files':
                $result = $backupManager->createFileBackup('scheduled');
                break;
            case 'system':
                $result = $backupManager->createSystemBackup('scheduled');
                break;
            default:
                echo "Unknown backup type: {$backupType}\n";
                continue 2;
        }
        
        $results[$backupType] = $result;
        
        if ($result['success']) {
            echo "✅ {$backupType} backup completed successfully: {$result['filename']}\n";
        } else {
            echo "❌ {$backupType} backup failed: {$result['message']}\n";
        }
    }
    
    // Upload to Google Drive for enabled types
    if (!empty($gdriveUploadTypes)) {
        echo "📤 Uploading backups to Google Drive...\n";
        try {
            $googleDriveBackup = new GoogleDriveBackup();
            
            foreach ($results as $backupType => $result) {
                // Only upload if this backup type is enabled for Google Drive
                if ($result['success'] && in_array($backupType, $gdriveUploadTypes)) {
                    echo "Uploading {$backupType} backup to Google Drive...\n";
                    $uploadResult = $googleDriveBackup->uploadBackup($result['filepath'], $result['filename'], $backupType);
                    
                    if ($uploadResult['success']) {
                        echo "✅ {$backupType} backup uploaded to Google Drive successfully\n";
                    } else {
                        echo "❌ {$backupType} backup Google Drive upload failed: {$uploadResult['message']}\n";
                    }
                } elseif ($result['success']) {
                    echo "ℹ️ {$backupType} backup created locally but Google Drive upload not enabled for this type\n";
                }
            }
        } catch (Exception $e) {
            echo "❌ Google Drive upload error: {$e->getMessage()}\n";
        }
    }
    
    // Summary
    $successCount = count(array_filter($results, function($result) { return $result['success']; }));
    $totalCount = count($results);
    
    if ($successCount === $totalCount) {
        echo "✅ All scheduled backups completed successfully ({$successCount}/{$totalCount})\n";
    } else {
        echo "⚠️  Scheduled backup completed with some failures ({$successCount}/{$totalCount} successful)\n";
    }
    
} catch (Exception $e) {
    echo "❌ Scheduled backup error: " . $e->getMessage() . "\n";
    
    // Send error notification
    try {
        require_once __DIR__ . '/../utils/notifications.php';
        $message = "Scheduled backup error: " . $e->getMessage();
        notifyAllAdmins($message, 'error');
    } catch (Exception $notificationError) {
        echo "Failed to send notification: " . $notificationError->getMessage() . "\n";
    }
    
    exit(1);
}
?>
