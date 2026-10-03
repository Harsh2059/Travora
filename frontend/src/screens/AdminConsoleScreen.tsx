import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  Layout,
  Radio,
  Zap,
  Trash2,
  CloudRain,
  Wind,
  Eye,
  Thermometer,
  ExternalLink,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  API_BASE_URL,
  fetchUserTrips,
  fetchTripById,
  getActiveTripId,
  setActiveTripId,
  triggerTripDisruption,
  fetchTripDisruptions,
  resetTripDisruptions,
  resetIndividualDisruption,
  resetAllSimulations,
} from '../store/journeyStore';
import type { Journey } from '../types';
import {
  subscribeToTripUpdates,
  getPersistedViewMode,
  subscribeToViewMode,
} from '../store/tripSync';
import type { ViewMode } from '../store/tripSync';

type DisruptionCategory =
  | 'FLIGHT_CANCELLED'
  | 'FLIGHT_DELAYED'
  | 'TRAIN_CANCELLED'
  | 'TRAIN_DELAYED'
  | 'CAB_DELAYED'
  | 'CAB_UNAVAILABLE'
  | 'HOTEL_CANCELLED'
  | 'ACTIVITY_CANCELLED'
  | 'MISSED_CONNECTION';

interface AdminWeather {
  location: string;
  temperature: number;
  rainfall: number;
  wind: number;
  visibility: number;
  condition: string;
  timestamp: string;
  source: string;
  is_live: boolean;
}

function getDisruptionOptions(itemType?: string): Array<{ value: DisruptionCategory; label: string; desc: string }> {
  if (!itemType) return [];
  const t = itemType.toLowerCase();

  if (t === 'flight') {
    return [
      { value: 'FLIGHT_CANCELLED', label: 'Flight Cancelled', desc: 'Flight has been cancelled by airline' },
      { value: 'FLIGHT_DELAYED', label: 'Flight Delayed', desc: 'Flight is delayed by specified duration' },
      { value: 'MISSED_CONNECTION', label: 'Missed Connection', desc: 'Connecting transit missed due to delay' },
    ];
  }
  if (t === 'train') {
    return [
      { value: 'TRAIN_CANCELLED', label: 'Train Cancelled', desc: 'Rail service cancelled by operator' },
      { value: 'TRAIN_DELAYED', label: 'Train Delayed', desc: 'Train delayed by specified duration' },
      { value: 'MISSED_CONNECTION', label: 'Missed Connection', desc: 'Connecting transit missed due to delay' },
    ];
  }
  if (t === 'hotel' || t === 'stay') {
    return [
      { value: 'HOTEL_CANCELLED', label: 'Hotel Cancelled', desc: 'Hotel reservation cancelled or unavailable' },
    ];
  }
  if (t === 'activity' || t === 'ticket' || t === 'event') {
    return [
      { value: 'ACTIVITY_CANCELLED', label: 'Activity Cancelled', desc: 'Event or tour booking cancelled' },
    ];
  }
  // Default for cab/taxi/metro/transfer
  return [
    { value: 'CAB_DELAYED', label: 'Cab / Transfer Delayed', desc: 'Cab dispatch delayed by specified duration' },
    { value: 'CAB_UNAVAILABLE', label: 'Cab Unavailable', desc: 'Cab driver / vehicle unavailable' },
    { value: 'MISSED_CONNECTION', label: 'Missed Connection', desc: 'Transit connection missed' },
  ];
}

function formatDateForInput(dString?: string): string {
  if (!dString) return formatNowForInput();
  try {
    const d = new Date(dString);
    if (isNaN(d.getTime())) return formatNowForInput();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  } catch {
    return formatNowForInput();
  }
}

function formatNowForInput(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function fmtDisplayTime(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return s; }
}

/** Active bookings only — hide REPLACED / RESTORED_DEMO / CANCELLED. */
function getActiveBookingNodes(nodes: Journey['nodes'] | undefined): Journey['nodes'] {
  if (!nodes?.length) return [];

  const byId = new Map(
    nodes.map((n) => [String(n.backendId ?? n.id), n] as const)
  );

  return nodes.filter((n) => {
    const status = (n.status || 'CONFIRMED').toUpperCase();
    if (status === 'CANCELLED' || status === 'REPLACED' || status === 'RESTORED_DEMO') {
      return false;
    }

    const meta = n.metadata || {};
    const isReplacement = Boolean(meta.is_replacement || meta.recovery_execution_id);
    if (isReplacement && meta.replaced_item_id != null) {
      const original = byId.get(String(meta.replaced_item_id));
      if (original) {
        const origStatus = (original.status || 'CONFIRMED').toUpperCase();
        if (origStatus !== 'REPLACED' && origStatus !== 'RESTORED_DEMO' && origStatus !== 'CANCELLED') {
          return false;
        }
      }
    }

    return true;
  });
}

