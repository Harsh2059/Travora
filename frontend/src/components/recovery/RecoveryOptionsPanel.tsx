import React, { useEffect, useState, useRef } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Clock, Plane,
  ArrowRight, Zap, Star, TrendingDown, Timer, ChevronRight
} from 'lucide-react';
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
  try { return new Date(startTimeStr).getTime(); }
  catch { return Number.MAX_SAFE_INTEGER; }
}

const PREFERENCE_TABS: { key: PreferenceType; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'RECOMMENDED', label: 'Best Match', Icon: Star },
  { key: 'LOWEST_COST', label: 'Lowest Cost', Icon: TrendingDown },
  { key: 'EARLIEST_ARRIVAL', label: 'Earliest', Icon: Timer },
];

export const RecoveryOptionsPanel: React.FC<RecoveryOptionsPanelProps> = ({
  tripId,
  journey,
  impactResult,
  currentDisruptionFingerprint = '',
  onPlanSelected,
  selectedRecoveryPlan,
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
    if (onPlanSelected) onPlanSelected(plan);
  };

  const plans = result?.plans || [];
  let sortedPlans = [...plans];
  if (preference === 'LOWEST_COST') {
    sortedPlans.sort((a, b) => (a.estimated_additional_cost || 0) - (b.estimated_additional_cost || 0));
  } else if (preference === 'EARLIEST_ARRIVAL') {
    sortedPlans.sort((a, b) => getPlanDepartureTimestamp(a) - getPlanDepartureTimestamp(b));
  }

  const rootNodeId = impactResult?.root_node_ids?.[0];
  const primaryNode = journey?.nodes?.find(
    (n: any) => String(n.id) === String(rootNodeId) || String(n.backendId) === String(rootNodeId)
  );

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Zap className="w-4 h-4 text-sky-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-sky-600">Recovery Engine</span>
            </div>
            <h3 className="text-base font-black text-slate-900">Available Options</h3>
            {primaryNode && (
              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
                <span>Recovering:</span>
                <span className="font-bold text-slate-700 truncate max-w-[160px]">{primaryNode.title}</span>
              </p>
            )}
          </div>
          {!loading && !error && (
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900">{sortedPlans.length}</div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">options</div>
            </div>
          )}
        </div>
      </div>

      {/* Sort Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50/50">
        {PREFERENCE_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setPreference(key)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 transition-all text-[10px] font-black uppercase tracking-wide ${
              preference === key
                ? 'text-sky-600 bg-white border-b-2 border-sky-500 shadow-sm'
                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Options List */}
      <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[480px]">
        {loading && (
          <div className="py-10 text-center space-y-3">
            <div className="relative mx-auto w-12 h-12">
              <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-sky-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Plane className="w-4 h-4 text-sky-500" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-700">Scanning live schedules</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Checking 14+ carriers...</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold flex gap-2 items-center">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {!loading && !error && sortedPlans.length === 0 && (
          <div className="py-10 text-center">
            <ShieldCheck className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">No options available right now.</p>
          </div>
        )}

        {!loading && !error && sortedPlans.map((plan, i) => {
          const isSelected = selectedRecoveryPlan?.id === plan.id;
          const replChange = plan.changes?.find((c) => c.action === 'REPLACE' || c.action === 'MODIFY');
          const newDetails = replChange?.new_details || {};
          const carrier = replChange?.provider || newDetails.provider || newDetails.airline || replChange?.new_title || plan.title;
          const flNo = newDetails.flight_number || newDetails.resource_id || '';
          const orig = replChange?.origin || newDetails.origin || primaryNode?.origin || '';
          const dest = replChange?.destination || newDetails.destination || primaryNode?.destination || '';
          const depT = fmtTime(replChange?.start_time || newDetails.departure_time);
          const arrT = fmtTime(replChange?.end_time || newDetails.arrival_time);
          const durationM = newDetails.duration_minutes || newDetails.duration || 0;
          const cost = plan.estimated_additional_cost || 0;
          const isBestMatch = i === 0 && preference === 'RECOMMENDED';

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border transition-all overflow-hidden cursor-pointer group ${
                isSelected
                  ? 'border-sky-400 ring-2 ring-sky-400/20 shadow-md shadow-sky-100'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
              }`}
              onClick={() => handleSelectPlan(plan)}
            >
              {/* Option Header */}
              <div className={`px-4 py-2.5 flex items-center justify-between ${
                isSelected
                  ? 'bg-sky-500 text-white'
                  : isBestMatch
                    ? 'bg-gradient-to-r from-emerald-50 to-sky-50 border-b border-slate-100'
                    : 'bg-slate-50 border-b border-slate-100'
              }`}>
                <div className="flex items-center gap-2">
                  {isBestMatch && !isSelected && (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <Star className="w-2.5 h-2.5" /> Best
                    </span>
                  )}
                  {isSelected && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  )}
                  <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                    Option {i + 1}
                  </span>
                </div>
                <span className={`text-sm font-black ${
                  isSelected ? 'text-sky-100' : cost === 0 ? 'text-emerald-600' : 'text-slate-700'
                }`}>
                  {cost === 0 ? '₹0 surcharge' : `+₹${cost.toLocaleString()}`}
                </span>
              </div>

              {/* Flight Info */}
              <div className="p-3">
                {replChange ? (
                  <div className="flex items-center justify-between">
                    {/* Carrier + Timing */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Plane className="w-4 h-4 text-sky-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-black text-slate-900">{depT || '--:--'}</span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <span className="w-3 h-px bg-slate-300"></span>
                            {durationM > 0 ? `${Math.floor(durationM / 60)}h${durationM % 60}m` : 'Direct'}
                            <span className="w-3 h-px bg-slate-300"></span>
                          </div>
                          <span className="text-[13px] font-black text-slate-900">{arrT || '--:--'}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {carrier} {flNo}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-1 text-sm font-semibold text-slate-700">{plan.title}</div>
                )}

                {/* Perks Row & Select Button */}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                      <ShieldCheck className="w-2.5 h-2.5 text-emerald-500" /> Airline credit
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                      <CheckCircle2 className="w-2.5 h-2.5 text-sky-500" /> Auto-sync
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelectPlan(plan); }}
                    className={`px-3 py-1.5 rounded-lg font-black text-[11px] transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
