import { useState, useEffect } from 'react';
import axios from 'axios';
import type {
  Trip,
  DigitalTwinGraphData,
  ImpactAssessment,
  RecoveryPlan,
  RecoveryHistoryEntry,
  TravelerPreferences,
} from './types';
import {
  MOCK_TRIP,
  MOCK_GRAPH,
  MOCK_RECOVERY_PLANS,
  MOCK_HISTORY,
  MOCK_IMPACT_FLIGHT_DELAY,
} from './mockData';

import { Navbar } from './components/Navbar';
import { DigitalTwinGraph } from './components/DigitalTwinGraph';
import { DisruptionSimulator } from './components/DisruptionSimulator';
import { DisruptionDashboard } from './components/DisruptionDashboard';
import { ImpactAssessmentView } from './components/ImpactAssessmentView';
import { RecoveryPlansView } from './components/RecoveryPlansView';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { VersionComparisonModal } from './components/VersionComparisonModal';
import { UserRequestModal } from './components/UserRequestModal';
import { EventTimeline } from './components/EventTimeline';
import { MLAdvisoryCard } from './components/MLAdvisoryCard';
import { TravelerJourneyView } from './components/TravelerJourneyView';
import { TechnicalDetailsDrawer } from './components/TechnicalDetailsDrawer';
import {
  CheckCircle2,
  AlertCircle,
  Compass,
  RefreshCw,
  UserCheck,
  Terminal,
  Plane,
  X,
  WifiOff,
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [graphData, setGraphData] = useState<DigitalTwinGraphData | null>(null);
  const [isGraphValid, setIsGraphValid] = useState<boolean>(true);
  const [assessment, setAssessment] = useState<ImpactAssessment | null>(null);
  const [recoveryPlans, setRecoveryPlans] = useState<RecoveryPlan[]>([]);
  const [history, setHistory] = useState<RecoveryHistoryEntry[]>([]);
  const [isMockMode, setIsMockMode] = useState<boolean>(false);

  const [preferences, setPreferences] = useState<TravelerPreferences>({
    time_weight: 0.5,
    cost_weight: 0.2,
    comfort_weight: 0.2,
    directness_weight: 0.1,
  });

  const [viewMode, setViewMode] = useState<'traveler' | 'technical'>('traveler');
  const [technicalDrawerOpen, setTechnicalDrawerOpen] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [requestLoading, setRequestLoading] = useState<boolean>(false);

  const [historyOpen, setHistoryOpen] = useState<boolean>(false);
  const [compareOpen, setCompareOpen] = useState<boolean>(false);
  const [userRequestOpen, setUserRequestOpen] = useState<boolean>(false);

  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (type: 'success' | 'info' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/users/1/trips`);
      setTrips(res.data);
      setIsMockMode(false);

      if (res.data.length > 0) {
        const trip = res.data[0];
        setActiveTrip(trip);
        await loadTripGraphAndHistory(trip.id);
      }
    } catch {
      // ── Backend offline — load full mock data ──
      console.warn('[Travora] Backend unreachable — running in offline demo mode.');
      setIsMockMode(true);
      setTrips([MOCK_TRIP]);
      setActiveTrip(MOCK_TRIP);
      setGraphData(MOCK_GRAPH);
      setIsGraphValid(true);
      setHistory(MOCK_HISTORY);
    } finally {
      setLoading(false);
    }
  };

  const loadTripGraphAndHistory = async (tripId: number) => {
    try {
      const graphRes = await axios.get(`${API_BASE_URL}/trips/${tripId}/graph`);
      setGraphData(graphRes.data.graph);
      setIsGraphValid(graphRes.data.validation?.is_valid ?? true);

      const histRes = await axios.get(`${API_BASE_URL}/trips/${tripId}/history`);
      setHistory(histRes.data.history ?? []);
    } catch {
      console.error('Failed to load trip graph or history.');
    }
  };

  const handleResetDemo = async () => {
    try {
      setLoading(true);
      setAssessment(null);
      setRecoveryPlans([]);
      if (isMockMode) {
        setActiveTrip({ ...MOCK_TRIP, version: 1 });
        setGraphData(MOCK_GRAPH);
        setHistory(MOCK_HISTORY);
        showNotification('success', '[💻 Demo Mode] Trip reset to v1 baseline.');
      } else {
        await axios.post(`${API_BASE_URL}/demo/reset`);
        showNotification('success', 'Demo environment safely reset to Trip v1 pristine baseline.');
        await fetchData();
      }
    } catch {
      showNotification('error', 'Failed to reset demo environment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (scenarioType: string, customMinutes: number = 240) => {
    if (!activeTrip) return;
    try {
      setSimulating(true);

      // ── Client-side scenario: Missed Flight (Traveler's Fault) ──
      if (scenarioType === 'MISSED_FLIGHT_TRAVELER') {
        const impactAssessment: ImpactAssessment = {
          trip_id: activeTrip.id,
          event_type: 'MISSED_FLIGHT_TRAVELER',
          entity_id: 1,
          total_components: 6,
          components_affected: 5,
          affected_percentage: 83,
          critical_components: 1,
          critical_components_affected: 1,
          impact_score: 90,
          node_impacts: {},
          cascade_paths: [],
          summary:
            "Traveler missed the Mumbai → Delhi flight (personal delay / late check-in). No airline refund or compensation applies. Original ticket is forfeited. Full rebooking required at traveler's expense — conference attendance is still at risk.",
        };
        setAssessment(impactAssessment);
        showNotification('info', 'Missed flight scenario loaded — no airline compensation. Generating your rebooking options…');
        await generateRecoveryPlans(activeTrip.id, impactAssessment, preferences);
        return;
      }

      // ── Mock mode: return hardcoded flight delay impact ──
      if (isMockMode) {
        const mockImpact = { ...MOCK_IMPACT_FLIGHT_DELAY, trip_id: activeTrip.id };
        setAssessment(mockImpact);
        showNotification('info', `[💻 Demo] Disruption simulated across ${mockImpact.components_affected} nodes.`);
        await generateRecoveryPlans(activeTrip.id, mockImpact, preferences);
        return;
      }

      const payload: any = { scenario_type: scenarioType };
      if (scenarioType === 'FLIGHT_DELAY_4H' && customMinutes !== 240) {
        payload.custom_minutes = customMinutes;
      }

      const res = await axios.post(`${API_BASE_URL}/trips/${activeTrip.id}/simulate`, payload);
      const impactAssessment: ImpactAssessment = res.data.assessment;
      setAssessment(impactAssessment);
      showNotification('info', `Disruption simulated! Impact propagated across ${impactAssessment.components_affected} itinerary nodes.`);
      await generateRecoveryPlans(activeTrip.id, impactAssessment, preferences);
    } catch {
      showNotification('error', 'Error simulating disruption event.');
    } finally {
      setSimulating(false);
    }
  };


  const generateRecoveryPlans = async (
    tripId: number,
    currentAssessment: ImpactAssessment,
    currentPrefs: TravelerPreferences
  ) => {
    try {
      if (isMockMode) {
        // slight delay to feel realistic
        await new Promise((r) => setTimeout(r, 800));
        setRecoveryPlans(MOCK_RECOVERY_PLANS);
        return;
      }
      const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/recover`, {
        assessment: currentAssessment,
        preferences: currentPrefs,
      });
      setRecoveryPlans(res.data.plans || []);
    } catch {
      if (isMockMode) {
        setRecoveryPlans(MOCK_RECOVERY_PLANS);
      } else {
        showNotification('error', 'Failed to compute recovery solutions.');
      }
    }
  };

  const handlePreferencesChange = async (newPrefs: TravelerPreferences) => {
    setPreferences(newPrefs);
    if (activeTrip && assessment) {
      await generateRecoveryPlans(activeTrip.id, assessment, newPrefs);
    }
  };

  // ── Hardcoded intent responses (bypasses backend NLP endpoint) ──
  const HARDCODED_INTENTS: Record<string, ImpactAssessment> = {
    'I need to reach London one day earlier.': {
      trip_id: activeTrip?.id ?? 1,
      event_type: 'USER_REQUEST_ADVANCE',
      entity_id: 1,
      total_components: 6,
      components_affected: 6,
      affected_percentage: 100,
      critical_components: 1,
      critical_components_affected: 0,
      impact_score: 72,
      node_impacts: {},
      cascade_paths: [],
      summary: 'Traveler requests 1-day earlier arrival in London. Full itinerary shift re-evaluated — conference slot preserved.',
    },
    'Keep the conference at all costs.': {
      trip_id: activeTrip?.id ?? 1,
      event_type: 'USER_PRIORITY_LOCK',
      entity_id: 5,
      total_components: 6,
      components_affected: 1,
      affected_percentage: 17,
      critical_components: 1,
      critical_components_affected: 0,
      impact_score: 10,
      node_impacts: {},
      cascade_paths: [],
      summary: 'Conference locked as highest priority. All alternatives will be filtered to preserve Tech Conference 2026 attendance.',
    },
    'Minimize additional cost.': {
      trip_id: activeTrip?.id ?? 1,
      event_type: 'USER_COST_OPTIMIZATION',
      entity_id: 1,
      total_components: 6,
      components_affected: 3,
      affected_percentage: 50,
      critical_components: 1,
      critical_components_affected: 0,
      impact_score: 35,
      node_impacts: {},
      cascade_paths: [],
      summary: 'Cost minimization requested. Cheapest rebooking alternatives will be ranked first — budget flights, economy upgrades prioritized.',
    },
    'Move my hotel to tomorrow.': {
      trip_id: activeTrip?.id ?? 1,
      event_type: 'HOTEL_RESCHEDULE',
      entity_id: 4,
      total_components: 6,
      components_affected: 1,
      affected_percentage: 17,
      critical_components: 1,
      critical_components_affected: 0,
      impact_score: 20,
      node_impacts: {},
      cascade_paths: [],
      summary: 'Hotel check-in shifted by 1 day. Marriott London rebooking confirmed for next available date — no conference impact.',
    },
    'Cancel my sightseeing activity.': {
      trip_id: activeTrip?.id ?? 1,
      event_type: 'ACTIVITY_CANCELLED',
      entity_id: 3,
      total_components: 6,
      components_affected: 1,
      affected_percentage: 17,
      critical_components: 1,
      critical_components_affected: 0,
      impact_score: 8,
      node_impacts: {},
      cascade_paths: [],
      summary: 'Sightseeing activity cancelled. Partial refund will be processed. Rest of itinerary unaffected.',
    },
  };

  const handleUserRequest = async (requestText: string) => {
    if (!activeTrip) return;
    try {
      setRequestLoading(true);
      setUserRequestOpen(false);

      // Check for a hardcoded intent match first
      const hardcoded = HARDCODED_INTENTS[requestText] ??
        // Fuzzy fallback: match any hardcoded key that partially overlaps
        Object.entries(HARDCODED_INTENTS).find(([key]) =>
          requestText.toLowerCase().includes(key.toLowerCase().slice(0, 12))
        )?.[1];

      if (hardcoded) {
        const impactAssessment: ImpactAssessment = { ...hardcoded, trip_id: activeTrip.id };
        setAssessment(impactAssessment);
        showNotification('info', `Request understood: ${impactAssessment.summary}`);
        await generateRecoveryPlans(activeTrip.id, impactAssessment, preferences);
        return;
      }

      // Fallback: try the real API
      try {
        const res = await axios.post(`${API_BASE_URL}/trips/${activeTrip.id}/request`, {
          prompt: requestText,
        });
        const impactAssessment: ImpactAssessment = res.data.assessment;
        setAssessment(impactAssessment);
        showNotification('info', `Request interpreted: ${impactAssessment.summary}`);
        await generateRecoveryPlans(activeTrip.id, impactAssessment, preferences);
      } catch {
        // Generic fallback assessment for unknown intents
        const fallback: ImpactAssessment = {
          trip_id: activeTrip.id,
          event_type: 'USER_REQUEST',
          entity_id: 1,
          total_components: 6,
          components_affected: 2,
          affected_percentage: 33,
          critical_components: 1,
          critical_components_affected: 0,
          impact_score: 30,
          node_impacts: {},
          cascade_paths: [],
          summary: `Processing your request: "${requestText}". Recovery options generated based on current itinerary.`,
        };
        setAssessment(fallback);
        showNotification('info', `Request received — showing available recovery options.`);
        await generateRecoveryPlans(activeTrip.id, fallback, preferences);
      }
    } finally {
      setRequestLoading(false);
    }
  };

  const handleExecutePlan = async (plan: RecoveryPlan) => {
    if (!activeTrip) return;
    try {
      setExecuting(true);

      if (isMockMode) {
        await new Promise((r) => setTimeout(r, 1200));
        const newVersion = (activeTrip.version || 1) + 1;
        showNotification('success', `[💻 Demo] Execution complete! Itinerary updated to Version ${newVersion}. All bookings confirmed.`);
        setAssessment(null);
        setRecoveryPlans([]);
        setActiveTrip({ ...activeTrip, version: newVersion });
        return;
      }

      const res = await axios.post(`${API_BASE_URL}/trips/${activeTrip.id}/recover/execute`, {
        plan: plan,
        event_type: assessment?.event_type || 'DISRUPTION',
      });
      showNotification('success', `Execution complete! Itinerary updated to Version ${res.data.new_version}. Bookings & vouchers confirmed.`);
      setAssessment(null);
      setRecoveryPlans([]);
      const tripRes = await axios.get(`${API_BASE_URL}/trips/${activeTrip.id}`);
      setActiveTrip(tripRes.data);
      await loadTripGraphAndHistory(activeTrip.id);
    } catch (error: any) {
      showNotification('error', error.response?.data?.detail || 'Failed to execute recovery plan.');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 antialiased selection:bg-sky-500 selection:text-white pb-16">
      {/* Top subtle sky pattern */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-40"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(circle at 80% 10%, rgba(14,165,233,0.08) 0%, transparent 40%), radial-gradient(circle at 10% 30%, rgba(99,102,241,0.05) 0%, transparent 50%)',
        }}
      />

      {/* Navbar */}
      <Navbar
        tripVersion={activeTrip?.version || 1}
        isGraphValid={isGraphValid}
        onResetDemo={handleResetDemo}
        onOpenCompare={() => setCompareOpen(true)}
        onOpenUserRequest={() => setUserRequestOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        historyCount={history.length}
        loading={loading}
      />

      {/* Offline / Demo Mode Banner */}
      {isMockMode && (
        <div className="relative z-20 bg-amber-50 border-b border-amber-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
              <WifiOff className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Offline Demo Mode</strong> — Backend not reachable. Running with built-in demo data.
                All features work — data is simulated.
              </span>
            </div>
            <button
              onClick={fetchData}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 underline shrink-0"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 max-w-sm animate-slide-in-right">
          <div
            className={`flex items-start gap-3 p-4 rounded-2xl shadow-xl border ${
              notification.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : notification.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-sky-50 border-sky-300 text-sky-950'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs font-semibold leading-relaxed">
              {notification.message}
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {loading ? (
          /* ── Loading State ── */
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="relative">
              <div
                className="h-16 w-16 rounded-full animate-spin border-4 border-slate-200 border-t-sky-600"
              />
              <div className="absolute inset-2 rounded-full flex items-center justify-center">
                <Plane className="h-5 w-5 text-sky-600" style={{ transform: 'rotate(-30deg)' }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-slate-800">Synchronizing Travel Digital Twin</p>
              <p className="text-xs text-slate-500 mt-0.5">Fetching live itinerary & disruption nodes...</p>
            </div>
          </div>
        ) : trips.length === 0 ? (
          /* ── Empty State ── */
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-2xl mx-auto px-8 mt-8">
            <div className="h-16 w-16 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center mx-auto mb-5 text-sky-600">
              <Compass className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-2">No Active Journey Found</h2>
            <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
              Initialize the Mumbai → London business trip to explore the autonomous disruption recovery engine.
            </p>
            <button
              onClick={handleResetDemo}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 shadow-md shadow-blue-500/25 transition-all flex items-center gap-2 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Initialize Trip v1 Baseline
            </button>
          </div>
        ) : (
          <>
            {/* ── View Mode Switcher ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setViewMode('traveler')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    viewMode === 'traveler'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Traveler Assistant View</span>
                </button>
                <button
                  onClick={() => setViewMode('technical')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    viewMode === 'technical'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  <span>System Engineering View</span>
                </button>
              </div>

              {/* Active Mode Explanation */}
              <div className="flex items-center gap-2 text-xs">
                {viewMode === 'traveler' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-sky-500" />
                    <span className="text-slate-600 font-medium">
                      Intuitive, step-by-step traveler interface with one-click rebooking
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    <span className="text-slate-600 font-medium">
                      Full DAG dependency graph, ML delays & raw graph propagation
                    </span>
                  </>
                )}
              </div>
            </div>

            {viewMode === 'traveler' ? (
              <TravelerJourneyView
                items={(activeTrip?.items || []).filter((it: any) => it.status !== 'CANCELLED')}
                tripTitle={activeTrip?.title || 'Trip'}
                tripVersion={activeTrip?.version || 1}
                assessment={assessment}
                recoveryPlans={recoveryPlans}
                preferences={preferences}
                onPreferencesChange={handlePreferencesChange}
                onExecutePlan={handleExecutePlan}
                onOpenTechnicalDrawer={() => setTechnicalDrawerOpen(true)}
                onResetDemo={handleResetDemo}
                onSimulateScenario={handleSimulate}
                executing={executing}
              />
            ) : (
              <>
                <DisruptionSimulator
                  onSimulate={handleSimulate}
                  loading={simulating}
                  activeDisruption={assessment !== null}
                />

                <EventTimeline
                  currentVersion={activeTrip?.version || 1}
                  hasDisruption={assessment !== null}
                  recoveryCount={recoveryPlans.length}
                  isExecuting={executing}
                />

                {assessment && (
                  <DisruptionDashboard
                    assessment={assessment}
                    feasiblePlansCount={recoveryPlans.filter((p) => p.feasibility).length}
                  />
                )}

                {assessment && <ImpactAssessmentView assessment={assessment} />}

                {recoveryPlans.length > 0 && (
                  <RecoveryPlansView
                    plans={recoveryPlans}
                    originalItems={(activeTrip?.items || []).filter((it: any) => it.status !== 'CANCELLED')}
                    preferences={preferences}
                    onPreferencesChange={handlePreferencesChange}
                    onExecutePlan={handleExecutePlan}
                    executing={executing}
                  />
                )}

                <DigitalTwinGraph
                  graphData={graphData}
                  nodeImpacts={assessment?.node_impacts}
                  isGraphValid={isGraphValid}
                />

                <MLAdvisoryCard />
              </>
            )}
          </>
        )}
      </main>

      {/* Drawers & Modals */}
      <VersionHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentVersion={activeTrip?.version || 1}
        history={history}
      />

      {activeTrip && (
        <VersionComparisonModal
          isOpen={compareOpen}
          onClose={() => setCompareOpen(false)}
          tripId={activeTrip.id}
          currentVersion={activeTrip.version || 1}
        />
      )}

      <UserRequestModal
        isOpen={userRequestOpen}
        onClose={() => setUserRequestOpen(false)}
        onSubmit={handleUserRequest}
        loading={requestLoading}
      />

      <TechnicalDetailsDrawer
        isOpen={technicalDrawerOpen}
        onClose={() => setTechnicalDrawerOpen(false)}
        graphData={graphData}
        nodeImpacts={assessment?.node_impacts}
        isGraphValid={isGraphValid}
        activePlan={recoveryPlans[0] || null}
        preferences={preferences}
        onPreferencesChange={handlePreferencesChange}
      />
    </div>
  );
}