export default function AdminConsoleScreen() {
  const navigate = useNavigate();

  const [tripsList, setTripsList] = useState<Array<{ id: number; title: string; version: number }>>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [journey, setJourney] = useState<Journey & { originalNodes?: import('../types').JourneyNode[] } | null>(null);
  const [loadingTrip, setLoadingTrip] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('RECOVERED');

  // Form selections
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [disruptionType, setDisruptionType] = useState<DisruptionCategory>('FLIGHT_CANCELLED');
  const [delayMinutes, setDelayMinutes] = useState<number>(120);
  const [detectedAt, setDetectedAt] = useState<string>(formatNowForInput());
  const [reason, setReason] = useState<string>('Operational disruption');

  // Admin Tab & Weather What-If Simulation State
  const [adminTab, setAdminTab] = useState<'operational' | 'weather_whatif'>('operational');
  const [simRainfall, setSimRainfall] = useState<number>(65);
  const [simWind, setSimWind] = useState<number>(45);
  const [simVisibility, setSimVisibility] = useState<number>(1.2);
  const [simTemp, setSimTemp] = useState<number>(32);
  const [simResult, setSimResult] = useState<any | null>(null);
  const [runningSim, setRunningSim] = useState<boolean>(false);

  // Weather state
  const [weather, setWeather] = useState<AdminWeather | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);

  // Status & Feedback
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState<boolean>(false);

  // Active Disruption History
  const [disruptionHistory, setDisruptionHistory] = useState<any[]>([]);

  // 1. Fetch user trips on mount
  useEffect(() => {
    fetchUserTrips(undefined, true)
      .then((list) => {
        setTripsList(list);
        const activeId = getActiveTripId();
        if (activeId && list.some((t) => t.id === activeId)) {
          setSelectedTripId(activeId);
        } else if (list.length > 0) {
          setSelectedTripId(list[0].id);
        }
      })
      .catch((err) => console.error('Failed to load trips for admin:', err));
  }, []);

  // 2. Load journey items & disruption history
  const fetchSelectedTrip = React.useCallback(() => {
    if (!selectedTripId) return;

    setLoadingTrip(true);
    setFormError(null);

    Promise.all([
      fetchTripById(selectedTripId, true),
      fetchTripDisruptions(selectedTripId),
    ])
      .then(([j, history]) => {
        setJourney(j);
        const historyList = history || [];
        setDisruptionHistory(historyList);
      })
      .catch((err) => {
        console.error('Failed to load trip details for admin:', err);
        setFormError('Failed to load trip data. Please verify network connection.');
      })
      .finally(() => setLoadingTrip(false));
  }, [selectedTripId]);

  // Initial fetch and subscription to updates
  useEffect(() => {
    if (!selectedTripId) return;

    setViewMode(getPersistedViewMode(selectedTripId));
    fetchSelectedTrip();

    const unsubUpdates = subscribeToTripUpdates(selectedTripId, fetchSelectedTrip);
    const unsubViewMode = subscribeToViewMode(selectedTripId, (mode) => setViewMode(mode));

    return () => {
      unsubUpdates();
      unsubViewMode();
    };
  }, [selectedTripId, fetchSelectedTrip]);

  // 3. Reconcile Selected Booking whenever derived active journey changes
  const activeJourneyNodes = viewMode === 'ORIGINAL' && journey?.originalNodes ? journey.originalNodes : journey?.nodes;
  const activeBookingNodes = getActiveBookingNodes(activeJourneyNodes);

  const selectedNode = activeBookingNodes.find((n) => n.id === selectedNodeId) ||
    activeJourneyNodes?.find((n) => n.id === selectedNodeId && !['REPLACED', 'RESTORED_DEMO', 'CANCELLED'].includes((n.status || '').toUpperCase()));

  // 4. Fetch Weather Context when journey or selected node location changes
  useEffect(() => {
    if (!selectedTripId) {
      setWeather(null);
      setWeatherError(null);
      return;
    }

    let isMounted = true;
    setLoadingWeather(true);
    setWeatherError(null);

    const loc = selectedNode?.origin || selectedNode?.location || journey?.title || 'Mumbai';

    axios
      .get(`${API_BASE_URL}/weather/current`, {
        params: { location: loc },
        timeout: 6000,
      })
      .then((res) => {
        if (!isMounted) return;
        const data = res.data || {};
        setWeather({
          location: data.location || loc,
          temperature: Number(data.temperature ?? 28),
          rainfall: Number(data.rainfall ?? 0),
          wind: Number(data.wind ?? 10),
          visibility: Number(data.visibility ?? 10),
          condition: data.condition || 'Clear',
          timestamp: data.timestamp
            ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: data.source || 'Live Weather API',
          is_live: Boolean(data.is_live),
        });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Weather fetch failed in Admin:', err?.message);
        setWeatherError('Weather data temporarily unavailable.');
      })
      .finally(() => {
        if (isMounted) setLoadingWeather(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTripId, selectedNode?.id, selectedNode?.origin, selectedNode?.location, journey?.title]);

  useEffect(() => {
    if (loadingTrip || !journey) return;

    const stillValid = activeBookingNodes.some(n => n.id === selectedNodeId);
    const activeDisp = disruptionHistory.find((d: any) => (d.status || 'ACTIVE') === 'ACTIVE') ?? null;

    if (!stillValid && activeBookingNodes.length > 0) {
      if (activeDisp) {
        const entityIdStr = String(activeDisp.entity_id || activeDisp.affected_node_id || '');
        const matchedNode = activeBookingNodes.find(
          (n) => n.id === entityIdStr || String(n.backendId) === entityIdStr
        );
        if (matchedNode) {
          setSelectedNodeId(matchedNode.id);
          return;
        }
      }
      setSelectedNodeId(activeBookingNodes[0].id);
    } else if (activeBookingNodes.length === 0) {
      setSelectedNodeId('');
    }

    if (activeDisp && stillValid) {
      const evType = activeDisp.event_type || activeDisp.type;
      if (evType && evType !== disruptionType) setDisruptionType(evType as DisruptionCategory);
      const ts = activeDisp.timestamp || activeDisp.detected_at;
      if (ts) setDetectedAt(formatDateForInput(ts));
      const meta = activeDisp.event_metadata || {};
      if (meta.reason || activeDisp.reason) setReason(meta.reason || activeDisp.reason);
      const dm = meta.delay_minutes ?? activeDisp.delay_minutes;
      if (dm !== undefined && dm !== null) setDelayMinutes(Number(dm));
    }

  }, [journey, viewMode, disruptionHistory, loadingTrip, activeBookingNodes.length]);

  useEffect(() => {
    if (selectedNode) {
      const opts = getDisruptionOptions(selectedNode.type);
      if (opts.length > 0 && !opts.some((o) => o.value === disruptionType)) {
        setDisruptionType(opts[0].value);
      }
    }
  }, [selectedNodeId, selectedNode]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const isDelayType = disruptionType.includes('DELAYED');

  const handleTriggerDisruption = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedTripId) {
      setFormError('Select a trip first.');
      return;
    }
    if (!selectedNode) {
      setFormError('Select a booking first.');
      return;
    }
    if (!disruptionType) {
      setFormError('Select a disruption type.');
      return;
    }
    if (!detectedAt) {
      setFormError('Detected time is required.');
      return;
    }
    if (isDelayType && (!delayMinutes || delayMinutes <= 0)) {
      setFormError('Enter a valid delay duration.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        trip_id: selectedTripId,
        affected_node_id: selectedNode.backendId || selectedNode.id,
        entity_id: selectedNode.backendId || selectedNode.id,
        type: disruptionType,
        event_type: disruptionType,
        detected_at: new Date(detectedAt).toISOString(),
        reason: reason.trim() || 'Operational disruption',
        delay_minutes: isDelayType ? delayMinutes : null,
      };

      await triggerTripDisruption(selectedTripId, payload, true);
      setToastMsg('Disruption triggered successfully!');

      const updatedHistory = await fetchTripDisruptions(selectedTripId);
      setDisruptionHistory(updatedHistory || []);
    } catch (err: any) {
      console.error('Failed to trigger disruption:', err);
      const msg = err?.response?.data?.detail || 'Unable to trigger disruption. Please try again.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunDigitalTwinSim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) {
      setFormError('Select a trip first.');
      return;
    }
    setRunningSim(true);
    setFormError(null);
    try {
      const loc = selectedNode?.origin || selectedNode?.location || journey?.title || 'Mumbai';
      const res = await axios.post(`${API_BASE_URL}/digital-twin/simulate`, {
        journey_id: selectedTripId,
        location: loc,
        rainfall: simRainfall,
        wind: simWind,
        visibility: simVisibility,
        temperature: simTemp,
      });
      setSimResult(res.data || {});

      // Trigger read-only weather disruption event so user view immediately updates
      const flightNode = activeBookingNodes.find((n) => (n.type || '').toUpperCase() === 'FLIGHT') || activeBookingNodes[0];
      const delayMinutes = res.data?.prediction?.estimated_delay_minutes || (simRainfall > 80 ? 300 : 120);

      if (flightNode) {
        const payload = {
          trip_id: selectedTripId,
          affected_node_id: flightNode.backendId || flightNode.id,
          entity_id: flightNode.backendId || flightNode.id,
          type: 'WEATHER_CONVECTIVE_DELAY',
          event_type: 'WEATHER_CONVECTIVE_DELAY',
          detected_at: new Date().toISOString(),
          reason: `Simulated Weather Disruption (Rain: ${simRainfall}mm, Wind: ${simWind}km/h, Vis: ${simVisibility}km, Temp: ${simTemp}°C)`,
          delay_minutes: delayMinutes,
          event_metadata: {
            rainfall: simRainfall,
            wind: simWind,
            visibility: simVisibility,
            temperature: simTemp,
          },
        };
        await triggerTripDisruption(selectedTripId, payload, true).catch(() => null);
        const updatedHistory = await fetchTripDisruptions(selectedTripId);
        setDisruptionHistory(updatedHistory || []);
      }

      setToastMsg('Digital Twin simulation executed (read-only disruption triggered)!');
    } catch (err: any) {
      console.error('Failed to execute Digital Twin simulation:', err);
      const msg = err?.response?.data?.detail || 'Failed to execute Digital Twin simulation.';
      setFormError(msg);
    } finally {
      setRunningSim(false);
    }
  };

  const handleResetSimulation = async () => {
    if (!selectedTripId) return;

    setResetting(true);
    setFormError(null);

    try {
      await resetTripDisruptions(selectedTripId);
      setDisruptionHistory([]);

      if (journey && activeBookingNodes.length > 0) {
        const firstNode = activeBookingNodes[0];
        setSelectedNodeId(firstNode.id);
        const opts = getDisruptionOptions(firstNode.type);
        if (opts.length > 0) setDisruptionType(opts[0].value);
      } else {
        setSelectedNodeId('');
      }
      setDetectedAt(formatNowForInput());
      setReason('Operational disruption');
      setDelayMinutes(120);

      setToastMsg('Simulation state reset successfully!');
    } catch (err) {
      console.error('Failed to reset simulation:', err);
      setFormError('Unable to reset simulation. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const handleResetAllSimulations = async () => {
    setResetting(true);
    setFormError(null);
    try {
      await resetAllSimulations();
      setDisruptionHistory([]);
      setToastMsg('All simulations across all trips reset successfully!');
    } catch (err) {
      console.error('Failed to reset all simulations:', err);
      setFormError('Unable to reset all simulations. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const handleResetIndividual = async (disruptionId: number) => {
    if (!selectedTripId) return;
    try {
      await resetIndividualDisruption(selectedTripId, disruptionId);
      setToastMsg(`Disruption #${disruptionId} reset successfully!`);
      const updatedHistory = await fetchTripDisruptions(selectedTripId);
      setDisruptionHistory(updatedHistory || []);
    } catch (err) {
      console.error(`Failed to reset disruption #${disruptionId}:`, err);
      setFormError(`Unable to reset disruption #${disruptionId}.`);
    }
  };

  const activeDisruption = (disruptionHistory || []).find((d: any) => (d.status || 'ACTIVE') === 'ACTIVE') ?? null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      {/* Reset ALL Confirmation Modal */}
      {showResetAllConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Reset all simulations?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will clear active simulation/disruption states across all journeys. Confirmed real itineraries will not be changed.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetAllConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowResetAllConfirm(false);
                  await handleResetAllSimulations();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md transition-colors"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Control Center Header */}
      <header className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Back to Traveler Home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Travora Admin</span>
                  <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Simulation Console
                  </span>
                  {viewMode === 'ORIGINAL' && (
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                      Viewing Original
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Simulate real-world disruptions against active journeys
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowResetAllConfirm(true)}
              disabled={resetting}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Reset all disruption simulations across all trips"
            >
              <RotateCcw className={`h-3.5 w-3.5 text-rose-500 ${resetting ? 'animate-spin' : ''}`} />
              <span>Reset ALL Simulations</span>
            </button>
            <button
              onClick={() => navigate('/app')}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Layout className="h-3.5 w-3.5 text-sky-500" />
              <span>Legacy Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Admin Body */}
      <main className="max-w-6xl mx-auto px-4 mt-6">
        {formError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300 text-xs flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Simulation Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 space-y-5">
              {/* ── 2-MODE TAB SWITCHER: OPERATIONAL vs WEATHER WHAT-IF ── */}
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdminTab('operational')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    adminTab === 'operational'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm border border-slate-200 dark:border-slate-800'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Radio className="h-3.5 w-3.5 text-amber-500" />
                  <span>1. Operational Disruption</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdminTab('weather_whatif')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    adminTab === 'weather_whatif'
                      ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200 dark:border-slate-800'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <CloudRain className="h-3.5 w-3.5 text-sky-500" />
                  <span>2. Weather What-If Simulation</span>
                </button>
              </div>

              {adminTab === 'operational' ? (
                <form onSubmit={handleTriggerDisruption} className="space-y-4">
                  {/* 1. Active Trip Selection */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      1. Select Active Trip *
                    </label>
                    <select
                      value={selectedTripId ?? ''}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedTripId(id);
                        setActiveTripId(id);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {tripsList.length === 0 && (
                        <option value="">No active journeys found for this account.</option>
                      )}
                      {tripsList.map((t) => (
                        <option key={t.id} value={t.id}>
                          #{t.id} · {t.title}
                        </option>
                      ))}
                    </select>
                    {tripsList.length === 0 && (
                      <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                        No active journeys found for this account. Create a journey in{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/build')}
                          className="underline font-bold"
                        >
                          Trip Builder
                        </button>
                        , then select it here.
                      </p>
                    )}
                  </div>

                  {/* Weather Context Widget */}
                  {selectedTripId && (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <CloudRain className="h-4 w-4 text-sky-500" />
                          <span>WEATHER CONTEXT</span>
                          {weather && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({weather.location})
                            </span>
                          )}
                        </span>
                        {loadingWeather ? (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin text-sky-500" /> Fetching live weather...
                          </span>
                        ) : weather ? (
                          <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                              weather.is_live
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                weather.is_live ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                              }`}
                            />
                            {weather.is_live ? 'LIVE' : 'FALLBACK'}
                          </span>
                        ) : null}
                      </div>

                      {loadingWeather ? (
                        <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-sky-500" />
                          Loading environmental weather context...
                        </div>
                      ) : weatherError ? (
                        <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs">
                          {weatherError}
                        </div>
                      ) : weather ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
                                <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                                <span>{weather.temperature}°C</span>
                              </div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Temp</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
                                <CloudRain className="h-3.5 w-3.5 text-sky-500" />
                                <span>{weather.rainfall} mm</span>
                              </div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Rainfall</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
                                <Wind className="h-3.5 w-3.5 text-teal-500" />
                                <span>{weather.wind} km/h</span>
                              </div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Wind</p>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                              <div className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center justify-center gap-0.5">
                                <Eye className="h-3.5 w-3.5 text-indigo-500" />
                                <span>{weather.visibility} km</span>
                              </div>
                              <p className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Visibility</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-1">
                            <span>Condition: <strong className="text-slate-800 dark:text-slate-200">{weather.condition}</strong></span>
                            <span>Updated: <strong className="text-slate-800 dark:text-slate-200">{weather.timestamp}</strong></span>
                            <span>Source: <strong className="text-slate-800 dark:text-slate-200">{weather.source}</strong></span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* 2. Select Affected Booking */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      2. Select Affected Booking *
                    </label>
                    <p className="text-[10px] text-slate-400 mb-1.5">
                      Active bookings only (replaced originals hidden after recovery)
                    </p>
                    {loadingTrip ? (
                      <div className="py-3 text-xs text-slate-500 flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full animate-spin border-2 border-slate-300 border-t-amber-500" />
                        Loading trip bookings...
                      </div>
                    ) : activeBookingNodes.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs text-center">
                        No active booking items found in this journey. Add a flight, transport, hotel, or other booking item in Trip Builder first.
                      </div>
                    ) : (
                      <select
                        value={selectedNodeId}
                        onChange={(e) => setSelectedNodeId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        {activeBookingNodes.map((n) => {
                          const routeLabel = n.origin && n.destination ? `${n.origin} → ${n.destination}` : n.location || '';
                          const dateLabel = n.startDate || (n.startTime ? n.startTime.split('T')[0] : '');
                          return (
                            <option key={n.id} value={n.id}>
                              [{n.type.toUpperCase()}] {n.title} {routeLabel ? `(${routeLabel})` : ''} {dateLabel ? `· ${dateLabel}` : ''}
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  {/* 3. Disruption Type */}
                  {selectedNode && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                        3. Disruption Type *
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {getDisruptionOptions(selectedNode.type).map((opt) => {
                          const isSelected = disruptionType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setDisruptionType(opt.value)}
                              className={`p-3 rounded-xl border text-left transition-all flex items-start justify-between ${
                                isSelected
                                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 ring-2 ring-amber-500/50'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900'
                              }`}
                            >
                              <div>
                                <p className="font-bold text-xs text-slate-900 dark:text-white">{opt.label}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
                              </div>
                              {isSelected && <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 mt-1" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4. Delay Duration (Conditional) */}
                  {isDelayType && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                        4. Delay Duration (Minutes) *
                      </label>
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {[30, 60, 90, 120, 180].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setDelayMinutes(m)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                delayMinutes === m
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              +{m} min
                            </button>
                          ))}
                        </div>
                        <input
                          type="number"
                          min="1"
                          value={delayMinutes}
                          onChange={(e) => setDelayMinutes(Number(e.target.value))}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold"
                          placeholder="Custom minutes..."
                        />
                      </div>
                    </div>
                  )}

                  {/* 5. Detected At */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      Detected At *
                    </label>
                    <input
                      type="datetime-local"
                      value={detectedAt}
                      onChange={(e) => setDetectedAt(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Time Travora system detected the event. Does NOT overwrite scheduled time.
                    </p>
                  </div>

                  {/* 6. Reason */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Operational disruption, Weather disruption"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['Weather disruption', 'Operational disruption', 'Technical issue', 'Schedule change'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setReason(r)}
                          className="text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Action */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || !selectedNode}
                      className={`w-full py-3 rounded-2xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                        submitting || !selectedNode
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                      }`}
                    >
                      <Zap className="h-4 w-4" />
                      <span>{submitting ? 'Triggering Disruption...' : 'TRIGGER OPERATIONAL DISRUPTION'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Weather What-If Simulation Form */
                <form onSubmit={handleRunDigitalTwinSim} className="space-y-5">
                  <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-800 dark:text-sky-300 text-xs space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0" />
                      <span>READ-ONLY WEATHER STRESS TEST</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug">
                      Simulate extreme weather parameters against your digital twin. Runs Random Forest ML predictions and evaluates cascading impacts across Flight → Transport → Hotel without mutating real journey data.
                    </p>
                  </div>

                  {/* Presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                      Quick Stress Presets
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSimRainfall(0);
                          setSimWind(10);
                          setSimVisibility(10);
                          setSimTemp(28);
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-sky-400 text-left transition-all"
                      >
                        <span className="font-bold text-xs block text-slate-900 dark:text-white">☀️ Clear / Normal</span>
                        <span className="text-[10px] text-slate-400 block">0mm rain, 10km/h wind</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSimRainfall(65);
                          setSimWind(45);
                          setSimVisibility(2.5);
                          setSimTemp(26);
                        }}
                        className="p-2.5 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/30 hover:border-sky-500 text-left transition-all"
                      >
                        <span className="font-bold text-xs block text-sky-900 dark:text-sky-200">🌧️ Heavy Monsoon</span>
                        <span className="text-[10px] text-sky-600 dark:text-sky-400 block">65mm rain, 45km/h wind</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSimRainfall(125);
                          setSimWind(85);
                          setSimVisibility(0.8);
                          setSimTemp(21);
                        }}
                        className="p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 hover:border-rose-500 text-left transition-all"
                      >
                        <span className="font-bold text-xs block text-rose-900 dark:text-rose-200">⚡ Severe Storm</span>
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 block">125mm rain, 85km/h wind</span>
                      </button>
                    </div>
                  </div>

                  {/* Sliders */}
                  <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <CloudRain className="h-3.5 w-3.5 text-sky-500" />
                          Rainfall
                        </span>
                        <span className="font-mono text-sky-600 dark:text-sky-400">{simRainfall} mm/h</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="150"
                        step="5"
                        value={simRainfall}
                        onChange={(e) => setSimRainfall(Number(e.target.value))}
                        className="w-full accent-sky-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Wind className="h-3.5 w-3.5 text-teal-500" />
                          Wind Speed
                        </span>
                        <span className="font-mono text-teal-600 dark:text-teal-400">{simWind} km/h</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="120"
                        step="5"
                        value={simWind}
                        onChange={(e) => setSimWind(Number(e.target.value))}
                        className="w-full accent-teal-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Eye className="h-3.5 w-3.5 text-indigo-500" />
                          Visibility
                        </span>
                        <span className="font-mono text-indigo-600 dark:text-indigo-400">{simVisibility} km</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.5"
                        value={simVisibility}
                        onChange={(e) => setSimVisibility(Number(e.target.value))}
                        className="w-full accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Thermometer className="h-3.5 w-3.5 text-amber-500" />
                          Temperature
                        </span>
                        <span className="font-mono text-amber-600 dark:text-amber-400">{simTemp} °C</span>
                      </div>
                      <input
                        type="range"
                        min="-10"
                        max="50"
                        step="1"
                        value={simTemp}
                        onChange={(e) => setSimTemp(Number(e.target.value))}
                        className="w-full accent-amber-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Run Sim Action */}
                  <button
                    type="submit"
                    disabled={runningSim || !selectedTripId}
                    className={`w-full py-3 rounded-2xl font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 ${
                      runningSim || !selectedTripId
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20 cursor-pointer'
                    }`}
                  >
                    {runningSim ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    <span>{runningSim ? 'Running Random Forest ML Digital Twin...' : 'RUN DIGITAL TWIN SIMULATION'}</span>
                  </button>

                  {/* Simulation Result Output */}
                  {simResult && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-sky-300 dark:border-sky-800 shadow-xl space-y-4 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4" />
                          <span>DIGITAL TWIN SIMULATION RESULT</span>
                        </span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 font-bold">
                          READ-ONLY SIMULATION
                        </span>
                      </div>

                      {/* Disruption & Risk Summary */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 font-bold block uppercase text-[9px]">Disruption Prob</span>
                          <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">
                            {Math.round((simResult.prediction?.disruption_probability ?? 0) * 100)}%
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 font-bold block uppercase text-[9px]">Estimated Delay</span>
                          <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                            +{simResult.prediction?.estimated_delay_minutes ?? 0}m
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs text-slate-500 font-bold block uppercase text-[9px]">ML Risk Level</span>
                          <span className={`text-xs font-extrabold uppercase px-2 py-1 rounded-lg inline-block mt-0.5 ${
                            simResult.prediction?.risk_level === 'HIGH'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : simResult.prediction?.risk_level === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {simResult.prediction?.risk_level || 'LOW'}
                          </span>
                        </div>
                      </div>

                      {/* Cascading Effects propagation flow */}
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-2">
                          Cascading Twin Propagation
                        </span>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/60 text-sky-800 dark:text-sky-200 text-[10px]">✈ Flight</span>
                            <span>→</span>
                            <span className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-[10px]">🚗 Ground Transport</span>
                            <span>→</span>
                            <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px]">🏨 Hotel</span>
                          </div>

                          {simResult.cascading_effects?.length > 0 ? (
                            <div className="space-y-1 pt-1">
                              {simResult.cascading_effects.map((eff: string, idx: number) => (
                                <p key={idx} className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                  <span>{eff}</span>
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-1">
                              ✓ No downstream disruption cascades under these weather parameters.
                            </p>
                          )}
                        </div>
                      </div>

                      {simResult.nugen_reasoning && (
                        <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-950/70 text-xs text-slate-700 dark:text-slate-300 italic border border-slate-200 dark:border-slate-800">
                          <span className="font-bold not-italic block mb-1 text-[10px] text-slate-500 uppercase">AI Reasoning Summary:</span>
                          "{typeof simResult.nugen_reasoning === 'string'
                            ? simResult.nugen_reasoning
                            : simResult.nugen_reasoning?.explanation || simResult.nugen_reasoning?.reasoning || 'Domain reasoning evaluated against weather parameters.'}"
                        </div>
                      )}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Active Simulation & Trip Details (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Active Simulation Status Card */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  ACTIVE SIMULATION
                </span>
                {activeDisruption && (
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    ACTIVE
                  </span>
                )}
              </div>

              {/* Safety Badge Banner */}
              <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold tracking-wider uppercase flex items-center justify-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span>SIMULATION MODE — REAL JOURNEY UNCHANGED</span>
              </div>

              {activeDisruption ? (
                <div className="p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 block">
                        {activeDisruption.type || activeDisruption.event_type}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-0.5">
                        {selectedNode ? selectedNode.title : `Node #${activeDisruption.entity_id}`}
                      </h3>
                    </div>
                    <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
                  </div>

                  <div className="text-xs space-y-1 text-slate-600 dark:text-slate-300 font-medium">
                    {journey?.title && (
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                        Journey: {journey.title}
                      </p>
                    )}
                    {activeDisruption.severity && (
                      <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                        Risk Level: {activeDisruption.severity}
                      </p>
                    )}
                    {activeDisruption.event_metadata?.detected_at && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span>Detected at {fmtDisplayTime(activeDisruption.event_metadata.detected_at)}</span>
                      </p>
                    )}
                    {activeDisruption.event_metadata?.delay_minutes !== undefined && activeDisruption.event_metadata?.delay_minutes !== null && (
                      <p className="text-amber-700 dark:text-amber-300 font-bold">
                        Estimated Delay: +{activeDisruption.event_metadata.delay_minutes} minutes
                      </p>
                    )}
                    {activeDisruption.event_metadata?.reason && (
                      <p className="text-slate-500 italic">Disruption: "{activeDisruption.event_metadata.reason}"</p>
                    )}
                  </div>

                  {/* Affected Entities Summary */}
                  {activeBookingNodes.length > 0 && (
                    <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/60 text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Affected Entities ({activeBookingNodes.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {activeBookingNodes.map((n) => (
                          <span
                            key={n.id}
                            className="px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 font-semibold border border-rose-200/50 dark:border-rose-900/50 text-slate-700 dark:text-slate-300"
                          >
                            [{n.type}] {n.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No active disruption triggered for this trip.
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => navigate('/digital-twin')}
                  className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>OPEN DIGITAL TWIN</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/disruption')}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>VIEW RECOVERY OPTIONS</span>
                </button>
              </div>

              {/* Reset Simulation Controls */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleResetSimulation}
                  disabled={resetting || !selectedTripId}
                  className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                  title="Clear all active disruptions for current trip"
                >
                  <RotateCcw className={`h-3.5 w-3.5 text-slate-500 ${resetting ? 'animate-spin' : ''}`} />
                  <span>Reset Trip</span>
                </button>

                <button
                  onClick={() => setShowResetAllConfirm(true)}
                  disabled={resetting}
                  className="py-2 px-3 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 font-semibold text-xs text-rose-700 dark:text-rose-300 transition-colors flex items-center justify-center gap-1.5"
                  title="Clear all simulations across all trips"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                  <span>Reset ALL</span>
                </button>
              </div>
            </div>

            {/* Selected Booking Preview */}
            {selectedNode && (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 space-y-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 block">
                  SELECTED BOOKING DETAILS
                </span>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      {selectedNode.type}
                    </span>
                    {selectedNode.bookingRef && (
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedNode.bookingRef}
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {selectedNode.title}
                  </h4>

                  {selectedNode.origin && selectedNode.destination && (
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {selectedNode.origin} → {selectedNode.destination}
                    </p>
                  )}

                  {selectedNode.location && (
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-sky-500" />
                      {selectedNode.location}
                    </p>
                  )}

                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-sky-500" />
                    <span>
                      {selectedNode.startDate || (selectedNode.startTime ? selectedNode.startTime.split('T')[0] : 'Date not set')}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Disruption History */}
            {disruptionHistory.length > 0 && (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    DISRUPTION HISTORY ({disruptionHistory.length})
                  </span>
                  <button
                    onClick={handleResetSimulation}
                    className="text-[10px] font-semibold text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Clear History
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {disruptionHistory.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 text-xs flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {h.event_type || h.type}
                          </span>
                          {h.id && (
                            <span className="font-mono text-[9px] text-slate-400 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.2 rounded">
                              #{h.id}
                            </span>
                          )}
                          {h.status === 'RESOLVED' ? (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              ✓ RESOLVED
                            </span>
                          ) : (
                            <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        {h.event_metadata?.reason && (
                          <p className="text-[10px] text-slate-500 truncate">{h.event_metadata.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-slate-400">
                          {fmtDisplayTime(h.timestamp)}
                        </span>
                        {h.id && (
                          <button
                            onClick={() => handleResetIndividual(h.id)}
                            title="Reset this individual simulation event"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
