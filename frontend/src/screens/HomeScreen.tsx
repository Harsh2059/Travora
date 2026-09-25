import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  PlusCircle,
  RefreshCw,
  Plane,
  Sparkles,
  Zap,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useJourney, fetchTripDisruptions, fetchTripImpact, updateItemOnBackend, saveLocalJourney, getSelectedRecoveryPlanWithMeta, clearSelectedRecoveryPlan, saveSelectedRecoveryPlan } from '../store/journeyStore';
import { analyzePart4Recovery, getLatestExecution } from '../services/recoveryApi';
import {
  notifyViewModeChanged,
  getPersistedViewMode,
  subscribeToViewMode
} from '../store/tripSync';
import { findSuccessorPlan } from '../utils/successorMatcher';
import { Part1JourneyView } from '../components/Part1JourneyView';
import { RecoveryPlanView } from '../components/recovery/RecoveryPlanView';
import { SelectedRecoveryPlanReview } from '../components/recovery/SelectedRecoveryPlanReview';
import { Part5BookingExecutionView } from '../components/recovery/Part5BookingExecutionView';
import { RestoreJourneyModal } from '../components/recovery/RestoreJourneyModal';
import type { Journey, ImpactResult, ImpactNodeStatus, TravelerPriority, Part4RecoveryPlan, Part4RecoveryResult } from '../types';
import {
  getJourneyStatus,
  getJourneyStatusDisplay,
  getImpactSummaryBuckets,
  scopeImpactToNodeIds,
} from '../utils/impactUtils';

function fmtDisplayTime(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return s;
  }
}

function getDisruptionNoticeText(disruption: any, node?: any): string {
  const title =
    node?.provider ||
    node?.title ||
    disruption?.event_metadata?.provider ||
    disruption?.provider ||
    'Booking';
  const type = disruption?.event_type || disruption?.type || '';
  const meta = disruption?.event_metadata || {};
  const delay = meta?.delay_minutes ?? disruption?.delay_minutes;

  if (type === 'FLIGHT_CANCELLED') {
    return `Your ${title} flight has been cancelled.`;
  }
  if (type === 'FLIGHT_DELAYED') {
    return `Your ${title} flight has been delayed${delay ? ` by ${delay} minutes` : ''}.`;
  }
  if (type === 'TRAIN_CANCELLED') {
    return `Your ${title} train has been cancelled.`;
  }
  if (type === 'TRAIN_DELAYED') {
    return `Your ${title} train has been delayed${delay ? ` by ${delay} minutes` : ''}.`;
  }
  if (type === 'CAB_CANCELLED' || type === 'CAB_UNAVAILABLE') {
    return `Your ${title} cab booking is unavailable.`;
  }
  if (type === 'CAB_DELAYED') {
    return `Your ${title} cab has been delayed${delay ? ` by ${delay} minutes` : ''}.`;
  }
  if (type === 'HOTEL_CANCELLED') {
    return `Your hotel booking (${title}) has been cancelled.`;
  }
  if (type === 'ACTIVITY_CANCELLED') {
    return `Your ${title} activity has been cancelled.`;
  }
  if (type === 'MISSED_CONNECTION') {
    return `A connecting transit for ${title} has been missed.`;
  }

  return `A disruption has been detected for your ${title} booking.`;
}

/** Prefer clean airline/provider label over long composed titles. */
function displayProviderLabel(
  provider?: string | null,
  title?: string | null,
  fallback = 'Booking'
): string {
  const raw = (provider || title || '').trim();
  if (!raw) return fallback;
  // Strip " (route…)" / " (Repl. for …)" suffixes from composed titles
  const cleaned = raw.split(' (Repl.')[0].split(' (')[0].trim();
  return cleaned || fallback;
}

