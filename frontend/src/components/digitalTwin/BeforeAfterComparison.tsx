/**
 * BeforeAfterComparison.tsx
 *
 * Dedicated side-by-side Before/After evaluation for HackCelestial 3.0 judges.
 * Contrast baseline itinerary execution against stress-tested What-If scenario.
 */

import React from 'react';
import {
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  Plane,
  Train,
  Hotel,
  TrendingUp,
} from 'lucide-react';

interface BeforeAfterComparisonProps {
  rainfall: number;
  wind: number;
  visibility: number;
  estimatedDelayMinutes: number;
  disruptionProb: number;
  transportImpact: number;
  hotelImpact: number;
}

export const BeforeAfterComparison: React.FC<BeforeAfterComparisonProps> = ({
  rainfall,
  wind,
  visibility,
  estimatedDelayMinutes,
  disruptionProb,
  transportImpact,
  hotelImpact,
}) => {
  const isSeverelyDisrupted = disruptionProb > 0.5 || estimatedDelayMinutes > 40;

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Journey Comparison (Original vs Simulated Weather)
              </h2>
              <p className="text-xs text-slate-500">
                See how bad weather might delay your flight and affect your cab and hotel bookings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Live Comparison
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Column 1: NORMAL WEATHER (BEFORE) */}
        <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Original Schedule (Normal Weather)
              </h3>
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
              ON SCHEDULE
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Weather */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <span className="font-bold text-slate-500">Expected Weather</span>
              <span className="font-extrabold text-slate-800">Clear / Mild Weather</span>
            </div>

            {/* Flight */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-700">Air India Express AI-441</span>
              </div>
              <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                On Time (0 min)
              </span>
            </div>

            {/* Transport */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-700">Uber Cab (Jaipur Airport)</span>
              </div>
              <span className="font-extrabold text-emerald-700">
                On Time (30 min wait buffer)
              </span>
            </div>

            {/* Hotel */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hotel className="w-4 h-4 text-emerald-600" />
                <span className="font-bold text-slate-700">Hotel Ram Jaipur Check-in</span>
              </div>
              <span className="font-extrabold text-emerald-700">
                On Time (20:30 Check-in)
              </span>
            </div>

            {/* Risk Score */}
            <div className="pt-2 flex items-center justify-between text-xs font-bold text-slate-600">
              <span>Overall Trip Delay Risk:</span>
              <span className="text-emerald-700 font-black">Very Low Risk (8% chance of delay)</span>
            </div>
          </div>
        </div>

        {/* Column 2: AFTER WHAT-IF SIMULATION */}
        <div
          className={`rounded-2xl p-5 border-2 space-y-4 transition-all ${
            isSeverelyDisrupted
              ? 'bg-rose-50/70 border-rose-400 shadow-sm'
              : 'bg-emerald-50/70 border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between border-b border-rose-200/80 pb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-3 h-3 rounded-full ${
                  isSeverelyDisrupted ? 'bg-rose-600 animate-ping' : 'bg-emerald-500'
                }`}
              />
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Simulated Weather Impact
              </h3>
            </div>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                isSeverelyDisrupted
                  ? 'bg-rose-200 text-rose-900 border-rose-300'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {isSeverelyDisrupted ? 'SIMULATION ESTIMATE — DELAY LIKELY' : 'FEASIBLE'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Weather Stress */}
            <div className="bg-white/95 p-3 rounded-xl border border-rose-100 shadow-2xs flex items-center justify-between">
              <span className="font-bold text-slate-500">Simulated Weather</span>
              <span className="font-black text-rose-700">
                Rain: {rainfall} mm • Wind: {wind} km/h • Vis: {visibility} km
              </span>
            </div>

            {/* Flight Impact */}
            <div className="bg-white/95 p-3 rounded-xl border border-rose-100 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-rose-600" />
                <span className="font-bold text-slate-800">Air India Express AI-441</span>
              </div>
              <span
                className={`font-black flex items-center gap-1 ${
                  estimatedDelayMinutes > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {estimatedDelayMinutes > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    +{estimatedDelayMinutes} min delay
                  </>
                ) : (
                  'On Time'
                )}
              </span>
            </div>

            {/* Transport Impact */}
            <div className="bg-white/95 p-3 rounded-xl border border-rose-100 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Train className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-800">Uber Cab (Jaipur Airport)</span>
              </div>
              <span
                className={`font-black ${
                  transportImpact > 0.4 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {transportImpact > 0.4 ? 'Cab Pickup Missed (Flight delay eats wait time)' : 'Pickup buffer intact'}
              </span>
            </div>

            {/* Hotel Impact */}
            <div className="bg-white/95 p-3 rounded-xl border border-rose-100 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hotel className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-800">Hotel Ram Jaipur Check-in</span>
              </div>
              <span
                className={`font-black ${
                  hotelImpact > 0.4 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {hotelImpact > 0.4 ? 'Late Check-in Expected (Past 22:30)' : 'Normal check-in'}
              </span>
            </div>

            {/* Risk Score */}
            <div className="pt-2 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700">Likelihood of Delay:</span>
              <span className="text-rose-700 font-black text-sm flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {Math.round(disruptionProb * 100)}% chance (+{Math.round(disruptionProb * 100) - 8}% higher)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
