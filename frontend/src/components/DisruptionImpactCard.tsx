import React from 'react';
import { Activity, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
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
  onContinueToBooking
}) => {
  if (!activeDisruption || !scopedImpactResult) return null;

  const journeyStatus = getJourneyStatus(scopedImpactResult);
  if (journeyStatus !== 'DISRUPTED') return null;

  // Find affected node
  const targetId = String(activeDisruption.entity_id || activeDisruption.affected_node_id || '');
  const affectedNode = journey.nodes.find(n => n.id === targetId || String(n.backendId) === targetId);

  // Parse time
  const detectedTimeStr = (activeDisruption.timestamp || activeDisruption.detected_at)
    ? new Date(activeDisruption.timestamp || activeDisruption.detected_at || '').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) + ' A ' + new Date(activeDisruption.timestamp || activeDisruption.detected_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  // Get nodes that have impact
  const impactedNodes = (scopedImpactResult.nodes || []).filter(n => n.status !== 'INTACT');
  
  // Try to find the exact reason/headline from the event
  let headline = `🔴 ${affectedNode?.title || 'Journey Segment'} Disrupted`;
  if (activeDisruption.type === 'FLIGHT_CANCELLATION') headline = `🔴 ${affectedNode?.title || 'Flight'} Cancelled`;
  else if (activeDisruption.type === 'WEATHER_DELAY') headline = `🔴 Weather Delay Detected`;
  else if (activeDisruption.type === 'TRAIN_STRIKE') headline = `🔴 Train Strike Active`;

  let subReason = activeDisruption.reason || activeDisruption.description || '';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-md">
      {/* Top Banner */}
      <div className="bg-rose-50 dark:bg-rose-950/40 px-6 py-5 border-b border-rose-100 dark:border-rose-900/60 flex items-center justify-between">
        <div>
          <h2 className="text-rose-700 dark:text-rose-300 font-extrabold text-xl sm:text-2xl flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
            {headline}
          </h2>
          {detectedTimeStr && (
            <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold mt-1">
              Detected at {detectedTimeStr}
            </p>
          )}
          {subReason && (
            <p className="text-slate-700 dark:text-slate-300 text-base font-medium mt-2">
              Reason: {subReason}
            </p>
          )}
        </div>
      </div>

      {/* Impacted Items List */}
      <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          {impactedNodes.length} Impacted Journey Segment{impactedNodes.length !== 1 ? 's' : ''}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {impactedNodes.map(nodeImpact => {
            const node = journey.nodes.find(n => n.id === nodeImpact.node_id || String(n.backendId) === String(nodeImpact.item_id));
            if (!node) return null;

            let statusColor = 'text-slate-500';
            let bgBadge = 'bg-slate-100';
            let statusText: string = nodeImpact.status;
            
            if (nodeImpact.status === 'BROKEN' || nodeImpact.status === 'NEEDS_CHANGE') {
              statusColor = 'text-rose-700 dark:text-rose-300';
              bgBadge = 'bg-rose-100 dark:bg-rose-900/60';
              statusText = 'CANCELLED';
            } else if (nodeImpact.status === 'AT_RISK') {
              statusColor = 'text-amber-700 dark:text-amber-300';
              bgBadge = 'bg-amber-100 dark:bg-amber-900/60';
              statusText = 'AT RISK';
            }

            const isPrimary = nodeImpact.impact_sources?.some((s: any) => s.kind === 'DIRECT') || String(nodeImpact.node_id) === String(scopedImpactResult.root_node_ids?.[0]) || String(nodeImpact.item_id) === String(scopedImpactResult.root_node_ids?.[0]);
            const impactLabel = isPrimary ? "PRIMARY DISRUPTION" : "RIPPLE IMPACT";
            const impactColor = isPrimary ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400";

            return (
              <div key={node.id} className="flex flex-col p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className={`text-[10px] font-extrabold uppercase tracking-wider mb-2 ${impactColor}`}>
                  {impactLabel}
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white mb-1 truncate">
                  {node.title}
                </div>
                {nodeImpact.reason && (
                  <div className="text-xs font-semibold text-slate-500 mb-3 line-clamp-2">
                    {nodeImpact.reason}
                  </div>
                )}
                <div className="mt-auto flex justify-start">
                  <div className={`px-2.5 py-1 rounded-md ${bgBadge} ${statusColor} text-[11px] font-extrabold tracking-wider uppercase`}>
                    {statusText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Area / Recovery Availability */}
      <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {selectedRecoveryPlan ? (
            <div>
              <p className="text-amber-700 dark:text-amber-400 font-extrabold text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                {isSelectedPlanUpdated ? 'Updated Recovery Plan Selected' : 'Recovery Plan Ready'}
              </p>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                {selectedRecoveryPlan.changed_node_ids.length} changes • A {selectedRecoveryPlan.preserved_node_ids.length} untouched
              </p>
            </div>
          ) : (
            <div>
              <p className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Travora Instant Recovery Active
              </p>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                Connecting to live carrier schedules to find alternative routes.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {selectedRecoveryPlan ? (
            <>
              <button
                onClick={onReviewPlan}
                className="px-4 py-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 font-bold text-xs transition-all border border-amber-200 dark:border-amber-800"
              >
                {isSelectedPlanUpdated ? 'Review Updated Plan' : 'Review Plan'}
              </button>
              <button
                onClick={onContinueToBooking}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20"
              >
                Continue to Booking
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
    </div>
  );
};
