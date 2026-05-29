import React from 'react';
import { useLocation } from 'react-router-dom';

const normalizeWhatsappNumber = (value: string) => value.replace(/[^\d]/g, '');

const WhatsAppWidget: React.FC = () => {
  const location = useLocation();
  const rawNumber = (import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '').trim();
  const phoneNumber = normalizeWhatsappNumber(rawNumber);

  if (!phoneNumber || location.pathname.startsWith('/chat/')) {
    return null;
  }

  const prefilledMessage = encodeURIComponent('Hello KukuSoko, I would like assistance.');
  const whatsappUrl = `https://wa.me/${phoneNumber}?text=${prefilledMessage}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat with KukuSoko on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed bottom-[5.75rem] right-5 z-[9998] flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_16px_35px_rgba(37,211,102,0.35)] transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-200 sm:bottom-24"
    >
      <svg viewBox="0 0 24 24" className="h-8 w-8" aria-hidden="true">
        <path
          fill="white"
          d="M19.05 4.94A10 10 0 0 0 3.37 17.03L2 22l5.08-1.33a10 10 0 0 0 4.78 1.22h.01A10 10 0 0 0 19.05 4.94ZM11.87 20.1h-.01a8.3 8.3 0 0 1-4.23-1.15l-.3-.18-3.01.79.81-2.93-.19-.3a8.31 8.31 0 1 1 6.93 3.77Zm4.56-6.23c-.25-.13-1.47-.73-1.7-.81-.23-.08-.4-.13-.57.13-.16.25-.65.81-.79.97-.15.17-.29.19-.54.07a6.78 6.78 0 0 1-1.99-1.23 7.47 7.47 0 0 1-1.38-1.72c-.14-.25-.02-.38.11-.51.11-.11.25-.29.38-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.13-.57-1.37-.78-1.88-.2-.48-.41-.42-.57-.42l-.48-.01c-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.2.88 2.36 1 2.52.12.16 1.72 2.63 4.18 3.69.58.25 1.03.4 1.39.51.58.18 1.1.16 1.51.1.46-.07 1.47-.6 1.68-1.19.21-.6.21-1.1.15-1.2-.06-.1-.23-.17-.48-.3Z"
        />
      </svg>
    </a>
  );
};

export default WhatsAppWidget;
