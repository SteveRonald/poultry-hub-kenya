import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { getApiUrl } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  intent?: string;
  created_at?: string;
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

  // Load chat history on mount
  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('admin_session_token');
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl('/api/chat/history'), {
        method: 'GET',
        headers,
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          setMessages(data.messages);
        }
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
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
        body: JSON.stringify({ message: messageToSend }),
      });

      if (response.ok) {
        const data: ChatResponse = await response.json();
        
        if (data.success) {
          // Play receive sound
          playSound('receive');
          
          // Add bot response
          const botMessage: Message = {
            id: `bot_${Date.now()}`,
            message: data.response,
            sender: 'bot',
            intent: data.intent,
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

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
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
  }, [isOpen]);

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
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bot className="h-5 w-5 sm:h-6 sm:w-6" />
                <Sparkles className="h-3 w-3 absolute -top-0.5 -right-0.5 text-yellow-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">AI Assistant</h3>
                <p className="text-xs text-white/80 hidden sm:block">PoultryHubKenya</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded-full p-1.5 sm:p-2 transition-colors"
              aria-label="Close chat"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>

          {/* Messages */}
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
                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">{message.message}</p>
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
        </div>
      )}
    </>
  );
};

export default Chatbot;

