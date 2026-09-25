import React from 'react';
import { Compass, BaggageClaim, ShieldCheck } from 'lucide-react';
import type { Journey } from '../types';

interface UpcomingTripDetailsProps {
  journey: Journey;
}

export const UpcomingTripDetails: React.FC<UpcomingTripDetailsProps> = ({ journey }) => {
  if (!journey || !journey.nodes || journey.nodes.length === 0) return null;

  // Derive final destination
  const destinationNode = journey.nodes[journey.nodes.length - 1];
  const destName = destinationNode.title || 'Your Destination';

  return (
    <div className="space-y-6">
      {/* Travel Status Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
        <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Compass className="w-4 h-4 text-sky-500" />
          Journey Overview
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">All Bookings Confirmed</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Your journey is on track. No active disruptions.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="h-8 w-8 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <BaggageClaim className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-extrabold text-slate-900 dark:text-white">Destination Intel</p>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">{destName} • Weather 29°C • Baggage flow normal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
