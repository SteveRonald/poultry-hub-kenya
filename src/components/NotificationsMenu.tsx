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
  const mobileModalRef = useRef<HTMLDivElement>(null);
  const desktopDropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Ensure we always have an array
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setNotifications([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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

  const markAsRead = async (id: number) => {
    const token = localStorage.getItem('token');
    try {
      await fetch(getApiUrl('/api/notifications/read'), {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      fetchNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
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
                {isAdmin ? (
                  <div className="p-6 text-center text-gray-500">
                    <div className="mb-4">
                      <Bell className="h-12 w-12 text-gray-400 mx-auto" />
                    </div>
                    <p className="text-base font-medium">Admin notifications</p>
                    <p className="text-sm text-gray-400 mt-2">
                      System notifications will appear here
                    </p>
                  </div>
                ) : loading ? (
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
                        {!n.is_read && (
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100 flex-shrink-0" 
                            onClick={() => markAsRead(n.id)}
                          >
                            Mark read
                          </button>
                        )}
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
                {isAdmin ? (
                  <div className="p-4 text-center text-gray-500">
                    <div className="mb-2">
                      <Bell className="h-8 w-8 text-gray-400 mx-auto" />
                    </div>
                    <p className="text-sm">Admin notifications</p>
                    <p className="text-xs text-gray-400 mt-1">
                      System notifications will appear here
                    </p>
                  </div>
                ) : loading ? (
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
                        {!n.is_read && (
                          <button 
                            className="text-xs text-blue-600 hover:underline flex-shrink-0" 
                            onClick={() => markAsRead(n.id)}
                          >
                            Mark as read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default NotificationsMenu; 