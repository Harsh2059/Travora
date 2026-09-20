import React from 'react';
import { Star, CheckCircle2, RefreshCw, ArrowRight } from 'lucide-react';
import type { Part4RecoveryPlan } from '../../types';

interface RecoveryPlanCardProps {
  plan: Part4RecoveryPlan;
  onReview: (plan: Part4RecoveryPlan) => void;
}

export const RecoveryPlanCard: React.FC<RecoveryPlanCardProps> = ({ plan, onReview }) => {
  const isPriorityPreserving = plan.category === 'PRIORITY_PRESERVING';

  const replacedChanges = plan.changes.filter((c) => c.action === 'REPLACE' || c.action === 'MODIFY');
  const keptChanges = plan.changes.filter((c) => c.action === 'KEEP');

  return (
    <div
      className={`rounded-3xl border p-6 transition-all shadow-md ${
        isPriorityPreserving
          ? 'bg-gradient-to-br from-white via-sky-50/40 to-indigo-50/40 dark:from-slate-900 dark:via-sky-950/20 dark:to-indigo-950/20 border-sky-300 dark:border-sky-800 shadow-sky-500/5'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-slate-200/20'
      }`}
    >
      {/* Category Badge & Recommendation */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isPriorityPreserving ? (
            <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 fill-current" />
              <span>Preserves Your Priorities</span>
            </span>
          ) : (
            <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              Alternative Option
            </span>
          )}
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
            {plan.feasibility}
          </span>
        </div>
      </div>

      {/* Plan Title & Explanation */}
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{plan.title}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
        {plan.explanation}
      </p>

      {/* Changes vs Intact Summary */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Replaced items */}
        <div className="p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200/70 dark:border-orange-900/50 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-orange-700 dark:text-orange-300 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>WHAT CHANGES ({replacedChanges.length})</span>
          </span>
          <div className="space-y-1">
            {replacedChanges.map((c) => (
              <div key={c.node_id} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                🔄 {c.new_title || c.original_title}
              </div>
            ))}
          </div>
        </div>

        {/* Kept items */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50 space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>WHAT STAYS ({keptChanges.length})</span>
          </span>
          <div className="space-y-1">
            {keptChanges.map((c) => (
              <div key={c.node_id} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                ✓ {c.original_title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Financials & Action Footer */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-white">
            Estimated additional cost:{' '}
            <span className="text-sky-600 dark:text-sky-400 font-extrabold">
              ₹{plan.estimated_additional_cost.toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
            Estimated refund: ₹{plan.estimated_refund.toLocaleString()}
          </div>
        </div>

        <button
          onClick={() => onReview(plan)}
          className={`px-5 py-2.5 rounded-2xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 ${
            isPriorityPreserving
              ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20'
              : 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white'
          }`}
        >
          <span>{isPriorityPreserving ? 'Review Plan' : 'Review Option'}</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
