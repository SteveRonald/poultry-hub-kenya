import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Bot, User, Sparkles, ThumbsUp, ThumbsDown, MessageSquare, Plus, ChevronLeft } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  intent?: string;
  created_at?: string;
  message_id?: string;
  conversation_id?: string;
}

interface QuickReply {
  text: string;
  action: string;
  payload?: any;
}

interface ChatResponse {
  success: boolean;
  response: string;
  intent?: string;
  action_type?: string;
  quick_replies?: QuickReply[];
  data?: any;
  message_id?: string;
  conversation_id?: string;
}

const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showWelcomeNotification, setShowWelcomeNotification] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<any[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const autoHideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Initialize audio context on first user interaction
  const initAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioContext();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.log('Audio context not available');
        }
      }
    }
    
    // Resume if suspended
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    return audioContextRef.current;
  };

  // Load conversations list if user is logged in (but don't auto-load them)
  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
    }
  }, [isOpen, user]);
  
  // Load chat history ONLY when user explicitly selects a conversation
  useEffect(() => {
    if (isOpen && currentConversationId) {
      // Only load if user explicitly selected a conversation
      loadChatHistory(currentConversationId);
    } else if (isOpen && !currentConversationId && !user) {
      // For non-logged-in users, just load session history
      loadChatHistory();
    }
  }, [isOpen, currentConversationId, user]);
  
  // Load conversations list (don't auto-load any conversation)
  const loadConversations = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/chat/conversations'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConversations(data.conversations || []);
          // DO NOT auto-load conversations - user must explicitly click to view them
        }
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };
  
  // Create new conversation
  const createNewConversation = async () => {
    if (!user) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/chat/conversations'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Clear current conversation to start fresh
          setCurrentConversationId(null);
          setMessages([]);
          setQuickReplies([]);
          setShowConversations(false);
          // Reload conversations list
          loadConversations();
          // Show welcome message for new conversation
          const welcomeMessage: Message = {
            id: 'welcome',
            message: "Hello! 👋 Welcome to PoultryHubKenya. I'm here to help you with:\n\n• Product information\n• Order status\n• Account help\n• General questions\n\nHow can I assist you today?",
            sender: 'bot',
          };
          setMessages([welcomeMessage]);
          setQuickReplies([
            { text: 'Browse Products', action: 'navigate', payload: { url: '/products' } },
            { text: 'My Orders', action: 'navigate', payload: { url: '/dashboard', requiresAuth: true } },
            { text: 'Account Help', action: 'intent', payload: { intent: 'account_help' } },
          ]);
        }
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };
  
  // Switch to a different conversation (user explicitly clicks to view)
  const switchConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setMessages([]);
    setQuickReplies([]);
    setShowConversations(false);
    // loadChatHistory will handle loading state
    await loadChatHistory(conversationId);
  };
  
  // Start fresh chat (clear current conversation and show welcome)
  const startFreshChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setQuickReplies([]);
    setShowConversations(false);
    // Show welcome message for fresh chat
    const welcomeMessage: Message = {
      id: 'welcome',
      message: "Hello! 👋 Welcome to PoultryHubKenya. I'm here to help you with:\n\n• Product information\n• Order status\n• Account help\n• General questions\n\nHow can I assist you today?",
      sender: 'bot',
    };
    setMessages([welcomeMessage]);
    setQuickReplies([
      { text: 'Browse Products', action: 'navigate', payload: { url: '/products' } },
      { text: 'My Orders', action: 'navigate', payload: { url: '/dashboard', requiresAuth: true } },
      { text: 'Account Help', action: 'intent', payload: { intent: 'account_help' } },
    ]);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async (conversationId?: string) => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token') || localStorage.getItem('admin_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Build URL with optional conversation_id query parameter
      let url = getApiUrl('/api/chat/history');
      if (conversationId) {
        url += `?conversation_id=${encodeURIComponent(conversationId)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
          // Update quick replies if provided
          if (data.quick_replies && Array.isArray(data.quick_replies)) {
            setQuickReplies(data.quick_replies);
          }
        }
      } else {
        console.error('Failed to load chat history:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Play sound effect (needs user interaction first due to browser policies)
  const playSound = (type: 'send' | 'receive') => {
    try {
      const audioContext = initAudioContext();
      
      if (audioContext) {
        if (audioContext.state === 'suspended') {
          audioContext.resume().then(() => {
            playSoundEffect(type, audioContext);
          }).catch(() => {
            // User interaction required - sound will work on next attempt
          });
        } else {
          playSoundEffect(type, audioContext);
        }
      }
    } catch (error) {
      // Silently fail if audio is not supported
      if (import.meta.env.DEV) {
        console.log('Audio playback not available:', error);
      }
    }
  };

  const playSoundEffect = (type: 'send' | 'receive', audioContext: AudioContext) => {
    if (type === 'send') {
      // Short beep for sending (higher pitch)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    } else if (type === 'receive') {
      // Pleasant chime for receiving (lower pitch, longer)
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 600;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);
    }
  };

  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim();
    if (!messageToSend) return;

    // Play send sound
    playSound('send');

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      message: messageToSend,
      sender: 'user',
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setQuickReplies([]);

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl('/api/chat/message'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: messageToSend,
          conversation_id: currentConversationId 
        }),
      });

      if (response.ok) {
        const data: ChatResponse = await response.json();
        
        if (data.success) {
          // Play receive sound
          playSound('receive');
          
          // Update current conversation ID when user sends first message (starts new conversation)
          if (data.conversation_id) {
            // Set conversation ID when user starts chatting (first message creates/links to conversation)
            setCurrentConversationId(data.conversation_id);
            // Reload conversations list if user is logged in
            if (user) {
              loadConversations();
            }
          }
          
          // Add bot response
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            message: data.response,
            sender: 'bot',
            intent: data.intent,
            message_id: data.message_id,
            conversation_id: data.conversation_id || currentConversationId || undefined,
          };
          setMessages(prev => [...prev, botMessage]);
          
          // Set quick replies if available
          if (data.quick_replies && data.quick_replies.length > 0) {
            setQuickReplies(data.quick_replies);
          }

          // Handle actions
          if (data.action_type === 'navigate' && data.quick_replies) {
            // Navigation will be handled by quick reply buttons
          }
        }
      } else {
        const errorData = await response.json();
        const errorMessage: Message = {
          id: `bot_${Date.now()}`,
          message: errorData.error || 'Sorry, I encountered an error. Please try again.',
          sender: 'bot',
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `bot_${Date.now()}`,
        message: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (reply: QuickReply) => {
    if (reply.action === 'navigate' && reply.payload?.url) {
      // Navigate to URL
      window.location.href = reply.payload.url;
    } else if (reply.action === 'intent' && reply.payload?.intent) {
      // Send intent-based message
      handleSendMessage(reply.text);
    } else {
      // Send the quick reply text as a message
      handleSendMessage(reply.text);
    }
  };

  const handleFeedback = async (messageId: string, feedbackType: 'positive' | 'negative', conversationId?: string) => {
    if (!messageId || feedbackGiven.has(messageId)) return;
    
    try {
      const response = await fetch(getApiUrl('/api/chat/feedback'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_id: messageId,
          conversation_id: conversationId,
          feedback_type: feedbackType,
        }),
      });

      if (response.ok) {
        setFeedbackGiven(prev => new Set(prev).add(messageId));
        console.log('Feedback submitted:', feedbackType);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Set mounted state for portal
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Show welcome notification after page load - ALWAYS show on reload
  useEffect(() => {
    console.log('🔍 Chatbot component mounted, showing welcome notification...');
    
    // Always show popup on every page load/reload
    // Show welcome notification after 1.5 seconds
    const timer = setTimeout(() => {
      console.log('✅ Showing welcome notification');
      setShowWelcomeNotification(true);
      
      // Auto-hide after 15 seconds
      autoHideTimerRef.current = setTimeout(() => {
        console.log('✅ Auto-hiding welcome notification');
        setShowWelcomeNotification(false);
        autoHideTimerRef.current = null;
      }, 15000);
    }, 1500);
    
    return () => {
      clearTimeout(timer);
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
    };
  }, []);
  
  // Expose function to manually show popup for testing
  useEffect(() => {
    // Add to window for easy testing: window.showChatbotWelcome()
    (window as any).showChatbotWelcome = () => {
      sessionStorage.removeItem('chatbot_welcome_seen');
      localStorage.setItem('chatbot_welcome_count', '0');
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
        autoHideTimerRef.current = null;
      }
      setShowWelcomeNotification(true);
      console.log('✅ Welcome notification shown manually');
      
      // Auto-hide after 15 seconds
      autoHideTimerRef.current = setTimeout(() => {
        setShowWelcomeNotification(false);
        sessionStorage.setItem('chatbot_welcome_seen', 'true');
        autoHideTimerRef.current = null;
      }, 15000);
    };
  }, []);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('📊 Chatbot state changed:', {
      showWelcomeNotification,
      isOpen,
      timestamp: new Date().toISOString()
    });
    
    // Check if popup element exists in DOM
    if (showWelcomeNotification && !isOpen) {
      setTimeout(() => {
        const popup = document.getElementById('chatbot-welcome-popup');
        console.log('🔍 Popup element in DOM:', popup ? 'YES ✅' : 'NO ❌');
        if (popup) {
          console.log('📍 Popup position:', popup.getBoundingClientRect());
        }
      }, 100);
    }
  }, [showWelcomeNotification, isOpen]);

  // Welcome message on first open - always show fresh chat (don't auto-load previous conversations)
  useEffect(() => {
    if (isOpen && messages.length === 0 && !isLoading && !currentConversationId) {
      // Always show welcome message when opening chat (fresh start)
      // Previous conversations are available via the conversations button
      const welcomeMessage: Message = {
        id: 'welcome',
        message: "Hello! 👋 Welcome to PoultryHubKenya. I'm here to help you with:\n\n• Product information\n• Order status\n• Account help\n• General questions\n\nHow can I assist you today?",
        sender: 'bot',
      };
      setMessages([welcomeMessage]);
      setQuickReplies([
        { text: 'Browse Products', action: 'navigate', payload: { url: '/products' } },
        { text: 'My Orders', action: 'navigate', payload: { url: '/dashboard', requiresAuth: true } },
        { text: 'Account Help', action: 'intent', payload: { intent: 'account_help' } },
      ]);
    }
  }, [isOpen, messages.length, isLoading, currentConversationId]);

  // Render popup using portal for better z-index handling
  const popupContent = showWelcomeNotification && !isOpen && mounted ? (
    <div 
      id="chatbot-welcome-popup"
      className="fixed"
      style={{ 
        bottom: isMobile ? '90px' : '100px',
        right: isMobile ? '12px' : '16px',
        width: isMobile ? 'calc(100vw - 24px)' : '320px',
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 999999,
        position: 'fixed',
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto',
        transform: 'translateZ(0)', // Force hardware acceleration
        WebkitTransform: 'translateZ(0)'
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-2xl border-2 border-primary relative" 
        style={{ 
          animation: 'slide-up-fade-in 0.5s ease-out',
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '2px solid #22c55e',
          padding: isMobile ? '0.75rem' : '1rem',
          width: '100%'
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setShowWelcomeNotification(false)}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
        
        {/* Content */}
        <div className="flex items-start gap-3 pr-6">
          <div className="relative flex-shrink-0">
            <div className="bg-gradient-to-r from-primary to-secondary rounded-full p-2.5 animate-pulse">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <Sparkles className="h-3 w-3 absolute -top-0.5 -right-0.5 text-yellow-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-sm text-gray-900 mb-1">Hello! 👋</h4>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              Welcome to PoultryHubKenya! I'm here to help you with products, orders, and any questions you have.
            </p>
            <button
              onClick={() => {
                setShowWelcomeNotification(false);
                setIsOpen(true);
              }}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors underline"
            >
              Chat with me →
            </button>
          </div>
        </div>
        
        {/* Arrow pointing to chatbot button */}
        <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r-2 border-b-2 border-primary transform rotate-45"></div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Welcome Notification Popup - Rendered via Portal for better z-index */}
      {mounted && createPortal(popupContent, document.body)}

      {/* Chat Button - AI Chatbot Style with Blinking Animation */}
      {!isOpen && (
        <button
          onClick={() => {
            // Activate audio context on first interaction (required by browsers)
            initAudioContext();
            
            setIsOpen(true);
            setShowWelcomeNotification(false);
          }}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 bg-gradient-to-r from-primary via-purple-500 to-secondary text-white rounded-full p-4 sm:p-5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 flex items-center justify-center group"
          style={{
            animation: 'float-pulse 3s ease-in-out infinite, blink-attention 2s ease-in-out infinite',
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 9999
          }}
          aria-label="Open AI Assistant"
          title="AI Assistant - Ask me anything!"
        >
          {/* Pulsing ring animation */}
          <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-60" style={{ animationDuration: '2s' }}></span>
          <span className="absolute inset-0 rounded-full bg-secondary animate-ping opacity-40" style={{ animationDelay: '0.7s', animationDuration: '2s' }}></span>
          
          <div className="relative z-10">
            <Bot className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse" style={{ animationDuration: '2s' }} />
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 absolute -top-1 -right-1 text-yellow-300 animate-pulse" style={{ animationDuration: '1.5s' }} />
          </div>
          {/* AI Badge with bounce */}
          <span className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-400 to-orange-400 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-lg border-2 border-white z-10 animate-bounce" style={{ animationDuration: '2.5s' }}>
            AI
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-96 sm:max-w-[calc(100vw-2rem)] h-[calc(100vh-4rem)] sm:h-[600px] sm:max-h-[calc(100vh-8rem)] sm:rounded-lg bg-white shadow-2xl flex flex-col border-t sm:border border-gray-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-secondary text-white p-3 sm:p-4 rounded-t-lg sm:rounded-t-lg flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Previous Conversations button - grouped in one place (only show when not viewing a conversation) */}
              {user && conversations.length > 0 && !currentConversationId && (
                <button
                  onClick={() => {
                    setShowConversations(true);
                    // Ensure we're in fresh chat mode
                    setCurrentConversationId(null);
                  }}
                  className="hover:bg-white/20 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-colors flex-shrink-0 relative flex items-center gap-1.5 bg-white/10 border border-white/20"
                  aria-label="Previous Conversations"
                  title={`${conversations.length} previous conversations`}
                >
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                    Previous
                  </span>
                  <span className="bg-yellow-400 text-gray-900 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {conversations.length > 9 ? '9+' : conversations.length}
                  </span>
                </button>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
                  <Sparkles className="h-3 w-3 absolute -top-0.5 -right-0.5 text-yellow-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base truncate">
                    {currentConversationId ? 'AI Assistant' : 'New Chat'}
                  </h3>
                  <p className="text-xs text-white/80 hidden sm:block truncate">PoultryHubKenya</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Start fresh chat button when viewing a conversation */}
              {user && currentConversationId && (
                <button
                  onClick={startFreshChat}
                  className="hover:bg-white/20 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
                  aria-label="Start new chat"
                  title="Start new chat"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
                aria-label="Close chat"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>
          
          {/* Conversations Sidebar (for logged-in users) */}
          {user && showConversations && (
            <div className="absolute inset-0 bg-white z-10 flex flex-col">
              {/* Conversations Header */}
              <div className="bg-gradient-to-r from-primary to-secondary text-white p-3 sm:p-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowConversations(false);
                      // When closing conversations list, ensure we're in fresh chat mode (not viewing old conversation)
                      if (currentConversationId) {
                        startFreshChat();
                      }
                    }}
                    className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
                    aria-label="Back to chat"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <h3 className="font-semibold text-sm sm:text-base">Your Previous Conversations</h3>
                  {conversations.length > 0 && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                      {conversations.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    createNewConversation();
                  }}
                  className="hover:bg-white/20 rounded-full p-1.5 transition-colors"
                  aria-label="New conversation"
                  title="Start new chat"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              
              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto p-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No previous conversations</p>
                    <p className="text-xs text-gray-400 mt-1">Start chatting to create your first conversation</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {conversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => switchConversation(conv.id)}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          currentConversationId === conv.id
                            ? 'bg-primary/10 border-l-4 border-primary shadow-sm'
                            : 'hover:bg-gray-100 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm text-gray-900 truncate">
                                {conv.title || 'New Conversation'}
                              </h4>
                              {currentConversationId === conv.id && (
                                <span className="text-xs bg-primary text-white px-1.5 py-0.5 rounded">Viewing</span>
                              )}
                            </div>
                            {conv.last_message && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2 mb-2">
                                {conv.last_message}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'}</span>
                              {conv.last_message_at && (
                                <>
                                  <span>•</span>
                                  <span>{new Date(conv.last_message_at).toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric',
                                    year: new Date(conv.last_message_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                  })}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Previous Conversations indicator - grouped in one place (only show when in fresh chat mode) */}
          {user && conversations.length > 0 && !showConversations && !currentConversationId && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-300 px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-900">
                    {conversations.length} Previous {conversations.length === 1 ? 'Conversation' : 'Conversations'}
                  </p>
                  <p className="text-xs text-blue-600">Click to view and continue previous chats</p>
                </div>
              </div>
              <button
                onClick={() => setShowConversations(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 shadow-md"
              >
                View
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
          )}

          {/* Messages - Hide when conversations sidebar is open */}
          {!showConversations && (
            <>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50">
              {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-lg p-2.5 sm:p-3 ${
                    message.sender === 'user'
                      ? 'bg-primary text-white'
                      : 'bg-white text-gray-800 border border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.sender === 'bot' && (
                      <div className="relative flex-shrink-0">
                        <Bot className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5" />
                        <Sparkles className="h-2 w-2 sm:h-2.5 sm:w-2.5 absolute -top-0.5 -right-0.5 text-yellow-400" />
                      </div>
                    )}
                    {message.sender === 'user' && (
                      <User className="h-4 w-4 sm:h-5 sm:w-5 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">{message.message}</p>
                      {/* Feedback buttons for bot messages */}
                      {message.sender === 'bot' && message.message_id && !feedbackGiven.has(message.message_id) && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <span className="text-xs text-gray-500">Helpful?</span>
                          <button
                            onClick={() => handleFeedback(message.message_id!, 'positive', message.conversation_id)}
                            className="p-1.5 hover:bg-green-50 rounded-full transition-colors group"
                            title="Helpful"
                          >
                            <ThumbsUp className="h-4 w-4 text-gray-400 group-hover:text-green-500 transition-colors" />
                          </button>
                          <button
                            onClick={() => handleFeedback(message.message_id!, 'negative', message.conversation_id)}
                            className="p-1.5 hover:bg-red-50 rounded-full transition-colors group"
                            title="Not helpful"
                          >
                            <ThumbsDown className="h-4 w-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                          </button>
                        </div>
                      )}
                      {message.sender === 'bot' && message.message_id && feedbackGiven.has(message.message_id) && (
                        <div className="text-xs text-green-600 mt-2 pt-2 border-t border-gray-100">
                          ✓ Thank you for your feedback!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Quick Replies */}
            {quickReplies.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {quickReplies.map((reply, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickReply(reply)}
                    className="bg-white border border-primary text-primary text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-full hover:bg-primary hover:text-white transition-colors active:scale-95"
                  >
                    {reply.text}
                  </button>
                ))}
              </div>
            )}

            {/* Loading Indicator with Blinking Dots */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 max-w-[85%] sm:max-w-[80%] shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-primary animate-pulse" />
                      <Sparkles className="h-3 w-3 sm:h-3.5 sm:w-3.5 absolute -top-0.5 -right-0.5 text-yellow-400 animate-pulse" style={{ animationDuration: '1s' }} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce opacity-100" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce opacity-75" style={{ animationDelay: '200ms', animationDuration: '1.4s' }}></div>
                      <div className="w-2.5 h-2.5 bg-primary rounded-full animate-bounce opacity-50" style={{ animationDelay: '400ms', animationDuration: '1.4s' }}></div>
                    </div>
                    <span className="text-xs sm:text-sm text-gray-600 font-medium">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 p-3 sm:p-4 bg-white rounded-b-lg flex-shrink-0">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value);
                    // Initialize audio context on first interaction
                    initAudioContext();
                  }}
                  onFocus={() => {
                    // Initialize audio context when input is focused
                    initAudioContext();
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputMessage.trim()}
                  className="bg-primary text-white rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-95"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
      )}
    </>
  );
};

export default Chatbot;