function resolveRestoreComparison(
  journey: Journey | null | undefined,
  latestExecution: any | null
): { replacementItem: any | null; originalItem: any | null } {
  const booking = latestExecution?.confirmed_bookings?.[0];
  if (!journey?.nodes?.length && !booking) {
    return { replacementItem: null, originalItem: null };
  }

  const nodes = journey?.nodes || [];

  // CURRENT = active recovered booking (tagged replacement or matching PNR)
  const recoveredNode =
    nodes.find(
      (n) =>
        booking &&
        (n.bookingRef === booking.booking_reference ||
          n.bookingRef === booking.pnr ||
          n.metadata?.pnr === booking.pnr)
    ) ||
    nodes.find(
      (n) =>
        (n.status === 'CONFIRMED' || n.status === 'RESTORED_DEMO') &&
        (n.metadata?.recovery_execution_id || n.metadata?.is_replacement)
    );

  const replacementItem = recoveredNode
    ? recoveredNode
    : booking
      ? ({
          id: 'repl',
          type: booking.type || 'FLIGHT',
          title: displayProviderLabel(booking.provider, booking.replacement_title, 'Replacement Booking'),
          provider: displayProviderLabel(booking.provider, booking.replacement_title, 'Replacement Booking'),
          origin: booking.origin,
          destination: booking.destination,
          bookingRef: booking.booking_reference || booking.pnr,
        } as any)
      : null;

  // ORIGINAL = true original row (REPLACED / no recovery tag / canonical node_id)
  const origId = booking?.node_id != null ? String(booking.node_id) : null;
  let originalNode =
    nodes.find((n) => n.status === 'REPLACED' && !n.metadata?.recovery_execution_id) ||
    nodes.find(
      (n) =>
        origId &&
        (n.id === origId || String(n.backendId) === origId) &&
        !n.metadata?.recovery_execution_id
    ) ||
    nodes.find(
      (n) =>
        !n.metadata?.recovery_execution_id &&
        !n.metadata?.is_replacement &&
        /indigo/i.test(`${n.provider || ''}${n.title || ''}`)
    );

  // Fallback: original_provider from execution metadata / DB-backed field
  const origProviderLabel = displayProviderLabel(
    booking?.original_provider,
    booking?.original_title,
    ''
  );

  const originalItem = originalNode
    ? {
        ...originalNode,
        provider: displayProviderLabel(originalNode.provider, originalNode.title),
        title: displayProviderLabel(originalNode.provider, originalNode.title),
      }
    : origProviderLabel
      ? ({
          id: 'orig',
          type: booking?.type || 'FLIGHT',
          title: origProviderLabel,
          provider: origProviderLabel,
          origin: originalNode ? (originalNode as any).origin : undefined,
          destination: originalNode ? (originalNode as any).destination : undefined,
          bookingRef: undefined,
        } as any)
      : null;

  return { replacementItem, originalItem };
}

