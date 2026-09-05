import React, { useState } from 'react';
import { X, Send, Sparkles, MessageSquare } from 'lucide-react';

interface UserRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (requestText: string) => void;
  loading: boolean;
}

export const UserRequestModal: React.FC<UserRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
}) => {
  const [requestText, setRequestText] = useState<string>('');

  const presets = [
    'I need to reach London one day earlier.',
    'Keep the conference at all costs.',
    'Minimize additional cost.',
    'Move my hotel to tomorrow.',
    'Cancel my sightseeing activity.',
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Traveler Natural Intent Request</h2>
              <p className="text-xs text-slate-400">
                Submit natural changes; our engine parses intent deterministically.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Natural Language Instruction
            </label>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="e.g. I need to reach London one day earlier. Keep the conference at all costs."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Quick Intent Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRequestText(p)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5"
                >
                  <MessageSquare className="h-3 w-3 text-purple-400" />
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (requestText.trim()) {
                  onSubmit(requestText.trim());
                  onClose();
                }
              }}
              disabled={!requestText.trim() || loading}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {loading ? 'Processing...' : 'Submit Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
