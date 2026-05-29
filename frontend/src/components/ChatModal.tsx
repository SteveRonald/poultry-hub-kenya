import React, { useEffect, useState, useRef } from 'react';
import { Button } from './ui/button';
import { X, Send, Check } from 'lucide-react';
import { getApiUrl, getImageUrl } from '../config/api';

type Message = {
  id: string;
  product_id: string;
  sender_id: string;
  receiver_id: string;
  sender_type?: string; // 'vendor' | 'customer'
  message: string;
  created_at: string;
  reply_to?: string | null;
};

const WS_PORT = 4000;

export default function ChatModal({ product, vendorUserId, onClose, isVendorReply }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [wsReady, setWsReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [sending, setSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  const [resolvedVendorId, setResolvedVendorId] = useState<string | null>(vendorUserId ?? null);
  const [resolvingVendor, setResolvingVendor] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!resolvedVendorId && !resolvingVendor && !isVendorReply) {
        setResolvingVendor(true);
        try {
          const res = await fetch(getApiUrl(`/api/products/${product.id}`));
          const data = await res.json();
          const vId = data?.vendor_profiles?.user_id || data?.vendor_user_id || null;
          setResolvedVendorId(vId);
        } catch (e) {
          console.error('Failed to resolve vendor id', e);
        } finally {
          setResolvingVendor(false);
        }
      }

      if (!token) return;
      try {
        const res2 = await fetch(getApiUrl(`/api/messages?product_id=${product.id}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data2 = await res2.json();
        const sortedMessages = Array.isArray(data2) ? data2 : [];
        sortedMessages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        setMessages(sortedMessages);
      } catch (e) {
        console.error('Failed to fetch messages', e);
      }
    };
    init();
  }, [product.id, token, isVendorReply]);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`ws://localhost:${WS_PORT}?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => setWsReady(true);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'message') {
          setMessages(prev => {
            const updated = [...prev, d];
            updated.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            return updated;
          });
        }
      } catch (err) { console.error(err); }
    };
    ws.onclose = () => setWsReady(false);
    return () => { try { ws.close(); } catch {} };
  }, [token]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text || !token || sending) return;
    if (!resolvedVendorId) {
      alert('Recipient not resolved yet. Please wait a moment.');
      return;
    }

    setSending(true);
    const payload = { type: 'message', product_id: product.id, receiver_id: resolvedVendorId, message: text };
    const messageText = text;

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(payload));
      } else {
        await fetch(getApiUrl('/api/messages'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ product_id: product.id, receiver_id: resolvedVendorId, message: messageText })
        });
      }

      setMessages(prev => ([...prev, {
        id: Math.random().toString(36).slice(2),
        product_id: product.id,
        sender_id: user.id || 'me',
        receiver_id: resolvedVendorId,
        sender_type: user.role || 'customer',
        message: messageText,
        created_at: new Date().toISOString()
      }]));

      setText('');
    } catch (err) {
      console.error('Failed to send message', err);
    } finally {
      setSending(false);
    }
  };

  const getDisplayName = () => {
    if (isVendorReply) return `${product.product_name || 'Product'}`;
    return product.vendor_profiles?.farm_name || 'vendor';
  };

  const renderMessageStatus = (message: any, isOwn: boolean, isLightBubble: boolean = false) => {
    if (!isOwn) return null;

    const isDelivered = !!message.id && !String(message.id).startsWith('temp-');
    const isRead = isDelivered && !!message.is_read;
    const colorClass = isRead
      ? (isLightBubble ? 'text-sky-500' : 'text-sky-300')
      : (isLightBubble ? 'text-gray-500' : 'text-green-100');

    if (!isDelivered) {
      return <Check className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${colorClass}`} />;
    }

    return (
      <span className={`inline-flex items-center ${colorClass}`}>
        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 -ml-1.5" />
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black bg-opacity-50 p-0 sm:p-2 md:p-4">
      <div className="bg-white rounded-t-lg sm:rounded-lg w-full sm:max-w-2xl max-h-screen sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-gradient-to-r from-green-50 to-green-100 flex-shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {product.image_url && (
              <img src={getImageUrl(product.image_url)} alt={product.name || product.product_name} className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover flex-shrink-0 border-2 border-green-200" />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-xs sm:text-sm text-gray-800">{isVendorReply ? 'Customer Inquiry' : getDisplayName()}</div>
              <div className="text-[11px] sm:text-xs text-gray-600 truncate">{product.name || product.product_name}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-gray-900 flex-shrink-0" aria-label="Close chat">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div ref={listRef} className="flex-1 overflow-y-auto bg-gradient-to-b from-green-50 to-white px-2 sm:px-4 py-3 sm:py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm h-full flex items-center justify-center">
              <div>
                <div className="text-4xl mb-2">💬</div>
                <div className="font-medium">Start a conversation</div>
              </div>
            </div>
          )}

          {messages.map((m: any, idx) => {
            // Prefer explicit sender_type stored on messages. Fallback only for customer view.
            const isVendorMessage = (m.sender_type && m.sender_type === 'vendor') || (!m.sender_type && !isVendorReply && resolvedVendorId && String(m.sender_id) === String(resolvedVendorId));
            const isCustomerMessage = !isVendorMessage;
            const isOwn = String(m.sender_id) === String(user.id) || m.sender_id === 'me';

            const prevMessage = idx > 0 ? messages[idx - 1] : null;
            const nextMessage = idx < messages.length - 1 ? messages[idx + 1] : null;
            const sameSenderAsPrev = prevMessage && prevMessage.sender_id === m.sender_id;
            const sameSenderAsNext = nextMessage && nextMessage.sender_id === m.sender_id;

            const referenced = m.reply_to ? messages.find((mm: any) => mm.id === m.reply_to) : null;

            const getAvatarInitial = () => {
              if (isOwn) return 'You';
              return isVendorMessage ? 'V' : 'C';
            };

            const alignmentClass = isCustomerMessage ? 'justify-end' : 'justify-start';

            return (
              <div key={m.id} className={`flex gap-2 ${alignmentClass} items-end`}>
                {isVendorMessage && !sameSenderAsPrev && (
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center text-xs text-gray-700 font-semibold">{getAvatarInitial()}</div>
                )}
                {isVendorMessage && sameSenderAsPrev && <div className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0" />}

                <div className={`max-w-xs sm:max-w-md ${isCustomerMessage ? 'order-first' : 'order-last'}`}>
                  {referenced && (
                    <div className="mb-1">
                      <div className="flex items-start gap-2 rounded-md bg-gray-50 p-2 text-xs text-gray-700 shadow-sm">
                        <div className={`w-1 rounded-sm ${referenced.sender_type === 'vendor' ? 'bg-gray-400' : 'bg-green-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{String(referenced.sender_id) === String(user.id) ? 'You' : (referenced.sender_type === 'vendor' ? 'Vendor' : 'Customer')}</div>
                          <div className="truncate text-[13px] text-gray-600">{String(referenced.message).split('\n')[0]}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-3xl shadow-sm ${isCustomerMessage ? 'bg-green-500 text-white rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm'}`}>
                    <p className="text-sm sm:text-base break-words leading-relaxed">{m.message}</p>
                    <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${isCustomerMessage ? 'text-green-100' : 'text-gray-500'}`}>
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                      <span className="ml-1 inline-flex items-center">
                        {renderMessageStatus(m, isOwn, !isCustomerMessage)}
                      </span>
                    </div>
                  </div>
                </div>

                {isCustomerMessage && !sameSenderAsPrev && (
                  <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex-shrink-0 flex items-center justify-center text-xs text-white font-semibold">{getAvatarInitial()}</div>
                )}
                {isCustomerMessage && sameSenderAsPrev && <div className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        <div className="p-2 sm:p-3 border-t border-gray-200 bg-white flex gap-2 flex-shrink-0">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message..." className="flex-1 border border-gray-300 rounded-full px-4 py-2 sm:py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" disabled={sending || !resolvedVendorId} />
          <Button onClick={sendMessage} disabled={!token || !resolvedVendorId || sending || !text.trim()} className="flex-shrink-0 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white p-2.5" size="sm">
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

