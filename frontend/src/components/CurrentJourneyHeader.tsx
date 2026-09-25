import React from 'react';
import { Navigation2, Plane, Calendar, MapPin, Wifi } from 'lucide-react';
import type { Journey } from '../types';
import { buildJourneyRoute } from '../utils/routeBuilder';

interface CurrentJourneyHeaderProps {
  journey: Journey;
  syncActive?: boolean;
}

export const CurrentJourneyHeader: React.FC<CurrentJourneyHeaderProps> = ({ journey, syncActive = true }) => {
  const activeNodes = journey.nodes.filter(n => n.status !== 'CANCELLED' && n.status !== 'REPLACED');
  const route = buildJourneyRoute(activeNodes);

  if (route.locations.length < 1) return null;

  const origin = route.locations[0];
  const destination = route.locations[route.locations.length - 1];

  const getCode = (label: string) => {
    const match = label.match(/\(([A-Z]{3})\)/);
    return match ? match[1] : label.substring(0, 3).toUpperCase();
  };

  const originCode = getCode(origin.label);
  const destCode = getCode(destination.label);
  const originCity = origin.label.split('(')[0].trim() || origin.label;
  const destCity = destination.label.split('(')[0].trim() || destination.label;

  let earliestDate = '';
  for (const node of activeNodes) {
    if (node.startDate) { earliestDate = node.startDate; break; }
    else if (node.startTime) { earliestDate = node.startTime.split('T')[0]; break; }
  }

  const dateStr = earliestDate
    ? new Date(earliestDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Date not set';

  const stageCount = activeNodes.length;

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Route Display */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5 text-blue-600" />
          </div>

          <div className="flex items-center gap-4">
            {/* Origin */}
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">{originCode}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[80px]">{originCity}</div>
            </div>

            {/* Flight path */}
            <div className="flex flex-col items-center gap-1 px-1">
              <div className="flex items-center gap-1">
                <div className="w-6 h-px bg-slate-200" />
                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <Plane className="w-2.5 h-2.5 text-blue-500" />
                </div>
                <div className="w-6 h-px bg-slate-200" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{stageCount} stages</span>
            </div>

            {/* Destination */}
            <div>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tighter leading-none">{destCode}</div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5 truncate max-w-[80px]">{destCity}</div>
            </div>

            {journey.id && (
              <div className="pl-4 border-l border-slate-100 hidden sm:block">
                <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Booking Ref</div>
                <div className="text-sm font-mono font-bold text-slate-700">
                  {String(journey.id).substring(0, 6).toUpperCase()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{dateStr}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{stageCount} stops</span>
          </div>

          <div className="flex items-center gap-2">
            {syncActive && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-bold">WhatsApp & SMS Live</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-slate-400 px-2.5 py-1.5 rounded-full bg-slate-50 border border-slate-200">
              <Wifi className="w-3 h-3" />
              <Navigation2 className="w-3 h-3" />
              <span className="text-[11px] font-bold">Feed Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
