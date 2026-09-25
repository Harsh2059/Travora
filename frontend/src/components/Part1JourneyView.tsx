import React from 'react';
import {
  Plane, Train, Car, Hotel, Ticket, MapPin, AlertTriangle, Pencil, Trash2, TrainFront, CheckCircle2, ChevronRight, Info
} from 'lucide-react';
import type { Journey, JourneyNode, TravelerPriority, ImpactNodeStatus, ImpactResult, Part4RecoveryPlan } from '../types';
import { buildJourneyRoute, routeStats } from '../utils/routeBuilder';
import { getNodeImpactDisplay, getJourneyStatus, getImpactSummaryBuckets } from '../utils/impactUtils';

interface Part1JourneyViewProps {
  journey: Journey;
  viewMode?: 'RECOVERED' | 'ORIGINAL';
  onEditNode?: (node: JourneyNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onUpdatePriority?: (nodeId: string, priority: TravelerPriority) => void;
  onAddNextStop?: () => void;
  onResetJourney?: () => void;
  onEditDraft?: () => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
  impactResult?: ImpactResult | null;
  selectedRecoveryPlan?: Part4RecoveryPlan | null;
}

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  flight: Plane, FLIGHT: Plane,
  train: Train, TRAIN: Train,
  metro: TrainFront, METRO: TrainFront,
  hotel: Hotel, HOTEL: Hotel,
  activity: Ticket, ACTIVITY: Ticket, ticket: Ticket,
  taxi: Car, CAB: Car, cab: Car, bus: Car,
};

function capitalizeWords(str?: string): string {
  if (!str) return '';
  return str.replace(/\b[a-z]/g, (l) => l.toUpperCase());
}

function fmtDate(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return s; }
}

