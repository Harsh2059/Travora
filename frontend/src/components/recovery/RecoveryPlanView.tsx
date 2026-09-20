import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, RefreshCw, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { analyzePart4Recovery } from '../../services/recoveryApi';
import { saveSelectedRecoveryPlan } from '../../store/journeyStore';
import type { Part4RecoveryResult, Part4RecoveryPlan } from '../../types';
import { RecoveryPlanCard } from './RecoveryPlanCard';
import { RecoveryPlanDetail } from './RecoveryPlanDetail';

interface RecoveryPlanViewProps {
  tripId: number;
  onClose: () => void;
  onPlanSelected?: (plan: Part4RecoveryPlan) => void;
}

export const RecoveryPlanView: React.FC<RecoveryPlanViewProps> = ({
  tripId,
  onClose,
  onPlanSelected,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Part4RecoveryResult | null>(null);
  const [inspectingPlan, setInspectingPlan] = useState<Part4RecoveryPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Part4RecoveryPlan | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);

  const fetchRecovery = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await analyzePart4Recovery(tripId);
      setResult(data);
    } catch (err: any) {
      console.error('Failed to generate Part 4 recovery plans:', err);
      setError(err?.response?.data?.detail || 'Failed to generate recovery options. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecovery();
  }, [tripId]);

  const handleSelectPlan = (plan: Part4RecoveryPlan) => {
    saveSelectedRecoveryPlan(tripId, plan);
    setSelectedPlan(plan);
    setShowToast(true);
    if (onPlanSelected) {
      onPlanSelected(plan);
    }
  };

  const priorityPlans = result?.plans?.filter((p) => p.category === 'PRIORITY_PRESERVING') || [];
  const altPlans = result?.plans?.filter((p) => p.category === 'ALTERNATIVE') || [];

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
                We found options to help restore your original travel plan while preserving what still works.
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

        {/* Loading State */}
        {loading && (
          <div className="py-16 text-center space-y-4">
            <div className="h-12 w-12 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">
              Analyzing Part 3 impact & generating recovery candidates...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Recovery Analysis Error</span>
            </div>
            <p className="text-xs">{error}</p>
            <button
              onClick={fetchRecovery}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors"
            >
              Retry Analysis
            </button>
          </div>
        )}

        {/* Empty / No Recovery Needed State */}
        {!loading && !error && result && result.plans.length === 0 && (
          <div className="py-12 text-center space-y-3 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Recovery Required</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{result.message}</p>
          </div>
        )}

        {/* Recovery Plans Display */}
        {!loading && !error && result && result.plans.length > 0 && (
          <div className="space-y-6">
            {/* Priority Preserving Plans */}
            {priorityPlans.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
                    PRESERVE YOUR PRIORITIES
                  </h3>
                </div>
                <div className="space-y-4">
                  {priorityPlans.map((plan) => (
                    <RecoveryPlanCard
                      key={plan.id}
                      plan={plan}
                      onReview={(p) => setInspectingPlan(p)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Plans */}
            {altPlans.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <RefreshCw className="h-4 w-4 text-slate-400" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    OTHER OPTIONS
                  </h3>
                </div>
                <div className="space-y-4">
                  {altPlans.map((plan) => (
                    <RecoveryPlanCard
                      key={plan.id}
                      plan={plan}
                      onReview={(p) => setInspectingPlan(p)}
                    />
                  ))}
                </div>
              </div>
            )}
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
