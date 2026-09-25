import React, { useState } from 'react';
import {
  Plane,
  Train,
  Car,
  Hotel,
  Ticket,
  MapPin,
  AlertTriangle,
  Pencil,
  Trash2,
  X,
  Clock,
  TrainFront,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { Journey, JourneyNode, TravelerPriority, ImpactNodeStatus, ImpactResult, Part4RecoveryPlan } from '../types';
import { buildJourneyRoute, routeStats, LocationResolver, type JourneyRoute } from '../utils/routeBuilder';
import { getNodeImpactDisplay, getJourneyStatus, getImpactSummaryBuckets } from '../utils/impactUtils';
import { JourneyRouteMap } from './JourneyRouteMap';

// Props
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
  /** Full ImpactResult — drives journey-level status badge and summary strip */
  impactResult?: ImpactResult | null;
  /** Selected Part 4 Recovery Plan proposal */
  selectedRecoveryPlan?: Part4RecoveryPlan | null;
}

// Icon map
const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  flight: Plane,   FLIGHT: Plane,
  train: Train,    TRAIN: Train,
  metro: TrainFront, METRO: TrainFront,
  hotel: Hotel,    HOTEL: Hotel,
  activity: Ticket, ACTIVITY: Ticket, ticket: Ticket,
  taxi: Car, CAB: Car, cab: Car, bus: Car,
};

// Pure helpers
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

interface TB { text: string; dot: string; isFixed: boolean }

function timeBadge(node: JourneyNode): TB {
  const isHotel = node.type.toLowerCase() === 'hotel';
  const sD = fmtDate(node.startDate || node.startTime);
  const eD = fmtDate(node.endDate   || node.endTime);
  const sT = fmtTime(node.startTime);
  const eT = fmtTime(node.endTime);
  const unknown  = node.timeStatus === 'UNKNOWN' || (!node.startTime && node.timeStatus !== 'FIXED');
  const flexible = node.timeStatus === 'FLEXIBLE';

  if (isHotel) {
    const range = sD && eD ? `${sD} → ${eD}` : '';
    if (unknown)   return { text: range ? `${range} · Check-in unknown`   : 'Check-in unknown',   dot: '⚪', isFixed: false };
    if (flexible)  return { text: range ? `${range} · Flexible check-in`  : 'Flexible check-in',  dot: '🟡', isFixed: false };
    return { text: `${sD}${sT ? ` ${sT}` : ''} → ${eD}${eT ? ` ${eT}` : ''}`, dot: '🟢', isFixed: true };
  }
  if (unknown)  return { text: `${sD ? `${sD} · ` : ''}Time not decided`, dot: '⚪', isFixed: false };
  if (flexible) return { text: `${sD ? `${sD} · ` : ''}Flexible timing`,  dot: '🟡', isFixed: false };
  if (sT && eT) return { text: `${sD ? `${sD} · ` : ''}${sT} → ${eT}`,   dot: '🟢', isFixed: true };
  if (sT)       return { text: `${sD ? `${sD} · ` : ''}${sT}`,            dot: '🟢', isFixed: true };
  return          { text: `${sD ? `${sD} · ` : ''}Time not decided`,       dot: '⚪', isFixed: false };
}

function typeBadgeStyle(type: string, transportMode?: string): string {
  const t = type.toLowerCase();
  if (t === 'metro' || transportMode === 'METRO')
    return 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800';
  if (t === 'flight')
    return 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800';
  if (t === 'hotel')
    return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
  if (t === 'train')
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  if (t === 'activity' || t === 'ticket')
    return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
  return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
}

function typeLabel(type: string, transportMode?: string): string {
  const t = type.toLowerCase();
  if (t === 'metro' || transportMode === 'METRO') return 'METRO';
  if (t === 'flight') return 'FLIGHT';
  if (t === 'hotel')  return 'HOTEL';
  if (t === 'train')  return 'TRAIN';
  if (t === 'activity' || t === 'ticket') return 'ACTIVITY';
  if (t === 'taxi' || t === 'cab') return 'CAB';
  return type.toUpperCase();
}

function idLabel(type: string, transportMode?: string): string | null {
  const t = type.toLowerCase();
  if (t === 'metro' || transportMode === 'METRO') return null;
  if (t === 'flight') return 'Booking reference / PNR';
  if (t === 'train')  return 'PNR / Ticket number';
  if (t === 'hotel')  return 'Booking confirmation';
  if (t === 'taxi' || t === 'cab') return 'Booking ID';
  if (t === 'activity' || t === 'ticket') return 'Ticket / Booking ID';
  return 'Booking reference';
}

