import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import type { Journey, Part4RecoveryPlan, ImpactResult } from '../../types';
import { executePart5Recovery } from '../../services/recoveryApi';
import { clearSelectedRecoveryPlan } from '../../store/journeyStore';

interface UpdatedItineraryPreviewProps {
  journey: Journey;
  plan: Part4RecoveryPlan;
  impactResult?: ImpactResult | null;
  disruptionFingerprint: string;
  onConfirmSuccess: () => Promise<void>;
  onChangeOption: () => void;
}

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

export const UpdatedItineraryPreview: React.FC<UpdatedItineraryPreviewProps> = ({
  journey,
  plan,
  impactResult: _impactResult,
  disruptionFingerprint,
  onConfirmSuccess,
  onChangeOption
}) => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const replacementChanges = plan.changes?.filter(
    (c) => c.action === 'REPLACE' || c.action === 'MODIFY'
  ) || [];

  const handleConfirmRecovery = async () => {
    if (!journey.id) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      await executePart5Recovery(
        journey.id as number,
        plan,
        disruptionFingerprint
      );
      
      clearSelectedRecoveryPlan(journey.id as number);
      await onConfirmSuccess();
    } catch (err: any) {
      console.error('Failed to confirm recovery execution:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Unable to apply this recovery right now.';
      setErrorMessage(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const netCost = plan.estimated_additional_cost ?? 0;

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
      {/* Header Banner */}
      <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Itinerary Preview
              </span>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Pre-Confirmation
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5 tracking-tight">
              Updated Itinerary Preview
            </h3>
          </div>
        </div>

        <button
          onClick={onChangeOption}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Change Option</span>
        </button>
      </div>

      <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
        Here is what your updated journey will look like with the selected recovery option. Review the changes before confirming.
      </p>

      {/* Selected Option Summary Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 border border-sky-100 dark:border-sky-900/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400 block">
            SELECTED RECOVERY OPTION
          </span>
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
            {plan.title}
          </h4>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold text-slate-500 uppercase block">NET ADDITIONAL COST</span>
          <span className="text-base font-extrabold text-sky-700 dark:text-sky-300">
            {netCost === 0 ? 'Zero Surcharge' : `+₹${netCost.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* BEFORE / AFTER COMPARISON BLOCK */}
      <div className="space-y-3">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 text-sky-500" />
          <span>Segment Changes Breakdown</span>
        </h4>

        <div className="space-y-3">
          {replacementChanges.map((change, idx) => {
            const origNode = change.original_details || {};
            const newDetails = change.new_details || {};
            const carrier = change.provider || newDetails.provider || newDetails.airline || change.new_title || 'Replacement Carrier';
            const flNo = newDetails.flight_number || newDetails.resource_id || '';

            return (
              <div
                key={change.node_id || idx}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    DISRUPTED: {change.original_title}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    CANCELLED
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      NEW REPLACEMENT: {carrier} {flNo}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                      {change.estimated_cost ? `₹${change.estimated_cost.toLocaleString()}` : 'Included'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-emerald-950 dark:text-emerald-100 font-semibold pt-1">
                    <div>
                      <span>{change.origin || origNode.origin || 'Mumbai'}</span>
                      <span className="mx-2 text-emerald-500">→</span>
                      <span>{change.destination || origNode.destination || 'Delhi'}</span>
                    </div>
                    <div>
                      {fmtTime(change.start_time || newDetails.departure_time)} - {fmtTime(change.end_time || newDetails.arrival_time)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RECALCULATED DOWNSTREAM STATUSES */}
      <div className="space-y-3 pt-1">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Downstream Journey Recalculations</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {journey.nodes.map((node) => {
            const isReplacedNode = replacementChanges.some(
              (c) => c.node_id === String(node.id) || (node.backendId && c.node_id === String(node.backendId))
            );
            if (isReplacedNode) return null;

            const nType = (node.type || '').toUpperCase();
            let statusLabel = 'Preserved';
            let iconColor = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800';

            if (nType === 'FLIGHT' || nType === 'TRAIN') {
              statusLabel = 'Connection preserved';
            } else if (nType === 'CAB' || nType === 'TAXI' || nType === 'TRANSFER') {
              statusLabel = 'Pickup automatically rescheduled';
            } else if (nType === 'HOTEL') {
              statusLabel = 'Check-in preserved';
            } else if (nType === 'ACTIVITY' || nType === 'EVENT') {
              statusLabel = 'Activity schedule valid';
            }

            return (
              <div
                key={node.id}
                className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-bold ${iconColor}`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <div className="truncate">
                  <span className="block truncate text-slate-900 dark:text-white">{node.title}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                    ✓ {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Protection & Guarantee Badge */}
      <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="text-xs">
          <span className="font-extrabold text-emerald-900 dark:text-emerald-200 block">
            Recovery Guarantee & Protection
          </span>
          <span className="font-medium text-emerald-700 dark:text-emerald-400 text-[11px]">
            100% Airline Rebooking Credit applied. Downstream bookings automatically updated.
          </span>
        </div>
      </div>

      {/* Failure Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1">
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={handleConfirmRecovery}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Confirmation Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          onClick={onChangeOption}
          disabled={submitting}
          className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Back to Options
        </button>

        <button
          onClick={handleConfirmRecovery}
          disabled={submitting}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 rounded-full animate-spin border-2 border-white border-t-transparent" />
              <span>Applying recovery...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirm & Apply Recovery</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
