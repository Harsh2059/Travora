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

  const METRICS = [
    {
      label: 'Affected Nodes',
      value: `${assessment.components_affected}`,
      sub: `of ${assessment.total_components} total`,
      icon: <Zap className="h-4 w-4 text-amber-600" />,
      accentBg: 'bg-amber-50 border-amber-200',
      progress: Math.min(100, assessment.affected_percentage),
      progressLabel: `${assessment.affected_percentage}% impacted`,
    },
    {
      label: 'Critical Impact',
      value: `${assessment.critical_components_affected}`,
      sub: `of ${assessment.critical_components} critical`,
      icon: <ShieldAlert className="h-4 w-4 text-rose-600" />,
      accentBg: isCriticalHit ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200',
      badge: isCriticalHit ? '⚠ Threatened' : '✓ Protected',
      badgeClass: isCriticalHit ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800',
    },
    {
      label: 'Cascade Risk',
      value: assessment.impact_score > 5 ? 'CRITICAL' : 'HIGH',
      sub: `Impact score ${assessment.impact_score}/10`,
      icon: <Clock className="h-4 w-4 text-blue-600" />,
      accentBg: assessment.impact_score > 5 ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200',
    },
    {
      label: 'Solutions Ready',
      value: `${feasiblePlansCount}`,
      sub: 'verified recovery plans',
      icon: <CheckCircle className="h-4 w-4 text-emerald-600" />,
      accentBg: 'bg-emerald-50 border-emerald-200',
      badge: feasiblePlansCount > 0 ? 'Available' : 'None Found',
      badgeClass: feasiblePlansCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
    },
  ];

  return (
    <div className="rounded-3xl p-6 bg-white border border-rose-200 shadow-xs relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-200 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                Active Disruption Event
              </span>
              <span className="text-xs text-slate-400 font-mono">
                #{assessment.entity_id || 'SYS-01'}
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {assessment.event_type.replace(/_/g, ' ')}
            </h2>
          </div>
        </div>

        <div className="text-xs text-slate-600 max-w-sm text-left sm:text-right">
          {assessment.summary}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {METRICS.map((metric, idx) => (
          <div key={idx} className={`p-4 rounded-2xl border ${metric.accentBg}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {metric.label}
              </span>
              {metric.icon}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {metric.value}
              </span>
              {metric.badge && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${metric.badgeClass}`}>
                  {metric.badge}
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 block">{metric.sub}</span>
            {metric.progress !== undefined && (
              <div className="mt-3">
                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${metric.progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block font-mono">
                  {metric.progressLabel}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
