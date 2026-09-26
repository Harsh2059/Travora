import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import {
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

/** Active bookings only — hide REPLACED / RESTORED_DEMO / CANCELLED.
 *  Also hides recovery replacements when their original is still active
 *  (guards against duplicate CONFIRMED original + replacement rows). */
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
        // Original still active → this replacement is a duplicate; hide it
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

  // Status & Feedback
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [resetting, setResetting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
      fetchTripById(selectedTripId, true), // admin=true: bypass ownership check
      fetchTripDisruptions(selectedTripId),
    ])
      .then(([j, history]) => {
        setJourney(j);
        const historyList = history || [];
        setDisruptionHistory(historyList);
        
        // Let the effect that depends on journey/viewMode handle reconciliation
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
    
    // Sync view mode
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

  useEffect(() => {
    if (loadingTrip || !journey) return;

    // Check if the current selected node is still valid
    const stillValid = activeBookingNodes.some(n => n.id === selectedNodeId);
    const activeDisp = disruptionHistory.find((d: any) => (d.status || 'ACTIVE') === 'ACTIVE') ?? null;

    if (!stillValid && activeBookingNodes.length > 0) {
      // If we have an active disruption, try to select its node
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
      // Otherwise fallback to first active node
      setSelectedNodeId(activeBookingNodes[0].id);
    } else if (activeBookingNodes.length === 0) {
      setSelectedNodeId('');
    }

    if (activeDisp && stillValid) {
       // Hydrate disruption form from active disruption
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

      await triggerTripDisruption(selectedTripId, payload, true); // admin=true: bypass ownership check
      setToastMsg('Disruption triggered successfully!');

      // Refresh disruption history
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

  const handleResetSimulation = async () => {
    if (!selectedTripId) return;

    setResetting(true);
    setFormError(null);

    try {
      await resetTripDisruptions(selectedTripId);
      setDisruptionHistory([]);

      // Reset form state to clean initial defaults
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
              onClick={handleResetAllSimulations}
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
              <span>Phase 2 Legacy Demo</span>
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Radio className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span>TRIGGER DISRUPTION EVENT</span>
                </span>
              </div>

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
                      <option value="">No trips found for current user</option>
                    )}
                    {tripsList.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.id} · {t.title}
                      </option>
                    ))}
                  </select>
                  {tripsList.length === 0 && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                      No trips yet. Create a journey in{' '}
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
                      No active booking items found in this trip. Add items in Trip Builder first.
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
                    placeholder="e.g. Operational disruption, Weather, ATC holding"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Operational disruption', 'Weather disruption', 'Technical issue', 'Schedule change'].map((r) => (
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
                    <span>{submitting ? 'Triggering Disruption...' : 'TRIGGER DISRUPTION'}</span>
                  </button>
                </div>
              </form>
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
                    {activeDisruption.event_metadata?.detected_at && (
                      <p className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span>Detected at {fmtDisplayTime(activeDisruption.event_metadata.detected_at)}</span>
                      </p>
                    )}
                    {activeDisruption.event_metadata?.delay_minutes && (
                      <p className="text-amber-700 dark:text-amber-300 font-bold">
                        Delay: +{activeDisruption.event_metadata.delay_minutes} minutes
                      </p>
                    )}
                    {activeDisruption.event_metadata?.reason && (
                      <p className="text-slate-500 italic">"{activeDisruption.event_metadata.reason}"</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No active disruption triggered for this trip.
                </div>
              )}

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
                  onClick={handleResetAllSimulations}
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
