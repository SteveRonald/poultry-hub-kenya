import React, { useEffect, useState, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { getApiUrl } from '../config/api';

interface NotificationsMenuProps {
  isAdmin?: boolean;
}

const NotificationsMenu = ({ isAdmin = false }: NotificationsMenuProps) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const mobileModalRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  const fetchNotifications = async () => {
    const token = isAdmin ? localStorage.getItem('admin_session_token') : localStorage.getItem('token');
    if (!token) {
      // No token means user is not logged in - stop loading and don't poll
      setLoading(false);
      setNotifications([]);
      return;
    }

    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;

    // Only show loading spinner on first load; don't flicker on background refresh.
    setLoading((prev) => (notifications.length === 0 ? true : prev));
    try {
      const res = await fetch(getApiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Handle 401 (Unauthorized) - user token is invalid or expired
      if (res.status === 401) {
        // Token is invalid - clear notifications and stop polling
        setNotifications([]);
        setLoading(false);
        // Don't log as error - this is normal when user is not authenticated
        return;
      }
      
      if (!res.ok) {
        // Other errors - log but don't show to user
        console.warn('Failed to fetch notifications:', res.status, res.statusText);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      // Ensure we always have an array
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      // Network errors or other issues - don't log if it's just a connection issue
      // Only log actual errors, not expected failures
      if (error instanceof Error && !error.message.includes('fetch')) {
        console.error('Failed to fetch notifications:', error);
      }
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    const token = isAdmin ? localStorage.getItem('admin_session_token') : localStorage.getItem('token');
    if (!token) {
      // User is not logged in - don't fetch or poll
      setLoading(false);
      setNotifications([]);
      return;
    }
    
    // Fetch immediately
    fetchNotifications();
    
    // Only poll if user is authenticated
    // Poll for new notifications:
    // - faster when the menu is open
    // - slightly faster for admin sessions
    const intervalMs = open ? 5000 : (isAdmin ? 10000 : 30000);
    const interval = setInterval(() => {
      const currentToken = isAdmin ? localStorage.getItem('admin_session_token') : localStorage.getItem('token');
      if (currentToken) {
        fetchNotifications();
      } else {
        // Token was removed - stop polling
        clearInterval(interval);
        setNotifications([]);
        setLoading(false);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isAdmin, open]);

  // Fetch latest notifications when opening the menu or when tab becomes visible again.
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isAdmin]);

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        desktopDropdownRef.current && 
        !desktopDropdownRef.current.contains(target) &&
        !(event.target as HTMLElement).closest('button[aria-label="Notifications"]')
      ) {
        setOpen(false);
      }
    };

    // Only add listener on desktop (md and up)
    const isMobile = window.innerWidth < 768;
    if (open && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Prevent body scroll when modal is open on mobile
  useEffect(() => {
    if (open) {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        document.body.style.overflow = 'hidden';
      }
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Prevent body scroll when delete confirmation is open
  useEffect(() => {
    if (confirmOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      // Only clear overflow if notifications modal isn't open
      if (!open) {
        document.body.style.overflow = '';
      }
    }

    return () => {
      if (!open) {
        document.body.style.overflow = '';
      }
    };
  }, [confirmOpen, open]);

  const markAsRead = async (id: number) => {
    const token = isAdmin ? localStorage.getItem('admin_session_token') : localStorage.getItem('token');
    if (!token) return; // Don't attempt if no token
    
    try {
      const res = await fetch(getApiUrl('/api/notifications/read'), {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      
      if (res.ok) {
        // Only refresh if request was successful
        fetchNotifications();
      } else if (res.status === 401) {
        // Token expired - don't show error, just stop
        setNotifications([]);
      }
    } catch (error) {
      // Network error - don't log, just silently fail
      // User can manually refresh if needed
    }
  };

  const openDeleteConfirm = (id: number) => {
    setConfirmId(id);
    setConfirmOpen(true);
  };

  const performDelete = async (id: number) => {
    const token = isAdmin ? localStorage.getItem('admin_session_token') : localStorage.getItem('token');
    if (!token) {
      setConfirmOpen(false);
      setConfirmId(null);
      return;
    }

    try {
      const res = await fetch(getApiUrl('/api/notifications/' + id), {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        fetchNotifications();
      } else if (res.status === 401) {
        setNotifications([]);
      }
    } catch (error) {
      // Silently fail
    } finally {
      setConfirmOpen(false);
      setConfirmId(null);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="relative inline-block text-left">
        <button 
          onClick={() => setOpen(!open)} 
          className="relative focus:outline-none p-1"
          aria-label="Notifications"
        >
          <Bell className="h-6 w-6 text-primary" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold min-w-[1.25rem]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
        
        {open && (
          <>
            {/* Mobile Modal */}
            <div 
              ref={mobileModalRef}
              className="fixed inset-x-0 top-0 bottom-0 md:hidden bg-white z-50 flex flex-col shadow-xl"
            >
              {/* Mobile Header */}
              <div className="py-4 px-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                <h2 className="text-lg font-semibold text-primary">Notifications</h2>
                <button 
                  onClick={() => setOpen(false)}
                  className="p-2 -mr-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                  aria-label="Close notifications"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Mobile Content */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-6 text-center text-gray-500">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-base">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`px-4 py-4 flex items-start gap-3 ${n.is_read ? 'bg-white' : 'bg-blue-50'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                            {n.message}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!n.is_read ? (
                            <button 
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100" 
                              onClick={() => markAsRead(n.id)}
                            >
                              Mark
                            </button>
                          ) : (
                            <button
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                              onClick={() => openDeleteConfirm(n.id)}
                              title="Delete notification"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Dropdown */}
            <div 
              ref={desktopDropdownRef}
              className="hidden md:block origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50"
            >
              <div className="py-2 px-4 border-b border-gray-200 font-semibold text-primary flex items-center justify-between">
                <span>Notifications</span>
                <button 
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  aria-label="Close notifications"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No notifications</div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`px-4 py-3 flex items-start gap-2 ${n.is_read ? 'bg-white' : 'bg-blue-50'}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm ${n.is_read ? 'text-gray-700' : 'text-gray-900'}`}>
                            {n.message}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {new Date(n.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!n.is_read ? (
                            <button 
                              className="text-xs text-blue-600 hover:underline flex-shrink-0" 
                              onClick={() => markAsRead(n.id)}
                            >
                              Mark as read
                            </button>
                          ) : (
                            <button
                              className="text-xs text-red-600 hover:underline flex-shrink-0"
                              onClick={() => openDeleteConfirm(n.id)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
      {/* Delete Confirmation Modal */}
      {confirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center px-3" style={{ zIndex: 9999 }} role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black bg-opacity-40" style={{ zIndex: 9998 }} onClick={() => { setConfirmOpen(false); setConfirmId(null); }} />
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-4 mx-auto" style={{ zIndex: 10000 }}>
            <h3 className="text-lg font-semibold text-gray-800">Delete notification</h3>
            <p className="text-sm text-gray-600 mt-2">Are you sure you want to delete this notification? This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setConfirmOpen(false); setConfirmId(null); }}
                className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={() => { if (confirmId) performDelete(confirmId); }}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 touch-manipulation"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationsMenu; 
