import type { ImpactNodeStatus, ImpactResult, JourneyStatus } from '../types';

export interface NodeImpactDisplay {
  status: ImpactNodeStatus;
  badgeLabel: string;
  badgeStyle: string;
  dotColor: string;
  reason?: string;
  isCancelled: boolean;
}

export function getImpactForNode(
  nodeId: string,
  backendId?: number | string,
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>
): { status: ImpactNodeStatus; reason: string } | null {
  if (!impactNodeMap) return null;
  const key1 = String(nodeId);
  if (impactNodeMap[key1]) return impactNodeMap[key1];
  if (backendId !== undefined && backendId !== null) {
    const key2 = String(backendId);
    if (impactNodeMap[key2]) return impactNodeMap[key2];
    const key3 = `item_${backendId}`;
    if (impactNodeMap[key3]) return impactNodeMap[key3];
  }
  return null;
}

export function getNodeImpactDisplay(
  nodeId: string,
  backendId?: number | string,
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>
): NodeImpactDisplay {
  const impact = getImpactForNode(nodeId, backendId, impactNodeMap);
  const status: ImpactNodeStatus = impact?.status || 'INTACT';
  const reason = impact?.reason;

  if (status === 'BROKEN') {
    const isCancelled = reason ? /cancel/i.test(reason) : false;
    return {
      status,
      badgeLabel: isCancelled ? '🔴 CANCELLED' : '🔴 BROKEN',
      badgeStyle: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      dotColor: 'bg-rose-500',
      reason,
      isCancelled,
    };
  }

  if (status === 'NEEDS_CHANGE') {
    return {
      status,
      badgeLabel: '🟠 NEEDS CHANGE',
      badgeStyle: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      dotColor: 'bg-amber-500',
      reason,
      isCancelled: false,
    };
  }

  if (status === 'AT_RISK') {
    return {
      status,
      badgeLabel: '🟡 AT RISK',
      badgeStyle: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
      dotColor: 'bg-yellow-500',
      reason,
      isCancelled: false,
    };
  }

  // Default INTACT
  return {
    status: 'INTACT',
    badgeLabel: '🟢 Confirmed',
    badgeStyle: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/80',
    dotColor: 'bg-emerald-500',
    reason: undefined,
    isCancelled: false,
  };
}

// ── Journey-level status helpers ─────────────────────────────────────────────

/**
 * Derives the journey-level status from an ImpactResult.
 *
 * Priority:
 *   1. `result.journey_status` — authoritative backend value (preferred).
 *   2. Client-side inference fallback: DISRUPTED if any node is BROKEN or
 *      NEEDS_CHANGE. This handles mock data and legacy API shapes.
 *
 * Returns 'NORMAL' when result is null (no active disruption).
 */
export function getJourneyStatus(result: ImpactResult | null): JourneyStatus {
  if (!result) return 'NORMAL';
  // Prefer the backend-authoritative value
  if (result.journey_status) return result.journey_status;
  // Client-side inference fallback
  const hasBreakage = result.nodes?.some(
    (n) => n.status === 'BROKEN' || n.status === 'NEEDS_CHANGE'
  );
  return hasBreakage ? 'DISRUPTED' : 'NORMAL';
}

export interface JourneyStatusDisplay {
  status: JourneyStatus;
  /** Short headline shown to traveler, e.g. "🔴 JOURNEY DISRUPTED" */
  headline: string;
  /** Single-sentence plain-language explanation */
  description: string;
  /** Tailwind classes for the container badge / banner background */
  bannerStyle: string;
  /** Tailwind classes for headline text */
  headlineStyle: string;
}

/**
 * Returns traveler-friendly display properties for a journey status.
 * No technical terminology (no "buffer", "DAG", "dependency edge").
 */
export function getJourneyStatusDisplay(status: JourneyStatus): JourneyStatusDisplay {
  if (status === 'DISRUPTED') {
    return {
      status,
      headline: '🔴 JOURNEY DISRUPTED',
      description: 'Your original travel plan can no longer be completed as planned.',
      bannerStyle: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60',
      headlineStyle: 'text-rose-700 dark:text-rose-300',
    };
  }
  if (status === 'RECOVERED') {
    return {
      status,
      headline: '🟢 JOURNEY RECOVERED',
      description: 'Your replacement bookings are confirmed. No active disruptions remain.',
      bannerStyle: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50',
      headlineStyle: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  return {
    status,
    headline: '🟢 Journey On Track',
    description: 'Your travel plan is currently executable as planned.',
    bannerStyle: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50',
    headlineStyle: 'text-emerald-700 dark:text-emerald-300',
  };
}

export interface ImpactSummaryBuckets {
  /** Nodes that are BROKEN or NEEDS_CHANGE — require recovery */
  needs_recovery: number;
  /** Nodes that are AT_RISK — may be affected but not currently broken */
  at_risk: number;
  /** Nodes that are INTACT — no current impact identified */
  unchanged: number;
  /** Total evaluated node count */
  total: number;
}

/**
 * Splits the impact result into three plain-language buckets for the
 * traveler-facing summary. No buffer/minute/DAG terminology.
 *
 * Needs recovery = BROKEN + NEEDS_CHANGE
 * At risk        = AT_RISK
 * Unchanged      = INTACT
 */
export function getImpactSummaryBuckets(result: ImpactResult | null): ImpactSummaryBuckets {
  if (!result?.nodes) {
    return { needs_recovery: 0, at_risk: 0, unchanged: 0, total: 0 };
  }
  let needs_recovery = 0;
  let at_risk = 0;
  let unchanged = 0;
  for (const n of result.nodes) {
    if (n.status === 'BROKEN' || n.status === 'NEEDS_CHANGE') needs_recovery++;
    else if (n.status === 'AT_RISK') at_risk++;
    else unchanged++;
  }
  return { needs_recovery, at_risk, unchanged, total: result.nodes.length };
}

/**
 * Scope an ImpactResult to a set of visible journey node/backend IDs.
 * Recalculates journey_status from the scoped nodes so REPLACED originals
 * do not mark a healthy recovered view as DISRUPTED.
 */
export function scopeImpactToNodeIds(
  result: ImpactResult | null,
  visibleIds: Set<string>
): ImpactResult | null {
  if (!result) return null;
  if (!visibleIds.size) return result;

  const nodes = (result.nodes || []).filter((n) => {
    const nid = String(n.node_id || '');
    const iid = n.item_id != null ? String(n.item_id) : '';
    return visibleIds.has(nid) || (iid !== '' && visibleIds.has(iid));
  });

  if (nodes.length === 0) return result;

  const hasBreakage = nodes.some((n) => n.status === 'BROKEN' || n.status === 'NEEDS_CHANGE');
  const journey_status: JourneyStatus = hasBreakage
    ? 'DISRUPTED'
    : result.journey_status === 'RECOVERED'
      ? 'RECOVERED'
      : 'NORMAL';

  return { ...result, nodes, journey_status };
}
