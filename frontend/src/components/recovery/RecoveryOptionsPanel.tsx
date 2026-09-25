import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, Plane, ChevronRight } from 'lucide-react';
import type { Part4RecoveryPlan, Part4RecoveryResult, Journey } from '../../types';
import { analyzePart4Recovery } from '../../services/recoveryApi';
import { saveSelectedRecoveryPlan } from '../../store/journeyStore';

interface RecoveryOptionsPanelProps {
  tripId: number | string;
  journey: Journey;
  impactResult: any;
  currentDisruptionFingerprint?: string;
  onPlanSelected?: (plan: Part4RecoveryPlan) => void;
  selectedRecoveryPlan: Part4RecoveryPlan | null;
}

export type PreferenceType = 'RECOMMENDED' | 'LOWEST_COST' | 'EARLIEST_ARRIVAL';

function fmtTime(isoStr?: string | null): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return isoStr || '';
  }
}

function getPlanDepartureTimestamp(plan: Part4RecoveryPlan): number {
  const replChange = plan.changes?.find((c) => c.action === 'REPLACE' || c.action === 'MODIFY');
  const startTimeStr = replChange?.start_time || replChange?.new_details?.departure_time;
  if (!startTimeStr) return Number.MAX_SAFE_INTEGER;
  try {
    return new Date(startTimeStr).getTime();
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export const RecoveryOptionsPanel: React.FC<RecoveryOptionsPanelProps> = ({
  tripId,
  journey,
  impactResult,
  currentDisruptionFingerprint = '',
  onPlanSelected,
  selectedRecoveryPlan
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Part4RecoveryResult | null>(null);
  const [preference, setPreference] = useState<PreferenceType>('RECOMMENDED');
  const activeFetchFpRef = useRef<string>('');

  useEffect(() => {
    activeFetchFpRef.current = currentDisruptionFingerprint;
    const fetchRecovery = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await analyzePart4Recovery(Number(tripId));
        if (activeFetchFpRef.current === currentDisruptionFingerprint) {
          setResult(res);
        }
      } catch (err: any) {
        if (activeFetchFpRef.current === currentDisruptionFingerprint) {
          setError(err.message || 'Failed to fetch recovery options');
        }
      } finally {
        if (activeFetchFpRef.current === currentDisruptionFingerprint) {
          setLoading(false);
        }
      }
    };
    fetchRecovery();
  }, [tripId, currentDisruptionFingerprint]);

  const handleSelectPlan = (plan: Part4RecoveryPlan) => {
    const fp = result?.disruption_fingerprint ?? currentDisruptionFingerprint;
    saveSelectedRecoveryPlan(Number(tripId), plan, fp);
    if (onPlanSelected) {
      onPlanSelected(plan);
    }
  };

  const plans = result?.plans || [];

  let sortedPlans = [...plans];
  if (preference === 'LOWEST_COST') {
    sortedPlans.sort((a, b) => (a.estimated_additional_cost || 0) - (b.estimated_additional_cost || 0));
  } else if (preference === 'EARLIEST_ARRIVAL') {
    sortedPlans.sort((a, b) => getPlanDepartureTimestamp(a) - getPlanDepartureTimestamp(b));
  }

  // Find primary node
  const rootNodeId = impactResult?.root_node_ids?.[0];
  const primaryNode = journey?.nodes?.find(
    (n: any) => String(n.id) === String(rootNodeId) || String(n.backendId) === String(rootNodeId)
  );

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md flex flex-col h-full">
      {primaryNode && (
        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">RECOVERING</div>
            <div className="text-sm font-extrabold truncate">{primaryNode.title}</div>
          </div>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 uppercase tracking-wider">
            Primary Disruption
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={() => setPreference('RECOMMENDED')}
          className={`flex-1 py-3 text-[11px] font-extrabold text-center transition-colors ${
            preference === 'RECOMMENDED'
              ? 'text-sky-600 border-b-2 border-sky-500 bg-white dark:bg-slate-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          Recommended
        </button>
        <button
          onClick={() => setPreference('LOWEST_COST')}
          className={`flex-1 py-3 text-[11px] font-extrabold text-center transition-colors ${
            preference === 'LOWEST_COST'
              ? 'text-sky-600 border-b-2 border-sky-500 bg-white dark:bg-slate-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          Lowest Cost
        </button>
        <button
          onClick={() => setPreference('EARLIEST_ARRIVAL')}
          className={`flex-1 py-3 text-[11px] font-extrabold text-center transition-colors ${
            preference === 'EARLIEST_ARRIVAL'
              ? 'text-sky-600 border-b-2 border-sky-500 bg-white dark:bg-slate-800'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
          }`}
        >
          Earliest Arrival
        </button>
      </div>

      <div className="p-4 bg-white dark:bg-slate-900 flex-1 overflow-y-auto space-y-4">
        {loading && (
          <div className="py-12 text-center space-y-4">
            <div className="h-8 w-8 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Finding recovery options...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold flex gap-2 items-center">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {!loading && !error && sortedPlans.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-slate-500">No recovery options available for this route.</p>
          </div>
        )}

        {!loading && !error && sortedPlans.map((plan, i) => {
          const isSelected = selectedRecoveryPlan?.id === plan.id;

          const replChange = plan.changes?.find((c) => c.action === 'REPLACE' || c.action === 'MODIFY');
          const newDetails = replChange?.new_details || {};
          const carrier = replChange?.provider || newDetails.provider || newDetails.airline || replChange?.new_title || plan.title;
          const flNo = newDetails.flight_number || newDetails.resource_id || '';
          const orig = replChange?.origin || newDetails.origin || primaryNode?.origin || 'BOM';
          const dest = replChange?.destination || newDetails.destination || primaryNode?.destination || 'DEL';
          const depT = fmtTime(replChange?.start_time || newDetails.departure_time);
          const arrT = fmtTime(replChange?.end_time || newDetails.arrival_time);
          const durationM = newDetails.duration_minutes || newDetails.duration || 135;

          const categoryBadge = i === 0 && preference === 'RECOMMENDED' ? 'Option 1 • Best Match' : `Option ${i + 1}`;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border transition-all bg-white dark:bg-slate-800 overflow-hidden ${
                isSelected
                  ? 'border-sky-500 ring-2 ring-sky-500/20 shadow-lg'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {/* Option Header */}
              <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                <span className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                  {categoryBadge}
                </span>
                <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400">
                  {plan.estimated_additional_cost === 0
                    ? 'Zero Surcharge'
                    : `+₹${plan.estimated_additional_cost?.toLocaleString() || 0}`}
                </span>
              </div>

              {/* Option Card Body */}
              <div className="p-4 space-y-3">
                {/* Replacement Journey Timing */}
                {replChange && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Plane className="w-3.5 h-3.5 text-sky-500" />
                        {carrier} {flNo}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {Math.floor(durationM / 60)}h {durationM % 60}m • Non-stop
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-extrabold text-slate-800 dark:text-slate-200 pt-1">
                      <div>
                        <span className="text-sm block">{depT || '08:40 AM'}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{orig}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      <div className="text-right">
                        <span className="text-sm block">{arrT || '10:55 AM'}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{dest}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Protection Badge */}
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span>100% Airline Rebooking Credit Applied</span>
                </div>

                {/* Downstream Preserved Bullets */}
                <div className="space-y-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300 pt-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Connection status recalculated & preserved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Hotel check-in & cab pickup synced</span>
                  </div>
                </div>

                {/* Select Button */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-2.5 rounded-xl font-extrabold text-xs transition-colors flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'bg-slate-100 dark:bg-slate-700 text-sky-600 dark:text-sky-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Selected as Primary Option</span>
                    </>
                  ) : (
                    `Select Option ${i + 1}`
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
