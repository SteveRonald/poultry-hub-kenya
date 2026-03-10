<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/sms/SMSService.php';
require_once __DIR__ . '/../utils/system_logs.php';

// Set timezone
date_default_timezone_set('Africa/Nairobi');

// Prevent multiple instances from running simultaneously
$lockFile = __DIR__ . '/sms_processor.lock';
$maxExecutionTime = 50; // seconds (leave buffer before next cron run)

if (file_exists($lockFile)) {
    $lockTime = filemtime($lockFile);
    if (time() - $lockTime < $maxExecutionTime) {
        echo "[" . date('Y-m-d H:i:s') . "] Another instance is running. Exiting.\n";
        exit(0);
    }

    // Stale lock file, remove it
    unlink($lockFile);
}

file_put_contents($lockFile, time());

try {
    echo "[" . date('Y-m-d H:i:s') . "] Starting SMS queue processor...\n";

    $maxJobsPerRun = getenv('SMS_QUEUE_BATCH_SIZE') ?: 20;

    $smsService = new SMSService();
    $result = $smsService->processPendingSMS($maxJobsPerRun);

    echo "[" . date('Y-m-d H:i:s') . "] SMS queue processing completed:\n";
    echo "  - Processed: " . ($result['processed'] ?? 0) . "\n";
    echo "  - Successful: " . ($result['successful'] ?? 0) . "\n";
    echo "  - Failed: " . ($result['failed'] ?? 0) . "\n";

    if (isset($result['error'])) {
        echo "  - Error: {$result['error']}\n";
    }

    logSystemEvent('sms_queue_processed', 'SMS queue batch processed', [
        'processed' => $result['processed'] ?? 0,
        'successful' => $result['successful'] ?? 0,
        'failed' => $result['failed'] ?? 0,
        'error' => $result['error'] ?? null
    ]);

    echo "[" . date('Y-m-d H:i:s') . "] SMS queue processor finished.\n";
} catch (Exception $e) {
    echo "[" . date('Y-m-d H:i:s') . "] SMS processor error: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";

    logActivity(null, 'system', 'sms_processor_crash', 'SMS queue processor crashed', [
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
} finally {
    if (file_exists($lockFile)) {
        unlink($lockFile);
    }
}
