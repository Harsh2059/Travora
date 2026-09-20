import React, { useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Plane,
  Building2,
  Train,
  Car,
  Calendar,
  ArrowRight,
  RefreshCw,
  Ticket,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import type {
  Part4RecoveryPlan,
  Part5RevalidationResult,
  Part5ExecutionResult,
  Part5ExecutionStatus
} from '../../types';
import { revalidatePart5Recovery, executePart5Recovery } from '../../services/recoveryApi';

interface Part5BookingExecutionViewProps {
  tripId: number;
  selectedPlan: Part4RecoveryPlan;
  disruptionFingerprint: string;
  onClose: () => void;
  onReturnToRecovery: () => void;
  onExecutionCompleted: (result: Part5ExecutionResult) => void;
}

export const Part5BookingExecutionView: React.FC<Part5BookingExecutionViewProps> = ({
  tripId,
  selectedPlan,
  disruptionFingerprint,
  onClose,
  onReturnToRecovery,
  onExecutionCompleted,
}) => {
  const [revalidation, setRevalidation] = useState<Part5RevalidationResult | null>(null);
  const [execution, setExecution] = useState<Part5ExecutionResult | null>(null);
  const [status, setStatus] = useState<Part5ExecutionStatus>('PENDING_REVALIDATION');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Stable revalidation guard ref: guarantees EXACTLY ONE revalidation request per (tripId, planId, fingerprint)
  const revalidationKeyRef = useRef<string | null>(null);

  const planId = selectedPlan?.id || 'plan';
  const cacheKey = `${tripId}:${planId}:${disruptionFingerprint || '0'}`;

  // Revalidate on mount (runs once per cache key)
  useEffect(() => {
    if (revalidationKeyRef.current === cacheKey && revalidation) {
      return; // Already revalidated for this exact key, do not call backend again!
    }

    revalidationKeyRef.current = cacheKey;
    let isMounted = true;

    async function doRevalidation() {
      try {
        setStatus('PENDING_REVALIDATION');
        setErrorMessage(null);
        const res = await revalidatePart5Recovery(tripId, selectedPlan, disruptionFingerprint);
        if (!isMounted) return;

        setRevalidation(res);
        setStatus(res.status);
        if (res.status === 'STALE_PLAN' || res.status === 'UNAVAILABLE' || res.status === 'FAILED') {
          setErrorMessage(res.message || 'Revalidation failed');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus('REVALIDATION_FAILED');
        setErrorMessage(
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to revalidate recovery options'
        );
      }
    }

    doRevalidation();

    return () => {
      isMounted = false;
    };
  }, [tripId, planId, disruptionFingerprint]);

  // Explicit user action: Confirm & Book (makes EXACTLY ONE execution request)
  const handleConfirmAndBook = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setStatus('BOOKING_IN_PROGRESS');
    setErrorMessage(null);

    try {
      const res = await executePart5Recovery(
        tripId,
        selectedPlan,
        disruptionFingerprint,
        revalidation?.execution_id
      );

      setExecution(res);
      setStatus(res.status);

      if (res.status === 'COMPLETED' || res.status === 'PARTIALLY_COMPLETED') {
        onExecutionCompleted(res);
      } else if (res.status === 'STALE_PLAN' || res.status === 'FAILED') {
        setErrorMessage(res.message || 'Booking execution failed');
      }
    } catch (err: any) {
      setStatus('FAILED');
      setErrorMessage(
        err?.response?.data?.detail ||
        err?.message ||
        'Booking execution failed'
      );
    } finally {
      setIsExecuting(false);
    }
  };

  const getItemIcon = (typeStr?: string) => {
    const t = (typeStr || '').toUpperCase();
    if (t.includes('FLIGHT') || t.includes('AIR')) return <Plane className="h-4 w-4 text-sky-500" />;
    if (t.includes('HOTEL') || t.includes('STAY')) return <Building2 className="h-4 w-4 text-emerald-500" />;
    if (t.includes('TRAIN') || t.includes('METRO')) return <Train className="h-4 w-4 text-purple-500" />;
    if (t.includes('CAB') || t.includes('TAXI')) return <Car className="h-4 w-4 text-amber-500" />;
    return <Calendar className="h-4 w-4 text-indigo-500" />;
  };

  // Cost display values
  const costObj = revalidation?.cost;
  const part4Est = costObj?.part4_estimated_additional_cost ?? revalidation?.part4_estimated_additional_cost ?? revalidation?.earlier_estimated_additional_cost ?? selectedPlan.estimated_additional_cost ?? 0;
  const currentEst = costObj?.current_estimated_additional_cost ?? revalidation?.current_estimated_additional_cost ?? revalidation?.current_total_price ?? 0;
  const priceDiff = costObj?.price_difference ?? revalidation?.price_difference ?? (currentEst - part4Est);

  const replacementCost = costObj?.replacement_cost ?? revalidation?.revalidated_items.reduce((acc, item) => acc + (item.current_price || 0), 0) ?? 0;
  const estimatedRefunds = costObj?.estimated_refunds ?? revalidation?.revalidated_items.reduce((acc, item) => acc + (item.estimated_refund || 0), 0) ?? (selectedPlan.estimated_refund || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-500/20 mt-0.5">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Part 5 · Booking & Execution
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {status === 'COMPLETED'
                  ? '🟢 JOURNEY RECOVERED'
                  : status === 'PARTIALLY_COMPLETED'
                  ? '⚠ RECOVERY PARTIALLY COMPLETED'
                  : status === 'STALE_PLAN'
                  ? '⚠ RECOVERY PLAN NO LONGER CURRENT'
                  : status === 'UNAVAILABLE'
                  ? '⚠ RECOVERY OPTION NO LONGER AVAILABLE'
                  : status === 'FAILED' || status === 'REVALIDATION_FAILED'
                  ? '🔴 BOOKING FAILED'
                  : 'CONFIRM YOUR RECOVERY'}
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

        {/* 1. REVALIDATION LOADING STATE */}
        {status === 'PENDING_REVALIDATION' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-sky-500 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                CHECKING CURRENT AVAILABILITY...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                Rechecking real-time seats, rooms, and provider pricing before confirmation.
              </p>
            </div>
          </div>
        )}

        {/* 2. STALE PLAN WARNING */}
        {status === 'STALE_PLAN' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <span>YOUR RECOVERY PLAN IS NO LONGER CURRENT</span>
              </div>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 leading-relaxed font-medium">
                {errorMessage || 'A new journey disruption has occurred since this plan was prepared. No booking has been made.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={onReturnToRecovery}
                className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-md shadow-amber-500/20"
              >
                Return to Recovery
              </button>
            </div>
          </div>
        )}

        {/* 3. UNAVAILABLE CANDIDATE WARNING */}
        {status === 'UNAVAILABLE' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-300">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>RECOVERY OPTION NO LONGER AVAILABLE</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed font-medium">
                {errorMessage || 'One or more proposed replacements are no longer available at the current check. No booking has been made.'}
              </p>
            </div>

            {/* List revalidated items showing availability status */}
            {revalidation?.revalidated_items && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Checked Items</span>
                {revalidation.revalidated_items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      item.available
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50/50 border-rose-200 text-rose-900 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getItemIcon(item.type)}
                      <span>{item.replacement_title}</span>
                    </div>
                    <span>{item.available ? '✓ Available' : '❌ Sold Out / Unavailable'}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={onReturnToRecovery}
                className="px-6 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all shadow-md shadow-rose-500/20"
              >
                Return to Recovery Options
              </button>
            </div>
          </div>
        )}

        {/* 4. EXECUTION FAILED / ERROR STATE */}
        {(status === 'FAILED' || status === 'REVALIDATION_FAILED') && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-800 dark:text-rose-300">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                <span>BOOKING FAILED</span>
              </div>
              <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed font-medium">
                {errorMessage || 'An error occurred while executing replacement bookings. No corrupted changes were saved.'}
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                onClick={onReturnToRecovery}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Return to Recovery Options
              </button>
            </div>
          </div>
        )}

        {/* 5. READY FOR CONFIRMATION (REVALIDATED) / BOOKING IN PROGRESS */}
        {(status === 'READY_FOR_CONFIRMATION' || status === 'BOOKING_IN_PROGRESS') && revalidation && (
          <div className="space-y-6">
            
            {/* Notice header */}
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 flex items-center justify-between text-xs font-semibold text-sky-900 dark:text-sky-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
                <span>Prices and availability were rechecked just now.</span>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300">
                Verified Fresh
              </span>
            </div>

            {/* WHAT WILL CHANGE */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                <span>WHAT WILL CHANGE ({revalidation.revalidated_items.length})</span>
              </span>

              <div className="space-y-2">
                {revalidation.revalidated_items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                        {getItemIcon(item.type)}
                        <span>{item.replacement_title}</span>
                      </div>
                      <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400">
                        ₹{(item.replacement_price ?? item.current_price ?? 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pl-6">
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span>Replacement for: <strong className="text-slate-700 dark:text-slate-300">{item.original_title}</strong></span>
                    </div>

                    {item.booking_conditions && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 pl-6 italic">
                        {item.booking_conditions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* WHAT WILL STAY */}
            <div className="space-y-3">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>WHAT WILL STAY ({revalidation.unchanged_items.length})</span>
              </span>

              {revalidation.unchanged_items.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No unchanged bookings.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {revalidation.unchanged_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {item.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CURRENT PRICE REVIEW */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-sky-500" />
                  <span>CURRENT PRICE REVIEW</span>
                </span>
                {priceDiff !== 0 && (
                  <span className={`text-[11px] font-bold ${priceDiff > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    Current estimated additional cost {priceDiff > 0 ? `increased by ₹${priceDiff.toLocaleString()}` : `decreased by ₹${Math.abs(priceDiff).toLocaleString()}`}
                  </span>
                )}
              </div>

              {/* 3 Summary Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">PART 4 ESTIMATE</span>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block mt-0.5">
                    ₹{part4Est.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">CURRENT ESTIMATE</span>
                  <span className="text-sm font-extrabold text-sky-600 dark:text-sky-400 block mt-0.5">
                    ₹{currentEst.toLocaleString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">CHANGE</span>
                  <span className={`text-sm font-extrabold block mt-0.5 ${
                    priceDiff > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : priceDiff < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {priceDiff > 0
                      ? `+₹${priceDiff.toLocaleString()}`
                      : priceDiff < 0
                      ? `-₹${Math.abs(priceDiff).toLocaleString()}`
                      : '₹0'}
                  </span>
                </div>
              </div>

              {/* Breakdown Detail Box */}
              <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                  <span>Replacement booking(s) price:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">₹{replacementCost.toLocaleString()}</span>
                </div>
                {estimatedRefunds > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Estimated refund for disrupted booking(s):</span>
                    <span className="font-semibold">-₹{estimatedRefunds.toLocaleString()}</span>
                  </div>
                )}
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                  <span>Current net estimated additional cost:</span>
                  <span className="text-sky-600 dark:text-sky-400">₹{currentEst.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700/60 font-medium">
                <span>Nothing has been booked yet.</span>
                <span>Requires explicit confirmation.</span>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onReturnToRecovery}
                disabled={isExecuting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Back to Recovery
              </button>

              <button
                onClick={handleConfirmAndBook}
                disabled={isExecuting}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>BOOKING IN PROGRESS...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Confirm & Book</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* 6. FINAL EXECUTION SUCCESS / PARTIAL SUCCESS RESULT SCREEN */}
        {(status === 'COMPLETED' || status === 'PARTIALLY_COMPLETED') && execution && (
          <div className="space-y-6">

            <div className={`p-4 rounded-2xl border space-y-2 ${
              status === 'COMPLETED'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}>
              <div className="flex items-center gap-2 font-extrabold text-base">
                <CheckCircle2 className={`h-5 w-5 ${status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}`} />
                <span>
                  {status === 'COMPLETED'
                    ? 'Your replacement bookings are confirmed.'
                    : 'Some replacement bookings succeeded, but others require attention.'}
                </span>
              </div>
              <p className="text-xs font-medium opacity-90">
                The itinerary database has been updated with real booking references.
              </p>
            </div>

            {/* BOOKING CONFIRMATIONS */}
            {execution.confirmed_bookings.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <Ticket className="h-4 w-4" />
                  <span>BOOKING CONFIRMATION ({execution.confirmed_bookings.length})</span>
                </span>

                <div className="space-y-3">
                  {execution.confirmed_bookings.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          {getItemIcon(b.type)}
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {b.replacement_title}
                          </span>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          CONFIRMED
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Booking Ref / PNR</span>
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
                            {b.pnr || b.booking_reference}
                          </span>
                        </div>

                        {b.ticket_number && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Ticket #</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                              {b.ticket_number}
                            </span>
                          </div>
                        )}

                        {b.flight_number && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Flight</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {b.flight_number}
                            </span>
                          </div>
                        )}

                        {b.seat && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Seat</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {b.seat}
                            </span>
                          </div>
                        )}

                        {b.room_type && (
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Room</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {b.room_type}
                            </span>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Final Price</span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            ₹{b.final_price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAILED BOOKINGS (if partial failure) */}
            {execution.failed_bookings.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span>UNSUCCESSFUL BOOKINGS ({execution.failed_bookings.length})</span>
                </span>

                <div className="space-y-2">
                  {execution.failed_bookings.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-xs space-y-1"
                    >
                      <div className="font-bold text-rose-800 dark:text-rose-300">
                        {b.replacement_title}
                      </div>
                      <div className="text-[11px] text-rose-600 dark:text-rose-400">
                        {b.error_message || 'Could not complete booking with provider.'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WHAT STAYED UNCHANGED */}
            {execution.unchanged_items.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>WHAT STAYED UNCHANGED ({execution.unchanged_items.length})</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {execution.unchanged_items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 font-medium"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION FOOTER */}
            <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={onClose}
                className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-sm transition-all shadow-lg shadow-sky-500/20 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span>View Updated Journey</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