// Detail card
const DetailCard: React.FC<{
  node: JourneyNode;
  onEdit?: (n: JourneyNode) => void;
  onDelete?: (id: string) => void;
  onUpdatePriority?: (nodeId: string, priority: TravelerPriority) => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
  selectedRecoveryPlan?: Part4RecoveryPlan | null;
}> = ({ node, onEdit, onDelete, onUpdatePriority, impactNodeMap, selectedRecoveryPlan }) => {
  const Icon  = TYPE_ICONS[node.type] || MapPin;
  const label = idLabel(node.type, node.transportMode);
  const tb    = timeBadge(node);
  const impactDisp = getNodeImpactDisplay(node.id, node.backendId, impactNodeMap);

  const recoveryChange = selectedRecoveryPlan?.changes?.find(
    (c) => c.node_id === String(node.id) || (node.backendId && c.node_id === String(node.backendId))
  );

  const isReplaced = recoveryChange && (recoveryChange.action === 'REPLACE' || recoveryChange.action === 'MODIFY');
  const isKept = (recoveryChange && recoveryChange.action === 'KEEP') || (selectedRecoveryPlan && impactDisp.status === 'INTACT');

  let badgeLabel = impactDisp.badgeLabel;
  let badgeStyle = impactDisp.badgeStyle;

  if (isKept) {
    badgeLabel = '🟢 KEPT AS BOOKED';
    badgeStyle = 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 font-extrabold';
  } else if (isReplaced) {
    badgeLabel = '🔴 ORIGINAL • BROKEN';
  }

  const cardBorderClass = isReplaced
    ? 'border-amber-400 dark:border-amber-700 shadow-md shadow-amber-100 dark:shadow-none'
    : impactDisp.status === 'BROKEN'
    ? 'border-rose-300 dark:border-rose-800/80 shadow-sm shadow-rose-100 dark:shadow-none'
    : impactDisp.status === 'NEEDS_CHANGE'
    ? 'border-amber-300 dark:border-amber-800/80 shadow-sm shadow-amber-100 dark:shadow-none'
    : impactDisp.status === 'AT_RISK'
    ? 'border-yellow-300 dark:border-yellow-800/80 shadow-sm shadow-yellow-100 dark:shadow-none'
    : 'border-slate-200/80 dark:border-slate-800';

  return (
    <div className={`bg-slate-50/70 dark:bg-slate-950/40 rounded-2xl border ${cardBorderClass} flex flex-col h-full hover:shadow-md transition-all group`}>
      <div className="flex-1 flex flex-col gap-2.5 p-4">
        {/* Row 1: type chip + status */}
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${typeBadgeStyle(node.type, node.transportMode)}`}>
            <Icon className="h-3 w-3" />
            {typeLabel(node.type, node.transportMode)}
          </span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${badgeStyle}`}>
            {!isKept && <span className={`w-1.5 h-1.5 rounded-full ${impactDisp.dotColor} inline-block`} />}
            {badgeLabel}
          </span>
        </div>

        {/* Row 2: title */}
        <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          {capitalizeWords(node.title)}
        </h3>

        {/* Row 3: route / location */}
        {(node.origin || node.destination) ? (
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <span>{capitalizeWords(node.origin  || 'Start')}</span>
            <span className="text-sky-500">→</span>
            <span>{capitalizeWords(node.destination || 'End')}</span>
          </p>
        ) : node.location ? (
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-sky-500 shrink-0" />
            {capitalizeWords(node.location)}
          </p>
        ) : null}

        {/* Row 4: time/date */}
        <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-2 flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
          <Clock className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span>{tb.text}</span>
        </div>

        {/* Row 5: booking ref */}
        {label && node.bookingRef && (
          <div className="border-t border-slate-100 dark:border-slate-800/60 pt-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">{label}</span>
            <span className="font-mono text-xs text-slate-800 dark:text-slate-200 bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded mt-0.5 inline-block">
              {node.bookingRef}
            </span>
          </div>
        )}

        {/* Row 6: Proposed Replacement Overlay */}
        {isReplaced && recoveryChange && (
          <div className="mt-2.5 p-3 rounded-2xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 space-y-1.5 shadow-xs">
            <div className="text-[10px] font-extrabold uppercase text-amber-800 dark:text-amber-200 tracking-wider flex items-center justify-between">
              <span>↓ Proposed Replacement</span>
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-xs">
                🟠 PROPOSED
              </span>
            </div>
            <div className="font-bold text-xs text-amber-950 dark:text-white">
              {recoveryChange.new_title || 'Replacement Option'}
            </div>
            <div className="text-[11px] font-medium text-amber-800 dark:text-amber-300 flex items-center justify-between">
              <span>Est. Addl Cost:</span>
              <span className="font-extrabold">
                {recoveryChange.estimated_cost !== null && recoveryChange.estimated_cost !== undefined
                  ? `₹${recoveryChange.estimated_cost.toLocaleString()}`
                  : 'PARTIAL'}
              </span>
            </div>
          </div>
        )}

        {/* Row 7: Impact Reason Alert Callout */}
        {!isReplaced && impactDisp.reason && impactDisp.status !== 'INTACT' && (
          <div className={`mt-2 p-2.5 rounded-xl border text-xs font-medium flex items-start gap-2 ${
            impactDisp.status === 'BROKEN'
              ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : impactDisp.status === 'NEEDS_CHANGE'
              ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
              : 'bg-yellow-50/90 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
          }`}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-current" />
            <span className="leading-snug">{impactDisp.reason}</span>
          </div>
        )}
      </div>

      {/* Pinned bottom: priority + actions */}
      <div className="border-t border-slate-200/60 dark:border-slate-800/60 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0">Priority:</span>
          <select
            value={node.priority || 'MUST_PRESERVE'}
            onChange={e => {
              const p = e.target.value as TravelerPriority;
              if (onUpdatePriority) {
                onUpdatePriority(node.id, p);
              } else if (onEdit) {
                onEdit({ ...node, priority: p });
              }
            }}
            className="text-[11px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer min-w-0"
          >
            <option value="MUST_PRESERVE">Must preserve</option>
            <option value="PREFER_TO_PRESERVE">Prefer to preserve</option>
            <option value="OPTIMIZE">Optimize</option>
          </select>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onDelete && (
            <button onClick={() => onDelete(node.id)} title="Delete"
              className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(node)} title="Edit"
              className="p-1.5 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg transition-colors">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Inspector modal
const Inspector: React.FC<{
  node: JourneyNode;
  onClose: () => void;
  onEdit?: (n: JourneyNode) => void;
  onDelete?: (id: string) => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
}> = ({ node, onClose, onEdit, onDelete, impactNodeMap }) => {
  const tb = timeBadge(node);
  const label = idLabel(node.type, node.transportMode);
  const impactDisp = getNodeImpactDisplay(node.id, node.backendId, impactNodeMap);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60">
              {React.createElement(TYPE_ICONS[node.type] || MapPin, { className: 'h-5 w-5 text-sky-500' })}
            </span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">{capitalizeWords(node.title)}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400">{typeLabel(node.type, node.transportMode)}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${impactDisp.badgeStyle}`}>
                  {impactDisp.badgeLabel}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="py-4 space-y-3 text-xs text-slate-700 dark:text-slate-300">
          {(node.origin || node.destination) && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Route</span>
              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                {capitalizeWords(node.origin)} → {capitalizeWords(node.destination)}
              </span>
            </div>
          )}
          {node.location && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Location</span>
              <span className="font-semibold">{capitalizeWords(node.location)}</span>
            </div>
          )}
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">Timing</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
              <span>{tb.dot}</span><span>{tb.text}</span>
            </span>
          </div>
          {label && node.bookingRef && (
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-0.5">{label}</span>
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-800 dark:text-slate-200">{node.bookingRef}</span>
            </div>
          )}
          {impactDisp.reason && impactDisp.status !== 'INTACT' && (
            <div className={`mt-3 p-3 rounded-xl border font-medium flex items-start gap-2 ${
              impactDisp.status === 'BROKEN'
                ? 'bg-rose-50/90 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : impactDisp.status === 'NEEDS_CHANGE'
                ? 'bg-amber-50/90 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                : 'bg-yellow-50/90 dark:bg-yellow-950/60 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
            }`}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-current" />
              <span className="leading-snug">{impactDisp.reason}</span>
            </div>
          )}
        </div>
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
          {onDelete && (
            <button onClick={() => { onDelete(node.id); onClose(); }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />Delete
            </button>
          )}
          {onEdit && (
            <button onClick={() => { onEdit(node); onClose(); }}
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 ml-auto">
              <Pencil className="h-3.5 w-3.5" />Edit Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function sortNodesByRouteFlow(nodes: JourneyNode[], route: JourneyRoute): JourneyNode[] {
  const resolver = new LocationResolver(nodes);
  const locOrder = new Map<string, number>();
  route.locations.forEach((loc, idx) => {
    locOrder.set(loc.id, idx);
  });

  const getOrder = (node: JourneyNode): number => {
    if (node.origin) {
      const k = resolver.getKey(node.origin);
      if (locOrder.has(k)) return locOrder.get(k)!;
    }
    if (node.location) {
      const k = resolver.getKey(node.location);
      if (locOrder.has(k)) return locOrder.get(k)!;
    }
    if (node.destination) {
      const k = resolver.getKey(node.destination);
      if (locOrder.has(k)) return locOrder.get(k)!;
    }
    return 999;
  };

  const getTimestamp = (node: JourneyNode): number => {
    const s = node.startTime || node.startDate;
    if (!s) return 0;
    try {
      const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    } catch {
      return 0;
    }
  };

  const getExactTimeWeight = (node: JourneyNode): number => {
    if (node.startTime && node.timeStatus === 'FIXED') {
      try {
        const d = new Date(node.startTime);
        return d.getHours() * 60 + d.getMinutes();
      } catch {
        return 0;
      }
    }
    return 0;
  };

  return [...nodes].sort((a, b) => {
    const dateA = a.startDate || (a.startTime ? a.startTime.split('T')[0] : '');
    const dateB = b.startDate || (b.startTime ? b.startTime.split('T')[0] : '');

    // 1. If different dates, sort by date
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    // 2. If same date (or missing date), sort by location route order
    const orderA = getOrder(a);
    const orderB = getOrder(b);
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // 3. Within same location/order, sort by exact time weight if available
    const timeA = getExactTimeWeight(a);
    const timeB = getExactTimeWeight(b);
    if (timeA !== timeB && timeA > 0 && timeB > 0) {
      return timeA - timeB;
    }

    // 4. Fallback to timestamp
    return getTimestamp(a) - getTimestamp(b);
  });
}

// Main view
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
  const isLocal = journey.syncStatus === 'local';

  // Filter active nodes according to viewMode ('RECOVERED' vs 'ORIGINAL')
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

  // Build data-driven route from active nodes
  const route = buildJourneyRoute(activeNodes);
  const stats = routeStats(activeNodes);
  const displayNodes = sortNodesByRouteFlow(activeNodes, route);

  const [selected, setSelected] = useState<JourneyNode | null>(null);

  // Journey-level impact — only count nodes visible in the current view
  const visibleIds = new Set(
    activeNodes.flatMap((n) => [String(n.id), String(n.backendId ?? '')].filter(Boolean))
  );
  const visibleImpactNodes = (impactResult?.nodes || []).filter((n) => {
    const nid = String(n.node_id || '');
    const iid = n.item_id != null ? String(n.item_id) : '';
    return visibleIds.has(nid) || (iid && visibleIds.has(iid));
  });

  // Prefer node-scoped status for the current view so REPLACED originals don't
  // mark a healthy recovered plan as DISRUPTED / inflate "unchanged" counts.
  const scopedImpactResult: ImpactResult | null = impactResult
    ? {
        ...impactResult,
        nodes: visibleImpactNodes,
        journey_status: visibleImpactNodes.some(
          (n) => n.status === 'BROKEN' || n.status === 'NEEDS_CHANGE'
        )
          ? 'DISRUPTED'
          : visibleImpactNodes.some((n) => n.status === 'AT_RISK')
            ? (impactResult.journey_status === 'RECOVERED' ? 'RECOVERED' : 'NORMAL')
            : (impactResult.journey_status === 'RECOVERED' ? 'RECOVERED' : 'NORMAL'),
      }
    : null;

  const journeyStatus = getJourneyStatus(scopedImpactResult);
  const buckets = getImpactSummaryBuckets(scopedImpactResult);
  const hasImpact = !!scopedImpactResult && buckets.total > 0;
  const isDisrupted = journeyStatus === 'DISRUPTED';

  // Route summary text
  const summaryText =
    route.locations.length > 0
      ? route.locations.map((l) => l.label).join(' → ')
      : 'No route defined yet';

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-2 sm:px-4 py-4">

      {/* Unsynced banner */}
      {isLocal && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/40 dark:border-amber-700 flex items-start gap-3 text-amber-900 dark:text-amber-200 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold">Unsynced Local Journey</p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Saved locally. Disruption monitoring activates once synced to backend.
            </p>
          </div>
        </div>
      )}

      {/* JOURNEY ROUTE CARD */}
      <div className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6 transition-colors ${
        isDisrupted
          ? 'border-rose-200 dark:border-rose-900/60 shadow-rose-100/40'
          : 'border-slate-200/80 dark:border-slate-800'
      }`}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">

              {journey.id && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2.5 py-0.5 rounded-full font-mono text-[10px]">
                  #{journey.id}
                </span>
              )}
              {/* Journey-level status badge — only shown when ImpactResult exists */}
              {hasImpact && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                  isDisrupted
                    ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                    : buckets.at_risk > 0
                    ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {isDisrupted ? '🔴 DISRUPTED' : buckets.at_risk > 0 ? '🟡 AT RISK' : '🟢 ON TRACK'}
                </span>
              )}
              {selectedRecoveryPlan && isDisrupted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border bg-emerald-100 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                  🟢 RECOVERY READY
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {journey.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{summaryText}</span>
              <span className="h-3 w-px bg-slate-200 dark:bg-slate-700" />
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">
                {stats.total} item{stats.total !== 1 ? 's' : ''}
                {stats.legs       > 0 ? ` · ${stats.legs} leg${stats.legs             !== 1 ? 's' : ''}` : ''}
                {stats.stays      > 0 ? ` · ${stats.stays} stay${stats.stays          > 1 ? 's' : ''}` : ''}
                {stats.activities > 0 ? ` · ${stats.activities} activit${stats.activities > 1 ? 'ies' : 'y'}` : ''}
              </span>
            </div>

            {/* Impact summary strip — only when ImpactResult exists */}
            {hasImpact && (
              <div className={`mt-3 pt-3 border-t flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-bold ${
                isDisrupted
                  ? 'border-rose-100 dark:border-rose-900/40'
                  : 'border-slate-100 dark:border-slate-800'
              }`}>
                {buckets.needs_recovery > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {buckets.needs_recovery} require{buckets.needs_recovery === 1 ? 's' : ''} recovery
                  </span>
                )}
                {buckets.at_risk > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {buckets.at_risk} at risk
                  </span>
                )}
                {buckets.unchanged > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {buckets.unchanged} unchanged
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onEditDraft && (
              <button onClick={onEditDraft}
                className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2 rounded-xl transition-colors">
                Edit Journey
              </button>
            )}
            {onResetJourney && (
              <button onClick={onResetJourney}
                className="text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-3.5 py-2 rounded-xl transition-colors">
                Reset Journey
              </button>
            )}
          </div>
        </div>

        {/* Route map body */}
        {activeNodes.length === 0 ? (
          <div className="py-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 flex items-center justify-center mx-auto mb-3">
              <MapPin className="h-6 w-6" />
            </div>
            <p className="font-semibold text-slate-900 dark:text-white text-base">Your Journey Route is Empty</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Add your first booking leg to start mapping your route.
            </p>
            {onAddNextStop && (
              <button onClick={onAddNextStop}
                className="mt-6 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs shadow-md shadow-sky-500/20 transition-all">
                + Start Building Route
              </button>
            )}
          </div>
        ) : (
          <JourneyRouteMap
            route={route}
            onItemClick={setSelected}
            onAddStop={onAddNextStop}
            impactNodeMap={impactNodeMap}
            selectedRecoveryPlan={selectedRecoveryPlan}
          />
        )}
      </div>

      {/* TRIP DETAILS GRID */}
      {activeNodes.length > 0 && (
        <div className={`bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 border shadow-xl shadow-slate-200/40 dark:shadow-none space-y-6 transition-colors ${
          isDisrupted
            ? 'border-rose-200/60 dark:border-rose-900/50'
            : 'border-slate-200/80 dark:border-slate-800'
        }`}>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isDisrupted
                  ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800'
                  : 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800'
              }`}>
                RESERVATIONS &amp; DETAILS
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1.5">
                MY TRIP DETAILS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isDisrupted
                  ? 'Some bookings require attention · see impact status below'
                  : 'Confirmed reservations \u0026 itinerary schedule'
                }
              </p>
            </div>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-xs font-bold shrink-0">
              {activeNodes.length} item{activeNodes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* 3-col desktop / 2-col tablet / 1-col mobile, rows stretch-equal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" style={{ alignItems: 'stretch' }}>
            {displayNodes.map(node => (
              <DetailCard
                key={node.id}
                node={node}
                onEdit={onEditNode}
                onDelete={onDeleteNode}
                onUpdatePriority={onUpdatePriority}
                impactNodeMap={impactNodeMap}
                selectedRecoveryPlan={selectedRecoveryPlan}
              />
            ))}
          </div>
        </div>
      )}

      {/* Inspector modal */}
      {selected && (
        <Inspector
          node={selected}
          onClose={() => setSelected(null)}
          onEdit={onEditNode}
          onDelete={onDeleteNode}
          impactNodeMap={impactNodeMap}
        />
      )}
    </div>
  );
};
