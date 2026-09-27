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

import { useJourney, triggerTripDisruption, fetchTripDisruptions, getActiveTripId, fetchTripById } from '../store/journeyStore';
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

function extractWeatherFromDisruption(disruption: any): {
  rainfall: number;
  wind: number;
  visibility: number;
  temperature: number;
} | null {
  if (!disruption) return null;

  const meta = disruption.event_metadata || {};
  if (meta.rainfall !== undefined || meta.wind !== undefined) {
    return {
      rainfall: Number(meta.rainfall ?? 150),
      wind: Number(meta.wind ?? 55),
      visibility: Number(meta.visibility ?? 1.0),
      temperature: Number(meta.temperature ?? 31.0),
    };
  }

  const reasonText = String(disruption.reason || meta.reason || '');
  if (!reasonText) return null;

  const rainMatch = reasonText.match(/(\d+(?:\.\d+)?)\s*mm/i);
  const windMatch = reasonText.match(/(\d+(?:\.\d+)?)\s*km\/h/i);
  const visMatch = reasonText.match(/Vis(?:ibility)?:?\s*(\d+(?:\.\d+)?)\s*km/i);
  const tempMatch = reasonText.match(/Temp(?:erature)?:?\s*(\d+(?:\.\d+)?)\s*°?C/i);

  if (rainMatch || windMatch || visMatch || tempMatch) {
    return {
      rainfall: rainMatch ? parseFloat(rainMatch[1]) : 150,
      wind: windMatch ? parseFloat(windMatch[1]) : 55,
      visibility: visMatch ? parseFloat(visMatch[1]) : 1.0,
      temperature: tempMatch ? parseFloat(tempMatch[1]) : 31.0,
    };
  }

  return null;
}

export default function DigitalTwinScreen() {
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId?: string }>();
  const { journey } = useJourney();

  // ── Meteorological Parameters ───────────────────────────────────────────────
  const [rainfall, setRainfall] = useState<number>(150);
  const [wind, setWind] = useState<number>(55);
  const [visibility, setVisibility] = useState<number>(1.0);
  const [temperature, setTemperature] = useState<number>(31.0);

  const [isSimulatedMode, setIsSimulatedMode] = useState<boolean>(true);
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

      // 3. Fetch Active Disruptions for Trip & Parse Simulated Weather
      let r = 150;
      let w = 55;
      let v = 1.0;
      let t = 31.0;

      let currentJourney = journey;
      if (!currentJourney || currentJourney.id !== targetTripId) {
        try {
          currentJourney = await fetchTripById(targetTripId);
        } catch {
          // ignore
        }
      }

      try {
        const disruptions = await fetchTripDisruptions(targetTripId);
        const activeDisp = (disruptions || [])
          .slice()
          .reverse()
          .find(
            (d: any) =>
              (d.status || 'ACTIVE') === 'ACTIVE' &&
              (d.event_type === 'WEATHER_CONVECTIVE_DELAY' ||
                d.type === 'WEATHER_CONVECTIVE_DELAY' ||
                extractWeatherFromDisruption(d) !== null)
          ) || (disruptions || []).slice().reverse().find((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');

        if (activeDisp) {
          const extracted = extractWeatherFromDisruption(activeDisp);
          if (extracted) {
            r = extracted.rainfall;
            w = extracted.wind;
            v = extracted.visibility;
            t = extracted.temperature;
          }
        }
      } catch (dispErr) {
        console.warn('Unable to fetch disruptions for simulated weather:', dispErr);
      }

      setRainfall(r);
      setWind(w);
      setVisibility(v);
      setTemperature(t);
      setIsSimulatedMode(true);

      // 4. Run Simulation with dynamic weather parameters and journey nodes
      const sim = await simulateDigitalTwin(
        {
          journey_id: targetTripId,
          location: 'Mumbai',
          rainfall: r,
          wind: w,
          visibility: v,
          temperature: t,
        },
        currentJourney?.nodes
      );
      setSimulationResult(sim);
    } catch (err: any) {
      console.warn('Initial telemetry error, using contract fallback:', err?.message);
      setSimulationResult(
        generateMockSimulation(targetTripId, { rainfall: 150, wind: 55, visibility: 1.0, temperature: 31.0 }, journey?.nodes)
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

  // ── Reactive Simulation Trigger with 350ms Debounce ────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      executeSimulation(rainfall, wind, visibility, temperature);
    }, 350);

    return () => clearTimeout(timeout);
  }, [rainfall, wind, visibility, temperature, executeSimulation]);

  // ── Connect to Existing Recovery Screen ────────────────────────────────────
  const handleViewRecoveryOptions = async () => {
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
        />

        {/* ── PHASE 5: WEATHER PANEL (LIVE vs SIMULATED) ── */}
        <WeatherPanel
          liveWeather={liveWeatherToUse}
          simulatedWeather={{ rainfall, wind, visibility, temperature }}
          forecast={forecastToUse}
          locationName="Mumbai Airport Area (BOM)"
          isSimulatedMode={isSimulatedMode}
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
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <h3 className="text-lg font-black tracking-tight text-white">
                Disruption Propagation Detected
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Simulated weather results in a {Math.round(simulationResult.prediction.disruption_probability * 100)}% disruption probability with an estimated {simulationResult.prediction.estimated_delay_minutes} min departure shift. Proceed to Recovery Engine to evaluate multi-modal rerouting.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleViewRecoveryOptions}
              className="w-full md:w-auto px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2.5"
            >
              <span>VIEW RECOVERY OPTIONS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
