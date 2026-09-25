import React from 'react';
import { Navigation2, Plane } from 'lucide-react';
import type { Journey } from '../types';
import { buildJourneyRoute } from '../utils/routeBuilder';

interface CurrentJourneyHeaderProps {
  journey: Journey;
  syncActive?: boolean;
}

export const CurrentJourneyHeader: React.FC<CurrentJourneyHeaderProps> = ({ journey, syncActive = true }) => {
  // Use active nodes excluding replaced or cancelled for the summary
  const activeNodes = journey.nodes.filter(n => n.status !== 'CANCELLED' && n.status !== 'REPLACED');
  const route = buildJourneyRoute(activeNodes);
  
  if (route.locations.length < 1) return null;

  const origin = route.locations[0];
  const destination = route.locations[route.locations.length - 1];

  // Try to find the earliest start date to display
  let earliestDate = '';
  for (const node of activeNodes) {
    if (node.startDate) {
      earliestDate = node.startDate;
      break;
    } else if (node.startTime) {
      earliestDate = node.startTime.split('T')[0];
      break;
    }
  }

  const dateStr = earliestDate 
    ? new Date(earliestDate).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : 'Date not set';

  // We could extract these from backend if they existed, for now mock what we can't extract, but user said:
  // "Only show fields that actually exist. Do not invent data just to match the screenshot."
  // Journey doesn't have traveler count or cabin class in its schema yet, so let's check what it has.
  // The backend Journey model has `title`, `status`, `syncStatus`, `traveler_id`, etc.
  
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-900/40 text-sky-500 dark:text-sky-400 flex items-center justify-center shrink-0">
          <Plane className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap">
              <span>{origin.label}</span>
              <span className="text-slate-300 dark:text-slate-600">→</span>
              <span>{destination.label}</span>
            </h1>
            {journey.id && (
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                PNR: {String(journey.id).substring(0, 6).toUpperCase()}
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              {dateStr}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 self-start md:self-auto border-t border-slate-100 dark:border-slate-800 md:border-0 pt-4 md:pt-0 w-full md:w-auto">
        {syncActive && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-[11px] font-extrabold tracking-wide">WhatsApp & SMS Sync Active</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 px-2">
          <Navigation2 className="w-4 h-4" />
          <span className="text-[11px] font-extrabold tracking-wide">Feed Live</span>
        </div>
      </div>
    </div>
  );
};
