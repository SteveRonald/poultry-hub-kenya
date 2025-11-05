<?php
/**
 * Scheduled task to automatically expire advertisements
 * Run this via cron job or Windows Task Scheduler
 * 
 * Recommended: Run every hour
 */

require_once __DIR__ . '/../config/database.php';

try {
    // Update advertisements that have passed their end_date
    $stmt = $pdo->prepare("
        UPDATE advertisements 
        SET status = 'expired'
        WHERE status = 'active' 
        AND end_date IS NOT NULL 
        AND end_date < NOW()
    ");
    
    $stmt->execute();
    $expiredCount = $stmt->rowCount();
    
    if ($expiredCount > 0) {
        error_log("Expired {$expiredCount} advertisement(s) at " . date('Y-m-d H:i:s'));
    }
    
    echo json_encode([
        'success' => true,
        'expired_count' => $expiredCount,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
} catch (PDOException $e) {
    error_log("Error expiring advertisements: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>

