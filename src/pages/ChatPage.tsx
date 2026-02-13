import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { X, Send, Circle, Trash2, MessageCircle, User, Store, Clock, Check, Plus } from 'lucide-react';
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
    conversations,
    conversation,
    typingUsers,
    onlineUsers,
    socket,
    openChat,
    sendMessage,
    setTyping,
    setActiveConversationById,
    deleteMessage,
    deleteConversation,
  } = useChat();
  
  // Check if we have a conversationId from navigation state
  const conversationIdFromState = location.state?.conversationId;

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showStartNewModal, setShowStartNewModal] = useState(false);
  const [showDeleteConversationModal, setShowDeleteConversationModal] = useState(false);
  const [deleteConversationTargetId, setDeleteConversationTargetId] = useState<string | null>(null);
  const [mobileConversationsOpen, setMobileConversationsOpen] = useState(true);
  const [startingNewConversation, setStartingNewConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStartingNewConversationRef = useRef(false);

  // Get vendorId from location state or product data
  const vendorId = location.state?.vendorId || conversation?.product?.vendor_user_id;

  // Open conversation on initial load / route changes
  useEffect(() => {
    if (isStartingNewConversationRef.current) return;

    let cancelled = false;
    const initConversation = async () => {
      const shouldOpenById = !!(conversationIdFromState && activeConversation !== conversationIdFromState);
      const shouldOpenByProduct = !!(productId && !activeConversation);
      if (!shouldOpenById && !shouldOpenByProduct) {
        setLoading(false);
        return;
      }

      const shouldBlockUI = !activeConversation;
      if (shouldBlockUI) {
        setLoading(true);
      }
      try {
        if (shouldOpenById) {
          await setActiveConversationById(String(conversationIdFromState));
        } else if (shouldOpenByProduct) {
          await openChat(String(productId), vendorId);
        }
      } catch (error) {
        // openChat / setActiveConversationById already handle user-facing error toasts
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initConversation();
    return () => {
      cancelled = true;
    };
  }, [productId, conversationIdFromState, setActiveConversationById, openChat, vendorId, activeConversation]);

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

  const handleDeleteSingleMessage = async (messageId: string) => {
    if (!activeConversation || !messageId || String(messageId).startsWith('temp-')) return;
    try {
      await deleteMessage(messageId, activeConversation);
      setShowDeleteConfirm(null);
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleStartNewConversation = async () => {
    const targetProductId = productId || conversation?.product_id || conversation?.product?.product_id;
    if (!targetProductId) {
      toast.error('Product not found');
      return;
    }

    try {
      isStartingNewConversationRef.current = true;
      setStartingNewConversation(true);
      setShowDeleteConfirm(null);
      await openChat(targetProductId, vendorId, true, true);
      setShowStartNewModal(false);
      toast.success('New conversation started');
    } catch (error) {
      toast.error('Failed to start new conversation');
    } finally {
      isStartingNewConversationRef.current = false;
      setStartingNewConversation(false);
    }
  };

  const openConversationFromList = (conv: any) => {
    navigate(`/chat/${conv.product_id}`, {
      state: { conversationId: conv.id, returnTo: location.state?.returnTo || window.location.pathname },
      replace: true,
    });
  };

  const requestDeleteConversation = (conversationId: string | null) => {
    if (!conversationId) return;
    setDeleteConversationTargetId(conversationId);
    setShowDeleteConversationModal(true);
  };

  const handleDeleteConversationById = async () => {
    const targetId = deleteConversationTargetId || activeConversation;
    if (!targetId) return;

    try {
      await deleteConversation(targetId);
      setShowDeleteConversationModal(false);
      setDeleteConversationTargetId(null);

      if (targetId === activeConversation) {
        const remaining = conversations.filter((c) => c.id !== targetId);
        if (remaining.length > 0) {
          openConversationFromList(remaining[0]);
        } else {
          navigate(user?.role === 'vendor' ? '/vendor/inbox' : '/inbox');
        }
      } else {
        toast.success('Conversation deleted');
      }
    } catch {
      toast.error('Failed to delete conversation');
    }
  };

  const isTyping = activeConversation
    ? Array.from(typingUsers[activeConversation] || []).some(id => id !== user?.id)
    : false;

  const renderMessageStatus = (message: any, isOwn: boolean) => {
    if (!isOwn) return null;

    const isDelivered = !!message.id && !String(message.id).startsWith('temp-');
    const isRead = isDelivered && !!message.is_read;
    const colorClass = isRead ? 'text-sky-300' : 'text-white/85';

    if (!isDelivered) {
      return <Check className={`h-3.5 w-3.5 ${colorClass}`} />;
    }

    return (
      <span className={`inline-flex items-center ${colorClass}`}>
        <Check className="h-3.5 w-3.5" />
        <Check className="h-3.5 w-3.5 -ml-1.5" />
      </span>
    );
  };

  if (loading && !activeConversation) {
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
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowStartNewModal(true)}
                    className="flex-shrink-0 p-2 text-primary hover:text-primary/90 hover:bg-primary/10"
                    title="Start new conversation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => requestDeleteConversation(activeConversation)}
                    className="flex-shrink-0 p-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 px-2 sm:px-4 py-4 sm:py-6 xl:py-8">
        <div className="max-w-6xl mx-auto lg:flex lg:gap-4">
          <div className="lg:hidden mb-3">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <button
                type="button"
                className="w-full px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
                onClick={() => setMobileConversationsOpen((v) => !v)}
              >
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Conversations</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {mobileConversationsOpen ? 'Hide' : 'Show'}
                </span>
              </button>
              {mobileConversationsOpen && (
                <div className="max-h-56 overflow-y-auto">
                  {conversations.length === 0 && (
                    <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No conversations yet.</div>
                  )}
                  {conversations.map((conv) => {
                    const isActive = activeConversation === conv.id;
                    const preview = conv.last_message || 'No messages yet';
                    return (
                      <div
                        key={`mobile-${conv.id}`}
                        className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700 ${
                          isActive ? 'bg-primary/10 dark:bg-primary/20' : ''
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            className="flex-1 text-left min-w-0"
                            onClick={() => openConversationFromList(conv)}
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {user?.role === 'vendor'
                                ? ((conv as any).customer_name || (conv.product as any)?.customer_name || 'Customer')
                                : ((conv as any).vendor_name || conv.product?.vendor_name || 'Vendor')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {conv.product?.product_name || (conv as any).product_name || 'Product'}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">{preview}</p>
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete conversation"
                            onClick={() => requestDeleteConversation(conv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <aside className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Conversations</h3>
              </div>
              <div className="max-h-[65vh] overflow-y-auto">
                {conversations.length === 0 && (
                  <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No conversations yet.</div>
                )}
                {conversations.map((conv) => {
                  const isActive = activeConversation === conv.id;
                  const preview = conv.last_message || 'No messages yet';
                  return (
                    <div
                      key={conv.id}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${
                        isActive ? 'bg-primary/10 dark:bg-primary/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          className="flex-1 text-left min-w-0"
                          onClick={() => openConversationFromList(conv)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {user?.role === 'vendor'
                                ? ((conv as any).customer_name || (conv.product as any)?.customer_name || 'Customer')
                                : ((conv as any).vendor_name || conv.product?.vendor_name || 'Vendor')}
                            </p>
                            {conv.unread_count ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary text-white">{conv.unread_count}</span>
                            ) : null}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {conv.product?.product_name || (conv as any).product_name || 'Product'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 truncate mt-1">{preview}</p>
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete conversation"
                          onClick={() => requestDeleteConversation(conv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
          <div className="flex-1 min-w-0 space-y-3 sm:space-y-4">
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
                onMouseEnter={() => setHoveredMessageId(message.id || null)}
                onMouseLeave={() => setHoveredMessageId(null)}
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

                <div className={`relative group max-w-[78%] sm:max-w-[70%] xl:max-w-[58%] ${isOwn ? 'order-first' : 'order-last'}`}>
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
                      <span className="ml-1 inline-flex items-center">
                        {renderMessageStatus(message, isOwn)}
                      </span>
                    </div>
                  </div>
                  {isOwn && !String(message.id || '').startsWith('temp-') && (
                    <button
                      type="button"
                      className={`absolute -top-2 ${isOwn ? '-left-2' : '-right-2'} p-1.5 rounded-full bg-white/95 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 hover:text-red-600 shadow transition-opacity ${
                        hoveredMessageId === message.id ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                      }`}
                      title="Delete message"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(showDeleteConfirm === message.id ? null : (message.id || null));
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {isOwn && showDeleteConfirm === message.id && (
                    <div className={`absolute ${isOwn ? '-left-2' : '-right-2'} top-8 z-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 w-44`}>
                      <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">Delete this message?</p>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs bg-red-600 hover:bg-red-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSingleMessage(message.id);
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
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
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 sm:p-5 relative z-[10000] shadow-lg">
        <div className="max-w-6xl mx-auto lg:flex lg:gap-4">
          <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0" />
          <div className="flex-1 min-w-0">
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

      {showStartNewModal && (
        <div className="fixed inset-0 z-[13000] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Start New Conversation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              This will create a fresh thread. Your current messages will remain in the old conversation.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowStartNewModal(false)} disabled={startingNewConversation}>Cancel</Button>
              <Button onClick={handleStartNewConversation} disabled={startingNewConversation} className="bg-primary hover:bg-primary/90 text-white">
                {startingNewConversation ? 'Starting...' : 'Start New'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConversationModal && (
        <div className="fixed inset-0 z-[13000] flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete Conversation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              This removes all messages in this thread and cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteConversationModal(false);
                  setDeleteConversationTargetId(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleDeleteConversationById} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;


















