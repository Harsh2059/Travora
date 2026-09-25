import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
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
  } else if (preference === 'RECOMMENDED') {
    // Keep backend default sorting
  }

  // Find primary node
  const rootNodeId = impactResult?.root_node_ids?.[0];
  const primaryNode = journey?.nodes?.find((n: any) => String(n.id) === String(rootNodeId) || String(n.backendId) === String(rootNodeId));

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md flex flex-col h-full">
      {primaryNode && (
        <div className="bg-slate-900 text-white px-5 py-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">RECOVERING</div>
          <div className="text-sm font-bold truncate">{primaryNode.title}</div>
        </div>
      )}
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <button
          onClick={() => setPreference('RECOMMENDED')}
          className={`flex-1 py-3 text-xs font-extrabold text-center transition-colors ${preference === 'RECOMMENDED' ? 'text-sky-600 border-b-2 border-sky-500 bg-white dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
        >
          Recommended
        </button>
        <button
          onClick={() => setPreference('LOWEST_COST')}
          className={`flex-1 py-3 text-xs font-extrabold text-center transition-colors ${preference === 'LOWEST_COST' ? 'text-sky-600 border-b-2 border-sky-500 bg-white dark:bg-slate-800' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
        >
          Lowest Cost
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
            <p className="text-sm font-semibold text-slate-500">No recovery options available yet.</p>
          </div>
        )}

        {!loading && !error && sortedPlans.map((plan, i) => {
          const isSelected = selectedRecoveryPlan?.id === plan.id;
          
          return (
            <div key={plan.id} className={`rounded-2xl border ${isSelected ? 'border-sky-500 shadow-md shadow-sky-500/10' : 'border-slate-200 dark:border-slate-700'} overflow-hidden transition-all bg-white dark:bg-slate-800`}>
              <div className="px-4 py-3 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center border-b border-slate-100 dark:border-slate-700">
                <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  Option {i + 1} {i === 0 && preference === 'RECOMMENDED' ? '• Best Match' : ''}
                </span>
                <span className="text-xs font-bold text-sky-600">
                  {plan.estimated_additional_cost === 0 ? 'Zero Surcharge' : `+₹${plan.estimated_additional_cost?.toLocaleString() || 0}`}
                </span>
              </div>
              <div className="p-4 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                  {plan.title}
                </h4>
                
                {plan.changed_node_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                    <ShieldCheck className="w-3.5 h-3.5" /> 100% Airline Rebooking Credit
                  </div>
                )}
                
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-colors ${isSelected ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20' : 'bg-slate-100 dark:bg-slate-700 text-sky-600 dark:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                >
                  {isSelected ? 'Selected as Primary Option' : `Select Option ${i + 1}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
