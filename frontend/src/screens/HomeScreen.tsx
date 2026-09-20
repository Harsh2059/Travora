import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Compass,
  PlusCircle,
  RefreshCw,
  Layout,
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
import { useJourney, fetchTripDisruptions, fetchTripImpact, updateItemOnBackend, saveLocalJourney, getSelectedRecoveryPlan, clearSelectedRecoveryPlan } from '../store/journeyStore';
import { Part1JourneyView } from '../components/Part1JourneyView';
import { RecoveryPlanView } from '../components/recovery/RecoveryPlanView';
import type { Journey, ImpactResult, ImpactNodeStatus, TravelerPriority, Part4RecoveryPlan } from '../types';
import {
  getJourneyStatus,
  getJourneyStatusDisplay,
  getImpactSummaryBuckets,
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
  const title = node?.title || 'Booking';
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


  const [selectedRecoveryPlan, setSelectedRecoveryPlanState] = useState<Part4RecoveryPlan | null>(null);

  // Real-time polling & focus/storage listeners for disruption events & impact engine
  useEffect(() => {
    const tripId = journey?.id;
    if (!tripId) {
      setActiveDisruption(null);
      setImpactResult(null);
      setShowToast(false);
      setSelectedRecoveryPlanState(null);
      return;
    }

    const checkDisruptions = () => {
      // Sync selected recovery plan for tripId
      const storedPlan = getSelectedRecoveryPlan(tripId);
      setSelectedRecoveryPlanState(storedPlan);

      fetchTripDisruptions(tripId)
        .then((history) => {
          if (history && history.length > 0) {
            const latest = history[0];
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

            // Fetch impact analysis from Part 3 Impact Engine
            fetchTripImpact(tripId)
              .then((impact) => setImpactResult(impact))
              .catch((err) => console.error('Failed to fetch impact analysis:', err));

          } else {
            // Disruption reset
            setActiveDisruption(null);
            setImpactResult(null);
            setShowToast(false);
            clearSelectedRecoveryPlan(tripId);
            setSelectedRecoveryPlanState(null);
          }
        })
        .catch((err) => console.error('Failed to poll active disruptions on HomeScreen:', err));
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

  const noticeText = activeDisruption ? getDisruptionNoticeText(activeDisruption, affectedNode) : '';
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
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200 dark:border-amber-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Admin Console</span>
            </Link>

            <Link
              to="/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Layout className="h-3.5 w-3.5 text-sky-500" />
              <span>Phase 2 Demo</span>
            </Link>

            <button
              onClick={() => navigate('/build')}
              className="text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 transition-all flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>New Journey</span>
            </button>
          </div>
        </div>
      </header>

      {/* DISRUPTION TOAST NOTIFICATION BANNER (Unacknowledged) */}
      {showToast && activeDisruption && (
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
              const journeyStatus = getJourneyStatus(impactResult);
              const jDisplay = getJourneyStatusDisplay(journeyStatus);
              const buckets = getImpactSummaryBuckets(impactResult);

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
                              🟠 RECOVERY PLAN SELECTED
                            </span>
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200">
                              {selectedRecoveryPlan.title}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                            A recovery plan is ready to restore your journey. {selectedRecoveryPlan.changed_node_ids.length} booking{selectedRecoveryPlan.changed_node_ids.length === 1 ? '' : 's'} will be replaced · {selectedRecoveryPlan.preserved_node_ids.length} remain unchanged.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
                        <button
                          onClick={() => setShowRecoveryModal(true)}
                          className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          <span>Review Recovery</span>
                        </button>
                        <button
                          onClick={() => setShowImpactModal(true)}
                          className="px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 font-bold text-xs transition-all shadow-sm flex items-center gap-1.5"
                        >
                          <Activity className="h-4 w-4" />
                          <span>View Impact</span>
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

            {/* RECOVERY PLAN SUMMARY CARD (Requirement 9) */}
            {selectedRecoveryPlan && (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 border border-amber-300 dark:border-amber-800 shadow-md space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-amber-500" />
                    <span>🟠 Selected Proposed Recovery Plan</span>
                  </span>
                  <button
                    onClick={() => setShowRecoveryModal(true)}
                    className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>Change Plan</span>
                  </button>
                </div>

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

                  <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Est. Addl Cost</span>
                      <span className="text-sky-600 dark:text-sky-400 font-extrabold text-sm">
                        ₹{selectedRecoveryPlan.estimated_additional_cost.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Est. Refund</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                        ₹{selectedRecoveryPlan.estimated_refund.toLocaleString()}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowRecoveryModal(true)}
                      className="px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs transition-all shadow-md shadow-sky-500/20 flex items-center gap-1.5 shrink-0"
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Review Recovery Plan</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* HERO HORIZONTAL JOURNEY ROUTE RAIL (With Impact Status Badges) */}
            <Part1JourneyView
              journey={journey}
              impactNodeMap={impactNodeMap}
              impactResult={impactResult}
              selectedRecoveryPlan={selectedRecoveryPlan}
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

      {/* TRAVEL IMPACT ANALYSIS MODAL */}
      {showImpactModal && activeDisruption && (() => {
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

      {/* PART 4 RECOVERY ENGINE MODAL */}
      {showRecoveryModal && journey?.id && (
        <RecoveryPlanView
          tripId={journey.id}
          onClose={() => setShowRecoveryModal(false)}
        />
      )}
    </div>
  );
}
