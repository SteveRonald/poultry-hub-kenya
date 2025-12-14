<?php
/**
 * Windows Task Scheduler Manager for Automatic Backups
 * This class manages Windows Task Scheduler tasks for scheduled backups
 */

class WindowsTaskManager {
    private $taskName = 'KukuSoko_Backup';
    private $phpPath;
    private $scriptPath;
    
    public function __construct() {
        // Set PHP path (adjust if needed)
        $this->phpPath = 'C:\\xampp\\php\\php.exe';
        $this->scriptPath = __DIR__ . '/../cron/scheduled_backup.php';
    }
    
    /**
     * Create or update the backup task
     */
    public function createOrUpdateTask($backupTime) {
        try {
            // Delete existing task if it exists
            $this->deleteTask();
            
            // Create new task
            // SECURITY: Use escapeshellarg() to prevent command injection
            $taskNameEscaped = escapeshellarg($this->taskName);
            $phpPathEscaped = escapeshellarg($this->phpPath);
            $scriptPathEscaped = escapeshellarg($this->scriptPath);
            $backupTimeEscaped = escapeshellarg($backupTime);
            
            $command = sprintf(
                'schtasks /create /tn %s /tr %s %s %s /sc daily /st %s /f',
                $taskNameEscaped,
                $phpPathEscaped,
                $scriptPathEscaped,
                $backupTimeEscaped
            );
            
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);
            
            if ($returnCode === 0) {
                return [
                    'success' => true,
                    'message' => 'Task created successfully',
                    'task_name' => $this->taskName,
                    'schedule' => "Daily at {$backupTime}"
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Failed to create task. Make sure you have administrator privileges.',
                    'error' => implode("\n", $output)
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error creating task: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Delete the backup task
     */
    public function deleteTask() {
        try {
            // SECURITY: Use escapeshellarg() to prevent command injection
            $taskNameEscaped = escapeshellarg($this->taskName);
            $command = sprintf('schtasks /delete /tn %s /f', $taskNameEscaped);
            exec($command);
            return true;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Check if the task exists
     */
    public function taskExists() {
        try {
            // SECURITY: Use escapeshellarg() to prevent command injection
            $taskNameEscaped = escapeshellarg($this->taskName);
            $command = sprintf('schtasks /query /tn %s', $taskNameEscaped);
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);
            
            return $returnCode === 0;
        } catch (Exception $e) {
            return false;
        }
    }
    
    /**
     * Get task information
     */
    public function getTaskInfo() {
        try {
            if (!$this->taskExists()) {
                return [
                    'exists' => false,
                    'message' => 'Task does not exist'
                ];
            }
            
            // SECURITY: Use escapeshellarg() to prevent command injection
            $taskNameEscaped = escapeshellarg($this->taskName);
            $command = sprintf('schtasks /query /tn %s /fo list', $taskNameEscaped);
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);
            
            $taskInfo = [
                'exists' => true,
                'details' => implode("\n", $output)
            ];
            
            return $taskInfo;
        } catch (Exception $e) {
            return [
                'exists' => false,
                'message' => 'Error getting task info: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * Run the backup task manually
     */
    public function runTask() {
        try {
            // SECURITY: Use escapeshellarg() to prevent command injection
            $taskNameEscaped = escapeshellarg($this->taskName);
            $command = sprintf('schtasks /run /tn %s', $taskNameEscaped);
            $output = [];
            $returnCode = 0;
            exec($command, $output, $returnCode);
            
            if ($returnCode === 0) {
                return [
                    'success' => true,
                    'message' => 'Task started successfully'
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'Failed to start task',
                    'error' => implode("\n", $output)
                ];
            }
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'Error running task: ' . $e->getMessage()
            ];
        }
    }
}
?>
