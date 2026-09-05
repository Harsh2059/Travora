import { AlertOctagon, TrendingDown, Target, Zap } from 'lucide-react';
import type { ImpactAssessment } from '../types';

interface ImpactAssessmentViewProps {
  assessment: ImpactAssessment | null;
}

export const ImpactAssessmentView = ({ assessment }: ImpactAssessmentViewProps) => {
  if (!assessment) return null;

  return (
    <div className="bg-white border border-amber-300 rounded-3xl p-6 shadow-xs relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <AlertOctagon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Impact Propagation Assessment
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Topological downstream ripple evaluation across digital twin graph connections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Trigger Event:</span>
          <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-mono font-bold">
            {assessment.event_type} (Item #{assessment.entity_id})
          </span>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {/* Affected Components */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-semibold">Affected Nodes</span>
            <TrendingDown className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {assessment.components_affected}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {assessment.total_components}
            </span>
          </div>
          <div className="text-xs text-amber-600 font-medium mt-0.5">
            {assessment.affected_percentage}% of itinerary
          </div>
        </div>

        {/* Critical Commitments at Risk */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-semibold">Critical at Risk</span>
            <Target className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xl font-black text-rose-600">
            {assessment.critical_components_affected}{' '}
            <span className="text-xs font-normal text-slate-500">
              / {assessment.critical_components}
            </span>
          </div>
          <div className="text-xs text-rose-600 font-medium mt-0.5">
            Fixed commitment threatened
          </div>
        </div>

        {/* Impact Severity Score */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-semibold">Impact Score</span>
            <Zap className="h-4 w-4 text-orange-600" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {assessment.impact_score}{' '}
            <span className="text-xs font-normal text-slate-500">/ 10</span>
          </div>
          <div className="text-xs text-orange-600 font-medium mt-0.5">
            {assessment.impact_score > 5 ? 'High severity' : 'Moderate cascade'}
          </div>
        </div>

        {/* Propagation Paths */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-600 mb-1">
            <span className="text-xs font-semibold">Cascade Paths</span>
            <span className="text-xs font-mono text-slate-400">DAG</span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {assessment.cascade_paths?.length || 1}{' '}
            <span className="text-xs font-normal text-slate-500">paths</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Dependency traversal</div>
        </div>
      </div>

      {/* Narrative Summary */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-4">
        <div className="text-xs font-bold text-amber-900 mb-1">Situation Summary</div>
        <p className="text-xs text-slate-700 leading-relaxed">{assessment.summary}</p>
      </div>

      {/* Missed flight — no compensation banner */}
      {assessment.event_type === 'MISSED_FLIGHT_TRAVELER' && (
        <div className="bg-pink-50 border border-pink-300 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <div className="text-sm font-extrabold text-pink-900 mb-1">No Airline Compensation Available</div>
            <p className="text-xs text-pink-800 leading-relaxed">
              Since you missed the flight due to a personal reason (late check-in, traffic, etc.), the airline is <strong>not obligated to refund or rebook you for free</strong>. Your original ticket is forfeited. Recovery options below show the <strong>cheapest next available flights</strong> you can book at your own cost.
            </p>
          </div>
        </div>
      )}


      {/* Node-by-Node Cascade Breakdown */}
      {assessment.node_impacts && Object.keys(assessment.node_impacts).length > 0 && (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Node-by-Node Impact Breakdown
          </h3>
          <div className="space-y-2">
            {Object.entries(assessment.node_impacts).map(([nodeId, impact]) => {
              const isMissedOrInvalid = impact.impact_status === 'MISSED' || impact.impact_status === 'INVALID' || impact.impact_status === 'CANCELLED';
              const isAffected = impact.impact_status === 'AFFECTED' || impact.impact_status === 'AT_RISK';

              const badgeColor = isMissedOrInvalid
                ? 'bg-rose-100 text-rose-800 border-rose-200'
                : isAffected
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-slate-100 text-slate-700 border-slate-200';

              return (
                <div
                  key={nodeId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-slate-500">
                      Node #{nodeId}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${badgeColor}`}
                    >
                      {impact.impact_status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-700 font-medium">
                      {impact.reason || impact.title || 'Impact registered'}
                    </span>
                  </div>

                  {impact.details && Object.keys(impact.details).length > 0 && (
                    <div className="text-xs text-slate-500 font-mono">
                      {JSON.stringify(impact.details).slice(0, 40)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
