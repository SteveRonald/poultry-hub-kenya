import React, { useEffect, useRef, useState } from 'react';
import { X, Send, Circle } from 'lucide-react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../config/api';
import { Button } from './ui/button';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  vendorId?: number;
}

const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose, productId, vendorId }) => {
  const { 
    activeConversation, 
    messages, 
    sendMessage, 
    loadMessages, 
    setTyping,
    typingUsers,
    isConnected,
    conversations,
    openChat
  } = useChat();
  const { user } = useAuth();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationMessages = activeConversation ? (messages[activeConversation] || []) : [];
  const conversation = activeConversation 
    ? conversations.find(c => c.id === activeConversation)
    : null;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Open conversation when drawer opens
  useEffect(() => {
    if (isOpen && !activeConversation && productId) {
      setLoading(true);
      openChat(productId, vendorId)
        .then(() => {
          setLoading(false);
        })
        .catch((error: any) => {
          console.error('Error opening chat:', error);
          setLoading(false);
          // If auth error, close drawer
          if (error?.message?.includes('login') || error?.message?.includes('token')) {
            onClose();
          }
        });
    }
  }, [isOpen, productId, vendorId, activeConversation, openChat, onClose]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen && inputRef.current && activeConversation) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, activeConversation]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (activeConversation) {
      setTyping(activeConversation, true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (activeConversation) {
          setTyping(activeConversation, false);
        }
      }, 2000);
    }
  };

  const handleSend = async () => {
    if (!activeConversation || !messageText.trim() || sending || loading) return;

    setSending(true);
    try {
      await sendMessage(activeConversation, messageText.trim());
      setMessageText('');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (activeConversation) {
        setTyping(activeConversation, false);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      if (error?.message?.includes('login') || error?.message?.includes('token')) {
        onClose();
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = activeConversation 
    ? Array.from(typingUsers[activeConversation] || []).some(id => id !== user?.id)
    : false;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-end animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer - Improved rendering */}
      <div className="relative bg-white w-full sm:w-96 h-full sm:h-[600px] sm:max-h-[90vh] sm:rounded-t-lg sm:rounded-l-lg flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-50 to-green-100 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {conversation?.product?.product_image && (
              <img 
                src={getImageUrl(conversation.product.product_image)} 
                alt={conversation.product.product_name}
                className="h-10 w-10 rounded-full object-cover flex-shrink-0 border-2 border-green-200"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm sm:text-base text-gray-800 flex items-center gap-2">
                <span className="truncate">{conversation?.product?.vendor_name || 'Vendor'}</span>
                {isConnected && (
                  <Circle className="h-2 w-2 fill-green-500 text-green-500 flex-shrink-0" title="Online" />
                )}
                {!isConnected && (
                  <Circle className="h-2 w-2 fill-gray-400 text-gray-400 flex-shrink-0" title="Offline" />
                )}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 truncate">
                {conversation?.product?.product_name || 'Product'}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-600 hover:text-gray-900 flex-shrink-0"
            aria-label="Close chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-white to-gray-50 px-3 sm:px-4 py-4 space-y-2 sm:space-y-3">
          {loading && (
            <div className="text-center text-gray-500 text-sm h-full flex items-center justify-center py-8">
              <div className="space-y-3">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
                <div className="font-medium">Loading conversation...</div>
              </div>
            </div>
          )}
          {!loading && conversationMessages.length === 0 && (
            <div className="text-center text-gray-500 text-sm h-full flex items-center justify-center py-8 px-4">
              <div className="space-y-3 max-w-xs mx-auto">
                <div className="text-5xl mb-3 animate-pulse">💬</div>
                <div className="font-semibold text-gray-700 text-base">Start a conversation</div>
                <div className="text-xs text-gray-500">Send a message to get started</div>
              </div>
            </div>
          )}

          {conversationMessages.map((message, idx) => {
            const isOwn = String(message.sender_id) === String(user?.id);
            const isVendor = message.sender_role === 'vendor';
            const prevMessage = idx > 0 ? conversationMessages[idx - 1] : null;
            const sameSenderAsPrev = prevMessage && String(prevMessage.sender_id) === String(message.sender_id);

            return (
              <div 
                key={message.id} 
                className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} items-end`}
              >
                {!isOwn && !sameSenderAsPrev && (
                  <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs text-gray-700 font-semibold">
                    {isVendor ? 'V' : 'C'}
                  </div>
                )}
                {!isOwn && sameSenderAsPrev && <div className="h-8 w-8 flex-shrink-0" />}

                <div className={`max-w-[75%] sm:max-w-xs ${isOwn ? 'order-first' : 'order-last'}`}>
                  <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl sm:rounded-3xl shadow-sm ${
                    isOwn 
                      ? 'bg-green-500 text-white rounded-tr-sm' 
                      : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm'
                  }`}>
                    <p className="text-sm sm:text-base break-words leading-relaxed whitespace-pre-wrap">{message.message_text}</p>
                    <div className={`text-[10px] sm:text-xs mt-1.5 font-medium ${
                      isOwn ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {new Date(message.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                  </div>
                </div>

                {isOwn && !sameSenderAsPrev && (
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex-shrink-0 flex items-center justify-center text-xs text-white font-semibold border-2 border-green-300 shadow-sm">
                    You
                  </div>
                )}
                {isOwn && sameSenderAsPrev && <div className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0" />}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-2 justify-start items-end mb-1">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs text-gray-700 font-semibold border border-gray-300">
                V
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl sm:rounded-3xl rounded-tl-sm px-3 sm:px-4 py-2 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-gray-200 bg-white flex gap-2 flex-shrink-0">
          <input
            ref={inputRef}
            value={messageText}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={!activeConversation ? "Loading..." : "Type a message..."}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed disabled:placeholder-gray-400"
            disabled={sending || !activeConversation || loading}
          />
          <Button
            onClick={handleSend}
            disabled={!activeConversation || sending || loading || !messageText.trim()}
            className="flex-shrink-0 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2.5 sm:p-3 transition-all duration-200 shadow-sm hover:shadow-md"
            size="sm"
            title={!activeConversation ? 'Loading conversation...' : sending ? 'Sending...' : 'Send message'}
          >
            {sending ? (
              <div className="h-4 w-4 sm:h-5 sm:w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatDrawer;

