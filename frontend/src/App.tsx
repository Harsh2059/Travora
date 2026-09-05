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

import { Navbar } from './components/Navbar';
import { DigitalTwinGraph } from './components/DigitalTwinGraph';
import { DisruptionSimulator } from './components/DisruptionSimulator';
import { ImpactAssessmentView } from './components/ImpactAssessmentView';
import { RecoveryPlansView } from './components/RecoveryPlansView';
import { VersionHistoryDrawer } from './components/VersionHistoryDrawer';
import { MLAdvisoryCard } from './components/MLAdvisoryCard';
import { CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000/api';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [graphData, setGraphData] = useState<DigitalTwinGraphData | null>(null);
  const [isGraphValid, setIsGraphValid] = useState<boolean>(true);
  const [assessment, setAssessment] = useState<ImpactAssessment | null>(null);
  const [recoveryPlans, setRecoveryPlans] = useState<RecoveryPlan[]>([]);
  const [history, setHistory] = useState<RecoveryHistoryEntry[]>([]);

  const [preferences, setPreferences] = useState<TravelerPreferences>({
    time_weight: 0.5,
    cost_weight: 0.2,
    comfort_weight: 0.2,
    directness_weight: 0.1,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [executing, setExecuting] = useState<boolean>(false);
  const [historyOpen, setHistoryOpen] = useState<boolean>(false);

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

      if (res.data.length > 0) {
        const trip = res.data[0];
        setActiveTrip(trip);
        await loadTripGraphAndHistory(trip.id);
      }
    } catch (error) {
      console.log('No existing trips found. Ready to seed demo.', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTripGraphAndHistory = async (tripId: number) => {
    try {
      // 1. Fetch Graph
      const graphRes = await axios.get(`${API_BASE_URL}/trips/${tripId}/graph`);
      setGraphData(graphRes.data.graph);
      setIsGraphValid(graphRes.data.validation?.is_valid ?? true);

      // 2. Fetch History
      const histRes = await axios.get(`${API_BASE_URL}/trips/${tripId}/history`);
      setHistory(histRes.data.history ?? []);
    } catch (error) {
      console.error('Failed to load trip graph or history:', error);
    }
  };

  const handleSeed = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/seed`);
      setAssessment(null);
      setRecoveryPlans([]);
      showNotification('success', 'Demo data loaded successfully (6 items, v1 foundation).');
      await fetchData();
    } catch (error) {
      console.error(error);
      showNotification('error', 'Failed to seed database.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (scenarioType: string, customMinutes: number = 240) => {
    if (!activeTrip) return;
    try {
      setSimulating(true);
      let payload: any = { scenario_type: scenarioType };
      if (scenarioType === 'FLIGHT_DELAY_4H' && customMinutes !== 240) {
        payload.custom_minutes = customMinutes;
      }

      const res = await axios.post(`${API_BASE_URL}/trips/${activeTrip.id}/simulate`, payload);
      const impactAssessment: ImpactAssessment = res.data.assessment;
      setAssessment(impactAssessment);

      showNotification(
        'info',
        `Disruption simulated! Impact propagated across ${impactAssessment.components_affected} itinerary nodes.`
      );

      // Automatically generate candidate recovery plans
      await generateRecoveryPlans(activeTrip.id, impactAssessment, preferences);
    } catch (error) {
      console.error(error);
      showNotification('error', 'Error simulating disruption event.');
    } finally {
      setSimulating(false);
    }
  };

  const generateRecoveryPlans = async (
    tripId: number,
    currentAssessment: ImpactAssessment,
    prefs: TravelerPreferences
  ) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/recover`, {
        preferences: prefs,
        event: {
          event_type: currentAssessment.event_type,
          entity_id: currentAssessment.entity_id,
          event_metadata: { delay_minutes: 240 },
        },
      });
      setRecoveryPlans(res.data.plans);
    } catch (error) {
      console.error('Failed to generate recovery plans:', error);
    }
  };

  const handlePreferencesChange = async (newPrefs: TravelerPreferences) => {
    setPreferences(newPrefs);
    if (activeTrip && assessment) {
      await generateRecoveryPlans(activeTrip.id, assessment, newPrefs);
    }
  };

  const handleExecutePlan = async (plan: RecoveryPlan) => {
    if (!activeTrip) return;
    try {
      setExecuting(true);
      const res = await axios.post(`${API_BASE_URL}/trips/${activeTrip.id}/recover/execute`, {
        plan: plan,
        event_type: assessment?.event_type || 'DISRUPTION',
      });

      showNotification(
        'success',
        `Plan executed! Itinerary successfully updated to Version ${res.data.new_version}.`
      );

      // Reset disruption view
      setAssessment(null);
      setRecoveryPlans([]);

      // Reload trip and reconstructed graph
      const tripRes = await axios.get(`${API_BASE_URL}/trips/${activeTrip.id}`);
      setActiveTrip(tripRes.data);
      await loadTripGraphAndHistory(activeTrip.id);
    } catch (error: any) {
      console.error(error);
      showNotification(
        'error',
        error.response?.data?.detail || 'Failed to execute recovery plan.'
      );
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Navbar */}
      <Navbar
        tripVersion={activeTrip?.version || 1}
        isGraphValid={isGraphValid}
        onSeed={handleSeed}
        onOpenHistory={() => setHistoryOpen(true)}
        historyCount={history.length}
        loading={loading}
      />

      {/* Floating Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 max-w-md animate-bounce">
          <div
            className={`flex items-start gap-3 p-4 rounded-xl shadow-2xl border ${
              notification.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-700 text-emerald-200'
                : notification.type === 'error'
                ? 'bg-red-950/90 border-red-700 text-red-200'
                : 'bg-blue-950/90 border-blue-700 text-blue-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            )}
            <div className="text-xs font-semibold">{notification.message}</div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <div className="h-12 w-12 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin" />
            <p className="text-sm text-slate-400 font-medium">
              Synchronizing with Digital Twin Graph Engine...
            </p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-24 bg-slate-900 border border-slate-800 rounded-3xl shadow-xl max-w-2xl mx-auto px-6">
            <div className="h-16 w-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">No Active Trip Initialized</h2>
            <p className="text-sm text-slate-400 mb-6 max-w-md mx-auto">
              Initialize the database with the Mumbai-to-London business journey (Flights, Heathrow Express, Marriott Hotel, Tech Conference).
            </p>
            <button
              onClick={handleSeed}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all"
            >
              Load Demo Itinerary (v1)
            </button>
          </div>
        ) : (
          <>
            {/* Top Trip Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Active Business Itinerary
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">{activeTrip?.title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Total Commitments:{' '}
                  <strong className="text-slate-200">{activeTrip?.items.length} items</strong>
                </span>
                <span className="h-4 w-px bg-slate-800" />
                <span className="text-xs text-slate-400">
                  Active Status:{' '}
                  <strong className="text-emerald-400">Confirmed (Version {activeTrip?.version})</strong>
                </span>
              </div>
            </div>

            {/* Disruption Simulator */}
            <DisruptionSimulator
              onSimulate={handleSimulate}
              loading={simulating}
              activeDisruption={assessment !== null}
            />

            {/* Impact Assessment Radar */}
            {assessment && <ImpactAssessmentView assessment={assessment} />}

            {/* Recovery Strategy Options & Personalized Ranking */}
            {recoveryPlans.length > 0 && (
              <RecoveryPlansView
                plans={recoveryPlans}
                preferences={preferences}
                onPreferencesChange={handlePreferencesChange}
                onExecutePlan={handleExecutePlan}
                executing={executing}
              />
            )}

            {/* Digital Twin Graph Canvas */}
            <DigitalTwinGraph
              graphData={graphData}
              nodeImpacts={assessment?.node_impacts}
              isGraphValid={isGraphValid}
            />

            {/* ML Advisory Card */}
            <MLAdvisoryCard />
          </>
        )}
      </main>

      {/* Version History Slide-Over Drawer */}
      <VersionHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentVersion={activeTrip?.version || 1}
        history={history}
      />
    </div>
  );
}
