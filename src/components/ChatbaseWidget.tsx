import React, { useState, useEffect, useRef } from 'react';
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
  const [isChatbaseLoaded, setIsChatbaseLoaded] = useState(false);

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

  return null;
};

export default ChatbaseWidget;

