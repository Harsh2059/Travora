/**
 * WeatherPanel.tsx
 *
 * Dedicated dual-view meteorological telemetry panel.
 * Crucial HackCelestial 3.0 requirement:
 * Clearly distinguishes LIVE WEATHER from SIMULATED WEATHER side-by-side.
 */

import React from 'react';
import {
  CloudSun,
  CloudRain,
  Wind,
  Eye,
  Clock,
  Radio,
  Sparkles,
} from 'lucide-react';
import type { WeatherCondition, WeatherForecastItem } from '../../types/digitalTwin';

interface WeatherPanelProps {
  liveWeather: WeatherCondition;
  simulatedWeather: {
    rainfall: number;
    wind: number;
    visibility: number;
    temperature?: number;
  };
  forecast: WeatherForecastItem[];
  locationName?: string;
  isSimulatedMode: boolean;
}

export const WeatherPanel: React.FC<WeatherPanelProps> = ({
  liveWeather,
  simulatedWeather,
  forecast,
  locationName = 'Mumbai (BOM)',
  isSimulatedMode,
}) => {
  // Dynamic weather condition status string
  const getWeatherStatusText = () => {
    const vis = simulatedWeather.visibility;
    const rain = simulatedWeather.rainfall;
    const wind = simulatedWeather.wind;

    if (vis <= 0.5) return 'Zero Visibility / CAT III Fog Hazard';
    if (vis <= 2.0) return 'Dense Fog / Low Visibility Warning';
    if (wind >= 60) return 'Gale-Force Wind Hazard';
    if (rain >= 120) return 'Torrential Downpour & Convective Storm';
    if (rain >= 40) return 'Heavy Precipitation';
    if (rain >= 15 || wind >= 25 || vis <= 5.0) return 'Moderate Rain & Turbulence';
    return 'Simulated Moderate Weather';
  };

  // Dynamic multi-metric What-If Delta badge
  const getWhatIfDeltaBadge = () => {
    const rainDiff = simulatedWeather.rainfall - liveWeather.rainfall_mm;
    const visDiff = simulatedWeather.visibility - liveWeather.visibility_km;
    const windDiff = simulatedWeather.wind - liveWeather.wind_kmh;

    if (simulatedWeather.visibility <= 0.5) {
      return `0.0 km Vis (${visDiff.toFixed(1)} km Vis)`;
    }
    if (simulatedWeather.visibility <= 2.0) {
      return `${simulatedWeather.visibility} km Vis (Low Vis)`;
    }
    if (Math.abs(windDiff) >= 20) {
      return `${windDiff >= 0 ? '+' : ''}${windDiff} km/h Wind`;
    }
    if (rainDiff !== 0) {
      return `${rainDiff >= 0 ? '+' : ''}${rainDiff} mm Rain`;
    }
    return 'Nominal Target';
  };

  // Dynamic 24-Hour Forecast Items based on live vs simulated mode
  const effectiveForecast: WeatherForecastItem[] = React.useMemo(() => {
    if (!isSimulatedMode) return forecast;

    const r = simulatedWeather.rainfall;
    const w = simulatedWeather.wind;
    const v = simulatedWeather.visibility;
    const t = simulatedWeather.temperature ?? 28;

    return [
      {
        time: '+3h Peak Stress',
        condition:
          v <= 0.5
            ? 'Zero Vis Fog'
            : r > 100
            ? 'Severe Storm'
            : r > 40 || w > 35
            ? 'Heavy Downpour'
            : 'Moderate Weather',
        temp_c: Math.round(t),
        rain_mm: Math.round(r),
        wind_kmh: Math.round(w),
        risk_level: v <= 1.0 || r > 100 || w > 60 ? 'critical' : r > 35 || w > 30 ? 'high' : 'medium',
      },
      {
        time: '+6h Sustained',
        condition:
          v <= 1.5
            ? 'Low Vis / Fog'
            : r > 60
            ? 'Heavy Rain'
            : r > 20
            ? 'Passing Showers'
            : 'Partly Cloudy',
        temp_c: Math.round(t - 1),
        rain_mm: Math.round(r * 0.65),
        wind_kmh: Math.round(w * 0.75),
        risk_level: v <= 2.0 || r > 60 || w > 45 ? 'high' : r > 15 ? 'medium' : 'low',
      },
      {
        time: '+12h Moderating',
        condition: r > 30 ? 'Light Rain' : 'Partly Cloudy',
        temp_c: Math.round(t + 1),
        rain_mm: Math.round(r * 0.25),
        wind_kmh: Math.round(w * 0.5),
        risk_level: r > 30 || w > 35 ? 'medium' : 'low',
      },
      {
        time: '+24h Nominal',
        condition: 'Clear Skies',
        temp_c: 27,
        rain_mm: Math.min(2, Math.round(r * 0.05)),
        wind_kmh: Math.min(15, Math.round(w * 0.25)),
        risk_level: 'low',
      },
    ];
  }, [isSimulatedMode, simulatedWeather, forecast]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <CloudSun className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Weather Telemetry & Observation
              </h2>
              <p className="text-xs text-slate-500">
                Real external weather observation vs synthetic stress scenario for {locationName}.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Observation Time: {liveWeather.timestamp}</span>
          </span>
        </div>
      </div>

      {/* Side-by-Side Distinction: LIVE WEATHER vs SIMULATED WEATHER */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: LIVE WEATHER */}
        <div className="relative rounded-2xl p-5 bg-gradient-to-br from-emerald-50/60 via-slate-50 to-white border border-emerald-200/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              LIVE WEATHER
            </span>
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Radio className="w-3 h-3 text-emerald-600" />
              LIVE WEATHER OBSERVATION
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="text-2xl font-black text-slate-900">
                {liveWeather.temperature_c}°C
              </div>
              <div className="text-xs font-bold text-slate-600">
                {liveWeather.condition}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <span className="font-bold text-slate-700">{locationName}</span>
              <div className="text-[10px]">Real-Time Station BOM</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-100/80 text-xs">
            <div className="bg-white/90 p-2 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Rainfall</div>
              <div className="text-sm font-black text-slate-800 mt-0.5 flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                <span>{liveWeather.rainfall_mm} mm</span>
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Wind</div>
              <div className="text-sm font-black text-slate-800 mt-0.5 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-teal-500" />
                <span>{liveWeather.wind_kmh} km/h</span>
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Visibility</div>
              <div className="text-sm font-black text-slate-800 mt-0.5 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                <span>{liveWeather.visibility_km} km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card B: SIMULATED WEATHER */}
        <div
          className={`relative rounded-2xl p-5 border shadow-2xs space-y-3 transition-all ${
            isSimulatedMode
              ? 'bg-gradient-to-br from-rose-50/70 via-amber-50/30 to-white border-rose-300'
              : 'bg-slate-50/70 border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black border uppercase tracking-wider ${
                isSimulatedMode
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-slate-200 text-slate-700 border-slate-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-rose-600" />
              {isSimulatedMode ? 'SIMULATED WEATHER' : 'SIMULATION INACTIVE'}
            </span>
            <span className="text-[11px] font-bold text-slate-500">Digital Twin Target</span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <div className="text-2xl font-black text-slate-900">
                {simulatedWeather.temperature !== undefined
                  ? `${simulatedWeather.temperature.toFixed(1)}°C`
                  : simulatedWeather.rainfall > 100
                  ? '25.0°C'
                  : '28.5°C'}
              </div>
              <div className="text-xs font-bold text-rose-700">
                {getWeatherStatusText()}
              </div>
            </div>
            <div className="text-right text-xs text-slate-500">
              <span className="font-bold text-slate-700">What-If Delta</span>
              <div className="text-[10px] text-rose-600 font-bold">
                {getWhatIfDeltaBadge()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-rose-100 text-xs">
            <div className="bg-white/90 p-2 rounded-xl border border-rose-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Rainfall</div>
              <div className="text-sm font-black text-rose-700 mt-0.5 flex items-center gap-1">
                <CloudRain className="w-3.5 h-3.5 text-rose-500" />
                <span>{simulatedWeather.rainfall} mm</span>
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-rose-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Wind</div>
              <div className="text-sm font-black text-amber-700 mt-0.5 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-amber-500" />
                <span>{simulatedWeather.wind} km/h</span>
              </div>
            </div>
            <div className="bg-white/90 p-2 rounded-xl border border-rose-100 shadow-2xs">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Visibility</div>
              <div className="text-sm font-black text-indigo-700 mt-0.5 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                <span>{simulatedWeather.visibility} km</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 24-Hour Forecast Timeline */}
      {effectiveForecast && effectiveForecast.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>24-HOUR FORECAST</span>
            <span className="text-slate-400 font-normal">Next 24 Hours</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {effectiveForecast.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-slate-800">{item.time}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                      item.risk_level === 'critical'
                        ? 'bg-rose-600 text-white'
                        : item.risk_level === 'high'
                        ? 'bg-rose-100 text-rose-800'
                        : item.risk_level === 'medium'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.risk_level}
                  </span>
                </div>
                <div className="my-2">
                  <div className="text-base font-extrabold text-slate-900">{item.temp_c}°C</div>
                  <div className="text-[11px] text-slate-500">{item.condition}</div>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200">
                  <span>Rain: {item.rain_mm}mm</span>
                  <span>Wind: {item.wind_kmh}km/h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
