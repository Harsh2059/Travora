import { Plane, Hotel, Train, Calendar, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import type { DigitalTwinGraphData, NodeImpact } from '../types';

interface DigitalTwinGraphProps {
  graphData: DigitalTwinGraphData | null;
  nodeImpacts?: Record<string, NodeImpact>;
  isGraphValid: boolean;
}

export const DigitalTwinGraph = ({
  graphData,
  nodeImpacts,
  isGraphValid,
}: DigitalTwinGraphProps) => {
  if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center text-slate-500">
        No graph digital twin available. Load demo itinerary to construct DAG.
      </div>
    );
  }

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'FLIGHT':
        return <Plane className="h-4 w-4" />;
      case 'HOTEL':
        return <Hotel className="h-4 w-4" />;
      case 'TRANSFER':
        return <Train className="h-4 w-4" />;
      case 'EVENT':
        return <Calendar className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (nodeId: string, defaultStatus: string) => {
    const impact = nodeImpacts ? nodeImpacts[nodeId] : null;
    const status = impact ? impact.impact_status : defaultStatus;

    switch (status) {
      case 'AFFECTED':
        return {
          label: 'AFFECTED (DELAYED)',
          classes: 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse',
          dot: 'bg-amber-500',
        };
      case 'MISSED':
        return {
          label: 'MISSED CONNECTION',
          classes: 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse',
          dot: 'bg-rose-600',
        };
      case 'INVALID':
        return {
          label: 'INVALID SCHEDULE',
          classes: 'bg-rose-100 text-rose-800 border-rose-200',
          dot: 'bg-rose-600',
        };
      case 'AT_RISK':
        return {
          label: 'AT RISK',
          classes: 'bg-amber-100 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'CANCELLED':
        return {
          label: 'CANCELLED',
          classes: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
          dot: 'bg-slate-400',
        };
      default:
        return {
          label: 'CONFIRMED (ON TIME)',
          classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Itinerary Digital Twin • Directed Acyclic Graph (DAG)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic dependency representation with temporal and geographical constraints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {isGraphValid ? 'DAG Invariant Verified (0 Cycles)' : 'Validation Alert'}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono font-bold">
            {graphData.node_count} Nodes • {graphData.edge_count} Edges
          </span>
        </div>
      </div>

      {/* Nodes Timeline & Dependency Flow */}
      <div className="space-y-3">
        {graphData.nodes.map((node, index) => {
          const statusBadge = getStatusBadge(node.id, node.status);
          const impact = nodeImpacts ? nodeImpacts[node.id] : null;

          // Find outgoing edges from this node
          const outgoingEdges = graphData.edges.filter((e) => e.source === node.id);

          return (
            <div key={node.id} className="relative">
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  impact && impact.impact_status !== 'UNAFFECTED'
                    ? 'bg-amber-50/50 border-amber-300'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Icon, Title, Route */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-center ${
                        node.type === 'FLIGHT'
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : node.type === 'HOTEL'
                          ? 'bg-purple-50 text-purple-600 border-purple-200'
                          : node.type === 'TRANSFER'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}
                    >
                      {getItemIcon(node.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">Node #{node.id}</span>
                        <span className="text-sm font-bold text-slate-900">{node.provider}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            node.priority === 'CRITICAL'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : node.priority === 'HIGH'
                              ? 'bg-blue-100 text-blue-900 border-blue-300'
                              : 'bg-slate-200 text-slate-700 border-slate-300'
                          }`}
                        >
                          {node.priority}
                        </span>
                        <span className="text-[10px] text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded border border-slate-300">
                          {node.flexibility}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 font-medium">{node.route}</div>
                    </div>
                  </div>

                  {/* Right: Timings, Status Badge */}
                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-800">
                        {new Date(node.start_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        -{' '}
                        {new Date(node.end_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(node.start_time).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold ${statusBadge.classes}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${statusBadge.dot}`} />
                      <span>{statusBadge.label}</span>
                    </div>
                  </div>
                </div>

                {/* Causality Impact explanation if present */}
                {impact && impact.reason && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-start gap-2 text-xs">
                    <span className="text-amber-700 font-bold shrink-0">Root Cause / Impact:</span>
                    <span className="text-slate-700">{impact.reason}</span>
                  </div>
                )}
              </div>

              {/* Edge connector to next node */}
              {outgoingEdges.length > 0 && index < graphData.nodes.length - 1 && (
                <div className="py-1 px-8 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <div className="w-4 h-px bg-slate-300" />
                  <ArrowRight className="h-3 w-3 text-slate-400" />
                  <span>
                    Edge:{' '}
                    <strong className="text-slate-700">
                      {outgoingEdges[0].dependency_type}
                    </strong>
                    {outgoingEdges[0].min_connection_minutes
                      ? ` (Min buffer: ${outgoingEdges[0].min_connection_minutes}m)`
                      : ''}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
