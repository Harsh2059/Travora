import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Briefcase,
  Phone,
  Bell,
  Menu,
  Compass,
  PlusCircle,
  RefreshCw,
  Plane,
  Zap,
  AlertTriangle,
  X,
  CheckCircle2,
  ShieldCheck,
  Activity,
  AlertCircle,
  User,
} from 'lucide-react';
import { useJourney, fetchTripDisruptions, fetchTripImpact, updateItemOnBackend, saveLocalJourney, getSelectedRecoveryPlanWithMeta, clearSelectedRecoveryPlan, saveSelectedRecoveryPlan } from '../store/journeyStore';
import { analyzePart4Recovery, getLatestExecution } from '../services/recoveryApi';
import { getStoredUser } from '../services/auth';
import type { UserProfile } from '../services/auth';
import { AuthModal } from '../components/AuthModal';
import { ProfileModal } from '../components/ProfileModal';
import {
  notifyViewModeChanged,
  getPersistedViewMode,
  subscribeToViewMode
} from '../store/tripSync';
import { findSuccessorPlan } from '../utils/successorMatcher';
import { Part1JourneyView } from '../components/Part1JourneyView';
import { CurrentJourneyHeader } from '../components/CurrentJourneyHeader';
import { DisruptionImpactCard } from '../components/DisruptionImpactCard';
import { RecoveryOptionsPanel } from '../components/recovery/RecoveryOptionsPanel';
import { UpdatedItineraryPreview } from '../components/recovery/UpdatedItineraryPreview';
import { UpcomingTripDetails } from '../components/UpcomingTripDetails';
import { RecoveryPlanView } from '../components/recovery/RecoveryPlanView';
import { SelectedRecoveryPlanReview } from '../components/recovery/SelectedRecoveryPlanReview';
import { Part5BookingExecutionView } from '../components/recovery/Part5BookingExecutionView';
import { RestoreJourneyModal } from '../components/recovery/RestoreJourneyModal';
import type { Journey, ImpactResult, ImpactNodeStatus, TravelerPriority, Part4RecoveryPlan } from '../types';
import {
  getJourneyStatus,
  getJourneyStatusDisplay,
  getImpactSummaryBuckets,
  scopeImpactToNodeIds,
} from '../utils/impactUtils';

