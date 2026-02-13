import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getApiUrl } from '../config/api';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: 'customer' | 'vendor';
  message_text: string;
  is_read: boolean;
  created_at: string;
}

interface Conversation {
  id: string;
  product_id: string;
  vendor_id: number;
  customer_id: number;
  created_at: string;
  updated_at: string;
  product?: {
    product_id: string;
    product_name: string;
    product_image?: string;
    vendor_name?: string;
    vendor_user_id?: number;
  };
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

interface ChatContextType {
  socket: Socket | null;
  isConnected: boolean;
  activeConversation: string | null;
  conversation: Conversation | null;
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  typingUsers: { [conversationId: string]: Set<string> };
  onlineUsers: { [conversationId: string]: Set<string> };
  openChat: (productId: string, vendorId?: number, forceNew?: boolean, suppressErrorToast?: boolean) => Promise<void>;
  closeChat: () => void;
  sendMessage: (conversationId: string, messageText: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  setTyping: (conversationId: string, isTyping: boolean) => void;
  setActiveConversationById: (conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string, conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<{ [conversationId: string]: Message[] }>({});
  const [typingUsers, setTypingUsers] = useState<{ [conversationId: string]: Set<string> }>({});
  const [onlineUsers, setOnlineUsers] = useState<{ [conversationId: string]: Set<string> }>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const activeConversationRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Initialize Socket.IO connection
  useEffect(() => {
    // Check both token from context and localStorage (supports both 'token' and 'session_token' keys)
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    const authUser = user || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : null);
    
    if (!authToken || !authUser || Object.keys(authUser).length === 0) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const WS_PORT = import.meta.env.VITE_WS_PORT || 4000;
    const wsUrl = `http://localhost:${WS_PORT}`;

    let newSocket: Socket | null = null;
    
    try {
      newSocket = io(wsUrl, {
        auth: { token: authToken },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 5000, // 5 second timeout
      });
    } catch (error) {
      console.error('Failed to initialize Socket.IO:', error);
      // Don't crash the app - just log the error and continue without real-time
      setIsConnected(false);
      return;
    }

    newSocket.on('connect', () => {
      console.log('Socket.IO connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', () => {
      console.log('Socket.IO disconnected');
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('Socket.IO authenticated:', data);
    });

    newSocket.on('error', (error) => {
      console.error('Socket.IO error:', error);
      toast.error(error.message || 'Connection error');
    });

    newSocket.on('receive_message', (message: Message) => {
      console.log('Received message:', message);
      
      setMessages(prev => {
        const conversationMessages = prev[message.conversation_id] || [];
        // Check if message already exists (prevent duplicates)
        if (conversationMessages.some(m => m.id === message.id)) {
          return prev;
        }

        // Replace optimistic temp message from the same sender with the persisted message
        const tempIndex = conversationMessages.findIndex(m =>
          String(m.id).startsWith('temp-') &&
          String(m.sender_id) === String(message.sender_id) &&
          m.message_text === message.message_text
        );

        if (tempIndex !== -1) {
          const updated = [...conversationMessages];
          updated[tempIndex] = message;
          return {
            ...prev,
            [message.conversation_id]: updated
          };
        }

        return {
          ...prev,
          [message.conversation_id]: [...conversationMessages, message]
        };
      });

      // Show toast notification if not the active conversation
      if (activeConversationRef.current !== message.conversation_id) {
        const conversation = conversationsRef.current.find(c => c.id === message.conversation_id);
        if (conversation) {
          toast.info(`New message from ${conversation.product?.vendor_name || 'vendor'}`, {
            description: message.message_text.substring(0, 50) + (message.message_text.length > 50 ? '...' : ''),
          });
        }
      }
    });

    newSocket.on('typing', (data: { userId: string; isTyping: boolean }) => {
      if (!activeConversation) return;

      setTypingUsers(prev => {
        const current = prev[activeConversation] || new Set();
        if (data.isTyping) {
          current.add(data.userId);
        } else {
          current.delete(data.userId);
        }
        return {
          ...prev,
          [activeConversation]: new Set(current)
        };
      });
    });

    newSocket.on('joined_conversation', (data: { conversationId: string }) => {
      console.log('Joined conversation:', data.conversationId);
    });

    newSocket.on('user_online', (data: { userId: string; conversationId: string }) => {
      setOnlineUsers(prev => {
        const current = prev[data.conversationId] || new Set();
        current.add(data.userId);
        return {
          ...prev,
          [data.conversationId]: new Set(current)
        };
      });
    });

    newSocket.on('user_offline', (data: { userId: string; conversationId: string }) => {
      setOnlineUsers(prev => {
        const current = prev[data.conversationId] || new Set();
        current.delete(data.userId);
        return {
          ...prev,
          [data.conversationId]: new Set(current)
        };
      });
    });

    newSocket.on('user_online_status', (data: { userId: string; conversationId: string; isOnline: boolean }) => {
      setOnlineUsers(prev => {
        const current = prev[data.conversationId] || new Set();
        if (data.isOnline) {
          current.add(data.userId);
        } else {
          current.delete(data.userId);
        }
        return {
          ...prev,
          [data.conversationId]: new Set(current)
        };
      });
    });

    if (newSocket) {
      setSocket(newSocket);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token, user]);

  // Define markAsRead first (used by loadMessages)
  const markAsRead = useCallback(async (conversationId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    if (!authToken) return;

    try {
      await fetch(getApiUrl('/api/messages/read'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ conversation_id: conversationId })
      });

      // Update local state
      setMessages(prev => {
        const conversationMessages = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: conversationMessages.map(msg => ({
            ...msg,
            is_read: msg.sender_role !== (user?.role || 'customer')
          }))
        };
      });

      // Update conversations unread count
      setConversations(prev => prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0 }
          : conv
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  }, [token, user]);

  // Define loadMessages second (used by openChat)
  const loadMessages = useCallback(async (conversationId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    if (!authToken) return;

    try {
      const response = await fetch(getApiUrl(`/api/messages?conversation_id=${conversationId}`), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      setMessages(prev => ({
        ...prev,
        [conversationId]: data.messages || []
      }));

      // Mark as read
      await markAsRead(conversationId);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [token, markAsRead]);

  // Define loadConversations third (used by openChat)
  const loadConversations = useCallback(async () => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    if (!authToken) return;

    try {
      const response = await fetch(getApiUrl('/api/conversations'), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, [token]);

  // Define openChat last (uses loadMessages and loadConversations)
  const openChat = useCallback(async (productId: string, vendorId?: number | string, forceNew: boolean = false, suppressErrorToast: boolean = false) => {
    // Check both token from context and localStorage as fallback (supports both 'token' and 'session_token' keys)
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    
    if (!authToken) {
      toast.error('Please log in to chat with vendors');
      return;
    }

    try {
      // Create or get conversation
      const requestBody: any = { product_id: productId };
      if (forceNew) {
        requestBody.force_new = true;
      }

      const response = await fetch(getApiUrl('/api/conversations/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create conversation');
      }

      const data = await response.json();
      const newConversation = data.conversation;

      // Join conversation room
      if (socket && socket.connected) {
        socket.emit('join_conversation', { conversationId: newConversation.id });
        
        // Check online status of the other user
        // If current user is vendor, check customer; if customer, check vendor
        const otherUserId = user?.role === 'vendor' 
          ? newConversation.customer_id 
          : newConversation.product?.vendor_user_id;
        
        if (otherUserId) {
          socket.emit('check_user_online', {
            userId: String(otherUserId),
            conversationId: newConversation.id
          });
        }
      }

      // Load messages
      await loadMessages(newConversation.id);

      // Set as active and store conversation
      setActiveConversation(newConversation.id);
      setConversation(newConversation);

      // Update conversations list
      await loadConversations();
    } catch (error: any) {
      console.error('Error opening chat:', error);
      // Generic error message - don't expose security details
      if (!suppressErrorToast) {
        toast.error('Failed to load conversation');
      }
      throw error;
    }
  }, [token, socket, loadMessages, loadConversations, user]);

  const closeChat = useCallback(() => {
    if (activeConversation && socket) {
      socket.emit('leave_conversation', { conversationId: activeConversation });
    }
    setActiveConversation(null);
    setConversation(null);
  }, [activeConversation, socket]);

  const sendMessage = useCallback(async (conversationId: string, messageText: string) => {
    if (!socket || !socket.connected) {
      // Fallback to HTTP API if socket not connected
      const authToken = token || (typeof window !== 'undefined' ? 
        (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
      
      if (!authToken) {
        toast.error('Please log in to send messages');
        return;
      }
      
      try {
        const response = await fetch(getApiUrl('/api/messages/send'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            message_text: messageText.trim()
          })
        });

        if (!response.ok) {
          throw new Error('Failed to send message');
        }

        const data = await response.json();
        // Add message to local state
        setMessages(prev => ({
          ...prev,
          [conversationId]: [...(prev[conversationId] || []), data.message]
        }));
        return;
      } catch (error) {
        toast.error('Failed to send message');
        return;
      }
    }

    if (!messageText.trim()) {
      return;
    }

    try {
      // Emit via Socket.IO (which will persist via PHP API)
      socket.emit('send_message', {
        conversationId,
        messageText: messageText.trim()
      });

      // Optimistically add message to UI
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: user?.id || '',
        sender_role: (user?.role || 'customer') as 'customer' | 'vendor',
        message_text: messageText.trim(),
        is_read: false,
        created_at: new Date().toISOString()
      };

      setMessages(prev => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), tempMessage]
      }));
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [socket, user, token]);

  const setTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (socket && socket.connected) {
      socket.emit('typing', { conversationId, isTyping });
    }
  }, [socket]);

  // Set active conversation by ID (for navigation from VendorInbox)
  const setActiveConversationById = useCallback(async (conversationId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    
    if (!authToken) return;

    try {
      // Get conversation details
      const response = await fetch(getApiUrl(`/api/conversations/${conversationId}`), {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load conversation');
      }

      const data = await response.json();
      const conv = data.conversation;

      // Join conversation room
      if (socket && socket.connected) {
        socket.emit('join_conversation', { conversationId: conversationId });
        
        // Check online status of the other user
        // Get current user from token
        const authToken = token || (typeof window !== 'undefined' ? 
          (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
        
        if (authToken) {
          try {
            // Decode token to get user role (simplified - in production use proper JWT decode)
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            const currentUserRole = payload.role || 'customer';
            
            // If current user is vendor, check customer; if customer, check vendor
            const otherUserId = currentUserRole === 'vendor' 
              ? conv.customer_id || conv.product?.customer_user_id
              : conv.product?.vendor_user_id;
            
            if (otherUserId) {
              socket.emit('check_user_online', {
                userId: String(otherUserId),
                conversationId: conversationId
              });
            }
          } catch (e) {
            // If token decode fails, try to get from user context
            const otherUserId = user?.role === 'vendor' 
              ? conv.customer_id || conv.product?.customer_user_id
              : conv.product?.vendor_user_id;
            
            if (otherUserId) {
              socket.emit('check_user_online', {
                userId: String(otherUserId),
                conversationId: conversationId
              });
            }
          }
        }
      }

      // Load messages
      await loadMessages(conversationId);

      // Set as active
      setActiveConversation(conversationId);
      setConversation(conv);

      // Update conversations list
      await loadConversations();
    } catch (error: any) {
      console.error('Error setting active conversation:', error);
      toast.error('Failed to load conversation');
      throw error;
    }
  }, [token, socket, loadMessages, loadConversations]);

  const deleteMessage = useCallback(async (messageId: string, conversationId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    if (!authToken) return;

    try {
      const response = await fetch(getApiUrl(`/api/messages/delete?message_id=${messageId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Remove message from local state
      setMessages(prev => {
        const conversationMessages = prev[conversationId] || [];
        return {
          ...prev,
          [conversationId]: conversationMessages.filter(msg => msg.id !== messageId)
        };
      });

      // Reload messages to ensure consistency
      await loadMessages(conversationId);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Failed to delete message');
      throw error;
    }
  }, [token, loadMessages]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    const authToken = token || (typeof window !== 'undefined' ? 
      (localStorage.getItem('session_token') || localStorage.getItem('token')) : null);
    if (!authToken) return;

    try {
      const response = await fetch(getApiUrl(`/api/conversations/${conversationId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Remove conversation from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Remove messages from local state
      setMessages(prev => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      // If this was the active conversation, close it
      if (activeConversation === conversationId) {
        closeChat();
      }

      // Reload conversations list
      await loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
      throw error;
    }
  }, [token, activeConversation, closeChat, loadConversations]);

  // Mark messages as read when active conversation changes
  useEffect(() => {
    if (activeConversation && markAsRead) {
      markAsRead(activeConversation);
    }
  }, [activeConversation, markAsRead]);

  // Load conversations on mount
  useEffect(() => {
    if (token && user) {
      loadConversations();
    }
  }, [token, user, loadConversations]);

  const value: ChatContextType = {
    socket,
    isConnected,
    activeConversation,
    conversation,
    conversations,
    messages,
    typingUsers,
    onlineUsers,
    openChat,
    closeChat,
    sendMessage,
    loadConversations,
    loadMessages,
    markAsRead,
    setTyping,
    setActiveConversationById,
    deleteMessage,
    deleteConversation,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};


















