/**
 * WhatIfController.tsx
 *
 * Interactive What-If Simulation Controls for Travora Digital Twin.
 * Allows stress-testing journey feasibility under variable weather parameters:
 *  - Rainfall: 0 mm to 200 mm
 *  - Wind: 0 km/h to 100 km/h
 *  - Visibility: 0 km to 10 km
 */

import React from 'react';
import {
  Sliders,
  RefreshCw,
  CloudRain,
  Wind,
  Eye,
  Thermometer,
  Sparkles,
  AlertCircle,
  Play,
} from 'lucide-react';

interface WhatIfControllerProps {
  rainfall: number;
  wind: number;
  visibility: number;
  temperature?: number;
  onRainfallChange: (val: number) => void;
  onWindChange: (val: number) => void;
  onVisibilityChange: (val: number) => void;
  onTemperatureChange?: (val: number) => void;
  onSimulate?: () => void;
  onResetToLive: () => void;
  isSimulating: boolean;
  isCustomSimulated: boolean;
}

export const WhatIfController: React.FC<WhatIfControllerProps> = ({
  rainfall,
  wind,
  visibility,
  temperature = 31,
  onRainfallChange,
  onWindChange,
  onVisibilityChange,
  onTemperatureChange,
  onSimulate,
  onResetToLive,
  isSimulating,
  isCustomSimulated,
}) => {
  // Preset scenarios for instant judge demonstration
  const handleApplyPreset = (
    presetRain: number,
    presetWind: number,
    presetVis: number,
    presetTemp: number
  ) => {
    onRainfallChange(presetRain);
    onWindChange(presetWind);
    onVisibilityChange(presetVis);
    if (onTemperatureChange) onTemperatureChange(presetTemp);
    if (onSimulate) {
      setTimeout(() => onSimulate(), 50);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-6 relative overflow-hidden">
      {/* Top Banner & Mode Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>What-If Weather Simulation</span>
                {isSimulating && (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin" />
                )}
              </h2>
              <p className="text-xs text-slate-500">
                Stress-test trip nodes against synthetic meteorological variations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCustomSimulated ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200 tracking-wide uppercase">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              DIGITAL TWIN — WHAT-IF
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              SYNCHRONIZED WITH LIVE TELEMETRY
            </span>
          )}

          {onSimulate && (
            <button
              onClick={onSimulate}
              disabled={isSimulating}
              className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer uppercase tracking-wider"
              title="Execute simulation request"
            >
              {isSimulating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3 h-3 fill-white" />
              )}
              <span>SIMULATE</span>
            </button>
          )}

          <button
            onClick={onResetToLive}
            className="px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1"
            title="Reset to live weather observation"
          >
            <RefreshCw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Live</span>
          </button>
        </div>
      </div>

      {/* Notice: REAL JOURNEY != SIMULATED JOURNEY */}
      <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-slate-600">
        <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold text-slate-800">
            REAL JOURNEY ≠ SIMULATED JOURNEY:
          </span>{' '}
          Adjusting these parameters runs a non-destructive predictive simulation on the Digital
          Twin DAG without modifying your live booking or tickets.
        </div>
      </div>

      {/* Sliders Grid: 4 Weather Parameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Slider 1: Rainfall (0-200 mm) */}
        <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-blue-600" />
              <span>Rainfall</span>
            </label>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
              {rainfall} mm
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={rainfall}
            onChange={(e) => onRainfallChange(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>0 mm (Clear)</span>
            <span>100 mm</span>
            <span>200 mm</span>
          </div>
        </div>

        {/* Slider 2: Wind (0-100 km/h) */}
        <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-teal-600" />
              <span>Wind Speed</span>
            </label>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
              {wind} km/h
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={wind}
            onChange={(e) => onWindChange(Number(e.target.value))}
            className="w-full accent-teal-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>0 km/h</span>
            <span>50 km/h</span>
            <span>100 km/h</span>
          </div>
        </div>

        {/* Slider 3: Visibility (0-10 km) */}
        <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600" />
              <span>Visibility</span>
            </label>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
              {visibility} km
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            step={0.1}
            value={visibility}
            onChange={(e) => onVisibilityChange(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>0.0 km</span>
            <span>5.0 km</span>
            <span>10.0 km</span>
          </div>
        </div>

        {/* Slider 4: Temperature (15-45 °C) */}
        <div className="space-y-2 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-600" />
              <span>Temperature</span>
            </label>
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
              {temperature}°C
            </span>
          </div>
          <input
            type="range"
            min={15}
            max={45}
            step={1}
            value={temperature}
            onChange={(e) => onTemperatureChange && onTemperatureChange(Number(e.target.value))}
            className="w-full accent-amber-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
            <span>15°C</span>
            <span>30°C</span>
            <span>45°C</span>
          </div>
        </div>
      </div>

      {/* Preset Quick Actions for Judges */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Judge Demo Scenarios:
        </span>
        <button
          onClick={() => handleApplyPreset(0, 10, 10, 28)}
          className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 transition-all text-slate-700 cursor-pointer"
        >
          ☀️ Clear Skies (0mm / 10km/h / 28°C)
        </button>
        <button
          onClick={() => handleApplyPreset(45, 32, 4.0, 27)}
          className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 hover:bg-yellow-50 hover:text-yellow-800 hover:border-yellow-200 border border-slate-200 transition-all text-slate-700 cursor-pointer"
        >
          🌧️ Moderate Monsoon (45mm / 32km/h / 27°C)
        </button>
        <button
          onClick={() => handleApplyPreset(150, 55, 1.0, 31)}
          className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-all shadow-2xs font-extrabold cursor-pointer"
        >
          ⚡ Severe Storm Benchmark (150mm / 55km/h / 1.0km / 31°C)
        </button>
        <button
          onClick={() => handleApplyPreset(200, 85, 0.4, 24)}
          className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 hover:bg-red-200 text-red-900 border border-red-300 transition-all cursor-pointer"
        >
          🌪️ Cyclone Stress Test (200mm / 85km/h / 24°C)
        </button>
      </div>
    </div>
  );
};