function renderStatusBadge(status: ImpactNodeStatus) {
  if (status === 'BROKEN') {
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">🔴 BROKEN</span>;
  }
  if (status === 'NEEDS_CHANGE') {
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-sm">🟠 NEEDS CHANGE</span>;
  }
  if (status === 'AT_RISK') {
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">🟡 AT RISK</span>;
  }
  return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">🟢 INTACT</span>;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { journey, loading, refresh, clearActive } = useJourney();

  const [activeDisruption, setActiveDisruption] = useState<any | null>(null);
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [showImpactModal, setShowImpactModal] = useState<boolean>(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [showSelectedPlanReviewModal, setShowSelectedPlanReviewModal] = useState<boolean>(false);
  const [showPart5HandoffModal, setShowPart5HandoffModal] = useState<boolean>(false);

  const [selectedRecoveryPlan, setSelectedRecoveryPlanState] = useState<Part4RecoveryPlan | null>(null);
  const [isSelectedPlanUpdated, setIsSelectedPlanUpdated] = useState<boolean>(false);
  const [recoveryAnalysisResult, setRecoveryAnalysisResult] = useState<Part4RecoveryResult | null>(null);

  // Ref to track the active disruption fingerprint for in-flight async requests
  const activeFetchFpRef = useRef<string>('');

  const [currentDisruptionFingerprint, setCurrentDisruptionFingerprint] = useState<string>('');
  const [latestExecution, setLatestExecution] = useState<any | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ORIGINAL' | 'RECOVERED'>(
    journey?.id ? getPersistedViewMode(journey.id) : 'RECOVERED'
  );

  // Subscribe to global view mode changes
  useEffect(() => {
    if (journey?.id) {
      // Sync initial state on trip change
      setViewMode(getPersistedViewMode(journey.id));
      
      const unsubscribe = subscribeToViewMode(journey.id, (mode) => {
        setViewMode(mode);
      });
      return unsubscribe;
    }
  }, [journey?.id]);

  // Real-time polling & focus/storage listeners for disruption events & impact engine
  useEffect(() => {
    const tripId = journey?.id;
    if (!tripId) {
      setActiveDisruption(null);
      setImpactResult(null);
      setShowToast(false);
      setSelectedRecoveryPlanState(null);
      setCurrentDisruptionFingerprint('');
      setLatestExecution(null);
      return;
    }

    const checkDisruptions = async () => {
      let execRes: any = null;
      try {
        execRes = await getLatestExecution(tripId);
        if (execRes && execRes.status !== 'NOT_FOUND') {
          setLatestExecution(execRes);
        } else {
          execRes = null;
          setLatestExecution(null);
        }
      } catch {
        execRes = null;
        setLatestExecution(null);
      }

      try {
        const history = await fetchTripDisruptions(tripId);
        const activeDisruptions = (history || []).filter((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');

        if (activeDisruptions.length > 0) {
          const latest = activeDisruptions[0];
          const activeId = String(latest.id || latest.timestamp || latest.detected_at);

          setActiveDisruption((prev: any) => {
            const prevId = prev ? String(prev.id || prev.timestamp || prev.detected_at) : null;
            if (prevId !== activeId) {
              const lastSeen = localStorage.getItem(`travora_last_seen_disruption_${tripId}`);
              if (lastSeen !== activeId) {
                setShowToast(true);
              }
            }
            return latest;
          });
        } else {
          setActiveDisruption(null);
          setShowToast(false);
        }

        // Always fetch impact analysis from Part 3 Impact Engine to keep UI state in sync
        try {
          const impact = await fetchTripImpact(tripId);
          setImpactResult(impact);

          const newFp: string = impact?.disruption_fingerprint ?? '';
          setCurrentDisruptionFingerprint(newFp);

          if (activeDisruptions.length === 0) {
            // After successful recovery, keep the selected plan so Original↔Recovered
            // toggle remains possible. Only clear when there is no completed execution.
            const hasCompletedRecovery =
              execRes &&
              (execRes.status === 'COMPLETED' || execRes.status === 'PARTIALLY_COMPLETED');
            const hasStoredPlan = Boolean(getSelectedRecoveryPlanWithMeta(tripId));
            if (!hasCompletedRecovery && !hasStoredPlan) {
              clearSelectedRecoveryPlan(tripId);
              setSelectedRecoveryPlanState(null);
              setIsSelectedPlanUpdated(false);
              setShowSelectedPlanReviewModal(false);
              setRecoveryAnalysisResult(null);
            } else if (hasStoredPlan) {
              const storedMeta = getSelectedRecoveryPlanWithMeta(tripId);
              if (storedMeta) {
                setSelectedRecoveryPlanState(storedMeta.plan);
                setIsSelectedPlanUpdated(storedMeta.isUpdated);
              }
            }
          } else {
            // Active disruptions exist — run successor matching on fingerprint change
            const storedMeta = getSelectedRecoveryPlanWithMeta(tripId);
            if (storedMeta) {
              if (storedMeta.disruptionFingerprint === newFp) {
                setSelectedRecoveryPlanState(storedMeta.plan);
                setIsSelectedPlanUpdated(storedMeta.isUpdated);
              } else {
                activeFetchFpRef.current = newFp;

                try {
                  const res = await analyzePart4Recovery(tripId);
                  if (activeFetchFpRef.current !== newFp) return;

                  setRecoveryAnalysisResult(res);

                  const currentFeasiblePlans = res?.plans ?? [];
                  const successor = findSuccessorPlan(storedMeta.plan, currentFeasiblePlans);

                  if (successor) {
                    saveSelectedRecoveryPlan(tripId, successor, newFp, true);
                    setSelectedRecoveryPlanState(successor);
                    setIsSelectedPlanUpdated(true);
                  } else {
                    clearSelectedRecoveryPlan(tripId);
                    setSelectedRecoveryPlanState(null);
                    setIsSelectedPlanUpdated(false);
                    setShowSelectedPlanReviewModal(false);
                  }
                } catch (err) {
                  console.error('Failed to run successor matching on disruption change:', err);
                  clearSelectedRecoveryPlan(tripId);
                  setSelectedRecoveryPlanState(null);
                  setIsSelectedPlanUpdated(false);
                }
              }
            } else {
              setSelectedRecoveryPlanState(null);
              setIsSelectedPlanUpdated(false);
            }
          }
        } catch (err) {
          console.error('Failed to fetch impact analysis:', err);
        }
      } catch (err) {
        console.error('Failed to poll active disruptions on HomeScreen:', err);
      }
    };

    // Initial check on mount
    checkDisruptions();

    // Poll every 2 seconds for real-time updates without hard refresh
    const interval = setInterval(checkDisruptions, 2000);

    // Re-check instantly when tab regains focus or storage changes
    window.addEventListener('focus', checkDisruptions);
    window.addEventListener('storage', checkDisruptions);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkDisruptions);
      window.removeEventListener('storage', checkDisruptions);
    };
  }, [journey?.id]);

  // Hydrate view mode from backend demo_restored flag after executions load
  useEffect(() => {
    if (!latestExecution || latestExecution.status === 'NOT_FOUND') return;
    if (latestExecution.demo_restored) {
      if (viewMode !== 'ORIGINAL' && journey?.id) {
        notifyViewModeChanged(journey.id, 'ORIGINAL');
      }
    } else if (
      latestExecution.status === 'COMPLETED' ||
      latestExecution.status === 'PARTIALLY_COMPLETED'
    ) {
      if (viewMode !== 'RECOVERED' && journey?.id) {
        notifyViewModeChanged(journey.id, 'RECOVERED');
      }
    }
  }, [latestExecution?.execution_id, latestExecution?.demo_restored, latestExecution?.status]);

  const handleDismissToast = () => {
    setShowToast(false);
    if (activeDisruption && journey?.id) {
      const activeId = String(activeDisruption.id || activeDisruption.timestamp || activeDisruption.detected_at);
      localStorage.setItem(`travora_last_seen_disruption_${journey.id}`, activeId);
    }
  };

  const handleUpdatePriority = async (nodeId: string, newPriority: TravelerPriority) => {
    if (!journey) return;

    // Update in memory & storage
    const updatedNodes = journey.nodes.map((n) =>
      n.id === nodeId ? { ...n, priority: newPriority } : n
    );
    const updatedJourney: Journey = { ...journey, nodes: updatedNodes };
    saveLocalJourney(updatedJourney);

    // Persist to backend if persisted node exists
    const targetNode = journey.nodes.find((n) => n.id === nodeId);
    if (journey.id && targetNode && targetNode.backendId) {
      try {
        await updateItemOnBackend(journey.id, targetNode.backendId, {
          ...targetNode,
          priority: newPriority,
        });
      } catch (err) {
        console.error('Failed to update priority on backend:', err);
      }
    }

    // Refresh journey
    await refresh();
  };

  const handleConfirmRestoreOriginal = async () => {
    if (!journey?.id) return;
    
    // Switch the global view mode
    notifyViewModeChanged(journey.id, 'ORIGINAL');
    
    setShowSelectedPlanReviewModal(false);
    setShowPart5HandoffModal(false);
    setShowRecoveryModal(false);
    setShowRestoreModal(false);

    setToastNotification('Showing Original journey plan.');
    setTimeout(() => setToastNotification(null), 4000);
  };

  const handleToggleBackToRecovered = async () => {
    if (!journey?.id) return;
    
    // Switch the global view mode back
    notifyViewModeChanged(journey.id, 'RECOVERED');

    setToastNotification('Switched back to Recovered Journey plan.');
    setTimeout(() => setToastNotification(null), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center">
        <div className="relative">
          <div className="h-12 w-12 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500" />
          <div className="absolute inset-2 flex items-center justify-center">
            <Plane className="h-4 w-4 text-sky-500" style={{ transform: 'rotate(-30deg)' }} />
          </div>
        </div>
        <p className="mt-4 text-xs font-semibold text-slate-500">Loading your travel route...</p>
      </div>
    );
  }

  // Find node affected by active disruption
  const affectedNode = journey?.nodes.find((n) => {
    if (!activeDisruption) return false;
    const targetId = String(activeDisruption.entity_id || activeDisruption.affected_node_id || '');
    return n.id === targetId || String(n.backendId) === targetId;
  });

  // Scope disruption alerts to the currently viewed journey (hide REPLACED-only noise)
  const visibleJourneyNodes = (journey?.nodes || []).filter((n) => {
    if (n.status === 'CANCELLED') return false;
    if (viewMode === 'ORIGINAL') {
      if (n.status === 'RESTORED_DEMO') return false;
      if (n.metadata?.recovery_execution_id || n.metadata?.replaced_item_id || n.metadata?.is_replacement) {
        return false;
      }
      return true;
    }
    if (n.status === 'REPLACED' || n.status === 'RESTORED_DEMO') return false;
    return true;
  });
  const visibleJourneyIds = new Set(
    visibleJourneyNodes.flatMap((n) => [String(n.id), String(n.backendId ?? '')].filter(Boolean))
  );
  const scopedImpactResult = scopeImpactToNodeIds(impactResult, visibleJourneyIds);

  const affectedNodeVisible =
    affectedNode &&
    (visibleJourneyIds.has(String(affectedNode.id)) ||
      visibleJourneyIds.has(String(affectedNode.backendId ?? '')));

  const noticeText =
    activeDisruption && affectedNodeVisible
      ? getDisruptionNoticeText(activeDisruption, affectedNode)
      : activeDisruption && !affectedNodeVisible
        ? ''
        : activeDisruption
          ? getDisruptionNoticeText(activeDisruption, affectedNode)
          : '';
  const detectedTimeStr = activeDisruption ? fmtDisplayTime(activeDisruption.timestamp || activeDisruption.detected_at) : '';

  // Build impactNodeMap for Route Map rendering
  const impactNodeMap: Record<string, { status: ImpactNodeStatus; reason: string }> = {};
  if (impactResult?.nodes) {
    for (const nodeImp of impactResult.nodes) {
      if (nodeImp.node_id) {
        impactNodeMap[nodeImp.node_id] = { status: nodeImp.status, reason: nodeImp.reason };
      }
      if (nodeImp.item_id) {
        impactNodeMap[String(nodeImp.item_id)] = { status: nodeImp.status, reason: nodeImp.reason };
      }
    }
  }


  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 pb-20">
      {/* App Floating Header Bar */}
      <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
              <Compass className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-sky-600 to-indigo-600 bg-clip-text text-transparent">
              Travora
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refresh()}
              title="Refresh from server"
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <Link
              to="/admin"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Admin Console</span>
            </Link>


            <button
              onClick={() => {
                clearActive();
                navigate('/build');
              }}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Journey</span>
            </button>
          </div>
        </div>
      </header>

      {/* DISRUPTION TOAST NOTIFICATION BANNER (Unacknowledged) */}
      {showToast && activeDisruption && affectedNodeVisible && noticeText && (
        <div className="bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xl px-4 py-3 sticky top-16 z-20 transition-all animate-in fade-in slide-in-from-top-2">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4 w-4 text-white animate-bounce" />
              </div>
              <div>
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-100 flex items-center gap-1.5">
                  <span>🔴 Travel Disruption Alert</span>
                  {detectedTimeStr && <span>· {detectedTimeStr}</span>}
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {noticeText}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowImpactModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5"
              >
                <Activity className="h-3.5 w-3.5" />
                <span>View Impact</span>
              </button>
              <button
                onClick={handleDismissToast}
                title="Acknowledge notification"
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Command Center Body */}
      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {!journey ? (
          /* Empty state */
          <div className="max-w-md mx-auto my-16 text-center p-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/30">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 flex items-center justify-center mx-auto mb-4">
              <Compass className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Active Journey</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              You haven't created a trip yet. Start building your horizontal route rail now.
            </p>
            <button
              onClick={() => navigate('/build')}
              className="mt-6 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-md shadow-sky-500/20"
            >
              Create Your First Journey
            </button>
          </div>
        ) : (
          /* Active Journey Command Center */
          <div className="space-y-6">
            {/* Greeting Header */}
            <div className="px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Good morning, Traveler</span>
              </span>
            </div>

            {/* PERSISTENT DISRUPTION ALERT CARD */}
            {activeDisruption && (() => {
              const journeyStatus = getJourneyStatus(scopedImpactResult);
              const jDisplay = getJourneyStatusDisplay(journeyStatus);
              const buckets = getImpactSummaryBuckets(scopedImpactResult);

              if (selectedRecoveryPlan) {
                return (
                  <div className="bg-gradient-to-r from-amber-500/10 via-amber-50/50 to-orange-50/50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-800/80 rounded-3xl p-5 shadow-lg shadow-amber-500/5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/20 mt-0.5">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                              {isSelectedPlanUpdated ? '🟠 RECOVERY PLAN UPDATED' : '🟠 RECOVERY PLAN SELECTED'}
                            </span>
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                              {selectedRecoveryPlan.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                            {isSelectedPlanUpdated
                              ? 'Your recovery plan has been updated after a new disruption.'
                              : 'A recovery plan is ready to restore your journey.'}{' '}
                            {selectedRecoveryPlan.changed_node_ids.length} booking{selectedRecoveryPlan.changed_node_ids.length === 1 ? '' : 's'} will be replaced · {selectedRecoveryPlan.preserved_node_ids.length} remain unchanged.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                        <button
                          onClick={() => setShowPart5HandoffModal(true)}
                          className="px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Continue to Booking</span>
                        </button>
                        <button
                          onClick={() => setShowSelectedPlanReviewModal(true)}
                          className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>{isSelectedPlanUpdated ? 'Review Updated Plan' : 'Review Plan'}</span>
                        </button>
                        <button
                          onClick={() => setShowRecoveryModal(true)}
                          className="px-3.5 py-2 rounded-2xl bg-amber-100/80 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-200 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Change Plan</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-5 shadow-lg shadow-rose-500/5 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className="h-10 w-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-500/20 mt-0.5">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Primary: journey-level status */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                            {jDisplay.headline}
                          </span>
                          {detectedTimeStr && (
                            <span className="text-[10px] font-semibold text-rose-500/80 dark:text-rose-400/80">
                              · Detected {detectedTimeStr}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                          {jDisplay.description}
                        </p>
                        {/* Bucket summary */}
                        {buckets.total > 0 && (
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
                            {buckets.needs_recovery > 0 && (
                              <span className="text-rose-700 dark:text-rose-300">
                                🔴 {buckets.needs_recovery} require{buckets.needs_recovery === 1 ? 's' : ''} recovery
                              </span>
                            )}
                            {buckets.at_risk > 0 && (
                              <span className="text-amber-700 dark:text-amber-300">
                                🟡 {buckets.at_risk} at risk
                              </span>
                            )}
                            {buckets.unchanged > 0 && (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                🟢 {buckets.unchanged} unchanged
                              </span>
                            )}
                          </div>
                        )}
                        {/* Secondary: specific booking notice */}
                        {noticeText && (
                          <p className="mt-2 text-[11px] font-semibold text-rose-600/80 dark:text-rose-400/80 leading-relaxed">
                            {noticeText}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                      <button
                        onClick={() => setShowImpactModal(true)}
                        className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                      >
                        <Activity className="h-4 w-4" />
                        <span>View Impact</span>
                      </button>
                      {journeyStatus === 'DISRUPTED' && (
                        <button
                          onClick={() => setShowRecoveryModal(true)}
                          className="px-4 py-2 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md shadow-rose-600/20 flex items-center gap-1.5"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Find Recovery Options</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* RECOVERED JOURNEY BANNER CARD */}
            {!activeDisruption && impactResult?.journey_status === 'RECOVERED' && (
              <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-3xl p-5 shadow-lg shadow-emerald-500/5 transition-all animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 mt-0.5">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                        <span>🟢 JOURNEY RECOVERED</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                        Your replacement bookings are confirmed. No active disruptions remain.
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* RECOVERY PLAN SUMMARY CARD (Requirement 9 & 10) */}
            {selectedRecoveryPlan && (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 border border-amber-300 dark:border-amber-800 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span>{isSelectedPlanUpdated ? '🟠 UPDATED PROPOSED RECOVERY PLAN' : '🟠 SELECTED PROPOSED RECOVERY PLAN'}</span>
                  </span>
                  <button
                    onClick={() => setShowRecoveryModal(true)}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Change Plan</span>
                  </button>
                </div>

                {isSelectedPlanUpdated && (
                  <div className="p-3 rounded-2xl bg-amber-100/70 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Your recovery plan has been updated after a new disruption.</span>
                  </div>
                )}

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">
                      {selectedRecoveryPlan.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                      <span>{selectedRecoveryPlan.changed_node_ids.length} replacements proposed</span>
                      <span>·</span>
                      <span>{selectedRecoveryPlan.preserved_node_ids.length} bookings kept unchanged</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Est. Addl Cost</span>
                      <span className="text-sky-600 dark:text-sky-400 font-extrabold text-sm">
                        {selectedRecoveryPlan.estimated_additional_cost !== null && selectedRecoveryPlan.estimated_additional_cost !== undefined
                          ? `₹${selectedRecoveryPlan.estimated_additional_cost.toLocaleString()}`
                          : 'PARTIAL'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Est. Refund</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        {selectedRecoveryPlan.estimated_refund !== null && selectedRecoveryPlan.estimated_refund !== undefined
                          ? `₹${selectedRecoveryPlan.estimated_refund.toLocaleString()}`
                          : 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowSelectedPlanReviewModal(true)}
                        className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5 shrink-0"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>{isSelectedPlanUpdated ? 'Review Updated Plan' : 'Review Recovery Plan'}</span>
                      </button>
                      <button
                        onClick={() => setShowRecoveryModal(true)}
                        className="px-3.5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Change Plan</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STATE D: NO FEASIBLE RECOVERY CARD (Requirement 8 & 9D) */}
            {activeDisruption && !selectedRecoveryPlan && (recoveryAnalysisResult?.status === 'NO_FEASIBLE_RECOVERY' || (impactResult && impactResult.nodes && impactResult.nodes.some(n => n.status === 'BROKEN' && n.priority === 'MUST_PRESERVE') && recoveryAnalysisResult?.plans?.length === 0)) && (
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl p-5 shadow-lg space-y-3 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-2xl bg-slate-400 text-white flex items-center justify-center shrink-0 shadow-md mt-0.5">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          ⚪ RECOVERY REVIEWED
                        </span>
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          NO FEASIBLE RECOVERY
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                        No feasible recovery plan found. A critical journey requirement can no longer be preserved with the available recovery options. Unaffected bookings remain unchanged.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start shrink-0">
                    <button
                      onClick={() => setShowImpactModal(true)}
                      className="px-4 py-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 shadow-sm"
                    >
                      View Impact
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HERO HORIZONTAL JOURNEY ROUTE RAIL (With Impact Status Badges) */}
            <Part1JourneyView
              journey={journey}
              viewMode={viewMode}
              impactNodeMap={impactNodeMap}
              impactResult={impactResult}
              selectedRecoveryPlan={selectedRecoveryPlan}
              hasRestoreAvailable={Boolean(
                (latestExecution && (latestExecution.status === 'COMPLETED' || latestExecution.status === 'PARTIALLY_COMPLETED')) ||
                journey?.nodes.some((n) => n.status === 'REPLACED') ||
                Boolean(journey?.id && localStorage.getItem(`travora_has_recovered_${journey.id}`))
              )}
              onRestoreOriginalJourney={() => setShowRestoreModal(true)}
              onToggleBackToRecovered={handleToggleBackToRecovered}
              onUpdatePriority={handleUpdatePriority}
              onEditDraft={() => navigate('/build', { state: { mode: 'edit' } })}
              onResetJourney={() => {
                if (window.confirm('Are you sure you want to clear your active journey?')) {
                  clearActive();
                }
              }}
            />
          </div>
        )}
      </main>

      {/* RESTORE ORIGINAL JOURNEY DEMO MODAL */}
      {showRestoreModal && journey?.id && (() => {
        const { replacementItem, originalItem } = resolveRestoreComparison(journey, latestExecution);
        return (
          <RestoreJourneyModal
            isOpen={showRestoreModal}
            onClose={() => setShowRestoreModal(false)}
            onConfirmRestore={handleConfirmRestoreOriginal}
            replacementItem={replacementItem}
            originalItem={originalItem}
          />
        );
      })()}

      {/* DEMO TOAST NOTIFICATION */}
      {toastNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastNotification}</span>
        </div>
      )}

      {/* TRAVEL IMPACT ANALYSIS MODAL */}
      {showImpactModal && activeDisruption && (() => {
        // Impact modal uses full engine result (includes disrupted originals)
        const journeyStatus = getJourneyStatus(impactResult);
        const jDisplay = getJourneyStatusDisplay(journeyStatus);
        const buckets = getImpactSummaryBuckets(impactResult);
        const attentionNodes = impactResult?.nodes?.filter((n) => n.status !== 'INTACT') || [];
        const intactNodes = impactResult?.nodes?.filter((n) => n.status === 'INTACT') || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-2xl bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">Travel Impact Analysis</h3>
                    <span className="text-[11px] font-semibold text-slate-500">Part 3 · Impact Engine</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowImpactModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* ── JOURNEY STATUS HEADLINE (primary message) ── */}
              <div className={`rounded-2xl border p-4 ${jDisplay.bannerStyle}`}>
                <div className={`text-sm font-extrabold tracking-tight mb-1 ${jDisplay.headlineStyle}`}>
                  {jDisplay.headline}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {jDisplay.description}
                </p>

                {/* Three-bucket summary */}
                {buckets.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-bold">
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

              {/* WHAT NEEDS ATTENTION SECTION */}
              {attentionNodes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 block px-1">
                    What Needs Attention ({attentionNodes.length})
                  </span>
                  <div className="space-y-2">
                    {attentionNodes.map((n) => (
                      <div
                        key={n.node_id}
                        className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{n.title}</span>
                            {n.priority && (
                              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {n.priority}
                              </span>
                            )}
                          </div>
                          {renderStatusBadge(n.status)}
                        </div>
                        <p className="text-xs font-semibold text-rose-800 dark:text-rose-200 leading-relaxed">
                          "{n.reason}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WHAT REMAINS UNCHANGED SECTION */}
              {intactNodes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block px-1">
                    Booking Remains Active ({intactNodes.length})
                  </span>
                  <div className="space-y-1.5">
                    {intactNodes.map((n) => (
                      <div
                        key={n.node_id}
                        className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          <div>
                            <span className="font-bold text-xs text-slate-800 dark:text-white block">{n.title}</span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                              {n.reason || 'No current impact identified for this booking.'}
                            </span>
                          </div>
                        </div>
                        {renderStatusBadge(n.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informational Notice */}
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <strong className="text-sky-700 dark:text-sky-300 block mb-0.5 font-bold">Travora Impact Analysis Complete</strong>
                  Given what happened, Travora identified what is affected, what remains safe, and why.
                  {journeyStatus === 'DISRUPTED' && ' Recovery options will be generated in Part 4.'}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                {journeyStatus === 'DISRUPTED' && (
                  <button
                    onClick={() => {
                      setShowImpactModal(false);
                      setShowRecoveryModal(true);
                    }}
                    className="w-full sm:w-auto flex-1 py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Find Recovery Options</span>
                  </button>
                )}
                <button
                  onClick={() => setShowImpactModal(false)}
                  className="w-full sm:w-auto py-3 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close Impact Analysis
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* DEDICATED SELECTED RECOVERY PLAN REVIEW MODAL */}
      {showSelectedPlanReviewModal && selectedRecoveryPlan && (
        <SelectedRecoveryPlanReview
          plan={selectedRecoveryPlan}
          isUpdated={isSelectedPlanUpdated}
          onClose={() => setShowSelectedPlanReviewModal(false)}
          onChangePlan={() => {
            setShowSelectedPlanReviewModal(false);
            setShowRecoveryModal(true);
          }}
          onContinueToBooking={() => {
            setShowSelectedPlanReviewModal(false);
            setShowPart5HandoffModal(true);
          }}
        />
      )}

      {/* PART 4 RECOVERY ENGINE MODAL (Recovery Options / Change Plan) */}
      {showRecoveryModal && journey?.id && (
        <RecoveryPlanView
          tripId={journey.id}
          currentDisruptionFingerprint={currentDisruptionFingerprint}
          onClose={() => setShowRecoveryModal(false)}
          onPlanSelected={(plan) => {
            saveSelectedRecoveryPlan(journey.id as number, plan, currentDisruptionFingerprint || "", false);
            setSelectedRecoveryPlanState(plan);
            setIsSelectedPlanUpdated(false);
            setShowRecoveryModal(false);
            setShowSelectedPlanReviewModal(true);
          }}
          onViewImpact={() => {
            setShowRecoveryModal(false);
            setShowImpactModal(true);
          }}
        />
      )}

      {/* PART 5 BOOKING & EXECUTION MODAL */}
      {showPart5HandoffModal && selectedRecoveryPlan && journey?.id && (
        <Part5BookingExecutionView
          tripId={journey.id}
          selectedPlan={selectedRecoveryPlan}
          disruptionFingerprint={currentDisruptionFingerprint}
          onClose={() => setShowPart5HandoffModal(false)}
          onReturnToRecovery={() => {
            setShowPart5HandoffModal(false);
            setShowRecoveryModal(true);
          }}
          onExecutionCompleted={async (result) => {
            if (result.status === 'COMPLETED') {
              // Clear selected recovery plan since journey is fully recovered
              clearSelectedRecoveryPlan(journey.id!);
              setSelectedRecoveryPlanState(null);
            }
            // Refresh journey from backend source of truth
            await refresh();
            const exec = await getLatestExecution(journey.id!);
            setLatestExecution(exec);
          }}
        />
      )}
    </div>
  );
}
