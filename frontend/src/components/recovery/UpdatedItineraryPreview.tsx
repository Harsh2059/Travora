import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Plane,
  ArrowRight,
  Hotel,
  Car,
  Zap,
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

function getNodeIcon(type: string) {
  const t = (type || '').toLowerCase();
  if (t === 'flight') return <Plane className="w-3.5 h-3.5" />;
  if (t === 'hotel') return <Hotel className="w-3.5 h-3.5" />;
  if (t === 'cab' || t === 'taxi' || t === 'transfer') return <Car className="w-3.5 h-3.5" />;
  return <Zap className="w-3.5 h-3.5" />;
}

export const UpdatedItineraryPreview: React.FC<UpdatedItineraryPreviewProps> = ({
  journey,
  plan,
  impactResult: _impactResult,
  disruptionFingerprint,
  onConfirmSuccess,
  onChangeOption,
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
      await executePart5Recovery(journey.id as number, plan, disruptionFingerprint);
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

  // Downstream nodes (not being replaced)
  const downstreamNodes = journey.nodes.filter((node) => {
    const isReplaced = replacementChanges.some(
      (c) => c.node_id === String(node.id) || (node.backendId && c.node_id === String(node.backendId))
    );
    return !isReplaced && node.status !== 'CANCELLED' && node.status !== 'REPLACED';
  });

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Accent top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400" />

      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-br from-emerald-50/60 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Itinerary Preview
              </span>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Pre-Confirmation
              </span>
            </div>
            <h3 className="text-sm font-black text-slate-900 mt-1 tracking-tight">Updated Itinerary</h3>
          </div>
        </div>

        <button
          onClick={onChangeOption}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3 h-3" />
          Change
        </button>
      </div>

      <div className="p-5 flex flex-col lg:flex-row gap-8">
        
        {/* Left Column: Plan Summary and Changes */}
        <div className="flex-[3] space-y-5">
          {/* Selected Option Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-100 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-600 mb-0.5">Selected Plan</div>
              <div className="text-base font-black text-slate-900">{plan.title}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Net Cost</div>
              <div className="text-lg font-black text-sky-700">
                {netCost === 0 ? '₹0' : `+₹${netCost.toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Changes Breakdown */}
          {replacementChanges.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Segment Changes</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {replacementChanges.map((change, idx) => {
                  const newDetails = change.new_details || {};
                  const carrier = change.provider || newDetails.provider || newDetails.airline || change.new_title || 'Replacement';
                  const flNo = newDetails.flight_number || newDetails.resource_id || '';
                  const depT = fmtTime(change.start_time || newDetails.departure_time);
                  const arrT = fmtTime(change.end_time || newDetails.arrival_time);

                  return (
                    <div key={change.node_id || idx} className="rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Before */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border-b border-rose-100">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="text-xs font-bold text-rose-700 truncate flex-1">{change.original_title || 'Original Booking'}</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-200 text-rose-800">Cancelled</span>
                      </div>

                      {/* After */}
                      <div className="px-4 py-4 bg-white space-y-2.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Replacement Booking
                        </div>
                        <div className="font-black text-base text-slate-900">{carrier} {flNo}</div>
                        {(depT || arrT) && (
                          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                            <span>{depT || '—'}</span>
                            <div className="flex-1 flex items-center gap-1">
                              <div className="flex-1 h-px bg-slate-200" />
                              <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                            </div>
                            <span>{arrT || '—'}</span>
                          </div>
                        )}
                        {(change.origin || change.destination) && (
                          <div className="text-[11px] text-slate-500 font-semibold">
                            {change.origin || '?'} → {change.destination || '?'}
                          </div>
                        )}
                        {change.estimated_cost != null && (
                          <div className="text-xs font-bold text-sky-600 pt-1">
                            {change.estimated_cost === 0 ? 'Included via airline credit' : `₹${change.estimated_cost.toLocaleString()}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Downstream & Actions */}
        <div className="flex-[2] flex flex-col space-y-5">
          {/* Downstream Preserved */}
          {downstreamNodes.length > 0 && (
            <div className="space-y-2.5">
              <div className="text-xs font-black uppercase tracking-widest text-slate-500 px-1">Downstream Bookings</div>
              <div className="grid grid-cols-1 gap-2">
                {downstreamNodes.map((node) => {
                  const nType = (node.type || '').toUpperCase();
                  let statusLabel = 'Preserved';
                  if (nType === 'CAB' || nType === 'TAXI' || nType === 'TRANSFER') statusLabel = 'Pickup rescheduled';
                  else if (nType === 'HOTEL') statusLabel = 'Check-in preserved';
                  else if (nType === 'FLIGHT' || nType === 'TRAIN') statusLabel = 'Connection preserved';

                  return (
                    <div
                      key={node.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
                        {getNodeIcon(node.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-800 truncate">{node.title}</div>
                        <div className="text-[11px] text-emerald-600 font-bold">✓ {statusLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1" />

          {/* Protection Badge */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-sky-50 border border-emerald-100 shadow-sm">
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-black text-emerald-900 mb-1">Recovery Guarantee</div>
              <div className="text-emerald-700 font-semibold text-xs leading-relaxed">
                100% Airline Credit<br/>
                Zero Cancellation Fee<br/>
                Auto-synced downstream
              </div>
            </div>
          </div>

          {/* Error State */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="flex-1">{errorMessage}</span>
              <button
                onClick={handleConfirmRecovery}
                className="px-2 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={onChangeOption}
              disabled={submitting}
              className="w-1/3 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirmRecovery}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Plan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
