@echo off
echo Setting up Windows Task Scheduler for automatic backups...
echo.

REM Get the current directory
set "SCRIPT_DIR=%~dp0"
set "BACKUP_SCRIPT=%SCRIPT_DIR%backend\cron\scheduled_backup.php"
set "PHP_PATH=C:\xampp\php\php.exe"

echo Script directory: %SCRIPT_DIR%
echo Backup script: %BACKUP_SCRIPT%
echo PHP path: %PHP_PATH%
echo.

REM Create a task that runs daily at the specified time
echo Creating Windows Task Scheduler task...
schtasks /create /tn "PoultryHubKenya_Backup" /tr "\"%PHP_PATH%\" \"%BACKUP_SCRIPT%\"" /sc daily /st 18:52 /f

if %errorlevel% equ 0 (
    echo.
    echo ✅ Task created successfully!
    echo.
    echo Task Details:
    echo - Name: PoultryHubKenya_Backup
    echo - Schedule: Daily at 18:52
    echo - Command: %PHP_PATH% %BACKUP_SCRIPT%
    echo.
    echo To view the task: schtasks /query /tn "PoultryHubKenya_Backup"
    echo To delete the task: schtasks /delete /tn "PoultryHubKenya_Backup" /f
    echo To run the task manually: schtasks /run /tn "PoultryHubKenya_Backup"
) else (
    echo.
    echo ❌ Failed to create task. Make sure you're running as Administrator.
    echo.
    echo Manual setup instructions:
    echo 1. Open Task Scheduler
    echo 2. Create Basic Task
    echo 3. Name: PoultryHubKenya_Backup
    echo 4. Trigger: Daily
    echo 5. Time: 18:52
    echo 6. Action: Start a program
    echo 7. Program: %PHP_PATH%
    echo 8. Arguments: %BACKUP_SCRIPT%
)

pause
