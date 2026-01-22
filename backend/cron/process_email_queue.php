<?php
#!/usr/bin/env php
<?php
/**
 * Email Queue Processor - Background Worker
 *
 * This script processes pending email jobs from the queue.
 * Run this via cron every minute for optimal performance.
 *
 * Cron setup:
 * * * * * * php /path/to/backend/cron/process_email_queue.php
 *
 * Or for Windows Task Scheduler:
 * Create a batch file with: php "C:\path\to\backend\cron\process_email_queue.php"
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../routes/email_queue.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

// Prevent multiple instances from running simultaneously
$lockFile = __DIR__ . '/email_processor.lock';
$maxExecutionTime = 50; // seconds (leave buffer before next cron run)

if (file_exists($lockFile)) {
    $lockTime = filemtime($lockFile);
    if (time() - $lockTime < $maxExecutionTime) {
        echo "[" . date('Y-m-d H:i:s') . "] Another instance is running. Exiting.\n";
        exit(0);
    } else {
        // Stale lock file, remove it
        unlink($lockFile);
    }
}

// Create lock file
file_put_contents($lockFile, time());

try {
    echo "[" . date('Y-m-d H:i:s') . "] Starting email queue processor...\n";

    // Process up to 10 emails per run (configurable)
    $maxJobsPerRun = getenv('EMAIL_QUEUE_BATCH_SIZE') ?: 10;

    $result = processEmailQueue($maxJobsPerRun);

    // Log the batch processing
    logEmailQueueBatch($result);

    echo "[" . date('Y-m-d H:i:s') . "] Email queue processing completed:\n";
    echo "  - Processed: {$result['processed']}\n";
    echo "  - Successful: {$result['successful']}\n";
    echo "  - Failed: {$result['failed']}\n";

    if (isset($result['error'])) {
        echo "  - Error: {$result['error']}\n";
    }

    // Clean up old jobs (keep last 30 days)
    $cleanupResult = cleanupEmailQueue(30);
    if ($cleanupResult['success']) {
        echo "  - Cleaned up: {$cleanupResult['deleted']} old jobs\n";
    }

    echo "[" . date('Y-m-d H:i:s') . "] Email queue processor finished.\n";

} catch (Exception $e) {
    echo "[" . date('Y-m-d H:i:s') . "] Email processor error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";

    // Log the error
    require_once __DIR__ . '/../utils/system_logs.php';
    logSystemEvent('email_processor_crash', 'Email queue processor crashed', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);

} finally {
    // Remove lock file
    if (file_exists($lockFile)) {
        unlink($lockFile);
    }
}

/**
 * Log email queue batch processing
 */
function logEmailQueueBatch($result) {
    global $pdo;

    try {
        $stmt = $pdo->prepare("
            INSERT INTO email_queue_logs (
                action, details, processed_count, successful_count, failed_count, created_at
            ) VALUES (?, ?, ?, ?, ?, NOW())
        ");

        $stmt->execute([
            'processed_batch',
            json_encode([
                'timestamp' => date('Y-m-d H:i:s'),
                'result' => $result
            ]),
            $result['processed'] ?? 0,
            $result['successful'] ?? 0,
            $result['failed'] ?? 0
        ]);

    } catch (Exception $e) {
        error_log("Failed to log email queue batch: " . $e->getMessage());
    }
}
?>

