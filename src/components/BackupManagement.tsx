import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { getApiUrl } from '../config/api';

interface BackupFile {
  filename: string;
  filepath: string;
  size: number;
  created: string;
  type: string;
}

interface BackupStatus {
  total_backups: number;
  total_size_mb: number;
  backup_types: Record<string, number>;
  disk_free_mb: number;
  disk_total_mb: number;
  disk_usage_percent: number;
}

interface BackupSettings {
  // Core backup settings
  auto_backup_frequency: string;
  auto_backup_time: string;
  max_backups: string;
  backup_retention_days: string;
  backup_notifications: string;
  
  // Specific backup type settings
  auto_local_database: string;
  auto_local_files: string;
  auto_local_system: string;
  auto_gdrive_database: string;
  auto_gdrive_files: string;
  auto_gdrive_system: string;
}

const BackupManagement: React.FC = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [nextBackupTime, setNextBackupTime] = useState<string>('');
  const [countdown, setCountdown] = useState<string>('');
  const [windowsTaskStatus, setWindowsTaskStatus] = useState<any>(null);
  const [setupTaskLoading, setSetupTaskLoading] = useState(false);
  const [setupTaskSuccess, setSetupTaskSuccess] = useState(false);
  const [stopTaskLoading, setStopTaskLoading] = useState(false);
  const [stopTaskSuccess, setStopTaskSuccess] = useState(false);
  const [refreshStatusLoading, setRefreshStatusLoading] = useState(false);
  const [refreshStatusSuccess, setRefreshStatusSuccess] = useState(false);
  const [testConnectionLoading, setTestConnectionLoading] = useState(false);
  const [testConnectionSuccess, setTestConnectionSuccess] = useState(false);
  const [testGoogleDriveLoading, setTestGoogleDriveLoading] = useState(false);
  const [testGoogleDriveSuccess, setTestGoogleDriveSuccess] = useState(false);
  const [refreshLocalLoading, setRefreshLocalLoading] = useState(false);
  const [refreshLocalSuccess, setRefreshLocalSuccess] = useState(false);
  const [refreshGoogleDriveLoading, setRefreshGoogleDriveLoading] = useState(false);
  const [refreshGoogleDriveSuccess, setRefreshGoogleDriveSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showReschedulePrompt, setShowReschedulePrompt] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [modalJustClosed, setModalJustClosed] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  }>({
    show: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    type: 'info'
  });
  const settingsRef = useRef<HTMLDivElement>(null);
  const [googleDriveBackups, setGoogleDriveBackups] = useState<any[]>([]);
  const [googleDriveLoading, setGoogleDriveLoading] = useState(false);
  const [googleDriveFolderInfo, setGoogleDriveFolderInfo] = useState<any>(null);
  
  // Independent loading states for each backup type
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [filesLoading, setFilesLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  
  // Success states for each backup type
  const [databaseSuccess, setDatabaseSuccess] = useState(false);
  const [filesSuccess, setFilesSuccess] = useState(false);
  const [systemSuccess, setSystemSuccess] = useState(false);
  
  // Upload loading states for individual files
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchBackups();
    fetchStatus();
    fetchSettings();
    fetchGoogleDriveBackups();
    fetchGoogleDriveFolderInfo();
  }, []);

  // Calculate next backup time and countdown
  const calculateNextBackupTime = () => {
    if (!settings) return;

    const now = new Date();
    const backupTime = settings.auto_backup_time;
    const frequency = settings.auto_backup_frequency;

    // Check if any automatic backups are enabled
    const hasLocalBackups = settings.auto_local_database === '1' || 
                           settings.auto_local_files === '1' || 
                           settings.auto_local_system === '1';
    
    const hasGDriveBackups = settings.auto_gdrive_database === '1' || 
                            settings.auto_gdrive_files === '1' || 
                            settings.auto_gdrive_system === '1';

    if (!hasLocalBackups && !hasGDriveBackups) {
      setNextBackupTime('');
      setCountdown('');
      return;
    }

    // Parse backup time
    const [hours, minutes] = backupTime.split(':').map(Number);
    
    let nextBackup = new Date();
    nextBackup.setHours(hours, minutes, 0, 0);

    // Calculate next backup based on frequency
    switch (frequency) {
      case 'hourly':
        // Next backup is at the next hour mark with the same minutes
        nextBackup = new Date(now);
        nextBackup.setHours(now.getHours() + 1, minutes, 0, 0);
        break;
      case 'daily':
        // Next backup is today or tomorrow at the specified time
        nextBackup = new Date(now);
        nextBackup.setHours(hours, minutes, 0, 0);
        
        // If the time has already passed today, schedule for tomorrow
        if (nextBackup <= now) {
          nextBackup.setDate(nextBackup.getDate() + 1);
        }
        break;
      case 'weekly':
        // Find next Monday at the specified time
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const daysUntilMonday = (1 - dayOfWeek + 7) % 7; // Days until next Monday
        
        nextBackup = new Date(today);
        nextBackup.setDate(today.getDate() + daysUntilMonday);
        nextBackup.setHours(hours, minutes, 0, 0);
        
        // If the calculated time has already passed today (for Monday), move to next week
        if (nextBackup <= now) {
          nextBackup.setDate(nextBackup.getDate() + 7);
        }
        break;
      case 'monthly':
        // Next backup is next month on the same day at the specified time
        nextBackup = new Date(now);
        nextBackup.setHours(hours, minutes, 0, 0);
        
        // Move to next month
        nextBackup.setMonth(nextBackup.getMonth() + 1);
        
        // If the calculated time has already passed this month, move to next month
        if (nextBackup <= now) {
          nextBackup.setMonth(nextBackup.getMonth() + 1);
        }
        break;
    }

    setNextBackupTime(nextBackup.toLocaleString());
    
    // Update countdown every second
    const updateCountdown = () => {
      if (isUpdatingSettings) return;
      
      const now = new Date();
      const diff = nextBackup.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown('Backup should be running now...');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      let countdownText = '';
      if (days > 0) countdownText += `${days}d `;
      if (hours > 0) countdownText += `${hours}h `;
      if (minutes > 0) countdownText += `${minutes}m `;
      countdownText += `${seconds}s`;
      
      setCountdown(countdownText);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  };

  // Update countdown when settings change
  useEffect(() => {
    if (!isUpdatingSettings) {
      calculateNextBackupTime();
    }
  }, [settings, isUpdatingSettings]);

  // Check if backup time has passed and reset to defaults
  const checkAndResetBackupSchedule = () => {
    if (!settings || !windowsTaskStatus?.exists || modalJustClosed || showReschedulePrompt) return;

    const now = new Date();
    const backupTime = settings.auto_backup_time;
    const [hours, minutes] = backupTime.split(':').map(Number);
    
    // Create today's backup time
    const todayBackupTime = new Date();
    todayBackupTime.setHours(hours, minutes, 0, 0);
    
    // Check if backup time has passed today
    if (now > todayBackupTime) {
      // Check if user has already handled the backup schedule reset today
      const today = now.toDateString();
      const handledToday = localStorage.getItem('backup_schedule_handled_' + today);
      
      if (handledToday) {
        return; // User already handled it today, don't show again
      }
      
      // Check if any automatic backups are enabled
      const hasLocalBackups = settings.auto_local_database === '1' || 
                             settings.auto_local_files === '1' || 
                             settings.auto_local_system === '1';
      const hasGoogleDriveBackups = settings.auto_gdrive_database === '1' || 
                                   settings.auto_gdrive_files === '1' || 
                                   settings.auto_gdrive_system === '1';

      if (hasLocalBackups || hasGoogleDriveBackups) {
        // Show reschedule prompt
        setShowReschedulePrompt(true);
      }
    }
  };

  // Reset to default settings
  const resetToDefaultSettings = async () => {
    try {
      setIsUpdatingSettings(true);
      
      const defaultSettings = {
        auto_backup_frequency: 'weekly',
        auto_backup_time: '18:30',
        max_backups: '10',
        backup_retention_days: '30',
        backup_notifications: '1',
        auto_local_database: '0',
        auto_local_files: '0',
        auto_local_system: '0',
        auto_gdrive_database: '0',
        auto_gdrive_files: '0',
        auto_gdrive_system: '0'
      };

      const response = await fetch(getApiUrl('/api/admin/backup/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        },
        body: JSON.stringify(defaultSettings)
      });

      if (response.ok) {
        // Stop the current Windows Task
        await stopWindowsTask();
        
        // Update local settings
        setSettings(prev => ({ ...prev, ...defaultSettings }));
        
        // Hide the prompt and prevent it from showing again
        setShowReschedulePrompt(false);
        setModalJustClosed(true);
        
        // Mark that user has handled the backup schedule reset today
        const today = new Date().toDateString();
        localStorage.setItem('backup_schedule_handled_' + today, 'true');
        
        // Clear countdown immediately
        setNextBackupTime('');
        setCountdown('');
        
        // Force refresh the countdown after settings are updated
        setTimeout(() => {
          calculateNextBackupTime();
          setIsUpdatingSettings(false);
          // Reset the modal flag after a delay
          setTimeout(() => {
            setModalJustClosed(false);
          }, 1000);
        }, 200);
        
        toast.success('Backup settings reset to defaults. Windows Task stopped.');
      } else {
        toast.error('Failed to reset settings');
        setIsUpdatingSettings(false);
      }
    } catch (error) {
      console.error('Error resetting settings:', error);
      toast.error('Error resetting settings');
      setIsUpdatingSettings(false);
    }
  };

  // Schedule at default time
  const scheduleAtDefaultTime = async () => {
    try {
      setIsUpdatingSettings(true);
      
      const defaultSettings = {
        auto_backup_frequency: 'weekly',
        auto_backup_time: '18:30',
        max_backups: '10',
        backup_retention_days: '30',
        backup_notifications: '1',
        auto_local_database: '1',
        auto_local_files: '0',
        auto_local_system: '0',
        auto_gdrive_database: '0',
        auto_gdrive_files: '0',
        auto_gdrive_system: '0'
      };

      const response = await fetch(getApiUrl('/api/admin/backup/settings'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        },
        body: JSON.stringify(defaultSettings)
      });

      if (response.ok) {
        // Setup Windows Task with default settings
        await setupWindowsTask();
        
        // Update local settings
        setSettings(prev => ({ ...prev, ...defaultSettings }));
        
        // Hide the prompt and prevent it from showing again
        setShowReschedulePrompt(false);
        setModalJustClosed(true);
        
        // Mark that user has handled the backup schedule reset today
        const today = new Date().toDateString();
        localStorage.setItem('backup_schedule_handled_' + today, 'true');
        
        // Clear countdown immediately
        setNextBackupTime('');
        setCountdown('');
        
        // Force refresh the countdown after settings are updated
        setTimeout(() => {
          calculateNextBackupTime();
          setIsUpdatingSettings(false);
          // Reset the modal flag after a delay
          setTimeout(() => {
            setModalJustClosed(false);
          }, 1000);
        }, 200);
        
        toast.success('Backup scheduled for weekly at 6:30 PM (database backup only).');
      } else {
        toast.error('Failed to schedule at default time');
        setIsUpdatingSettings(false);
      }
    } catch (error) {
      console.error('Error scheduling at default time:', error);
      toast.error('Error scheduling at default time');
      setIsUpdatingSettings(false);
    }
  };

  // Handle backup settings button click
  const handleBackupSettingsClick = () => {
    // Show settings if not already shown
    if (!showSettings) {
      setShowSettings(true);
    }
    
    // Scroll to settings section after a short delay to ensure it's rendered
    setTimeout(() => {
      if (settingsRef.current) {
        settingsRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    }, 100);
  };

  // Show confirmation modal
  const showConfirmationModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'info',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmationModal({
      show: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      type
    });
  };

  // Hide confirmation modal
  const hideConfirmationModal = () => {
    setConfirmationModal(prev => ({ ...prev, show: false }));
  };

  // Check Windows Task Scheduler status
  const checkWindowsTaskStatus = async (showFeedback = false) => {
    if (showFeedback) {
      setRefreshStatusLoading(true);
      setRefreshStatusSuccess(false);
    }
    
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/windows-task-status'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWindowsTaskStatus(data);
        
        if (showFeedback) {
          setRefreshStatusSuccess(true);
          setTimeout(() => setRefreshStatusSuccess(false), 3000);
        }
      }
    } catch (error) {
      console.error('Error checking Windows task status:', error);
    } finally {
      if (showFeedback) {
        setRefreshStatusLoading(false);
      }
    }
  };

  // Setup Windows Task Scheduler
  const setupWindowsTask = async () => {
    setSetupTaskLoading(true);
    setSetupTaskSuccess(false);
    
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/setup-windows-task'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(data.message || 'Windows Task Scheduler setup successfully!');
        setSetupTaskSuccess(true);
        setTimeout(() => setSetupTaskSuccess(false), 3000);
        checkWindowsTaskStatus(); // Refresh status
      } else {
        toast.error(data.error || 'Failed to setup Windows Task Scheduler');
      }
    } catch (error) {
      console.error('Error setting up Windows task:', error);
      toast.error('Failed to setup Windows Task Scheduler');
    } finally {
      setSetupTaskLoading(false);
    }
  };

  // Stop Windows Task Scheduler
  const stopWindowsTask = async () => {
    showConfirmationModal(
      'Stop Windows Task',
      'Are you sure you want to stop the Windows Task Scheduler? This will disable automatic backups.',
      async () => {
        setStopTaskLoading(true);
        setStopTaskSuccess(false);
        
        try {
          const response = await fetch(getApiUrl('/api/admin/backup/stop-windows-task'), {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
            }
          });
          
          const data = await response.json();
          
          if (response.ok) {
            toast.success(data.message || 'Windows Task Scheduler task removed successfully!');
            setStopTaskSuccess(true);
            setTimeout(() => setStopTaskSuccess(false), 3000);
            checkWindowsTaskStatus(); // Refresh status
          } else {
            toast.error(data.error || 'Failed to remove Windows Task Scheduler task');
          }
        } catch (error) {
          console.error('Error stopping Windows task:', error);
          toast.error('Failed to remove Windows Task Scheduler task');
        } finally {
          setStopTaskLoading(false);
        }
      },
      'warning',
      'Stop Task',
      'Cancel'
    );
  };

  // Check Windows Task status on component mount
  useEffect(() => {
    checkWindowsTaskStatus();
  }, []);

  // Check for backup schedule reset when windowsTaskStatus changes
  useEffect(() => {
    if (windowsTaskStatus && settings) {
      checkAndResetBackupSchedule();
    }
  }, [windowsTaskStatus, settings]);

  const fetchBackups = async (showFeedback = false) => {
    if (showFeedback) {
      setRefreshLocalLoading(true);
      setRefreshLocalSuccess(false);
    }
    
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/list'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
        
        if (showFeedback) {
          setRefreshLocalSuccess(true);
          setTimeout(() => setRefreshLocalSuccess(false), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching backups:', error);
    } finally {
      if (showFeedback) {
        setRefreshLocalLoading(false);
      }
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/status'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching backup status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/settings'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        console.error('Failed to fetch settings');
        // Set default settings if fetch fails
        setSettings({
          // Core settings
          auto_backup_frequency: 'daily',
          auto_backup_time: '02:00',
          max_backups: '30',
          backup_retention_days: '30',
          backup_notifications: '1',
          
          // Specific backup type settings
          auto_local_database: '0',
          auto_local_files: '0',
          auto_local_system: '0',
          auto_gdrive_database: '0',
          auto_gdrive_files: '0',
          auto_gdrive_system: '0'
        });
      }
    } catch (error) {
      console.error('Error fetching backup settings:', error);
      // Set default settings if fetch fails
      setSettings({
        // Core settings
        auto_backup_frequency: 'daily',
        auto_backup_time: '02:00',
        max_backups: '30',
        backup_retention_days: '30',
        backup_notifications: '1',
        
        // Specific backup type settings
        auto_local_database: '0',
        auto_local_files: '0',
        auto_local_system: '0',
        auto_gdrive_database: '0',
        auto_gdrive_files: '0',
        auto_gdrive_system: '0'
      });
    }
  };

  const createBackup = async (type: 'system' | 'database' | 'files') => {
    // Set loading state for specific backup type
    switch (type) {
      case 'database':
        setDatabaseLoading(true);
        setDatabaseSuccess(false);
        break;
      case 'files':
        setFilesLoading(true);
        setFilesSuccess(false);
        break;
      case 'system':
        setSystemLoading(true);
        setSystemSuccess(false);
        break;
    }
    
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        },
        body: JSON.stringify({ type, trigger: 'manual' })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Backup created successfully: ${data.filename}`);
        fetchBackups();
        fetchStatus();
        
        // Set success state for specific backup type
        switch (type) {
          case 'database':
            setDatabaseSuccess(true);
            setTimeout(() => setDatabaseSuccess(false), 3000);
            break;
          case 'files':
            setFilesSuccess(true);
            setTimeout(() => setFilesSuccess(false), 3000);
            break;
          case 'system':
            setSystemSuccess(true);
            setTimeout(() => setSystemSuccess(false), 3000);
            break;
        }
      } else {
        toast.error(data.error || 'Failed to create backup');
      }
    } catch (error) {
      toast.error('Error creating backup');
    } finally {
      // Clear loading state for specific backup type
      switch (type) {
        case 'database':
          setDatabaseLoading(false);
          break;
        case 'files':
          setFilesLoading(false);
          break;
        case 'system':
          setSystemLoading(false);
          break;
      }
    }
  };

  const deleteBackup = async (filename: string) => {
    showConfirmationModal(
      'Delete Backup',
      `Are you sure you want to delete backup: ${filename}? This action cannot be undone.`,
      async () => {
        try {
          const response = await fetch(getApiUrl('/api/admin/backup/delete'), {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
            },
            body: JSON.stringify({ filename })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            toast.success('Backup deleted successfully');
            fetchBackups();
            fetchStatus();
          } else {
            toast.error(data.error || 'Failed to delete backup');
          }
        } catch (error) {
          toast.error('Error deleting backup');
        }
      },
      'danger',
      'Delete',
      'Cancel'
    );
  };

  const downloadBackup = (filename: string) => {
    const url = `/backend/api/admin/backup/download?filename=${encodeURIComponent(filename)}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateSettings = async () => {
    if (!settings) return;

    try {
      // Filter out old/legacy settings that are no longer supported
      const validSettings = {
        // Core settings
        auto_backup_frequency: settings.auto_backup_frequency,
        auto_backup_time: settings.auto_backup_time,
        max_backups: settings.max_backups,
        backup_retention_days: settings.backup_retention_days,
        backup_notifications: settings.backup_notifications,
        
        // Specific backup type settings
        auto_local_database: settings.auto_local_database,
        auto_local_files: settings.auto_local_files,
        auto_local_system: settings.auto_local_system,
        auto_gdrive_database: settings.auto_gdrive_database,
        auto_gdrive_files: settings.auto_gdrive_files,
        auto_gdrive_system: settings.auto_gdrive_system
      };

      const response = await fetch(getApiUrl('/api/admin/backup/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        },
        body: JSON.stringify(validSettings)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success('Backup settings updated successfully');
        setShowSettings(false);
      } else {
        toast.error(data.error || 'Failed to update settings');
      }
    } catch (error) {
      toast.error('Error updating settings');
    }
  };

  const testConnection = async () => {
    setTestConnectionLoading(true);
    setTestConnectionSuccess(false);
    
    try {
      const response = await fetch(getApiUrl('/api/admin/backup/test'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResults(data.tests);
        const allPassed = data.all_tests_passed;
        if (allPassed) {
          toast.success('All local backup tests passed!');
          setTestConnectionSuccess(true);
          setTimeout(() => setTestConnectionSuccess(false), 3000);
        } else {
          toast.warning('Some local backup tests failed. Check the results below.');
        }
      } else {
        toast.error(data.error || 'Local backup test failed');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error('Error testing local backup connection');
    } finally {
      setTestConnectionLoading(false);
    }
  };

  const fetchGoogleDriveBackups = async (showFeedback = false) => {
    if (showFeedback) {
      setRefreshGoogleDriveLoading(true);
      setRefreshGoogleDriveSuccess(false);
    }
    
    try {
      const response = await fetch(getApiUrl('/api/admin/google-drive/list'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setGoogleDriveBackups(data.files || []);
        
        if (showFeedback) {
          setRefreshGoogleDriveSuccess(true);
          setTimeout(() => setRefreshGoogleDriveSuccess(false), 3000);
        }
      } else {
        console.error('Failed to fetch Google Drive backups:', data.error);
      }
    } catch (error) {
      console.error('Error fetching Google Drive backups:', error);
    } finally {
      if (showFeedback) {
        setRefreshGoogleDriveLoading(false);
      }
    }
  };

  const uploadToGoogleDrive = async (filename: string) => {
    // Add filename to uploading set
    setUploadingFiles(prev => new Set(prev).add(filename));
    
    try {
      const response = await fetch(getApiUrl('/api/admin/google-drive/upload'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        },
        body: JSON.stringify({ filename })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Backup uploaded to Google Drive: ${data.filename}`);
        fetchGoogleDriveBackups();
      } else {
        toast.error(data.error || 'Failed to upload to Google Drive');
      }
    } catch (error) {
      toast.error('Error uploading to Google Drive');
    } finally {
      // Remove filename from uploading set
      setUploadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filename);
        return newSet;
      });
    }
  };

  const deleteFromGoogleDrive = async (fileId: string, filename: string) => {
    showConfirmationModal(
      'Delete from Google Drive',
      `Are you sure you want to delete ${filename} from Google Drive? This action cannot be undone.`,
      async () => {
        try {
          const response = await fetch(getApiUrl('/api/admin/google-drive/delete'), {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
            },
            body: JSON.stringify({ file_id: fileId })
          });
          
          const data = await response.json();
          
          if (response.ok) {
            toast.success('Backup deleted from Google Drive');
            fetchGoogleDriveBackups();
          } else {
            toast.error(data.error || 'Failed to delete from Google Drive');
          }
        } catch (error) {
          toast.error('Error deleting from Google Drive');
        }
      },
      'danger',
      'Delete',
      'Cancel'
    );
  };

  const testGoogleDriveConnection = async () => {
    setTestGoogleDriveLoading(true);
    setTestGoogleDriveSuccess(false);
    
    try {
      const response = await fetch(getApiUrl('/api/admin/google-drive/test'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Google Drive connection successful! Found ${data.file_count} files.`);
        setTestGoogleDriveSuccess(true);
        setTimeout(() => setTestGoogleDriveSuccess(false), 3000);
        fetchGoogleDriveFolderInfo(); // Refresh folder info after successful test
      } else {
        toast.error(data.error || 'Google Drive connection failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Google Drive test error:', error);
      toast.error('Error testing Google Drive connection. Please check your internet connection.');
    } finally {
      setTestGoogleDriveLoading(false);
    }
  };

  const fetchGoogleDriveFolderInfo = async () => {
    try {
      const response = await fetch(getApiUrl('/api/admin/google-drive/folder-info'), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_session_token')}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setGoogleDriveFolderInfo(data.folder);
      } else {
        console.error('Failed to fetch Google Drive folder info:', data.error);
      }
    } catch (error) {
      console.error('Error fetching Google Drive folder info:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getBackupTypeColor = (type: string) => {
    switch (type) {
      case 'system': return 'bg-blue-100 text-blue-800';
      case 'database': return 'bg-green-100 text-green-800';
      case 'files': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Backup Management</h2>
          <p className="text-gray-600">Manage local backups, Google Drive cloud backups, and automated backup settings</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <button
            onClick={testConnection}
            disabled={testConnectionLoading || testConnectionSuccess}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center ${
              testConnectionLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : testConnectionSuccess 
                  ? 'bg-green-600' 
                  : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {testConnectionLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testing...
              </>
            ) : testConnectionSuccess ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                ✓ Test Passed
              </>
            ) : (
              'Test Local Backup'
            )}
          </button>
          <button
            onClick={testGoogleDriveConnection}
            disabled={testGoogleDriveLoading || testGoogleDriveSuccess}
            className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors flex items-center justify-center ${
              testGoogleDriveLoading 
                ? 'bg-green-400 cursor-not-allowed' 
                : testGoogleDriveSuccess 
                  ? 'bg-green-600' 
                  : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {testGoogleDriveLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testing...
              </>
            ) : testGoogleDriveSuccess ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                ✓ Test Passed
              </>
            ) : (
              'Test Google Drive'
            )}
          </button>
          <button
            onClick={handleBackupSettingsClick}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Backup Settings
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Local Backup Test Results</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(testResults).map(([test, result]) => (
              <div key={test} className="flex items-center space-x-3 p-3 border rounded-lg">
                <div className={`w-3 h-3 rounded-full ${result === 'OK' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 capitalize">
                    {test.replace('_', ' ')}
                  </div>
                  <div className={`text-sm ${result === 'OK' ? 'text-green-600' : 'text-red-600'}`}>
                    {String(result)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Cards */}
      {status && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Backups</p>
                <p className="text-2xl font-semibold text-gray-900">{status.total_backups}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Size</p>
                <p className="text-2xl font-semibold text-gray-900">{status.total_size_mb.toFixed(2)} MB</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Disk Usage</p>
                <p className="text-2xl font-semibold text-gray-900">{status.disk_usage_percent.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Free Space</p>
                <p className="text-2xl font-semibold text-gray-900">{status.disk_free_mb.toFixed(0)} MB</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Connection Test Results</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(testResults).map(([test, result]) => (
              <div key={test} className="text-center">
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  result === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {String(result)}
                </div>
                <p className="text-sm text-gray-600 mt-1">{test.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Backup Countdown */}
      {nextBackupTime && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            Next Scheduled Backup
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 mb-2">Scheduled Time</p>
              <p className="text-xl font-semibold text-gray-900">{nextBackupTime}</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600 mb-2">Time Remaining</p>
              <p className="text-xl font-semibold text-blue-600">{countdown}</p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Automatic backups will run based on your configured settings. 
              Make sure Windows Task Scheduler is set up to run the scheduled backup script.
            </p>
          </div>
        </div>
      )}

      {/* Windows Task Scheduler Status */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          Windows Task Scheduler
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Task Status</p>
            <div className="flex items-center">
              {windowsTaskStatus?.exists ? (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-green-700 font-medium">Task Configured</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  <span className="text-red-700 font-medium">No Task Found</span>
                </div>
              )}
            </div>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Actions</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={setupWindowsTask}
                disabled={setupTaskLoading || setupTaskSuccess}
                className={`px-3 py-1 text-white text-sm rounded transition-colors flex items-center ${
                  setupTaskLoading 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : setupTaskSuccess 
                      ? 'bg-green-600' 
                      : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {setupTaskLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Setting up...
                  </>
                ) : setupTaskSuccess ? (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    ✓ Done
                  </>
                ) : (
                  'Setup Task'
                )}
              </button>
              
              <button
                onClick={stopWindowsTask}
                disabled={stopTaskLoading || stopTaskSuccess}
                className={`px-3 py-1 text-white text-sm rounded transition-colors flex items-center ${
                  stopTaskLoading 
                    ? 'bg-red-400 cursor-not-allowed' 
                    : stopTaskSuccess 
                      ? 'bg-green-600' 
                      : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {stopTaskLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Stopping...
                  </>
                ) : stopTaskSuccess ? (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    ✓ Stopped
                  </>
                ) : (
                  'Stop Task'
                )}
              </button>
              
              <button
                onClick={() => checkWindowsTaskStatus(true)}
                disabled={refreshStatusLoading || refreshStatusSuccess}
                className={`px-3 py-1 text-white text-sm rounded transition-colors flex items-center ${
                  refreshStatusLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : refreshStatusSuccess 
                      ? 'bg-green-600' 
                      : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {refreshStatusLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Refreshing...
                  </>
                ) : refreshStatusSuccess ? (
                  <>
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    ✓ Refreshed
                  </>
                ) : (
                  'Refresh Status'
                )}
              </button>
            </div>
          </div>
        </div>
        
        {windowsTaskStatus?.exists && (
          <div className="mt-4 p-3 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✅ Task is configured!</strong> Your automatic backups should run at the scheduled time.
            </p>
          </div>
        )}
        
        {!windowsTaskStatus?.exists && (
          <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ No task configured.</strong> Click "Setup Task" to configure Windows Task Scheduler for automatic backups.
              <br />
              <strong>Note:</strong> You may need to run this application as Administrator to create the task.
            </p>
          </div>
        )}
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <div ref={settingsRef} className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Backup Settings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Frequency
              </label>
              <select
                value={settings.auto_backup_frequency}
                onChange={(e) => setSettings({...settings, auto_backup_frequency: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Backup frequency setting"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Time
              </label>
              <input
                type="time"
                value={settings.auto_backup_time}
                onChange={(e) => setSettings({...settings, auto_backup_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Backup time setting"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Backups
              </label>
              <input
                type="number"
                value={settings.max_backups}
                onChange={(e) => setSettings({...settings, max_backups: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                aria-label="Maximum number of backups setting"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retention Days
              </label>
              <input
                type="number"
                value={settings.backup_retention_days}
                onChange={(e) => setSettings({...settings, backup_retention_days: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="1"
                aria-label="Backup retention days setting"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notifications
              </label>
              <select
                value={settings.backup_notifications}
                onChange={(e) => setSettings({...settings, backup_notifications: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                aria-label="Backup notifications setting"
              >
                <option value="1">Enabled</option>
                <option value="0">Disabled</option>
              </select>
            </div>

          </div>

          {/* New Specific Backup Settings */}
          <div className="mt-8 border-t pt-6">
            <h4 className="text-lg font-medium text-gray-900 mb-4">Automatic Backup Configuration</h4>
            <p className="text-sm text-gray-600 mb-6">Configure exactly which backup types should run automatically and where they should be stored.</p>
            
            {/* Local Automatic Backups */}
            <div className="mb-6">
              <h5 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                Automatic Local Backups
              </h5>
              <p className="text-xs text-gray-500 mb-3">Choose which backup types to create automatically on your local server:</p>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_local_database === '1'}
                    onChange={(e) => setSettings({...settings, auto_local_database: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Database Backup</span>
                    <span className="text-gray-500 ml-2">- Create SQL dump of your database</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_local_files === '1'}
                    onChange={(e) => setSettings({...settings, auto_local_files: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">File Backup</span>
                    <span className="text-gray-500 ml-2">- Backup uploads, configs, and system files</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_local_system === '1'}
                    onChange={(e) => setSettings({...settings, auto_local_system: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Full System Backup</span>
                    <span className="text-gray-500 ml-2">- Complete backup including database and all files</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Google Drive Automatic Uploads */}
            <div className="mb-6">
              <h5 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <div className="w-4 h-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
                Automatic Google Drive Uploads
              </h5>
              <p className="text-xs text-gray-500 mb-3">Choose which backup types to automatically upload to Google Drive cloud storage:</p>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_gdrive_database === '1'}
                    onChange={(e) => setSettings({...settings, auto_gdrive_database: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Database Backup</span>
                    <span className="text-gray-500 ml-2">- Upload database backups to Google Drive</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_gdrive_files === '1'}
                    onChange={(e) => setSettings({...settings, auto_gdrive_files: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">File Backup</span>
                    <span className="text-gray-500 ml-2">- Upload file backups to Google Drive</span>
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.auto_gdrive_system === '1'}
                    onChange={(e) => setSettings({...settings, auto_gdrive_system: e.target.checked ? '1' : '0'})}
                    className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
                  />
                  <span className="ml-3 text-sm text-gray-700">
                    <span className="font-medium">Full System Backup</span>
                    <span className="text-gray-500 ml-2">- Upload complete system backups to Google Drive</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={updateSettings}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Local Backup Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Local Backup System</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Create and manage backups stored on your local server</p>
        
        <h4 className="text-md font-medium mb-3">Create New Local Backup</h4>
        <div className="flex flex-col sm:flex-row flex-wrap gap-4">
          <button
            onClick={() => createBackup('system')}
            disabled={systemLoading}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {systemLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : systemSuccess ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Success!
              </>
            ) : (
              'Full System Backup'
            )}
          </button>
          <button
            onClick={() => createBackup('database')}
            disabled={databaseLoading}
            className="w-full sm:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {databaseLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : databaseSuccess ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Success!
              </>
            ) : (
              'Database Backup'
            )}
          </button>
          <button
            onClick={() => createBackup('files')}
            disabled={filesLoading}
            className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {filesLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Creating...
              </>
            ) : filesSuccess ? (
              <>
                <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Success!
              </>
            ) : (
              'Files Backup'
            )}
          </button>
        </div>
      </div>

      {/* Local Backups List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Local Backups</h3>
            </div>
            <button
              onClick={() => fetchBackups(true)}
              disabled={refreshLocalLoading || refreshLocalSuccess}
              className={`px-3 py-1 text-sm text-white rounded transition-colors flex items-center ${
                refreshLocalLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : refreshLocalSuccess 
                    ? 'bg-green-600' 
                    : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {refreshLocalLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Refreshing...
                </>
              ) : refreshLocalSuccess ? (
                <>
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  ✓ Refreshed
                </>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backups.map((backup, index) => (
                <tr key={index}>
                  <td className="px-3 sm:px-6 py-4 text-sm font-medium text-gray-900">
                    <div className="max-w-xs truncate">
                      {backup.filename}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getBackupTypeColor(backup.type)}`}>
                      {backup.type}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatFileSize(backup.size)}
                  </td>
                  <td className="px-3 sm:px-6 py-4 text-sm text-gray-900">
                    <div className="hidden sm:block">
                      {new Date(backup.created).toLocaleString()}
                    </div>
                    <div className="sm:hidden">
                      {new Date(backup.created).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-2">
                      <button
                        onClick={() => downloadBackup(backup.filename)}
                        className="text-blue-600 hover:text-blue-900 text-xs sm:text-sm px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => deleteBackup(backup.filename)}
                        className="text-red-600 hover:text-red-900 text-xs sm:text-sm px-2 py-1 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {backups.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No backups found. Create your first backup above.</p>
            </div>
          )}
        </div>
      </div>

      {/* Google Drive Folder Info */}
      {googleDriveFolderInfo && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Google Drive Backup Folder</h3>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-800">{googleDriveFolderInfo.name}</h4>
                <p className="text-sm text-green-600">Folder ID: {googleDriveFolderInfo.id}</p>
                <p className="text-xs text-green-500">Created: {new Date(googleDriveFolderInfo.createdTime).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google Drive Section */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Google Drive Cloud Backups</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">Manage backups stored in Google Drive cloud storage</p>
        
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-medium">Cloud Backups</h4>
          <button
            onClick={() => fetchGoogleDriveBackups(true)}
            disabled={refreshGoogleDriveLoading || refreshGoogleDriveSuccess}
            className={`px-3 py-1 text-sm text-white rounded transition-colors flex items-center ${
              refreshGoogleDriveLoading 
                ? 'bg-green-400 cursor-not-allowed' 
                : refreshGoogleDriveSuccess 
                  ? 'bg-green-600' 
                  : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {refreshGoogleDriveLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : refreshGoogleDriveSuccess ? (
              <>
                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                ✓ Refreshed
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
        
        {googleDriveBackups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No backups found in Google Drive</p>
            <p className="text-sm mt-2">Upload local backups to Google Drive for cloud storage</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Filename</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Size</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Modified</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {googleDriveBackups.map((backup, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 truncate max-w-xs" title={backup.name}>
                        {backup.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatFileSize(parseInt(backup.size || '0'))}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(backup.createdTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {new Date(backup.modifiedTime).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => deleteFromGoogleDrive(backup.id, backup.name)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Local Backups to Google Drive */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Upload Local Backups to Google Drive</h3>
        </div>
        <p className="text-gray-600 mb-4">Select local backups to upload to Google Drive for cloud storage</p>
        
        {backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No local backups available to upload</p>
          </div>
        ) : (
          <div className="space-y-2">
            {backups.slice(0, 5).map((backup, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{backup.filename}</div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(backup.size)} • {backup.created}
                  </div>
                </div>
                <button
                  onClick={() => uploadToGoogleDrive(backup.filename)}
                  disabled={uploadingFiles.has(backup.filename)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploadingFiles.has(backup.filename) ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Uploading...
                    </>
                  ) : (
                    'Upload'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule Prompt Modal */}
      {showReschedulePrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Backup Schedule Reset</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 mb-4">
                The scheduled backup time has passed. Would you like to:
              </p>
              <div className="space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="font-medium text-blue-900">Option 1: Schedule at Default Time</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Set up weekly backup at 6:30 PM (database backup only)
                  </p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-medium text-gray-900">Option 2: Disable Auto Backup</h4>
                  <p className="text-sm text-gray-700 mt-1">
                    Turn off automatic backups completely
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReschedulePrompt(false);
                  setModalJustClosed(true);
                  
                  // Mark that user has handled the backup schedule reset today
                  const today = new Date().toDateString();
                  localStorage.setItem('backup_schedule_handled_' + today, 'true');
                  
                  setTimeout(() => {
                    setModalJustClosed(false);
                  }, 1000);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={resetToDefaultSettings}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 transition-colors"
              >
                Disable Auto Backup
              </button>
              <button
                onClick={scheduleAtDefaultTime}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Schedule at Default Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmationModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center">
                {confirmationModal.type === 'danger' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {confirmationModal.type === 'warning' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {confirmationModal.type === 'info' && (
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{confirmationModal.title}</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">{confirmationModal.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={hideConfirmationModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {confirmationModal.cancelText}
              </button>
              <button
                onClick={() => {
                  confirmationModal.onConfirm();
                  hideConfirmationModal();
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  confirmationModal.type === 'danger' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : confirmationModal.type === 'warning'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {confirmationModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BackupManagement;
