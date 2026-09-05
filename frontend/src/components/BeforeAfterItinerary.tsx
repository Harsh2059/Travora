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
    <div className="rounded-2xl bg-white border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Before & After Recovery Comparison
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparently highlights what is preserved, modified, removed, and newly booked.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            Preserved
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
            Modified
          </span>
          <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
            Removed
          </span>
          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
            Added
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* BEFORE COLUMN */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Current Itinerary (Before)
            </span>
            <span className="text-xs text-slate-400">{originalItems.length} items</span>
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
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : isModified
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                      {getItemIcon(item.type)}
                    </span>
                    <div>
                      <div className="font-semibold">{item.provider}</div>
                      <div className="text-[11px] text-slate-500">
                        {item.origin && item.destination
                          ? `${item.origin} → ${item.destination}`
                          : item.location || item.type}
                      </div>
                    </div>
                  </div>

                  <div>
                    {isRemoved ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                        <X className="h-3 w-3" /> Replaced
                      </span>
                    ) : isModified ? (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                        <RefreshCw className="h-3 w-3" /> Rescheduled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <Check className="h-3 w-3" /> Kept
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
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Recovered Itinerary (After)
            </span>
            <span className="text-xs text-blue-600 font-semibold">
              {originalItems.length - plan.removed_items.length + plan.added_items.length} items
            </span>
          </div>

          <div className="space-y-2">
            {/* Preserved & Modified items */}
            {originalItems
              .filter((it) => !removedIds.has(it.id))
              .map((item) => {
                const isModified = modifiedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      isModified
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50/50 border-emerald-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">
                        {getItemIcon(item.type)}
                      </span>
                      <div>
                        <div className="font-semibold">{item.provider}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.origin && item.destination
                            ? `${item.origin} → ${item.destination}`
                            : item.location || item.type}
                        </div>
                      </div>
                    </div>

                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  </div>
                );
              })}

            {/* Added Alternative items */}
            {plan.added_items.map((item: any, i: number) => (
              <div
                key={`added-${i}`}
                className="p-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 rounded-lg bg-white border border-blue-200 text-blue-600">
                    {getItemIcon(item.type || 'flight')}
                  </span>
                  <div>
                    <div className="font-bold flex items-center gap-1.5">
                      <span>{item.provider || item.type}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 uppercase font-black">
                        New
                      </span>
                    </div>
                    <div className="text-[11px] text-blue-700">
                      {item.origin && item.destination
                        ? `${item.origin} → ${item.destination}`
                        : item.location || 'Confirmed Booking'}
                    </div>
                  </div>
                </div>

                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700">
                  <PlusCircle className="h-3 w-3" /> New Booking
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
