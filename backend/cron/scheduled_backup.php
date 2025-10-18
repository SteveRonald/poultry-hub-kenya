<?php
/**
 * Scheduled backup script
 * This script should be run via cron job
 * Example cron entry: 0 2 * * * php /path/to/scheduled_backup.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/backup.php';

try {
    // Check if auto backup is enabled
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_backup_enabled'");
    $autoBackupEnabled = $stmt->fetchColumn();
    
    if (!$autoBackupEnabled || $autoBackupEnabled !== '1') {
        echo "Auto backup is disabled. Exiting.\n";
        exit(0);
    }
    
    // Get backup frequency
    $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'auto_backup_frequency'");
    $frequency = $stmt->fetchColumn() ?: 'daily';
    
    // Get last backup time
    $stmt = $pdo->query("
        SELECT MAX(created_at) as last_backup 
        FROM backup_logs 
        WHERE type = 'scheduled' AND status = 'success'
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
    
    // Create backup
    echo "Starting scheduled backup...\n";
    $backupManager = new BackupManager();
    $result = $backupManager->createSystemBackup('scheduled');
    
    if ($result['success']) {
        echo "✅ Scheduled backup completed successfully: {$result['filename']}\n";
        
        // Send notification if enabled
        $stmt = $pdo->query("SELECT setting_value FROM backup_settings WHERE setting_key = 'backup_notifications'");
        $notificationsEnabled = $stmt->fetchColumn();
        
        if ($notificationsEnabled === '1') {
            require_once __DIR__ . '/../utils/notifications.php';
            $message = "Scheduled backup completed successfully: {$result['filename']} (Size: " . round($result['size'] / (1024 * 1024), 2) . " MB)";
            notifyAllAdmins($message, 'backup');
        }
        
    } else {
        echo "❌ Scheduled backup failed: {$result['message']}\n";
        
        // Send error notification
        require_once __DIR__ . '/../utils/notifications.php';
        $message = "Scheduled backup failed: {$result['message']}";
        notifyAllAdmins($message, 'error');
        
        exit(1);
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
