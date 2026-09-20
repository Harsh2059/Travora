import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { analyzePart4Recovery } from '../../services/recoveryApi';
import { saveSelectedRecoveryPlan } from '../../store/journeyStore';
import type { Part4RecoveryResult, Part4RecoveryPlan } from '../../types';
import { RecoveryPlanCard } from './RecoveryPlanCard';
import { RecoveryPlanDetail } from './RecoveryPlanDetail';

interface RecoveryPlanViewProps {
  tripId: number;
  /** Authoritative fingerprint of the CURRENT active disruption set, from impactResult.disruption_fingerprint.
   * Used to detect and discard stale async recovery responses. */
  currentDisruptionFingerprint?: string;
  onClose: () => void;
  onPlanSelected?: (plan: Part4RecoveryPlan) => void;
  onViewImpact?: () => void;
}

export type PreferenceType = 'LOWEST_COST' | 'MORE_COMFORTABLE' | 'FEWEST_CHANGES' | 'PRESERVE_PRIORITIES' | 'BALANCED';

export const RecoveryPlanView: React.FC<RecoveryPlanViewProps> = ({
  tripId,
  currentDisruptionFingerprint = '',
  onClose,
  onPlanSelected,
  onViewImpact,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Part4RecoveryResult | null>(null);
  const [preference, setPreference] = useState<PreferenceType>('PRESERVE_PRIORITIES');
  const [maxBudget, setMaxBudget] = useState<string>('');
  // Track whether we detected a stale response that was discarded and re-fetched
  const [staleWarning, setStaleWarning] = useState<boolean>(false);
  
  const [inspectingPlan, setInspectingPlan] = useState<Part4RecoveryPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Part4RecoveryPlan | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);

  // Ref holds the fingerprint at the time each fetch was *started*.
  // If currentDisruptionFingerprint changes while a fetch is in-flight, the result
  // is discarded (stale async-response guard — test case 17).
  const fetchFingerprintRef = useRef<string>('');

  const fetchRecovery = async (pref: PreferenceType = preference, budgetStr: string = maxBudget) => {
    try {
      setLoading(true);
      setError(null);
      setStaleWarning(false);

      // Capture the fingerprint at the moment this request starts
      const fpAtFetchStart = currentDisruptionFingerprint;
      fetchFingerprintRef.current = fpAtFetchStart;

      const budgetNum = budgetStr.trim() !== '' ? parseFloat(budgetStr) : null;
      const data = await analyzePart4Recovery(tripId, pref, budgetNum);

      // ── Stale async-response guard (test case 17) ──
      // If the fingerprint changed while the request was in-flight, this result
      // was built from an outdated disruption snapshot. Discard it and re-fetch.
      const fpAtFetchEnd = currentDisruptionFingerprint;
      const resultFp = data?.disruption_fingerprint ?? '';

      // A result is stale if:
      //   a) The backend fingerprint in the result doesn't match the current fingerprint
      //   b) AND we actually have a current fingerprint to compare (non-empty)
      const isStale =
        fpAtFetchEnd !== '' &&
        resultFp !== '' &&
        resultFp !== fpAtFetchEnd;

      if (isStale) {
        // Silently re-fetch with the current disruption state
        setStaleWarning(true);
        setLoading(false);
        fetchRecovery(pref, budgetStr);
        return;
      }

      setResult(data);
      setStaleWarning(false);
    } catch (err: any) {
      console.error('Failed to generate Part 4 recovery plans:', err);
      setError(err?.response?.data?.detail || 'Failed to generate recovery options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecovery(preference, maxBudget);
  }, [tripId, preference]);

  const handleApplyBudget = () => {
    fetchRecovery(preference, maxBudget);
  };

  const handleClearBudget = () => {
    setMaxBudget('');
    fetchRecovery(preference, '');
  };

  const handleSelectPlan = (plan: Part4RecoveryPlan) => {
    // Save plan bound to the disruption fingerprint from the result that produced it.
    // HomeScreen will use this fingerprint to detect invalidation when disruptions change.
    const fp = result?.disruption_fingerprint ?? currentDisruptionFingerprint;
    saveSelectedRecoveryPlan(tripId, plan, fp);
    setSelectedPlan(plan);
    setShowToast(true);
    if (onPlanSelected) {
      onPlanSelected(plan);
    }
  };

  const planCount = result?.total_feasible_plans ?? result?.plans?.length ?? 0;
  const status = result?.status || (planCount > 0 ? 'OPTIONS_AVAILABLE' : 'NO_FEASIBLE_RECOVERY');

  const preferencesList: { key: PreferenceType; label: string; icon: string }[] = [
    { key: 'LOWEST_COST', label: '💰 Lowest Cost', icon: '💰' },
    { key: 'MORE_COMFORTABLE', label: '🛋️ More Comfortable', icon: '🛋️' },
    { key: 'FEWEST_CHANGES', label: '🔄 Fewest Changes', icon: '🔄' },
    { key: 'PRESERVE_PRIORITIES', label: '⭐ Preserve Priorities', icon: '⭐' },
    { key: 'BALANCED', label: '⚖️ Balanced', icon: '⚖️' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  Part 4 · Recovery Engine
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">RECOVER YOUR JOURNEY</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                We evaluate feasible options to restore your journey while preserving intact bookings.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stale Async Response Notice */}
        {staleWarning && (
          <div className="p-3 rounded-2xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Journey state updated while loading. Re-fetching recovery options...</span>
          </div>
        )}

        {/* Selected Plan Toast Notice */}
        {showToast && selectedPlan && (
          <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-white" />
              <div>
                <div className="font-bold text-xs">Plan Selected: {selectedPlan.title}</div>
                <div className="text-[11px] text-emerald-100 mt-0.5">
                  Proposed plan stored locally. Original bookings remain untouched until booking execution in Part 5.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Preference & Budget Selector Bar */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-sky-500" />
              <span>HOW WOULD YOU LIKE TO RECOVER?</span>
            </span>
          </div>

          {/* Preference Pill Buttons */}
          <div className="flex flex-wrap gap-2">
            {preferencesList.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreference(p.key)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                  preference === p.key
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Optional Budget Constraint Input */}
          <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">Maximum additional cost budget:</span>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2.5 top-1.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleApplyBudget()}
                  className="w-32 pl-6 pr-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <button
                onClick={handleApplyBudget}
                className="px-3 py-1 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                Apply
              </button>
              {maxBudget !== '' && (
                <button
                  onClick={handleClearBudget}
                  className="px-2 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-4">
            <div className="h-12 w-12 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">
              Analyzing Part 3 impact & generating feasible recovery options...
            </p>
          </div>
        )}

        {/* System Error State (Actual API / Server Failure) */}
        {error && !loading && (
          <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Recovery Analysis Error</span>
            </div>
            <p className="text-xs">{error}</p>
            <button
              onClick={() => fetchRecovery(preference, maxBudget)}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* VALID BUSINESS RESULT: Hard Constraint Failure (NO_FEASIBLE_RECOVERY) */}
        {!loading && !error && status === 'NO_FEASIBLE_RECOVERY' && (
          <div className="py-10 text-center space-y-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto text-xl font-bold">
              ⚪
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                RECOVERY REVIEWED
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                No feasible recovery plan found.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                {result?.message || 'A critical journey requirement can no longer be preserved with the available recovery options. Your unaffected bookings remain unchanged.'}
              </p>
            </div>
            {onViewImpact && (
              <button
                onClick={onViewImpact}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                View Impact
              </button>
            )}
          </div>
        )}

        {/* VALID BUSINESS RESULT: Budget Constraint Failure (BUDGET_EXCEEDED) */}
        {!loading && !error && status === 'BUDGET_EXCEEDED' && (
          <div className="py-10 text-center space-y-4 p-8 bg-amber-50/60 dark:bg-amber-950/30 rounded-3xl border border-amber-200 dark:border-amber-900/50">
            <div className="h-12 w-12 rounded-2xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto text-xl font-bold">
              🔴
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                BUDGET CONSTRAINT EXCEEDED
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                NO RECOVERY OPTION WITHIN YOUR BUDGET
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                The available recovery options exceed your selected budget of ₹{parseFloat(maxBudget).toLocaleString()}.
              </p>
            </div>
            <button
              onClick={handleClearBudget}
              className="px-5 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shadow-md shadow-amber-600/20"
            >
              Clear Budget Constraint
            </button>
          </div>
        )}

        {/* Feasible Recovery Plans Display */}
        {!loading && !error && status === 'OPTIONS_AVAILABLE' && result && result.plans.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                RECOVERY {planCount === 1 ? 'OPTION (1)' : `OPTIONS (${planCount})`}
              </h3>
              <span className="text-[11px] text-slate-400">
                Showing {planCount} feasible {planCount === 1 ? 'plan' : 'plans'}
              </span>
            </div>

            <div className="space-y-4">
              {result.plans.map((plan) => (
                <RecoveryPlanCard
                  key={plan.id}
                  plan={plan}
                  onReview={(p) => setInspectingPlan(p)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty OPTIONS_AVAILABLE with no plans — previously rendered a blank panel */}
        {!loading && !error && status === 'OPTIONS_AVAILABLE' && result && result.plans.length === 0 && (
          <div className="py-10 text-center space-y-4 p-8 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800">
            <div className="h-12 w-12 rounded-2xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto text-xl font-bold">
              ⚪
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                NO OPTIONS TO DISPLAY
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                No recovery alternatives were returned.
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                {result?.message || 'Recovery analysis completed without feasible replacement options for the current disruption.'}
              </p>
            </div>
            <button
              onClick={() => fetchRecovery(preference, maxBudget)}
              className="px-5 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Preserving intact bookings by default</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Plan Detail Modal */}
      {inspectingPlan && (
        <RecoveryPlanDetail
          plan={inspectingPlan}
          onClose={() => setInspectingPlan(null)}
          onSelectPlan={handleSelectPlan}
        />
      )}
    </div>
  );
};
