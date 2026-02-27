import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Sparkles, X, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CHATBASE_CONFIG } from '../config/chatbase';

declare global {
  interface Window {
    chatbase: any;
    chatbaseLoaded: boolean;
  }
}

const ChatbaseWidget: React.FC = () => {
  const { user } = useAuth();
  const [showWelcomeNotification, setShowWelcomeNotification] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isChatbaseLoaded, setIsChatbaseLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    const checkMobile = window.innerWidth < 768;
    setIsMobile(checkMobile);

    // Only show welcome notification on desktop (not on mobile to avoid crowding)
    if (!checkMobile) {
      const timer = setTimeout(() => {
        setShowWelcomeNotification(true);
      }, 2000); // Show after 2 seconds

      // Auto-hide after 8 seconds
      const hideTimer = setTimeout(() => {
        setShowWelcomeNotification(false);
      }, 10000);

      return () => {
        clearTimeout(timer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  useEffect(() => {
    // Initialize Chatbase immediately on component mount for faster loading
    const initChatbase = () => {
      if (!window.chatbase || window.chatbase("getState") !== "initialized") {
        window.chatbase = (...args: any[]) => {
          if (!window.chatbase.q) {
            window.chatbase.q = [];
          }
          window.chatbase.q.push(args);
        };
        window.chatbase = new Proxy(window.chatbase, {
          get(target: any, prop: string) {
            if (prop === "q") {
              return target.q;
            }
            return (...args: any[]) => target(prop, ...args);
          }
        });
      }
    };

    // Load Chatbase script immediately
    const loadChatbase = () => {
      // Check if script already exists
      if (document.getElementById(CHATBASE_CONFIG.widget.scriptId)) {
        setIsChatbaseLoaded(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://www.chatbase.co/embed.min.js";
      script.id = CHATBASE_CONFIG.widget.scriptId;
      script.setAttribute('chatbotId', CHATBASE_CONFIG.botId);
      script.defer = true;
      script.onload = () => {
        setIsChatbaseLoaded(true);
        window.chatbaseLoaded = true;
      };

      // Add enhanced CSS for left positioning and animations
      const style = document.createElement("style");
      style.textContent = `
        /* Chatbase Widget Enhanced Left Positioning */
        .chatbase-widget,
        #chatbase-bubble-button,
        .chatbase-chatbot-container {
          left: 20px !important;
          right: auto !important;
          position: fixed !important;
          bottom: 20px !important;
          z-index: 9999 !important;
        }

        .chatbase-chatbot-container {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          border-radius: 12px !important;
        }

        #chatbase-bubble-button {
          background: linear-gradient(135deg, #1a4d2e 0%, #0f2e1a 100%) !important;
          border: none !important;
          border-radius: 50% !important;
          width: 56px !important;
          height: 56px !important;
          box-shadow: 0 4px 12px rgba(26, 77, 46, 0.3) !important;
          transition: all 0.3s ease !important;
          animation: float-pulse-chatbase 3s ease-in-out infinite, blink-attention-chatbase 4s ease-in-out infinite !important;
          cursor: pointer !important;
        }

        #chatbase-bubble-button:hover {
          transform: scale(1.05) !important;
          box-shadow: 0 6px 16px rgba(26, 77, 46, 0.4) !important;
        }

        /* Chatbase-specific animations */
        @keyframes float-pulse-chatbase {
          0%, 100% {
            transform: translateY(0px) scale(1);
            box-shadow: 0 10px 25px rgba(26, 77, 46, 0.2);
          }
          50% {
            transform: translateY(-8px) scale(1.03);
            box-shadow: 0 15px 35px rgba(26, 77, 46, 0.3);
          }
        }

        @keyframes blink-attention-chatbase {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
          }
          50% {
            opacity: 0.95;
            box-shadow: 0 0 0 15px rgba(34, 197, 94, 0);
          }
        }

        /* Ensure chat opens immediately when loaded */
        .chatbase-chatbot-container.show {
          animation: slide-in-left 0.3s ease-out !important;
        }

        @keyframes slide-in-left {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(script);
    };

    initChatbase();

    // Load immediately instead of waiting for page load
    loadChatbase();

    // Identify user if logged in
    if (user) {
      identifyUser();
    }

    return () => {
      // Cleanup
      const existingScript = document.getElementById(CHATBASE_CONFIG.widget.scriptId);
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [user]);

  const identifyUser = async () => {
    try {
      // Call backend to get JWT token
      const response = await fetch('/backend/api/chatbase-token', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token && window.chatbase) {
          window.chatbase('identify', { token: data.token });
        }
      }
    } catch (error) {
      console.error('Failed to identify user with Chatbase:', error);
    }
  };

  const handleOpenChat = () => {
    setShowWelcomeNotification(false);
    // If Chatbase is loaded, trigger it to open
    if (window.chatbase && window.chatbaseLoaded) {
      // Find and click the Chatbase button
      const chatbaseButton = document.getElementById('chatbase-bubble-button') as HTMLElement;
      if (chatbaseButton) {
        chatbaseButton.click();
      }
    }
  };

  // Welcome notification popup (similar to existing chatbot)
  const popupContent = showWelcomeNotification && mounted ? (
    <div
      id="chatbase-welcome-popup"
      className="fixed"
      style={{
        bottom: isMobile ? '100px' : '100px',
        left: isMobile ? '12px' : '90px',
        width: isMobile ? 'calc(100vw - 24px)' : '320px',
        maxWidth: 'calc(100vw - 24px)',
        zIndex: 999999,
        position: 'fixed',
        display: 'block',
        visibility: 'visible',
        opacity: 1,
        pointerEvents: 'auto',
        transform: 'translateZ(0)',
        WebkitTransform: 'translateZ(0)'
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-primary relative animate-slide-up-fade-in"
        style={{
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
          className="absolute top-2 right-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors z-10"
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
            <h4 className="font-semibold text-sm text-gray-900 mb-1">AI Assistant</h4>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">
              How can I help you today?
            </p>
            <button
              onClick={handleOpenChat}
              className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors underline"
            >
              Start chatting →
            </button>
          </div>
        </div>

        {/* Arrow pointing to chatbase button */}
        <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white dark:bg-gray-800 border-l-2 border-b-2 border-primary transform rotate-45"></div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Welcome Notification Popup */}
      {mounted && createPortal(popupContent, document.body)}
    </>
  );
};

export default ChatbaseWidget;
