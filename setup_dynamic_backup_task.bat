@echo off
echo Setting up Windows Task Scheduler for automatic backups...
echo Reading backup settings from database...
echo.

REM Get the current directory
set "SCRIPT_DIR=%~dp0"
set "BACKUP_SCRIPT=%SCRIPT_DIR%backend\cron\scheduled_backup.php"
set "PHP_PATH=C:\xampp\php\php.exe"

echo Script directory: %SCRIPT_DIR%
echo Backup script: %BACKUP_SCRIPT%
echo PHP path: %PHP_PATH%
echo.

REM Get backup time from database using PHP
echo Reading backup settings from database...
for /f "tokens=*" %%i in ('"%PHP_PATH%" -r "require_once '%SCRIPT_DIR%backend/config/database.php'; try { $stmt = $pdo->query('SELECT setting_value FROM backup_settings WHERE setting_key = \"auto_backup_time\"'); $time = $stmt->fetchColumn() ?: '18:00'; echo $time; } catch (Exception $e) { echo '18:00'; }"') do set BACKUP_TIME=%%i

echo Backup time from database: %BACKUP_TIME%
echo.

REM Delete existing task if it exists
echo Removing existing task (if any)...
schtasks /delete /tn "PoultryHubKenya_Backup" /f >nul 2>&1

REM Create a task that runs daily at the specified time
echo Creating Windows Task Scheduler task...
schtasks /create /tn "PoultryHubKenya_Backup" /tr "\"%PHP_PATH%\" \"%BACKUP_SCRIPT%\"" /sc daily /st %BACKUP_TIME% /f

if %errorlevel% equ 0 (
    echo.
    echo ✅ Task created successfully!
    echo.
    echo Task Details:
    echo - Name: PoultryHubKenya_Backup
    echo - Schedule: Daily at %BACKUP_TIME%
    echo - Command: %PHP_PATH% %BACKUP_SCRIPT%
    echo.
    echo To view the task: schtasks /query /tn "PoultryHubKenya_Backup"
    echo To delete the task: schtasks /delete /tn "PoultryHubKenya_Backup" /f
    echo To run the task manually: schtasks /run /tn "PoultryHubKenya_Backup"
    echo.
    echo Note: The task will run automatically at %BACKUP_TIME% every day.
) else (
    echo.
    echo ❌ Failed to create task. Make sure you're running as Administrator.
    echo.
    echo Manual setup instructions:
    echo 1. Open Task Scheduler
    echo 2. Create Basic Task
    echo 3. Name: PoultryHubKenya_Backup
    echo 4. Trigger: Daily
    echo 5. Time: %BACKUP_TIME%
    echo 6. Action: Start a program
    echo 7. Program: %PHP_PATH%
    echo 8. Arguments: %BACKUP_SCRIPT%
)

pause
