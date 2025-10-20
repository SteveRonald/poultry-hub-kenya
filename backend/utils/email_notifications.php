<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/email.php';

/**
 * Email notification utility for backup operations
 */
class EmailNotifications {
    private $pdo;
    
    public function __construct() {
        global $pdo;
        $this->pdo = $pdo;
    }
    
    /**
     * Send backup notification email to admin
     */
    public function sendBackupNotification($backupType, $status, $details = []) {
        try {
            error_log("=== BACKUP EMAIL NOTIFICATION START ===");
            error_log("Backup type: {$backupType}, Status: {$status}");
            error_log("Details: " . json_encode($details));
            
            // Get admin email
            $adminEmail = $this->getAdminEmail();
            if (!$adminEmail) {
                error_log('No admin email found for backup notifications');
                return false;
            }
            
            // Prepare email data for template
            $data = [
                'backup_type' => $backupType,
                'status' => $status,
                'details' => $details
            ];
            
            error_log("Email data prepared: " . json_encode($data));
            
            // Use the existing styled email system
            error_log("Attempting to send email to: {$adminEmail}");
            $result = sendStyledEmail($adminEmail, 'backup_notification', $data);
            error_log("Email send result: " . ($result ? 'SUCCESS' : 'FAILED'));
            error_log("=== BACKUP EMAIL NOTIFICATION END ===");
            
            return $result;
            
        } catch (Exception $e) {
            error_log('Failed to send backup notification email: ' . $e->getMessage());
            error_log('Stack trace: ' . $e->getTraceAsString());
            return false;
        }
    }
    
    /**
     * Get admin email address
     */
    private function getAdminEmail() {
        try {
            // Get admin email from user_profiles table where role = 'admin'
            $stmt = $this->pdo->prepare("
                SELECT email, full_name
                FROM user_profiles 
                WHERE role = 'admin' AND account_status = 'active'
                LIMIT 1
            ");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $email = $result ? $result['email'] : null;
            $name = $result ? $result['full_name'] : null;
            
            error_log('Admin found: ' . ($name ?: 'NONE') . ' (' . ($email ?: 'NO EMAIL') . ')');
            
            return $email;
        } catch (Exception $e) {
            error_log('Failed to get admin email: ' . $e->getMessage());
            return null;
        }
    }
}
