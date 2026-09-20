import React from 'react';
import { X, CheckCircle2, RefreshCw, AlertCircle, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react';
import type { Part4RecoveryPlan } from '../../types';

interface SelectedRecoveryPlanReviewProps {
  plan: Part4RecoveryPlan;
  isUpdated?: boolean;
  onClose: () => void;
  onChangePlan: () => void;
  onContinueToBooking: () => void;
}

export const SelectedRecoveryPlanReview: React.FC<SelectedRecoveryPlanReviewProps> = ({
  plan,
  isUpdated = false,
  onClose,
  onChangePlan,
  onContinueToBooking,
}) => {
  const isPriorityPreserving = plan.category === 'PRIORITY_PRESERVING';
  const replacedChanges = plan.changes.filter(
    (c) => c.action === 'REPLACE' || c.action === 'MODIFY' || c.action === 'CANCEL'
  );
  const keptChanges = plan.changes.filter((c) => c.action === 'KEEP');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isUpdated ? 'Part 4 · Updated Recovery Plan' : 'Part 4 · Selected Recovery Plan'}
                </span>
                {isPriorityPreserving && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    ⭐ Preserves Priorities
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {isUpdated ? 'REVIEW YOUR UPDATED PLAN' : 'REVIEW YOUR SELECTED PLAN'}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Updated Notice if plan was automatically updated */}
        {isUpdated && (
          <div className="p-3.5 rounded-2xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Your recovery plan has been updated after a new disruption to preserve your previous recovery choices.</span>
          </div>
        )}

        {/* Selected Plan Overview Header */}
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {plan.title}
            </h3>
            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
              {plan.feasibility}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {plan.explanation}
          </p>
        </div>

        {/* WHAT WILL CHANGE */}
        <div className="space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>WHAT WILL CHANGE ({replacedChanges.length})</span>
          </span>
          <div className="space-y-2">
            {replacedChanges.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                No bookings need to be replaced by this plan.
              </p>
            ) : (
              replacedChanges.map((change, idx) => (
                <div
                  key={change.node_id || idx}
                  className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Disrupted: {change.original_title}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {change.action}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-900 dark:text-white pl-5 flex items-center gap-1.5">
                    <ArrowRight className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                    <span>Proposed: {change.new_title || change.explanation}</span>
                  </div>
                  {change.estimated_cost !== null && change.estimated_cost !== undefined && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-9 font-medium">
                      Est. Addl Cost: ₹{change.estimated_cost.toLocaleString()}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* WHAT WILL STAY */}
        <div className="space-y-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>WHAT WILL STAY ({keptChanges.length})</span>
          </span>
          {keptChanges.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              No bookings kept unchanged.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {keptChanges.map((change, idx) => (
                <div
                  key={change.node_id || idx}
                  className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {change.original_title}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FINANCIAL ESTIMATE */}
        <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-sky-500" />
              <span>FINANCIAL ESTIMATE</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Additional Cost</span>
              <span className="text-base font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 block">
                {plan.estimated_additional_cost !== null && plan.estimated_additional_cost !== undefined
                  ? `₹${plan.estimated_additional_cost.toLocaleString()}`
                  : 'PARTIAL / NOT FULLY KNOWN'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Refund</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                {plan.estimated_refund !== null && plan.estimated_refund !== undefined
                  ? `₹${plan.estimated_refund.toLocaleString()}`
                  : 'Unknown'}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right pt-1 italic font-medium">
            Estimates only. No bookings modified yet.
          </p>
        </div>

        {/* Action Footer */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Back
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
            <button
              onClick={onChangePlan}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 font-bold text-xs hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Change Plan</span>
            </button>

            <button
              onClick={onContinueToBooking}
              className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Continue to Booking →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
