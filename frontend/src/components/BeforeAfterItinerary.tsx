import { Plane, Building2, Train, Calendar, Check, X, RefreshCw, PlusCircle } from 'lucide-react';
import type { RecoveryPlan, ItineraryItem } from '../types';

interface BeforeAfterItineraryProps {
  plan: RecoveryPlan;
  originalItems: ItineraryItem[];
}

export const BeforeAfterItinerary: React.FC<BeforeAfterItineraryProps> = ({
  plan,
  originalItems,
}) => {
  const getItemIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'FLIGHT':
        return <Plane className="h-4 w-4" />;
      case 'HOTEL':
        return <Building2 className="h-4 w-4" />;
      case 'TRANSFER':
        return <Train className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const removedIds = new Set(plan.removed_items.map((it: any) => it.id));
  const modifiedIds = new Set(plan.modified_items.map((it: any) => it.id));

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            Before & After Recovery Comparison
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparently highlights what is preserved, modified, removed, and newly booked.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
            Preserved
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
            Modified
          </span>
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
            Removed
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
            Added
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE COLUMN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Current Itinerary (Before)
            </span>
            <span className="text-xs text-slate-500">{originalItems.length} items</span>
          </div>

          <div className="space-y-2">
            {originalItems.map((item) => {
              const isRemoved = removedIds.has(item.id);
              const isModified = modifiedIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isRemoved
                      ? 'bg-red-950/20 border-red-800/40 text-red-300 opacity-75'
                      : isModified
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : 'bg-slate-950/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
                      {getItemIcon(item.type)}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {item.provider}
                        {item.priority === 'CRITICAL' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-extrabold">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.origin && item.destination ? `${item.origin} → ${item.destination}` : item.location}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {isRemoved ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                        <X className="h-3 w-3" /> REMOVED
                      </span>
                    ) : isModified ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> MODIFIED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <Check className="h-3 w-3" /> PRESERVED
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AFTER COLUMN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Recovered Itinerary (After: {plan.title})
            </span>
            <span className="text-xs text-slate-500">
              {originalItems.length - plan.removed_items.length + plan.added_items.length} items
            </span>
          </div>

          <div className="space-y-2">
            {/* 1. Preserved items */}
            {originalItems
              .filter((it) => !removedIds.has(it.id) && !modifiedIds.has(it.id))
              .map((item) => (
                <div
                  key={`pres-${item.id}`}
                  className="p-3 rounded-xl border border-emerald-900/30 bg-emerald-950/10 text-emerald-200 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
                      {getItemIcon(item.type)}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {item.provider}
                        {item.priority === 'CRITICAL' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-extrabold">
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {item.origin && item.destination ? `${item.origin} → ${item.destination}` : item.location}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    INTACT
                  </span>
                </div>
              ))}

            {/* 2. Modified items */}
            {plan.modified_items.map((item: any) => (
              <div
                key={`mod-${item.id}`}
                className="p-3 rounded-xl border border-amber-800/40 bg-amber-950/20 text-amber-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400">
                    {getItemIcon(item.type || 'FLIGHT')}
                  </div>
                  <div>
                    <div className="font-bold text-white">{item.provider || 'Rescheduled Service'}</div>
                    <div className="text-[11px] text-amber-300 font-mono">
                      Rescheduled: {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> RESCHEDULED
                </span>
              </div>
            ))}

            {/* 3. Newly Added items */}
            {plan.added_items.map((item: any, idx: number) => (
              <div
                key={`add-${idx}`}
                className="p-3 rounded-xl border border-blue-700/50 bg-blue-950/20 text-blue-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-blue-950/60 text-blue-400">
                    {getItemIcon(item.type || 'FLIGHT')}
                  </div>
                  <div>
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {item.provider}
                      <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-bold">
                        NEW BOOKING
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {item.origin && item.destination ? `${item.origin} → ${item.destination}` : item.location || 'Express Route'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white font-mono">₹{item.cost?.toLocaleString()}</div>
                  <span className="text-[10px] text-blue-300 flex items-center gap-1 justify-end">
                    <PlusCircle className="h-3 w-3" /> ADDED
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
