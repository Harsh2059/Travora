import { AlertOctagon, TrendingDown, Target, Zap } from 'lucide-react';
import type { ImpactAssessment } from '../types';


interface ImpactAssessmentViewProps {
  assessment: ImpactAssessment | null;
}

export const ImpactAssessmentView = ({ assessment }: ImpactAssessmentViewProps) => {
  if (!assessment) return null;

  return (
    <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
              <AlertOctagon className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Impact Propagation Assessment
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Topological downstream ripple evaluation across graph connections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Trigger Event:</span>
          <span className="px-2.5 py-1 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800 text-xs font-mono font-bold">
            {assessment.event_type} (Item #{assessment.entity_id})
          </span>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {/* Affected Components */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Affected Nodes</span>
            <TrendingDown className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold text-white">
            {assessment.components_affected}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {assessment.total_components}
            </span>
          </div>
          <div className="text-xs text-amber-400 mt-0.5">
            {assessment.affected_percentage}% of itinerary
          </div>
        </div>

        {/* Critical Commitments at Risk */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Critical at Risk</span>
            <Target className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-xl font-bold text-red-400">
            {assessment.critical_components_affected}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {assessment.critical_components}
            </span>
          </div>
          <div className="text-xs text-red-300 mt-0.5">
            Fixed commitment threatened
          </div>
        </div>

        {/* Impact Severity Score */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Impact Score</span>
            <Zap className="h-4 w-4 text-orange-400" />
          </div>
          <div className="text-xl font-bold text-orange-400">
            {assessment.impact_score}{' '}
            <span className="text-xs font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">High severity propagation</div>
        </div>

        {/* Cascade Depth */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-semibold">Cascade Depth</span>
            <span className="text-xs font-mono text-blue-400">4 hops</span>
          </div>
          <div className="text-xl font-bold text-white">4 Levels</div>
          <div className="text-xs text-blue-300 mt-0.5">Flights → Hotel → Conf</div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 mb-6 flex items-start gap-2">
        <span className="font-bold shrink-0">Propagation Verdict:</span>
        <span>{assessment.summary}</span>
      </div>

      {/* Node by Node Breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="p-3">Node</th>
              <th className="p-3">Item Provider</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Cascade State</th>
              <th className="p-3">Deterministic Propagation Causality</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {Object.entries(assessment.node_impacts).map(([id, impact]) => (
              <tr key={id} className="hover:bg-slate-800/30 transition-colors">
                <td className="p-3 font-mono text-slate-400">#{id}</td>
                <td className="p-3 font-semibold text-white">{impact.title}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      impact.priority === 'CRITICAL'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : impact.priority === 'HIGH'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {impact.priority}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      impact.impact_status === 'MISSED'
                        ? 'bg-red-950 text-red-300 border border-red-800'
                        : impact.impact_status === 'INVALID'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : impact.impact_status === 'AT_RISK'
                        ? 'bg-yellow-950 text-yellow-300 border border-yellow-800'
                        : impact.impact_status === 'AFFECTED'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {impact.impact_status}
                  </span>
                </td>
                <td className="p-3 text-slate-300">{impact.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
