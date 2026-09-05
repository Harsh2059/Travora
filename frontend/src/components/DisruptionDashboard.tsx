import React from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, Clock, Zap } from 'lucide-react';
import type { ImpactAssessment } from '../types';

interface DisruptionDashboardProps {
  assessment: ImpactAssessment;
  feasiblePlansCount: number;
}

export const DisruptionDashboard: React.FC<DisruptionDashboardProps> = ({
  assessment,
  feasiblePlansCount,
}) => {
  const isCriticalHit = assessment.critical_components_affected > 0;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-red-950/20 border border-red-900/40 p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                ACTIVE DISRUPTION
              </span>
              <span className="text-xs text-slate-400 font-mono">
                EVENT #{assessment.entity_id || 'SYS-01'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {assessment.event_type.replace(/_/g, ' ')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Recovery Feasibility:</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold border ${
              feasiblePlansCount > 0
                ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                : 'bg-red-950/80 border-red-600 text-red-300'
            }`}
          >
            {feasiblePlansCount > 0 ? `${feasiblePlansCount} Feasible Options` : 'No Feasible Plan'}
          </span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {/* Component Impact */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Affected Nodes</span>
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {assessment.components_affected}{' '}
            <span className="text-sm font-normal text-slate-400">/ {assessment.total_components}</span>
          </div>
          <div className="mt-2 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full"
              style={{ width: `${Math.min(100, assessment.affected_percentage)}%` }}
            />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            {assessment.affected_percentage}% itinerary impacted
          </div>
        </div>

        {/* Critical Commitment Status */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Critical Impact</span>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {assessment.critical_components_affected}{' '}
            <span className="text-sm font-normal text-slate-400">/ {assessment.critical_components}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold">
            {isCriticalHit ? (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Conference Threatened
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3.5 w-3.5" /> Protected via Buffer
              </span>
            )}
          </div>
        </div>

        {/* Risk Level */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Cascade Risk</span>
            <Clock className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {assessment.impact_score > 5 ? 'CRITICAL' : 'HIGH'}
          </div>
          <div className="text-[10px] text-slate-400 mt-2">
            Impact Score: <strong className="text-slate-200">{assessment.impact_score} / 10.0</strong>
          </div>
        </div>

        {/* Feasible Options */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Solutions</span>
            <CheckCircle className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{feasiblePlansCount}</div>
          <div className="text-[10px] text-slate-400 mt-2">
            Deterministic candidate strategies evaluated
          </div>
        </div>
      </div>
    </div>
  );
};
