import React from 'react';
import { Plane, Train, Car, Hotel, Ticket, MapPin, AlertTriangle, Pencil, Trash2, TrainFront, CheckCircle2, Info } from 'lucide-react';
import type { Journey, JourneyNode, ImpactNodeStatus, ImpactResult, Part4RecoveryPlan } from '../types';
import { buildJourneyRoute, routeStats } from '../utils/routeBuilder';
import { getNodeImpactDisplay, getJourneyStatus, getImpactSummaryBuckets } from '../utils/impactUtils';

interface Part1JourneyViewProps {
  journey: Journey;
  viewMode?: 'RECOVERED' | 'ORIGINAL';
  onEditNode?: (node: JourneyNode) => void;
  onDeleteNode?: (nodeId: string) => void;
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
  const prefix = node.timeStatus === 'APPROXIMATE' ? 'Approx. ' : '';
  if (sT && eT) return `${prefix}${sT} - ${eT}`;
  if (sT) return `${prefix}${sT}`;
  if (node.timeStatus === 'APPROXIMATE') return 'Approx. time pending';
  return 'Time not set';
}

function getStatusColors(status: string) {
  if (status === 'BROKEN') return 'bg-rose-50 text-rose-900';
  if (status === 'NEEDS_CHANGE') return 'bg-orange-50 text-orange-900';
  if (status === 'AT_RISK') return 'bg-amber-50 text-amber-900';
  if (status === 'INTACT' || status === 'RECOVERED') return 'bg-[#f4f7f9] text-slate-800';
  return 'bg-[#f4f7f9] text-slate-800';
}

function getIconColors(status: string) {
  if (status === 'BROKEN') return 'bg-[#c62828] text-white';
  if (status === 'NEEDS_CHANGE') return 'bg-[#e65100] text-white';
  if (status === 'AT_RISK') return 'bg-[#ef6c00] text-white';
  if (status === 'INTACT' || status === 'RECOVERED') return 'bg-[#00695c] text-white';
  return 'bg-slate-600 text-white';
}

function getBadgeColors(status: string) {
  if (status === 'BROKEN') return 'bg-[#d32f2f] text-white';
  if (status === 'NEEDS_CHANGE') return 'bg-[#ed6c02] text-white';
  if (status === 'AT_RISK') return 'bg-[#ff9800] text-amber-900';
  if (status === 'INTACT') return 'bg-[#4caf50] text-[#004d40]';
  return 'bg-slate-200 text-slate-700';
}

