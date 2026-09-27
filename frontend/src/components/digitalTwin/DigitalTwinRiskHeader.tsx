/**
 * DigitalTwinRiskHeader.tsx
 *
 * Primary Digital Twin Risk Summary & Navigation Bar.
 * Displays:
 *  - Journey: Mumbai → London
 *  - Status: SIMULATED vs LIVE
 *  - AI Risk metrics: Disruption Probability, Estimated Delay, Transport & Hotel impact, Confidence
 *  - Prominent "VIEW RECOVERY OPTIONS" action button connecting to recovery flow.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Car,
  Hotel,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import type { DigitalTwinPrediction } from '../../types/digitalTwin';

interface DigitalTwinRiskHeaderProps {
  journeyTitle?: string;
  tripId?: number | string;
  isSimulated: boolean;
  prediction: DigitalTwinPrediction;
  rainfall: number;
  wind: number;
  visibility: number;
  onViewRecovery: () => void;
  canViewRecovery: boolean;
}

export const DigitalTwinRiskHeader: React.FC<DigitalTwinRiskHeaderProps> = ({
  journeyTitle = 'Mumbai to Jaipur Express Journey (Trip #7)',
  tripId: _tripId = 7,
  isSimulated: _isSimulated,
  prediction,
  rainfall,
  wind,
  visibility,
  onViewRecovery,
  canViewRecovery,
}) => {
  const probPercent = Math.round(prediction.disruption_probability * 100);
  const delayMinutes = prediction.estimated_delay_minutes;
  const transportPercent = Math.round(prediction.transport_impact * 100);
  const hotelPercent = Math.round(prediction.hotel_impact * 100);
  const confidencePercent = Math.round(prediction.confidence * 100);

  const isCritical = probPercent >= 70 || delayMinutes > 60;
  const isHigh = probPercent >= 45 || delayMinutes > 30;

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ── */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
        <Link to="/" className="hover:text-sky-600 transition-colors">Home</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to="/my-trips" className="hover:text-sky-600 transition-colors">My Trips</Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-900 font-semibold">Digital Twin & What-If Simulation</span>
      </nav>

      {/* ── Main Banner ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
            isCritical
              ? 'bg-rose-500/10'
              : isHigh
              ? 'bg-amber-500/10'
              : 'bg-emerald-500/10'
          }`}
        />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left Column: Title & Journey Info */}
          <div className="space-y-3">


            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                <span>{journeyTitle}</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                <span>Route: <strong>Mumbai Airport (BOM) → Jaipur Airport (JAI)</strong></span>
                <span className="text-slate-300">•</span>
                <span>Chain: <strong>Flight → Uber Ground Transport → Hotel</strong></span>
                <span className="text-slate-300">•</span>
                <span>Weather Stress: <strong>{rainfall} mm Rain, {wind} km/h Wind, {visibility} km Vis</strong></span>
              </p>
            </div>
          </div>

          {/* Right Column: Prominent "VIEW RECOVERY OPTIONS" Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {canViewRecovery && <button
              onClick={onViewRecovery}
              className={`px-6 py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2.5 shadow-lg group ${
                isCritical || isHigh
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/25 animate-bounce-subtle'
                  : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/20'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              <span>VIEW RECOVERY OPTIONS</span>
              <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
            </button>}
            {!canViewRecovery && (
              <span className="px-5 py-3 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-black">
                ✓ JOURNEY ON SCHEDULE
              </span>
            )}
          </div>
        </div>

        {/* ── AI Risk Score Metric Cards ── */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* Disruption Probability */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>Disruption Risk</span>
              <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="my-1.5">
              <div
                className={`text-2xl sm:text-3xl font-black ${
                  isCritical ? 'text-rose-600' : isHigh ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {probPercent}%
              </div>
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {prediction.risk_level
                ? `${prediction.risk_level.toUpperCase().includes('CRIT') ? '🔴' : prediction.risk_level.toUpperCase().includes('HIGH') ? '🟠' : prediction.risk_level.toUpperCase().includes('MED') ? '🟡' : '🟢'} ${prediction.risk_level.toUpperCase()} RISK`
                : isCritical ? '🔴 CRITICAL RISK' : isHigh ? '🟠 ELEVATED RISK' : '🟢 NOMINAL'}
            </div>
          </div>

          {/* Estimated Delay */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>Estimated Delay</span>
              <Clock className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="my-1.5">
              <div
                className={`text-2xl sm:text-3xl font-black ${
                  delayMinutes > 60 ? 'text-rose-600' : delayMinutes > 20 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {delayMinutes} <span className="text-sm font-bold text-slate-500">min</span>
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Downstream ripple impact
            </div>
          </div>

          {/* Transport Impact */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>Transport Impact</span>
              <Car className="w-3.5 h-3.5 text-sky-500" />
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {transportPercent}%
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Transfer buffer breach
            </div>
          </div>

          {/* Hotel Impact */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>Hotel Impact</span>
              <Hotel className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-slate-900">
                {hotelPercent}%
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Late check-in window
            </div>
          </div>

          {/* AI Model Confidence */}
          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <span>Confidence</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="my-1.5">
              <div className="text-2xl sm:text-3xl font-black text-indigo-700">
                {confidencePercent}%
              </div>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Deterministic DAG model
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