function fmtTime(s?: string): string {
  if (!s || !s.includes('T')) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

function timeBadge(node: JourneyNode) {
  const isHotel = node.type.toLowerCase() === 'hotel';
  const sT = fmtTime(node.startTime);
  const eT = fmtTime(node.endTime);
  
  if (isHotel) {
    return `${sT || '14:00'} Check-in`;
  }
  if (sT && eT) return `${sT} - ${eT}`;
  if (sT) return sT;
  return 'Time not set';
}

function getStatusColors(status: string) {
  if (status === 'BROKEN') return 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400';
  if (status === 'NEEDS_CHANGE') return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400';
  if (status === 'AT_RISK') return 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950/30 dark:border-yellow-900/50 dark:text-yellow-400';
  if (status === 'INTACT' || status === 'RECOVERED') return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400';
  return 'bg-white border-slate-200 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300';
}

function getIconColors(status: string) {
  if (status === 'BROKEN') return 'bg-rose-500 text-white shadow-rose-500/30 border-rose-600';
  if (status === 'NEEDS_CHANGE') return 'bg-amber-500 text-white shadow-amber-500/30 border-amber-600';
  if (status === 'AT_RISK') return 'bg-amber-500 text-white shadow-amber-500/30 border-amber-600';
  if (status === 'INTACT' || status === 'RECOVERED') return 'bg-emerald-500 text-white shadow-emerald-500/30 border-emerald-600';
  return 'bg-slate-700 text-white dark:bg-slate-600 shadow-slate-500/20 border-slate-800';
}

function getBadgeColors(status: string) {
  if (status === 'BROKEN') return 'bg-rose-500 text-white';
  if (status === 'NEEDS_CHANGE') return 'bg-amber-500 text-white';
  if (status === 'AT_RISK') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200';
  if (status === 'INTACT') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
}

export const Part1JourneyView: React.FC<Part1JourneyViewProps> = ({
  journey,
  viewMode = 'RECOVERED',
  onEditNode,
  onDeleteNode,
  onUpdatePriority,
  onAddNextStop,
  onResetJourney,
  onEditDraft,
  impactNodeMap,
  impactResult,
  selectedRecoveryPlan,
}) => {
  const activeNodes = journey.nodes.filter((n) => {
    if (n.status === 'CANCELLED') return false;
    if (viewMode === 'ORIGINAL') {
      if (n.status === 'RESTORED_DEMO') return false;
      const isReplacementNode = Boolean(n.metadata?.recovery_execution_id || n.metadata?.replaced_item_id);
      if (isReplacementNode) return false;
      return true;
    } else {
      if (n.status === 'REPLACED') return false;
      if (n.status === 'RESTORED_DEMO') return false;
      return true;
    }
  });

  const route = buildJourneyRoute(activeNodes);
  const stats = routeStats(activeNodes);
  
  const visibleIds = new Set(activeNodes.flatMap((n) => [String(n.id), String(n.backendId ?? '')].filter(Boolean)));
  const visibleImpactNodes = (impactResult?.nodes || []).filter((n) => {
    const nid = String(n.node_id || '');
    const iid = n.item_id != null ? String(n.item_id) : '';
    return visibleIds.has(nid) || (iid && visibleIds.has(iid));
  });

  const scopedImpactResult: ImpactResult | null = impactResult
    ? {
        ...impactResult,
        nodes: visibleImpactNodes,
        journey_status: visibleImpactNodes.some(n => n.status === 'BROKEN' || n.status === 'NEEDS_CHANGE')
          ? 'DISRUPTED'
          : visibleImpactNodes.some(n => n.status === 'AT_RISK')
            ? (impactResult.journey_status === 'RECOVERED' ? 'RECOVERED' : 'NORMAL')
            : (impactResult.journey_status === 'RECOVERED' ? 'RECOVERED' : 'NORMAL'),
      }
    : null;

  const journeyStatus = getJourneyStatus(scopedImpactResult);
  const buckets = getImpactSummaryBuckets(scopedImpactResult);
  const hasImpact = !!scopedImpactResult && buckets.total > 0;
  const isDisrupted = journeyStatus === 'DISRUPTED';

  const renderCard = (node: JourneyNode, isFirst: boolean, isLast: boolean, lineStatus: string) => {
    const Icon = TYPE_ICONS[node.type] || MapPin;
    const impactDisp = getNodeImpactDisplay(node.id, node.backendId, impactNodeMap);
    
    const recoveryChange = selectedRecoveryPlan?.changes?.find(
      (c) => c.node_id === String(node.id) || (node.backendId && c.node_id === String(node.backendId))
    );
    const isReplaced = recoveryChange && (recoveryChange.action === 'REPLACE' || recoveryChange.action === 'MODIFY');
    const isKept = (recoveryChange && recoveryChange.action === 'KEEP') || (selectedRecoveryPlan && impactDisp.status === 'INTACT');

    const status = isReplaced ? 'BROKEN' : isKept ? 'INTACT' : impactDisp.status;
    const cardColors = getStatusColors(status);
    const iconColors = getIconColors(status);
    
    let badgeText = '';
    if (isReplaced) badgeText = 'Cancelled';
    else if (isKept) badgeText = 'Confirmed';
    else if (status === 'BROKEN') badgeText = 'Disrupted';
    else if (status === 'AT_RISK') badgeText = 'At Risk';
    else if (status === 'INTACT') badgeText = 'Confirmed';

    const nextLineColor = lineStatus === 'BROKEN' ? 'bg-rose-500' : lineStatus === 'AT_RISK' ? 'bg-amber-400' : lineStatus === 'INTACT' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700';

    return (
      <div key={node.id} className="relative flex items-start gap-3 sm:gap-6 group">
        <div className="flex flex-col items-center relative h-full min-h-[140px]">
          {!isFirst && <div className="absolute top-0 bottom-1/2 w-[3px] bg-slate-300 dark:bg-slate-700" />}
          {!isLast && <div className={`absolute top-1/2 bottom-0 w-[3px] ${nextLineColor}`} />}
          
          <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-md border-[3px] ${iconColors} mt-4`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex-1 py-4">
          <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${cardColors} hover:shadow-md cursor-pointer`} onClick={() => onEditNode && onEditNode(node)}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                    {capitalizeWords(node.title)}
                  </h3>
                  {badgeText && (
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full tracking-wider ${getBadgeColors(status)}`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                
                {(node.origin || node.destination) && (
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    {capitalizeWords(node.origin || 'Origin')} <ChevronRight className="w-4 h-4 text-slate-400" /> {capitalizeWords(node.destination || 'Destination')}
                  </p>
                )}
                {node.location && !(node.origin || node.destination) && (
                  <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
                    {capitalizeWords(node.location)}
                  </p>
                )}
              </div>
              
              <div className="text-left sm:text-right shrink-0">
                <div className="font-extrabold text-base text-slate-900 dark:text-white">{timeBadge(node)}</div>
                <div className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-wide">
                  {node.startDate ? fmtDate(node.startDate) : fmtDate(node.startTime)}
                </div>
              </div>
            </div>

            {node.bookingRef && (
              <div className="mt-3 flex items-center gap-3 text-[12px]">
                <span className="font-medium text-slate-500">Booking:</span>
                <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded">
                  {node.bookingRef}
                </span>
              </div>
            )}

            {!isReplaced && impactDisp.reason && impactDisp.status !== 'INTACT' && (
              <div className="mt-3.5 pt-3 border-t border-black/5 dark:border-white/5">
                <p className={`text-[12px] font-semibold flex items-start gap-1.5 ${status === 'BROKEN' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{impactDisp.reason}</span>
                </p>
              </div>
            )}
            
            {isReplaced && recoveryChange && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] font-extrabold uppercase text-amber-700 dark:text-amber-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Proposed Replacement
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-amber-900 dark:text-amber-100">{recoveryChange.new_title}</span>
                  <span className="font-extrabold text-amber-700 dark:text-amber-400 text-[13px]">
                    {recoveryChange.estimated_cost !== null && recoveryChange.estimated_cost !== undefined
                      ? `₹${recoveryChange.estimated_cost.toLocaleString()}`
                      : 'PARTIAL'}
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Priority:</span>
                <select
                  value={node.priority || 'MUST_PRESERVE'}
                  onChange={e => onUpdatePriority && onUpdatePriority(node.id, e.target.value as TravelerPriority)}
                  className="text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer min-w-0"
                >
                  <option value="MUST_PRESERVE">Must preserve</option>
                  <option value="PREFER_TO_PRESERVE">Prefer to preserve</option>
                  <option value="OPTIMIZE">Optimize</option>
                </select>
              </div>
              {onDeleteNode && (
                <button onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              {onEditNode && (
                <button onClick={(e) => { e.stopPropagation(); onEditNode(node); }} className="p-1.5 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const timelineItems: { node: JourneyNode; isLocation: boolean; locationLabel?: string }[] = [];
  
  route.locations.forEach((loc) => {
    loc.attachedItems.forEach(item => {
      timelineItems.push({ node: item, isLocation: false });
    });
    
    const seg = route.segments.find(s => s.fromLocationId === loc.id);
    if (seg) {
      timelineItems.push({ node: seg.item, isLocation: false });
    }
  });

  [...route.unconnected.flatMap(u => u.attachedItems), ...route.unplaced.map(u => u.item)].forEach(node => {
     if (!timelineItems.some(ti => ti.node.id === node.id)) {
       timelineItems.push({ node, isLocation: false });
     }
  });

  const displayNodes = routeStats(activeNodes).total > 0 ? timelineItems.map(ti => ti.node) : activeNodes;
  const itemsToRender = displayNodes.length > 0 ? displayNodes : activeNodes;

  return (
    <div className="bg-transparent space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Journey Timeline
            {hasImpact && isDisrupted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-extrabold tracking-widest bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                {buckets.needs_recovery} Disruptions
              </span>
            )}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Original flow vs real-time impact
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {onAddNextStop && (
            <button onClick={onAddNextStop} className="px-3.5 py-1.5 text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/40 hover:bg-sky-200 dark:hover:bg-sky-800 font-semibold text-xs rounded-xl transition-colors hidden md:block">
              + Add Item
            </button>
          )}
          {onEditDraft && (
            <button onClick={onEditDraft} className="px-3.5 py-1.5 text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold text-xs rounded-xl transition-colors">
              Edit Journey
            </button>
          )}
          {onResetJourney && (
            <button onClick={onResetJourney} className="px-3.5 py-1.5 text-rose-600 bg-rose-50 dark:bg-rose-900/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 font-semibold text-xs rounded-xl transition-colors">
              Reset Journey
            </button>
          )}
          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 rounded-xl text-[11px] font-bold">
            {stats.total} Stages
          </span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 md:p-8 shadow-sm border border-slate-200/60 dark:border-slate-800 relative">
        <div className="relative max-w-2xl mx-auto">
          <div className="hidden absolute left-5 top-0 bottom-0 w-[3px] bg-slate-300 dark:bg-slate-700" />
          
          {itemsToRender.map((node, i) => {
            let lineStatus = 'NORMAL';
            if (i < itemsToRender.length - 1) {
               const nextNode = itemsToRender[i + 1];
               const nextImpact = getNodeImpactDisplay(nextNode.id, nextNode.backendId, impactNodeMap);
               lineStatus = nextImpact.status;
            }
            return renderCard(node, i === 0, i === itemsToRender.length - 1, lineStatus);
          })}
          
          {itemsToRender.length === 0 && (
             <div className="text-center py-12 text-slate-500">
                <Info className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold">Your journey is empty</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
