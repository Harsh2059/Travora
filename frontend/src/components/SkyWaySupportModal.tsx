import React, { useState, useEffect } from 'react';
import {
  X,
  Headphones,
  Phone,
  MessageCircle,
  Send
} from 'lucide-react';

interface SkyWaySupportModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const SkyWaySupportModal: React.FC<SkyWaySupportModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const [isOpen, setIsOpen] = useState(propIsOpen || false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string }>>([
    {
      sender: 'agent',
      text: 'Hello! I am your SkyWay Journey Concierge. How can we assist you with your booking or flight recovery today?',
      time: 'Just now',
    },
  ]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (propIsOpen !== undefined) {
      setIsOpen(propIsOpen);
    }
  }, [propIsOpen]);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('skyway_open_support', handleOpen);
    return () => window.removeEventListener('skyway_open_support', handleOpen);
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    if (propOnClose) propOnClose();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userText = chatMessage.trim();
    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: userText, time: 'Just now' },
    ]);
    setChatMessage('');
    setIsSending(true);

    setTimeout(() => {
      setIsSending(false);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `Thank you for reaching out! A SkyWay travel operations specialist is reviewing your inquiry ("${userText.slice(0, 30)}..."). We have your booking details linked and our priority rebooking desk is on standby 24/7.`,
          time: 'Just now',
        },
      ]);
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-500 to-blue-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">SkyWay 24/7 Concierge & Support</h3>
              <p className="text-xs text-sky-100 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Travel Experts Online
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Channels bar */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70">
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800">WhatsApp Recovery</p>
              <p className="text-[10px] text-slate-500">+1 (800) SKY-WAY-1</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200/70">
            <Phone className="w-4 h-4 text-sky-600 shrink-0" />
            <div>
              <p className="font-bold text-slate-800">Direct Helpline</p>
              <p className="text-[10px] text-slate-500">Toll-free 24/7</p>
            </div>
          </div>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#f8fbff]/60">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                m.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs ${
                  m.sender === 'user'
                    ? 'bg-sky-600 text-white rounded-br-xs'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs'
                }`}
              >
                {m.text}
              </div>
              <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
            </div>
          ))}
          {isSending && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 px-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.4s]" />
              <span className="text-[11px] text-slate-500 ml-1">SkyWay agent typing...</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Type your message or flight query..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white"
          />
          <button
            type="submit"
            disabled={!chatMessage.trim() || isSending}
            className="w-9 h-9 rounded-full bg-sky-600 text-white flex items-center justify-center disabled:opacity-50 hover:bg-sky-700 transition-colors shadow-sm shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
