import React from 'react';
import { MessageCircle } from 'lucide-react';

const normalizeWhatsappNumber = (value: string) => value.replace(/[^\d]/g, '');

const WhatsAppWidget: React.FC = () => {
  const rawNumber = (import.meta.env.VITE_WHATSAPP_SUPPORT_NUMBER || '').trim();
  const phoneNumber = normalizeWhatsappNumber(rawNumber);

  if (!phoneNumber) {
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
      <MessageCircle className="h-7 w-7" strokeWidth={2.2} />
      <span className="absolute -right-1 -top-1 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#128C7E] shadow-sm">
        WA
      </span>
    </a>
  );
};

export default WhatsAppWidget;
