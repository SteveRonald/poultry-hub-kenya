<?php
require_once __DIR__ . '/../config/database.php';

/**
 * Create a notification for a specific user
 */
function createNotification($userId, $message, $type = 'info') {
    global $pdo;
    
    try {
        $stmt = $pdo->prepare("INSERT INTO notifications (user_id, message, is_read, created_at) VALUES (?, ?, 0, NOW())");
        $stmt->execute([$userId, $message]);
        return true;
    } catch (PDOException $e) {
        error_log("Failed to create notification: " . $e->getMessage());
        return false;
    }
}

/**
 * Create notifications for all admins
 */
function notifyAllAdmins($message, $type = 'info') {
    global $pdo;
    
    try {
        // Get all admin users
        $stmt = $pdo->query("SELECT id FROM user_profiles WHERE role = 'admin'");
        $admins = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($admins as $admin) {
            createNotification($admin['id'], $message, $type);
        }
        
        return true;
    } catch (PDOException $e) {
        error_log("Failed to notify admins: " . $e->getMessage());
        return false;
    }
}

/**
 * Create notification for a specific vendor
 */
function notifyVendor($vendorId, $message, $type = 'info') {
    global $pdo;
    
    try {
        // Get user_id from vendor_id
        $stmt = $pdo->prepare("SELECT user_id FROM vendors WHERE id = ?");
        $stmt->execute([$vendorId]);
        $vendor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($vendor) {
            createNotification($vendor['user_id'], $message, $type);
            return true;
        }
        
        return false;
    } catch (PDOException $e) {
        error_log("Failed to notify vendor: " . $e->getMessage());
        return false;
    }
}

/**
 * Create notification for a specific user by user_id
 */
function notifyUser($userId, $message, $type = 'info') {
    return createNotification($userId, $message, $type);
}
?>
