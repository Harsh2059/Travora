import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, X, CheckCircle2, History } from 'lucide-react';
import type { JourneyNode } from '../../types';

interface RestoreJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmRestore: () => Promise<void>;
  replacementItem?: JourneyNode | null;
  originalItem?: JourneyNode | null;
}

export const RestoreJourneyModal: React.FC<RestoreJourneyModalProps> = ({
  isOpen,
  onClose,
  onConfirmRestore,
  replacementItem,
  originalItem,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRestore = async () => {
    try {
      setIsRestoring(true);
      setError(null);
      await onConfirmRestore();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Unable to restore original journey.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 shrink-0">
              <History className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                  DEMO / TESTING
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                RESTORE ORIGINAL JOURNEY?
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-white leading-relaxed">
            This will restore your journey to the state it had before the simulated recovery was executed.
          </p>

          <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span className="text-xs font-medium leading-snug">
              Demo/testing action. No real booking cancellation or refund will occur.
            </span>
          </div>

          {/* Comparison summary */}
          <div className="space-y-2.5 pt-1">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              Journey Change Summary
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* CURRENT */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-1.5 min-w-0">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  CURRENT JOURNEY
                </div>
                <div className="font-bold text-slate-900 dark:text-white flex items-start justify-between gap-2 min-w-0">
                  <span className="min-w-0 break-words">
                    {replacementItem?.provider || replacementItem?.title || 'Replacement Booking'}
                  </span>
                  <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Confirmed
                  </span>
                </div>
                {(replacementItem?.origin || replacementItem?.destination) && (
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 break-words">
                    {replacementItem.origin} → {replacementItem.destination}
                  </div>
                )}
                {replacementItem?.bookingRef && (
                  <div className="text-[11px] font-mono text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2 py-0.5 rounded w-max max-w-full truncate">
                    PNR: {replacementItem.bookingRef}
                  </div>
                )}
              </div>

              {/* ORIGINAL */}
              <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/60 space-y-1.5 min-w-0">
                <div className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider">
                  ORIGINAL JOURNEY
                </div>
                <div className="font-bold text-slate-900 dark:text-white flex items-start justify-between gap-2 min-w-0">
                  <span className="min-w-0 break-words">
                    {originalItem?.provider || originalItem?.title || 'Original Booking'}
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-300 shrink-0">
                    Original booking
                  </span>
                </div>
                {(originalItem?.origin || originalItem?.destination) && (
                  <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 break-words">
                    {originalItem.origin} → {originalItem.destination}
                  </div>
                )}
                {originalItem?.bookingRef && (
                  <div className="text-[11px] font-mono text-sky-700 dark:text-sky-300 bg-sky-100/60 dark:bg-sky-900/40 px-2 py-0.5 rounded w-max max-w-full truncate">
                    PNR: {originalItem.bookingRef}
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isRestoring ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Restoring...
              </>
            ) : (
              'Restore Original'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
