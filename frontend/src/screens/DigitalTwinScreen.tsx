/**
 * DigitalTwinScreen.tsx
 *
 * Dedicated Weather-Driven Digital Twin Experience for HackCelestial 3.0.
 *
 * Architecture Flow:
 * LIVE WEATHER → AI PREDICTION → DIGITAL TWIN → WHAT-IF SIMULATION →
 * CASCADING IMPACT → MAP → SOCIAL SIGNALS → RECOVERY OPTIONS
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Plane,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { DigitalTwinRiskHeader } from '../components/digitalTwin/DigitalTwinRiskHeader';
import { WeatherPanel } from '../components/digitalTwin/WeatherPanel';
import { DigitalTwinMap } from '../components/digitalTwin/DigitalTwinMap';
import { ImpactPropagationPipeline } from '../components/digitalTwin/ImpactPropagationPipeline';
import { BeforeAfterComparison } from '../components/digitalTwin/BeforeAfterComparison';
import { NugenExplanationCard } from '../components/digitalTwin/NugenExplanationCard';
import { PublicSignalsSection } from '../components/digitalTwin/PublicSignalsSection';
import { WhatIfController } from '../components/digitalTwin/WhatIfController';

import { useJourney, triggerTripDisruption, getActiveTripId, fetchTripById } from '../store/journeyStore';
import { subscribeToTripUpdates } from '../store/tripSync';
import {
  fetchCurrentWeather,
  simulateDigitalTwin,
  fetchSocialSignals,
  BASELINE_LIVE_WEATHER,
  generateMockSimulation,
} from '../services/digitalTwinApi';
import type {
  DigitalTwinSimulateResponse,
  WeatherDataResponse,
  SocialSignalsResponse,
} from '../types/digitalTwin';

const NOMINAL_WEATHER = { rainfall: 0, wind: 10, visibility: 10, temperature: 28 };

export default function DigitalTwinScreen() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId?: string }>();
  const { journey } = useJourney();

  // ── Meteorological Parameters ───────────────────────────────────────────────
  const [rainfall, setRainfall] = useState<number>(NOMINAL_WEATHER.rainfall);
  const [wind, setWind] = useState<number>(NOMINAL_WEATHER.wind);
  const [visibility, setVisibility] = useState<number>(NOMINAL_WEATHER.visibility);
  const [temperature, setTemperature] = useState<number>(NOMINAL_WEATHER.temperature);

  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ── Telemetry & AI Model Data ───────────────────────────────────────────────
  const [weatherData, setWeatherData] = useState<WeatherDataResponse | null>(null);
  const [simulationResult, setSimulationResult] = useState<DigitalTwinSimulateResponse | null>(
    null
  );
  const [socialSignals, setSocialSignals] = useState<SocialSignalsResponse | null>(null);

  const activeTripId = tripId
    ? parseInt(tripId, 10) || getActiveTripId() || journey?.id || 1
    : getActiveTripId() || journey?.id || 1;
  const journeyTitle = journey?.title || `Journey #${activeTripId}`;

  // ── Execute Simulation Function ─────────────────────────────────────────────
  const executeSimulation = useCallback(
    async (r: number, w: number, v: number, t: number) => {
      setIsSimulating(true);
      try {
        const sim = await simulateDigitalTwin(
          {
            journey_id: activeTripId,
            location: 'Mumbai',
            rainfall: r,
            wind: w,
            visibility: v,
            temperature: t,
          },
          journey?.nodes
        );
        setSimulationResult(sim);
      } catch (err: any) {
        console.warn('Simulation execution fallback:', err?.message);
        setSimulationResult(
          generateMockSimulation(activeTripId, { rainfall: r, wind: w, visibility: v, temperature: t }, journey?.nodes)
        );
      } finally {
        setIsSimulating(false);
      }
    },
    [activeTripId, journey?.nodes]
  );

  // ── Initialize Weather & Simulation ─────────────────────────────────────────
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const targetTripId = tripId
      ? parseInt(tripId, 10) || getActiveTripId() || 1
      : getActiveTripId() || journey?.id || 1;

    try {
      // 1. Fetch Live Weather Observation for Mumbai (BOM)
      const weather = await fetchCurrentWeather('Mumbai');
      setWeatherData(weather);

      // 2. Fetch Public Signals for Mumbai Area
      const signals = await fetchSocialSignals('Mumbai');
      setSocialSignals(signals);

      let currentJourney = journey;
      if (!currentJourney || currentJourney.id !== targetTripId) {
        try {
          currentJourney = await fetchTripById(targetTripId);
        } catch {
          // ignore
        }
      }

      // Start in a nominal, non-simulated state. Existing disruptions must not
      // pre-populate this what-if tool with a severe synthetic weather scenario.
      setRainfall(NOMINAL_WEATHER.rainfall);
      setWind(NOMINAL_WEATHER.wind);
      setVisibility(NOMINAL_WEATHER.visibility);
      setTemperature(NOMINAL_WEATHER.temperature);
      setIsSimulatedMode(false);
      setSimulationResult(generateMockSimulation(targetTripId, NOMINAL_WEATHER, currentJourney?.nodes));
    } catch (err: any) {
      console.warn('Initial telemetry error, using contract fallback:', err?.message);
      setSimulationResult(
        generateMockSimulation(targetTripId, NOMINAL_WEATHER, journey?.nodes)
      );
    } finally {
      setLoading(false);
    }
  }, [activeTripId, tripId, journey]);

  useEffect(() => {
    loadInitialData();
    const unsubscribe = subscribeToTripUpdates(null, () => {
      loadInitialData();
    });
    return () => unsubscribe();
  }, [loadInitialData]);

  // ── Reactive simulation only after the traveler changes a weather control ──
  useEffect(() => {
    if (!isSimulatedMode) return;
    const timeout = setTimeout(() => {
      executeSimulation(rainfall, wind, visibility, temperature);
    }, 350);

    return () => clearTimeout(timeout);
  }, [rainfall, wind, visibility, temperature, executeSimulation, isSimulatedMode]);

  const updateWeather = (setter: (value: number) => void, value: number) => {
    setter(value);
    setIsSimulatedMode(true);
  };

  const resetToNominal = () => {
    setRainfall(NOMINAL_WEATHER.rainfall);
    setWind(NOMINAL_WEATHER.wind);
    setVisibility(NOMINAL_WEATHER.visibility);
    setTemperature(NOMINAL_WEATHER.temperature);
    setIsSimulatedMode(false);
    setSimulationResult(generateMockSimulation(activeTripId, NOMINAL_WEATHER, journey?.nodes));
  };

  const runSimulation = () => {
    setIsSimulatedMode(true);
    void executeSimulation(rainfall, wind, visibility, temperature);
  };

  // ── Connect to Existing Recovery Screen ────────────────────────────────────
  const handleViewRecoveryOptions = async () => {
    const risk = simulationResult?.prediction.disruption_probability ?? 0;
    if (risk < 0.4) return;
    const tripToDisrupt = journey?.id || 7;

    try {
      const flightNode = journey?.nodes?.find((n) => (n.type || '').toUpperCase() === 'FLIGHT');
      const affectedNode = flightNode || journey?.nodes?.[0];
      const delayMinutes = simulationResult?.prediction.estimated_delay_minutes || 279;

      const payload = {
        trip_id: tripToDisrupt,
        affected_node_id: affectedNode?.backendId || 1,
        entity_id: affectedNode?.backendId || 1,
        type: 'WEATHER_CONVECTIVE_DELAY',
        event_type: 'WEATHER_CONVECTIVE_DELAY',
        detected_at: new Date().toISOString(),
        reason: `Digital Twin What-If: Convective weather (${rainfall}mm rain, ${wind}km/h wind)`,
        delay_minutes: delayMinutes,
      };

      await triggerTripDisruption(tripToDisrupt, payload).catch(() => null);
    } catch {
      // offline fallback
    }

    // Seamless navigation to existing recovery screen
    navigate('/disruption');
  };

  // ── Loading Skeleton State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
        <SkyWayNavbar />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-full animate-spin border-4 border-slate-200 border-t-sky-600" />
            <div className="absolute inset-2 flex items-center justify-center">
              <Plane className="h-5 w-5 text-sky-600" style={{ transform: 'rotate(-30deg)' }} />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="text-base font-extrabold text-slate-900">
              Synchronizing Digital Twin Telemetry...
            </h3>
            <p className="text-xs text-slate-500">
              Evaluating live weather observations, airport telemetry, and DAG propagation constraints.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ── Error State with Resilient Retry ────────────────────────────────────────
  if (error || !simulationResult) {
    return (
      <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
        <SkyWayNavbar />
        <main className="max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16 flex-1 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center shadow-md">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900">
            Digital Twin Telemetry Unavailable
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Unable to establish websocket or HTTP connection to digital twin engine. You can retry
            or initialize offline synthetic simulation.
          </p>
          <button
            onClick={loadInitialData}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </main>
      </div>
    );
  }

  const liveWeatherToUse = weatherData?.current || BASELINE_LIVE_WEATHER;
  const forecastToUse = weatherData?.forecast || [];
  const hasActionableDisruption = simulationResult.prediction.disruption_probability >= 0.4;

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={simulationResult.prediction.disruption_probability > 0.6} />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {/* ── PHASE 1 & 8: RISK HEADER & RECOVERY BUTTON ── */}
        <DigitalTwinRiskHeader
          journeyTitle={journeyTitle}
          tripId={activeTripId}
          isSimulated={isSimulatedMode}
          prediction={simulationResult.prediction}
          rainfall={rainfall}
          wind={wind}
          visibility={visibility}
          onViewRecovery={handleViewRecoveryOptions}
          canViewRecovery={hasActionableDisruption}
        />

        {/* ── PHASE 5: WEATHER PANEL (LIVE vs SIMULATED) ── */}
        <WeatherPanel
          liveWeather={liveWeatherToUse}
          simulatedWeather={{ rainfall, wind, visibility, temperature }}
          forecast={forecastToUse}
          locationName="Mumbai Airport Area (BOM)"
          isSimulatedMode={isSimulatedMode}
        />

        <WhatIfController
          rainfall={rainfall}
          wind={wind}
          visibility={visibility}
          temperature={temperature}
          onRainfallChange={(value) => updateWeather(setRainfall, value)}
          onWindChange={(value) => updateWeather(setWind, value)}
          onVisibilityChange={(value) => updateWeather(setVisibility, value)}
          onTemperatureChange={(value) => updateWeather(setTemperature, value)}
          onSimulate={runSimulation}
          onResetToLive={resetToNominal}
          isSimulating={isSimulating}
          isCustomSimulated={isSimulatedMode}
        />

        {/* ── PHASE 4: LEAFLET + OPENSTREETMAP MAP VISUALIZATION ── */}
        <DigitalTwinMap
          journey={journey}
          affectedEntities={simulationResult.affected_entities}
          currentRainfall={rainfall}
          currentWind={wind}
          currentVisibility={visibility}
          disruptionProb={simulationResult.prediction.disruption_probability}
          isSimulated={isSimulatedMode}
        />

        {/* ── PHASE 1 & CASCADING IMPACT PROPAGATION PIPELINE ── */}
        <ImpactPropagationPipeline
          affectedEntities={simulationResult.affected_entities}
          estimatedDelayMinutes={simulationResult.prediction.estimated_delay_minutes}
        />

        {/* ── PHASE 3: BEFORE / AFTER SIMULATION COMPARISON ── */}
        <BeforeAfterComparison
          rainfall={rainfall}
          wind={wind}
          visibility={visibility}
          estimatedDelayMinutes={simulationResult.prediction.estimated_delay_minutes}
          disruptionProb={simulationResult.prediction.disruption_probability}
          transportImpact={simulationResult.prediction.transport_impact}
          hotelImpact={simulationResult.prediction.hotel_impact}
          isSimulated={isSimulatedMode}
        />

        {/* ── PHASE 6: NUGEN AI EXPLANATION CARD ── */}
        <NugenExplanationCard
          reasoning={simulationResult.nugen_reasoning}
          affectedEntities={simulationResult.affected_entities}
          cascadingEffects={simulationResult.cascading_effects}
          confidence={simulationResult.prediction.confidence}
        />

        {/* ── PHASE 7: PUBLIC / SOCIAL SIGNALS SECTION ── */}
        <PublicSignalsSection
          location={socialSignals?.location || 'Mumbai Airport Area'}
          signals={socialSignals?.signals || []}
          isLive={Boolean(socialSignals?.is_live)}
        />

        {/* ── BOTTOM ACTION BAR: DIRECT LINK TO EXISTING RECOVERY ── */}
        <div className={`text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border ${hasActionableDisruption ? 'bg-gradient-to-r from-slate-900 to-indigo-950 border-slate-800' : 'bg-gradient-to-r from-emerald-800 to-teal-900 border-emerald-800'}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${hasActionableDisruption ? 'bg-rose-500 animate-ping' : 'bg-emerald-300'}`} />
              <h3 className="text-lg font-black tracking-tight text-white">
                {hasActionableDisruption ? 'Disruption Propagation Detected' : 'Journey Monitoring Normal'}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              {hasActionableDisruption
                ? `The selected scenario has a ${Math.round(simulationResult.prediction.disruption_probability * 100)}% disruption probability and an estimated ${simulationResult.prediction.estimated_delay_minutes} min departure shift. Recovery options are available.`
                : 'Your itinerary is within operational limits. Adjust the weather controls to evaluate a what-if scenario; recovery is only offered when a disruption is likely.'}
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3 w-full md:w-auto">
            {hasActionableDisruption && (
              <button
                onClick={handleViewRecoveryOptions}
                className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2.5"
              >
                <span>VIEW RECOVERY OPTIONS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
