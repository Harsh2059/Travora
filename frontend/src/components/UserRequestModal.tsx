import React, { useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Request a Change</h2>
              <p className="text-xs text-slate-500">
                Describe what you need — Travora will find the best recovery options for you.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              What would you like to change?
            </label>
            <textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="e.g. I need to reach London one day earlier. Keep the conference safe."
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
              Common Requests:
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setRequestText(p)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 hover:text-purple-700 border border-slate-200 text-slate-700 transition flex items-center gap-1.5 font-medium"
                >
                  <MessageSquare className="h-3 w-3 text-purple-600" />
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
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
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2"
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
