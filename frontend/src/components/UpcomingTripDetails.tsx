import React from 'react';
import { Compass, BaggageClaim, ShieldCheck, CheckCircle2, Wifi, Activity } from 'lucide-react';
import type { Journey } from '../types';

interface UpcomingTripDetailsProps {
  journey: Journey;
}

export const UpcomingTripDetails: React.FC<UpcomingTripDetailsProps> = ({ journey }) => {
  if (!journey || !journey.nodes || journey.nodes.length === 0) return null;

  const activeNodes = journey.nodes.filter(n => n.status !== 'CANCELLED' && n.status !== 'REPLACED');
  const destinationNode = activeNodes[activeNodes.length - 1];
  const destName = destinationNode?.title || 'Your Destination';

  return (
    <div className="space-y-4">
      {/* All Clear Status */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Green accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-sky-400" />
        
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Journey On Track</p>
              <p className="text-[11px] text-emerald-600 font-semibold">No active disruptions detected</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">All Bookings Confirmed</p>
                <p className="text-[11px] text-slate-400 font-medium">Your journey is fully confirmed and on schedule</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-sky-50 border border-sky-100 rounded-xl">
              <Activity className="w-4 h-4 text-sky-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Live Monitoring Active</p>
                <p className="text-[11px] text-slate-400 font-medium">Travora is monitoring your trip in real-time</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <BaggageClaim className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-800">Destination Intel</p>
                <p className="text-[11px] text-slate-400 font-medium">{destName} · Weather 29°C · Baggage flow normal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coverage Summary */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recovery Coverage</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Flight rebooking', check: true },
            { label: 'Hotel protection', check: true },
            { label: 'Cab auto-sync', check: true },
            { label: 'WhatsApp alerts', check: true },
          ].map(({ label, check }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <span className="font-medium">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold">
          <Wifi className="w-3 h-3" />
          Travora Protection Active · Zero Out-of-Pocket Risk
        </div>
      </div>
    </div>
  );
};
