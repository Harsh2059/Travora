import React from 'react';
import { X, CheckCircle2, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import type { Part4RecoveryPlan } from '../../types';

interface RecoveryPlanDetailProps {
  plan: Part4RecoveryPlan;
  onClose: () => void;
  onSelectPlan: (plan: Part4RecoveryPlan) => void;
}

export const RecoveryPlanDetail: React.FC<RecoveryPlanDetailProps> = ({
  plan,
  onClose,
  onSelectPlan,
}) => {
  const isPriorityPreserving = plan.category === 'PRIORITY_PRESERVING';

  const replacedChanges = plan.changes.filter((c) => c.action === 'REPLACE' || c.action === 'MODIFY');
  const keptChanges = plan.changes.filter((c) => c.action === 'KEEP');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              {isPriorityPreserving && (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  ⭐ Preserves Priorities
                </span>
              )}
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                {plan.feasibility}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">{plan.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{plan.explanation}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* BEFORE & AFTER Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* BEFORE */}
          <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/40 space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>BEFORE (Disrupted)</span>
            </span>
            <div className="space-y-2">
              {replacedChanges.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No bookings disrupted</p>
              ) : (
                replacedChanges.map((change) => (
                  <div
                    key={change.node_id}
                    className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200/60 dark:border-rose-900/50 shadow-sm"
                  >
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {change.original_title}
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                      Cancelled / Disrupted
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AFTER */}
          <div className="p-4 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/40 space-y-3">
            <span className="text-xs font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>AFTER (Proposed Replacement)</span>
            </span>
            <div className="space-y-2">
              {replacedChanges.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No replacements needed</p>
              ) : (
                replacedChanges.map((change) => (
                  <div
                    key={change.node_id}
                    className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-sky-200/60 dark:border-sky-900/50 shadow-sm"
                  >
                    <div className="font-bold text-xs text-slate-900 dark:text-white">
                      {change.new_title || change.explanation}
                    </div>
                    <div className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5 font-medium">
                      Est. Addl Cost:{' '}
                      {change.estimated_cost !== null && change.estimated_cost !== undefined
                        ? `₹${change.estimated_cost.toLocaleString()}`
                        : 'Unknown'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* UNCHANGED / PRESERVED BOOKINGS */}
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>UNCHANGED BOOKINGS ({keptChanges.length})</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {keptChanges.map((change) => (
              <div
                key={change.node_id}
                className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {change.original_title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Financial Estimate
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Estimated Additional Cost:{' '}
              <strong className="text-slate-900 dark:text-white font-bold text-sm">
                {plan.estimated_additional_cost !== null && plan.estimated_additional_cost !== undefined
                  ? `₹${plan.estimated_additional_cost.toLocaleString()}`
                  : 'PARTIAL / NOT FULLY KNOWN'}
              </strong>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Estimated Refund:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {plan.estimated_refund !== null && plan.estimated_refund !== undefined
                  ? `₹${plan.estimated_refund.toLocaleString()}`
                  : 'Unknown'}
              </strong>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            Estimates only. No bookings modified yet.
          </div>
        </div>

        {/* PRIORITIES */}
        {plan.preserved_priorities.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
              Traveler Priorities Preserved
            </span>
            <ul className="space-y-1">
              {plan.preserved_priorities.map((item, idx) => (
                <li key={idx} className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSelectPlan(plan);
              onClose();
            }}
            className="px-6 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Select Plan for Booking</span>
          </button>
        </div>
      </div>
    </div>
  );
};