export const Part1JourneyView: React.FC<Part1JourneyViewProps> = ({
  journey,
  viewMode = 'RECOVERED',
  onEditNode,
  onDeleteNode,
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

    return (
      <div key={node.id} className="relative flex items-start gap-4 sm:gap-5 group">
        <div className="flex flex-col items-center relative h-full min-h-[90px]">
          {!isFirst && <div className="absolute top-0 bottom-1/2 w-[2px] bg-slate-300" />}
          {!isLast && <div className={`absolute top-1/2 bottom-0 w-[2px] ${lineStatus === 'BROKEN' ? 'bg-[#c62828]' : lineStatus === 'AT_RISK' ? 'bg-[#ef6c00]' : 'bg-slate-300'}`} />}
          
          <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center ${iconColors} mt-4`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        <div className="flex-1 py-1.5 sm:py-2">
          <div className={`p-4 rounded-[14px] transition-all ${cardColors} cursor-pointer`} onClick={() => onEditNode && onEditNode(node)}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-1">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
                    {capitalizeWords(node.title)}
                  </h3>
                  {badgeText && (
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${getBadgeColors(status)}`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                
                {(node.origin || node.destination) && (
                  <p className="text-[13px] font-medium text-slate-600 flex items-center gap-1.5 mt-1">
                    {['cab', 'taxi', 'transfer'].includes((node.type || '').toLowerCase()) ? (
                      <>
                        <span className="text-slate-400">Pickup:</span> {capitalizeWords(node.origin || 'Not set')} 
                        <span className="text-slate-300 mx-1">|</span> 
                        <span className="text-slate-400">Dropoff:</span> {capitalizeWords(node.destination || 'Not set')}
                      </>
                    ) : (
                      <>
                        {capitalizeWords(node.origin || 'Origin')} <span className="text-slate-400">→</span> {capitalizeWords(node.destination || 'Destination')}
                      </>
                    )}
                  </p>
                )}
                {node.location && !(node.origin || node.destination) && (
                  <p className="text-[13px] font-medium text-slate-600 mt-1">
                    {capitalizeWords(node.location)}
                  </p>
                )}
                
                {node.bookingRef && (
                  <p className="text-[12px] font-medium text-slate-600 mt-1">
                    Booking #{node.bookingRef}
                  </p>
                )}
              </div>
              
              <div className="text-left sm:text-right shrink-0">
                <div className="text-[13px] font-medium text-slate-700">{timeBadge(node)}</div>
                {node.startDate && (
                  <div className="text-[13px] font-medium text-slate-500 mt-0.5">
                    {fmtDate(node.startDate)}
                  </div>
                )}
              </div>
            </div>

            {!isReplaced && impactDisp.reason && impactDisp.status !== 'INTACT' && (
              <div className="mt-2.5">
                <p className={`text-[12px] font-bold flex items-start gap-1.5 ${status === 'BROKEN' ? 'text-[#c62828]' : 'text-[#ef6c00]'}`}>
                  {status === 'BROKEN' ? <span className="text-[14px]">⊗</span> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{impactDisp.reason}</span>
                </p>
              </div>
            )}
            
            {isReplaced && recoveryChange && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10">
                <p className="text-[11px] font-bold text-amber-800 tracking-wider mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Proposed Replacement
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-amber-900">{recoveryChange.new_title}</span>
                  <span className="font-bold text-amber-700 text-[12px]">
                    {recoveryChange.estimated_cost !== null && recoveryChange.estimated_cost !== undefined
                      ? `₹${recoveryChange.estimated_cost.toLocaleString()}`
                      : 'PARTIAL'}
                  </span>
                </div>
              </div>
            )}
            
            {(onDeleteNode || onEditNode) && (
            <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-end gap-1">
              {onDeleteNode && (
                <button type="button" aria-label={`Delete ${node.title}`} onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              {onEditNode && (
                <button type="button" aria-label={`Edit ${node.title}`} onClick={(e) => { e.stopPropagation(); onEditNode(node); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sky-700 bg-white border border-sky-200 hover:bg-sky-50 rounded-lg text-xs font-bold transition-colors">
                  <Pencil className="h-4 w-4" />
                  Edit stage
                </button>
              )}
            </div>
            )}
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
      <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Journey Timeline
            {hasImpact && isDisrupted && (
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest bg-rose-100 text-rose-700 border border-rose-200">
                {buckets.needs_recovery} Disruption{buckets.needs_recovery > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p className="text-[13px] text-slate-500 mt-0.5 font-medium">
            {hasImpact && isDisrupted ? 'Original flow vs real-time impact' : 'Real-time flight & booking status'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {onEditDraft && (
            <button onClick={onEditDraft} className="px-3 py-1.5 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-xs rounded-lg transition-colors shadow-sm">
              Edit Journey
            </button>
          )}
          {onResetJourney && (
            <button onClick={onResetJourney} className="px-3 py-1.5 text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 font-semibold text-xs rounded-lg transition-colors">
              Reset
            </button>
          )}
          <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[11px] font-black">
            {stats.total} Stages
          </span>
        </div>
      </div>

      <div className="bg-white rounded-[24px] p-5 sm:p-8 shadow-sm border border-slate-200/60 relative">
        <div className="relative max-w-2xl mx-auto">
          <div className="hidden absolute left-5 top-0 bottom-0 w-[2px] bg-slate-300" />
          
          <div className="flex flex-col space-y-2">
            {itemsToRender.map((node, i) => {
              let lineStatus = 'NORMAL';
              if (i < itemsToRender.length - 1) {
                 const nextNode = itemsToRender[i + 1];
                 const nextImpact = getNodeImpactDisplay(nextNode.id, nextNode.backendId, impactNodeMap);
                 lineStatus = nextImpact.status;
              }
              return renderCard(node, i === 0, i === itemsToRender.length - 1, lineStatus);
            })}
          </div>
          
          {itemsToRender.length === 0 && (
             <div className="text-center py-12 text-slate-500">
                <Info className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="font-semibold">Your journey is empty</p>
             </div>
          )}

          {/* Recovery Guarantee Block */}
          {hasImpact && isDisrupted && (
            <div className="mt-8 ml-[52px] sm:ml-[60px] p-5 rounded-2xl bg-[#f0f4f8] border border-[#e2e8f0]">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-700 mb-3">
                Recovery Guarantee
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">DGCA & Travora Auto-Claim</span>
                  <span className="text-[#00695c]">₹0 Rebooking Fee</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Cab Reschedule Allowance</span>
                  <span className="text-slate-900">Free 1x adjustment</span>
                </div>
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-500">Hotel Late Arrival Notice</span>
                  <span className="text-slate-900">Dispatched via API</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
