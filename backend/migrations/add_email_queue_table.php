<?php
// Database migration to add email queue system
// Run this to create the email_jobs table for background email processing

require_once __DIR__ . '/../config/database.php';

try {
    $pdo->beginTransaction();

    // Create email_jobs table for background email processing
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS email_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_type VARCHAR(100) NOT NULL COMMENT 'customer_order_confirmation, vendor_new_order, etc.',
            recipient_email VARCHAR(255) NOT NULL,
            template_type VARCHAR(100) NOT NULL COMMENT 'order_confirmation, vendor_notification, etc.',
            template_data JSON NOT NULL COMMENT 'Email template data as JSON',
            priority ENUM('urgent', 'high', 'normal', 'low') DEFAULT 'normal',
            status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
            retry_count INT DEFAULT 0,
            error_message TEXT NULL,
            next_retry_at DATETIME NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

            INDEX idx_status_priority (status, priority),
            INDEX idx_recipient (recipient_email),
            INDEX idx_created_at (created_at),
            INDEX idx_next_retry (next_retry_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Add indexes for performance
    $pdo->exec("
        ALTER TABLE email_jobs
        ADD INDEX idx_status_created (status, created_at),
        ADD INDEX idx_job_type (job_type)
    ");

    // Create email_queue_logs table for tracking queue processing
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS email_queue_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            action VARCHAR(100) NOT NULL COMMENT 'processed_batch, job_completed, job_failed, etc.',
            details JSON NULL,
            processed_count INT DEFAULT 0,
            successful_count INT DEFAULT 0,
            failed_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            INDEX idx_action_created (action, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $pdo->commit();

    echo "✅ Email queue tables created successfully!\n";
    echo "📧 Email queue system is ready for background processing.\n";
    echo "\nNext steps:\n";
    echo "1. Set up cron job to run email processor every minute:\n";
    echo "   * * * * * php /path/to/backend/cron/process_email_queue.php\n";
    echo "\n2. Update your order creation logic to use queueEmail() instead of sendStyledEmail()\n";

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    echo "❌ Migration failed: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
    exit(1);
}
?>

