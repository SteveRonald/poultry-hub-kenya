<?php
/**
 * Secure Prediction Runner
 * Runs price predictions with security checks and logging
 * 
 * Security Features:
 * - API key authentication
 * - IP whitelist (optional)
 * - Rate limiting
 * - Logging of all runs
 * - Error handling and notifications
 * 
 * Usage:
 *   php backend/cron/run_predictions_secure.php [--api-key=YOUR_API_KEY]
 * 
 * For cron jobs, set API key in environment variable or .env file
 */

// Set working directory to project root
chdir(__DIR__ . '/..');

// Load environment variables
require_once __DIR__ . '/../config/env_loader.php';

// Security configuration
$API_KEY = getenv('PREDICTION_API_KEY') ?: 'your-secure-api-key-here';
$ALLOWED_IPS = []; // Empty array means allow all IPs (for cron), or specify: ['127.0.0.1', '::1']
$MAX_RUNTIME_SECONDS = 3600; // 1 hour max runtime
$LOG_FILE = __DIR__ . '/../logs/prediction_runs.log';

// Create logs directory if it doesn't exist
$logDir = dirname($LOG_FILE);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

/**
 * Log a message with timestamp
 */
function logMessage($message, $level = 'INFO') {
    global $LOG_FILE;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] [$level] $message\n";
    file_put_contents($LOG_FILE, $logEntry, FILE_APPEND);
    echo $logEntry;
}

/**
 * Check if request is authorized
 */
function isAuthorized() {
    global $API_KEY, $ALLOWED_IPS;
    
    // Check API key
    $providedKey = $_GET['api_key'] ?? $_SERVER['HTTP_X_API_KEY'] ?? null;
    if ($providedKey && $providedKey === $API_KEY) {
        return true;
    }
    
    // Check if running from command line (cron)
    if (php_sapi_name() === 'cli') {
        // Allow CLI execution if no API key is required or if provided via env
        if (empty($API_KEY) || $API_KEY === getenv('PREDICTION_API_KEY')) {
            return true;
        }
    }
    
    // Check IP whitelist (if configured)
    if (!empty($ALLOWED_IPS)) {
        $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (in_array($clientIP, $ALLOWED_IPS)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Check rate limiting
 */
function checkRateLimit() {
    $rateLimitFile = __DIR__ . '/../logs/prediction_rate_limit.json';
    $maxRunsPerHour = 4; // Maximum 4 runs per hour
    
    $rateLimitData = [];
    if (file_exists($rateLimitFile)) {
        $rateLimitData = json_decode(file_get_contents($rateLimitFile), true) ?: [];
    }
    
    $currentHour = date('Y-m-d H');
    $runCount = $rateLimitData[$currentHour] ?? 0;
    
    if ($runCount >= $maxRunsPerHour) {
        logMessage("Rate limit exceeded: $runCount runs in current hour (max: $maxRunsPerHour)", 'WARNING');
        return false;
    }
    
    // Update rate limit
    $rateLimitData[$currentHour] = $runCount + 1;
    // Clean up old entries (keep only last 24 hours)
    $rateLimitData = array_filter($rateLimitData, function($key) {
        return $key >= date('Y-m-d H', strtotime('-24 hours'));
    }, ARRAY_FILTER_USE_KEY);
    
    file_put_contents($rateLimitFile, json_encode($rateLimitData));
    return true;
}

// Main execution
try {
    logMessage("Starting prediction run...");
    
    // Check authorization
    if (!isAuthorized()) {
        http_response_code(401);
        logMessage("Unauthorized access attempt", 'ERROR');
        echo json_encode(['error' => 'Unauthorized']);
        exit(1);
    }
    
    // Check rate limiting
    if (!checkRateLimit()) {
        http_response_code(429);
        logMessage("Rate limit exceeded", 'ERROR');
        echo json_encode(['error' => 'Rate limit exceeded']);
        exit(1);
    }
    
    // Set max execution time
    set_time_limit($MAX_RUNTIME_SECONDS);
    
    // Check if Python is available
    $pythonCommand = 'python';
    $pythonVersion = shell_exec("$pythonCommand --version 2>&1");
    if (strpos($pythonVersion, 'Python') === false) {
        // Try python3
        $pythonCommand = 'python3';
        $pythonVersion = shell_exec("$pythonCommand --version 2>&1");
        if (strpos($pythonVersion, 'Python') === false) {
            throw new Exception("Python is not installed or not in PATH");
        }
    }
    
    logMessage("Using Python: $pythonVersion");
    
    // Get Python script path
    $scriptPath = __DIR__ . '/../scripts/predict_prices.py';
    if (!file_exists($scriptPath)) {
        throw new Exception("Prediction script not found: $scriptPath");
    }
    
    // Run prediction script
    $startTime = microtime(true);
    $command = escapeshellcmd($pythonCommand) . ' ' . escapeshellarg($scriptPath) . ' 2>&1';
    logMessage("Executing: $command");
    
    $output = [];
    $returnVar = 0;
    exec($command, $output, $returnVar);
    
    $executionTime = round(microtime(true) - $startTime, 2);
    
    if ($returnVar !== 0) {
        $errorOutput = implode("\n", $output);
        logMessage("Prediction script failed with exit code $returnVar", 'ERROR');
        logMessage("Error output: $errorOutput", 'ERROR');
        throw new Exception("Prediction script failed: $errorOutput");
    }
    
    $outputText = implode("\n", $output);
    logMessage("Prediction script completed successfully in {$executionTime}s");
    logMessage("Output: $outputText");
    
    // Update metadata
    require_once __DIR__ . '/../config/database.php';
    try {
        $stmt = $pdo->prepare("
            UPDATE market_insights_metadata 
            SET last_prediction_run = NOW(),
                total_prediction_records = (SELECT COUNT(*) FROM predicted_prices)
            WHERE id = 1
        ");
        $stmt->execute();
        logMessage("Metadata updated successfully");
    } catch (PDOException $e) {
        logMessage("Failed to update metadata: " . $e->getMessage(), 'WARNING');
    }
    
    // Return success response
    if (php_sapi_name() !== 'cli') {
        http_response_code(200);
        header('Content-Type: application/json');
    }
    
    echo json_encode([
        'success' => true,
        'message' => 'Predictions generated successfully',
        'execution_time' => $executionTime,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
    
    logMessage("Prediction run completed successfully");
    
} catch (Exception $e) {
    logMessage("Error: " . $e->getMessage(), 'ERROR');
    
    if (php_sapi_name() !== 'cli') {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
    
    exit(1);
}

