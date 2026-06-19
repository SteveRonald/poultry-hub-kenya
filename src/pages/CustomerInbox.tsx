import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiUrl, getImageUrl } from '../config/api';
import { Button } from '../components/ui/button';

export default function CustomerInbox() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const token = localStorage.getItem('session_token') || localStorage.getItem('token');
        const res = await fetch(getApiUrl('/api/conversations'), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) {
          throw new Error('Failed to fetch conversations');
        }
        const data = await res.json();
        setConversations(data.conversations || []);
      } catch (e) {
        console.error('Failed to fetch conversations', e);
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, []);

  const handleOpenChat = (conv: any) => {
    // Navigate to chat page
    const currentPath = window.location.pathname;
    navigate(`/chat/${conv.product_id}`, {
      state: {
        conversationId: conv.id,
        returnTo: currentPath.includes('/dashboard') ? '/dashboard' : currentPath
      }
    });
  };

  return (
    <div>
      <div className="py-4 px-3 sm:px-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold mb-4">Your Messages</h1>
          {loading && <div className="text-gray-600 dark:text-gray-400">Loading...</div>}
          {!loading && conversations.length === 0 && <div className="text-gray-600 dark:text-gray-400">No conversations found.</div>}
          <div className="space-y-3">
            {conversations.map((conv, idx) => (
              <div key={idx} className="p-3 sm:p-4 bg-white dark:bg-gray-800 rounded shadow flex justify-between items-start gap-3">
                <div className="flex gap-3 flex-1 min-w-0">
                  {/* Product Image */}
                  {conv.product_image && (
                    <img 
                      src={getImageUrl(conv.product_image)} 
                      alt={conv.product_name}
                      className="h-16 w-16 sm:h-20 sm:w-20 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100">{conv.product_name || 'Product'}</div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">With: {conv.vendor_name || `Vendor`}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{conv.last_message || 'No message'}</div>
                    {conv.unread_count > 0 && (
                      <div className="text-xs text-green-600 font-semibold mt-1">
                        {conv.unread_count} unread message{conv.unread_count > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                <Button 
                  onClick={() => handleOpenChat(conv)} 
                  size="sm" 
                  className="flex-shrink-0"
                >
                  Open
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
