import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { getApiUrl } from '../config/api';

interface NotificationsMenuProps {
  isAdmin?: boolean;
}

const NotificationsMenu = ({ isAdmin = false }: NotificationsMenuProps) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    <div className="relative inline-block text-left">
      <button onClick={() => setOpen(!open)} className="relative focus:outline-none">
        <Bell className="h-6 w-6 text-primary" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5">
            {unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-2 px-4 border-b font-semibold text-primary">Notifications</div>
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
            ) : notifications.map(n => (
              <div key={n.id} className={`px-4 py-2 border-b last:border-b-0 flex items-start gap-2 ${n.is_read ? 'bg-gray-50' : 'bg-blue-50'}`}>
                <div className="flex-1">
                  <div className="text-sm text-gray-800">{n.message}</div>
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && (
                  <button className="text-xs text-blue-600 hover:underline ml-2" onClick={() => markAsRead(n.id)}>Mark as read</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsMenu; 