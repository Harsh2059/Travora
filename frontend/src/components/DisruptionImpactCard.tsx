import React from 'react';
import { AlertTriangle, Activity, ShieldCheck, RefreshCw, ArrowRight, Zap } from 'lucide-react';
import type { Journey, ImpactResult, Part4RecoveryPlan } from '../types';
import { getJourneyStatus } from '../utils/impactUtils';

interface DisruptionImpactCardProps {
  journey: Journey;
  activeDisruption: any;
  scopedImpactResult: ImpactResult | null;
  selectedRecoveryPlan: Part4RecoveryPlan | null;
  isSelectedPlanUpdated: boolean;
  onViewImpact: () => void;
  onFindRecovery: () => void;
  onChangePlan: () => void;
  onReviewPlan: () => void;
  onContinueToBooking: () => void;
}

export const DisruptionImpactCard: React.FC<DisruptionImpactCardProps> = ({
  journey,
  activeDisruption,
  scopedImpactResult,
  selectedRecoveryPlan,
  isSelectedPlanUpdated,
  onFindRecovery,
  onReviewPlan,
  onContinueToBooking,
}) => {
  if (!activeDisruption || !scopedImpactResult) return null;

  const journeyStatus = getJourneyStatus(scopedImpactResult);
  if (journeyStatus !== 'DISRUPTED') return null;

  const targetId = String(activeDisruption.entity_id || activeDisruption.affected_node_id || '');
  const affectedNode = journey.nodes.find(n => n.id === targetId || String(n.backendId) === targetId);

  const detectedTime = (activeDisruption.timestamp || activeDisruption.detected_at)
    ? new Date(activeDisruption.timestamp || activeDisruption.detected_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '';

  const detectedDate = (activeDisruption.timestamp || activeDisruption.detected_at)
    ? new Date(activeDisruption.timestamp || activeDisruption.detected_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  let headline = affectedNode?.title || 'Journey Segment';
  let disruptionType = 'Operational Disruption';
  if (activeDisruption.type === 'FLIGHT_CANCELLATION') disruptionType = 'Cancelled by Airline';
  else if (activeDisruption.type === 'WEATHER_DELAY') disruptionType = 'Weather Delay';
  else if (activeDisruption.type === 'TRAIN_STRIKE') disruptionType = 'Train Strike';

  const impactedNodes = (scopedImpactResult.nodes || []).filter(n => n.status !== 'INTACT');
  const rootNodeId = String(scopedImpactResult.root_node_ids?.[0] ?? '');

  return (
    <div className="relative overflow-hidden rounded-2xl border border-rose-200/60 bg-gradient-to-br from-rose-50 via-white to-orange-50/40 shadow-lg shadow-rose-100/50">
      {/* Pulsing alert indicator top bar */}
      <div className="h-1 w-full bg-gradient-to-r from-rose-500 via-red-400 to-orange-400" />

      {/* Alert glow effect */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-rose-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="p-5 sm:p-6">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-rose-500 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Live Disruption
                </span>
                {detectedTime && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Detected {detectedTime}{detectedDate ? `, ${detectedDate}` : ''}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {headline}
              </h2>
              <p className="text-sm font-semibold text-rose-600 mt-0.5">{disruptionType}</p>
              {activeDisruption.reason && (
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-lg">
                  {activeDisruption.reason}
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:shrink-0">
            {selectedRecoveryPlan ? (
              <>
                <button
                  onClick={onReviewPlan}
                  className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs transition-all"
                >
                  {isSelectedPlanUpdated ? '⚡ Updated Plan' : 'Review Plan'}
                </button>
                <button
                  onClick={onContinueToBooking}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Confirm & Book
                </button>
              </>
            ) : (
              <button
                onClick={onFindRecovery}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Find Recovery Options
              </button>
            )}
          </div>
        </div>

        {/* Impact Summary Row */}
        {impactedNodes.length > 0 && (
          <div className="mt-5 pt-4 border-t border-rose-100">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-rose-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                {impactedNodes.length} Impacted Segment{impactedNodes.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {impactedNodes.map(nodeImpact => {
                const node = journey.nodes.find(n =>
                  n.id === nodeImpact.node_id ||
                  String(n.backendId) === String(nodeImpact.item_id)
                );
                if (!node) return null;

                const isPrimary = String(nodeImpact.node_id) === rootNodeId || String(nodeImpact.item_id) === rootNodeId;
                const isBroken = nodeImpact.status === 'BROKEN' || nodeImpact.status === 'NEEDS_CHANGE';

                return (
                  <div
                    key={node.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                      isPrimary
                        ? 'bg-rose-100 border-rose-200 text-rose-800'
                        : isBroken
                          ? 'bg-orange-50 border-orange-200 text-orange-800'
                          : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}
                  >
                    {isPrimary && (
                      <Zap className="w-3 h-3 shrink-0" />
                    )}
                    <span className="truncate max-w-[140px]">{node.title}</span>
                    <ArrowRight className="w-3 h-3 shrink-0 opacity-60" />
                    <span className={`text-[10px] font-black uppercase tracking-wide ${
                      isPrimary ? 'text-rose-600' : isBroken ? 'text-orange-600' : 'text-amber-600'
                    }`}>
                      {isPrimary ? 'CANCELLED' : isBroken ? 'AFFECTED' : 'AT RISK'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Recovery Status Info */}
            {selectedRecoveryPlan ? (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-black text-emerald-800 block">
                    {isSelectedPlanUpdated ? '⚡ Recovery Plan Updated' : '✓ Recovery Plan Selected'}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium">
                    {selectedRecoveryPlan.changed_node_ids.length} changes · {selectedRecoveryPlan.preserved_node_ids.length} bookings preserved
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-xl bg-sky-50 border border-sky-200">
                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-sky-700">
                  Travora AI is cross-checking {14} live flight schedules for recovery options...
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