/** Prefer clean airline/provider label over long composed titles. */
function displayProviderLabel(
  provider?: string | null,
  title?: string | null,
  fallback = 'Booking'
): string {
  const raw = (provider || title || '').trim();
  if (!raw) return fallback;
  // Strip " (routeÃ¢â‚¬Â¦)" / " (Repl. for Ã¢â‚¬Â¦)" suffixes from composed titles
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
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-sm">Ã°Å¸â€Â´ BROKEN</span>;
  }
  if (status === 'NEEDS_CHANGE') {
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-orange-500 text-white shadow-sm">Ã°Å¸Å¸Â  NEEDS CHANGE</span>;
  }
  if (status === 'AT_RISK') {
    return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500 text-white shadow-sm">Ã°Å¸Å¸Â¡ AT RISK</span>;
  }
  return <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">Ã°Å¸Å¸Â¢ INTACT</span>;
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const { journey, loading, refresh, clearActive } = useJourney();

  const [activeDisruption, setActiveDisruption] = useState<any | null>(null);
  const [impactResult, setImpactResult] = useState<ImpactResult | null>(null);
  const [showImpactModal, setShowImpactModal] = useState<boolean>(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [showSelectedPlanReviewModal, setShowSelectedPlanReviewModal] = useState<boolean>(false);
  const [showPart5HandoffModal, setShowPart5HandoffModal] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  const [selectedRecoveryPlan, setSelectedRecoveryPlanState] = useState<Part4RecoveryPlan | null>(null);
  const [isSelectedPlanUpdated, setIsSelectedPlanUpdated] = useState<boolean>(false);

  // Auth & Profile state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getStoredUser());
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, []);

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
              }
            }
            return latest;
          });
        } else {
          setActiveDisruption(null);
        }

        // Always fetch impact analysis from Part 3 Impact Engine to keep UI state in sync
        try {
          const impact = await fetchTripImpact(tripId);
          setImpactResult(impact);

          const newFp: string = impact?.disruption_fingerprint ?? '';
          setCurrentDisruptionFingerprint(newFp);

          if (activeDisruptions.length === 0) {
            // After successful recovery, keep the selected plan so OriginalÃ¢â€ â€Recovered
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
            } else if (hasStoredPlan) {
              const storedMeta = getSelectedRecoveryPlanWithMeta(tripId);
              if (storedMeta) {
                setSelectedRecoveryPlanState(storedMeta.plan);
                setIsSelectedPlanUpdated(storedMeta.isUpdated);
              }
            }
          } else {
            // Active disruptions exist Ã¢â‚¬â€ run successor matching on fingerprint change
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

  // We no longer need noticeText and detectedTimeStr as they are in DisruptionImpactCard

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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar Overlay (Mobile/when opened) */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-full text-white">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-900 flex items-center gap-1">
                Travora
              </h1>
              <p className="text-[9px] font-bold text-slate-500 tracking-widest mt-0.5">TRAVEL INTELLIGENCE</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="px-4 py-2 mt-4">
          <p className="text-[10px] font-bold text-slate-400 mb-4 px-2 tracking-wider">WORKSPACE</p>
          <nav className="space-y-1">
            <div className="flex items-center gap-3 bg-blue-600 text-white px-3 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-blue-600/20 cursor-pointer" onClick={() => setIsSidebarOpen(false)}>
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </div>
            <div className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors cursor-not-allowed opacity-50">
              <Briefcase className="w-4 h-4" />
              My Journeys
            </div>
            <div className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm justify-between transition-colors cursor-not-allowed opacity-50">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4" />
                Alerts & Live Feed
              </div>
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            </div>
            <div className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors cursor-not-allowed opacity-50">
              <Settings className="w-4 h-4" />
              Travel Settings
            </div>
          </nav>
        </div>

        <div className="mt-auto p-4 mb-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Live Sync Active
              </div>
              <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
              WhatsApp & SMS dispatch channel connected to live carrier feeds.
            </p>
            <button onClick={() => { if (journey?.id) setShowRecoveryModal(true); }} className="w-full py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-[13px] font-bold text-blue-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
              <Phone className="w-4 h-4" />
              Emergency Hotline
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#FAFAFA]">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
              <div className="bg-blue-600 p-1.5 rounded-full text-white">
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-blue-600 font-bold text-lg hidden sm:block">Travora</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={() => refresh()}
              title="Refresh from server"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <Link
              to="/admin"
              className="text-[13px] font-bold px-4 py-1.5 rounded-full bg-[#FFEDD5] text-[#C2410C] hover:bg-[#FED7AA] transition-colors flex items-center gap-2"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin Console</span>
            </Link>

            <button
              onClick={() => {
                clearActive();
                navigate('/build');
              }}
              className="text-[13px] font-bold px-4 py-1.5 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Journey</span>
            </button>
            
            {currentUser ? (
              <div
                onClick={() => setIsProfileModalOpen(true)}
                className="hidden sm:flex items-center gap-3 border-l border-slate-200 pl-6 group cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="text-right">
                  <p className="text-[13px] font-bold text-slate-900">{currentUser.name || 'Traveler'}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {currentUser.whatsapp_phone || currentUser.email}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-sm ring-2 ring-white ring-offset-1">
                  <span className="text-sm font-bold">{(currentUser.name || 'T')[0].toUpperCase()}</span>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto relative">
          <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-6">
        {!journey ? (
          /* Empty state */
          <div className="max-w-md mx-auto my-16 text-center p-8 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/30">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-500 flex items-center justify-center mx-auto mb-4">
              <Compass className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">No Active Journey</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              You haven't created a trip yet. Start building your journey now.
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
            <CurrentJourneyHeader journey={journey} syncActive={true} />
            
            <DisruptionImpactCard
              journey={journey}
              activeDisruption={activeDisruption}
              scopedImpactResult={scopedImpactResult}
              selectedRecoveryPlan={selectedRecoveryPlan}
              isSelectedPlanUpdated={isSelectedPlanUpdated}
              onViewImpact={() => setShowImpactModal(true)}
              onFindRecovery={() => setShowRecoveryModal(true)}
              onChangePlan={() => setShowRecoveryModal(true)}
              onReviewPlan={() => setShowSelectedPlanReviewModal(true)}
              onContinueToBooking={() => setShowPart5HandoffModal(true)}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 xl:col-span-7 space-y-6">
                <Part1JourneyView
                  journey={journey}
                  viewMode={viewMode}
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
              <div className="lg:col-span-5 xl:col-span-5 w-full space-y-6">
                {activeDisruption ? (
                  <>
                    <RecoveryOptionsPanel
                      tripId={journey.id!}
                      journey={journey}
                      impactResult={impactResult}
                      currentDisruptionFingerprint={currentDisruptionFingerprint}
                      selectedRecoveryPlan={selectedRecoveryPlan}
                      onPlanSelected={(plan) => {
                        saveSelectedRecoveryPlan(journey.id as number, plan, currentDisruptionFingerprint || "", false);
                        setSelectedRecoveryPlanState(plan);
                        setIsSelectedPlanUpdated(false);
                      }}
                    />

                    {selectedRecoveryPlan && (
                      <UpdatedItineraryPreview
                        journey={journey}
                        plan={selectedRecoveryPlan}
                        impactResult={impactResult}
                        disruptionFingerprint={currentDisruptionFingerprint}
                        onConfirmSuccess={async () => {
                          setToastNotification('🟢 Journey Updated: Your recovery plan has been applied.');
                          setTimeout(() => setToastNotification(null), 5000);
                          setSelectedRecoveryPlanState(null);
                          setIsSelectedPlanUpdated(false);
                          setShowSelectedPlanReviewModal(false);
                          setShowPart5HandoffModal(false);
                          setShowRecoveryModal(false);
                          if (journey.id) {
                            notifyViewModeChanged(journey.id, 'RECOVERED');
                          }
                          await refresh();
                          if (journey.id) {
                            const exec = await getLatestExecution(journey.id);
                            setLatestExecution(exec);
                          }
                        }}
                        onChangeOption={() => {
                          clearSelectedRecoveryPlan(journey.id as number);
                          setSelectedRecoveryPlanState(null);
                          setIsSelectedPlanUpdated(false);
                        }}
                      />
                    )}
                  </>
                ) : (
                  <UpcomingTripDetails journey={journey} />
                )}
              </div>
            </div>
          </div>
        )}
          </div>
        </div>
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
                    <span className="text-[11px] font-semibold text-slate-500">Part 3 Ã‚Â· Impact Engine</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowImpactModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Ã¢â€â‚¬Ã¢â€â‚¬ JOURNEY STATUS HEADLINE (primary message) Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
            await refresh();
            const exec = await getLatestExecution(journey.id!);
            setLatestExecution(exec);
          }}
        />
      )}

      {/* MULTI-USER AUTH & PROFILE MODALS */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setCurrentUser(getStoredUser())}
      />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={(u) => setCurrentUser(u)}
      />
    </div>
  );
}
