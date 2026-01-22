import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { X, Send, Circle, Trash2, MoreVertical, MessageCircle, User, Store, Image as ImageIcon, Clock } from 'lucide-react';
import { getImageUrl } from '../config/api';
import { toast } from 'sonner';

const ChatPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeConversation,
    messages,
    isConnected,
    conversation,
    typingUsers,
    onlineUsers,
    socket,
    openChat,
    closeChat,
    sendMessage,
    setTyping,
    loadMessages,
    loadConversations,
    setActiveConversationById,
    deleteConversation,
  } = useChat();
  
  // Check if we have a conversationId from navigation state
  const conversationIdFromState = location.state?.conversationId;

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get vendorId from location state or product data
  const vendorId = location.state?.vendorId || conversation?.product?.vendor_user_id;

  // Open conversation when component mounts or productId changes
  useEffect(() => {
    // If we have a conversationId from navigation, use it
    if (conversationIdFromState) {
      // Check if current active conversation matches the one from state
      if (activeConversation !== conversationIdFromState) {
        setLoading(true);
        // Close previous conversation if different
        if (activeConversation && activeConversation !== conversationIdFromState) {
          closeChat();
        }
        setActiveConversationById(conversationIdFromState)
          .then(() => {
            setLoading(false);
          })
          .catch((error: any) => {
            console.error('Error loading conversation:', error);
            setLoading(false);
            toast.error('Failed to load conversation');
          });
      } else {
        setLoading(false);
      }
      return;
    }

    // If we have a productId but no conversationId from state
    if (productId) {
      // Check if current conversation is for a different product
      const currentProductId = conversation?.product_id || conversation?.product?.product_id;
      if (activeConversation && currentProductId && currentProductId !== productId) {
        // Product changed - close old conversation
        closeChat();
        setLoading(true);
        openChat(productId, vendorId)
          .then(() => {
            setLoading(false);
          })
          .catch((error: any) => {
            console.error('Error opening chat:', error);
            setLoading(false);
            toast.error('Failed to load conversation');
            setTimeout(() => navigate(-1), 2000);
          });
      } else if (!activeConversation) {
        // No active conversation - open new one
        setLoading(true);
        openChat(productId, vendorId)
          .then(() => {
            setLoading(false);
          })
          .catch((error: any) => {
            console.error('Error opening chat:', error);
            setLoading(false);
            toast.error('Failed to load conversation');
            setTimeout(() => navigate(-1), 2000);
          });
      } else {
        // Same product, conversation already active
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [productId, vendorId, activeConversation, conversation, openChat, closeChat, navigate, conversationIdFromState, setActiveConversationById]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeConversation]);

  // Focus input when conversation loads
  useEffect(() => {
    if (activeConversation && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeConversation]);

  // Hide chatbot on chat page to prevent blocking send button
  useEffect(() => {
    const chatbotButton = document.querySelector('[aria-label="Open AI Assistant"]') as HTMLElement;
    const chatbotWindow = document.querySelector('.fixed.bottom-0.right-0.z-50') as HTMLElement;
    
    if (chatbotButton) {
      chatbotButton.style.display = 'none';
    }
    if (chatbotWindow) {
      chatbotWindow.style.display = 'none';
    }
    
    return () => {
      if (chatbotButton) {
        chatbotButton.style.display = '';
      }
      if (chatbotWindow) {
        chatbotWindow.style.display = '';
      }
    };
  }, []);

  // Re-check online status when conversation changes
  useEffect(() => {
    if (activeConversation && conversation && socket?.connected) {
      const otherUserId = user?.role === 'vendor' 
        ? conversation.customer_id
        : conversation.product?.vendor_user_id;
      
      if (otherUserId) {
        socket.emit('check_user_online', {
          userId: String(otherUserId),
          conversationId: activeConversation
        });
      }
    }
  }, [activeConversation, conversation, user?.role, socket]);

  const conversationMessages = activeConversation ? (messages[activeConversation] || []) : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    if (activeConversation) {
      setTyping(activeConversation, true);

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

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
      toast.error('Failed to send message');
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="text-center space-y-4">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-green-500"></div>
          <div className="font-medium text-gray-700 dark:text-gray-300 text-sm sm:text-base">Loading conversation...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const returnTo = location.state?.returnTo;
                  // Check if coming from dashboard
                  if (returnTo && returnTo.includes('/dashboard')) {
                    // Return to dashboard with messages tab active
                    navigate('/dashboard', { state: { activeTab: 'messages' } });
                  } else if (returnTo) {
                    navigate(returnTo);
                  } else if (user?.role === 'vendor') {
                    navigate('/vendor/inbox');
                  } else {
                    // Default for customers - go to inbox
                    navigate('/inbox');
                  }
                }}
                className="flex-shrink-0 p-2"
                aria-label="Go back"
                title="Go back"
              >
                <X className="h-5 w-5" />
              </Button>

              {conversation?.product?.product_image && (
                <img
                  src={getImageUrl(conversation.product.product_image)}
                  alt={conversation.product.product_name}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0 border-2 border-green-200"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-100 flex items-center gap-2">
                  <span className="truncate">{conversation?.product?.vendor_name || (user?.role === 'vendor' ? 'Customer' : 'Vendor')}</span>
                  {(() => {
                    // Get the other user's ID (customer if vendor, vendor if customer)
                    const otherUserId = user?.role === 'vendor' 
                      ? conversation?.customer_id
                      : conversation?.product?.vendor_user_id;
                    
                    // Check if other user is online
                    const otherUserOnline = activeConversation && otherUserId
                      ? onlineUsers[activeConversation]?.has(String(otherUserId))
                      : false;
                    
                    return otherUserOnline ? (
                      <span title="Online">
                        <Circle className="h-2.5 w-2.5 fill-green-500 text-green-500 flex-shrink-0" />
                      </span>
                    ) : (
                      <span title="Offline">
                        <Circle className="h-2.5 w-2.5 fill-gray-400 text-gray-400 flex-shrink-0" />
                      </span>
                    );
                  })()}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
                  {conversation?.product?.product_name || 'Product'}
                </div>
              </div>
              {activeConversation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Delete entire conversation? This cannot be undone.')) {
                      deleteConversation(activeConversation).then(() => {
                        navigate(user?.role === 'vendor' ? '/vendor/inbox' : '/inbox');
                      }).catch(() => {});
                    }
                  }}
                  className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Delete conversation"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-2 sm:px-4 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
          {conversationMessages.length === 0 && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8 sm:py-12">
              <div className="space-y-4 max-w-sm mx-auto">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-2">
                  <MessageCircle className="h-10 w-10 text-primary" />
                </div>
                <div className="font-semibold text-gray-700 dark:text-gray-300 text-lg sm:text-xl">Start a conversation</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Send a message to get started with the vendor</div>
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
                key={message.id || idx}
                className={`flex gap-2 sm:gap-3 ${isOwn ? 'justify-end' : 'justify-start'} items-end mb-2`}
              >
                {!isOwn && !sameSenderAsPrev && (
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex-shrink-0 flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800">
                    {isVendor ? (
                      <Store className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    ) : (
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                    )}
                  </div>
                )}
                {!isOwn && sameSenderAsPrev && <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" />}

                <div className={`max-w-[75%] sm:max-w-[70%] ${isOwn ? 'order-first' : 'order-last'}`}>
                  <div
                    className={`px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl shadow-md ${
                      isOwn
                        ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm sm:text-base break-words leading-relaxed whitespace-pre-wrap">
                      {message.message_text}
                    </p>
                    <div
                      className={`flex items-center gap-1 text-xs mt-2 ${
                        isOwn ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      <span>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {isOwn && !sameSenderAsPrev && (
                  <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-accent to-accent/80 flex-shrink-0 flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800">
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                  </div>
                )}
                {isOwn && sameSenderAsPrev && <div className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0" />}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex gap-2 sm:gap-3 justify-start items-end mb-2">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex-shrink-0 flex items-center justify-center shadow-md border-2 border-white dark:border-gray-800">
                <Store className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 sm:px-5 sm:py-3.5 shadow-md">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 sm:p-5 relative z-[10000] shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-2 border border-gray-200 dark:border-gray-700">
            <input
              ref={inputRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={!activeConversation ? 'Loading...' : 'Type your message...'}
              className="flex-1 bg-transparent border-none px-3 sm:px-4 py-3 text-sm sm:text-base focus:outline-none disabled:cursor-not-allowed disabled:placeholder-gray-400 dark:disabled:placeholder-gray-500 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              disabled={sending || !activeConversation || loading}
            />
            <Button
              onClick={handleSend}
              disabled={!activeConversation || sending || loading || !messageText.trim()}
              className="flex-shrink-0 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 sm:px-5 py-3 transition-all duration-200 shadow-md hover:shadow-lg disabled:shadow-none min-w-[48px] sm:min-w-auto"
              size="lg"
              title={!activeConversation ? 'Loading conversation...' : sending ? 'Sending...' : 'Send message'}
            >
              {sending ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;


















