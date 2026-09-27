/**
 * PublicSignalsSection.tsx
 *
 * Compact Public/Social Signals UI component.
 * Respects HackCelestial 3.0 honesty constraints:
 * Explicitly surfaces "DEMO PUBLIC SIGNAL" badge when is_live is false.
 */

import React from 'react';
import { MessageSquareText, Clock } from 'lucide-react';
import type { PublicSignalItem } from '../../types/digitalTwin';

interface PublicSignalsSectionProps {
  location: string;
  signals: PublicSignalItem[];
  isLive: boolean;
}

export const PublicSignalsSection: React.FC<PublicSignalsSectionProps> = ({
  location,
  signals,
  isLive,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <MessageSquareText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              PUBLIC TRAVEL SIGNALS
            </h2>
            <p className="text-xs text-slate-500">
              Aggregated crowd-sourced & public observations for {location}.
            </p>
          </div>
        </div>

        <div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              LIVE PUBLIC FEED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider" title="Test data fixture">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              DEMO PUBLIC SIGNAL
            </span>
          )}
        </div>
      </div>

      {/* Signals List */}
      <div className="space-y-2.5">
        {signals && signals.length > 0 ? (
          signals.map((sig) => (
            <div
              key={sig.id}
              className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/70 transition-colors flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    sig.severity === 'critical' || sig.severity === 'high'
                      ? 'bg-rose-600'
                      : sig.severity === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <div className="space-y-0.5">
                  <p className="font-extrabold text-slate-900 leading-snug">
                    {sig.title || sig.text || 'Public Observation'}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-600">{sig.author || sig.source}</span>
                    {!isLive && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-slate-200 text-slate-600 uppercase tracking-wider">
                        DEMO FIXTURE
                      </span>
                    )}
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      {sig.time_ago}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0 ${
                  sig.severity === 'high' || sig.severity === 'critical'
                    ? 'bg-rose-100 text-rose-800'
                    : sig.severity === 'medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {sig.severity}
              </span>
            </div>
          ))
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No public signals reported for this area.
          </div>
        )}
      </div>
    </div>
  );
};
