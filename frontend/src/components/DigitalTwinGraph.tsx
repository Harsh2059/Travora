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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
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
          classes: 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse',
          dot: 'bg-amber-400',
        };
      case 'MISSED':
        return {
          label: 'MISSED CONNECTION',
          classes: 'bg-red-950/80 text-red-300 border-red-800 animate-pulse',
          dot: 'bg-red-500',
        };
      case 'INVALID':
        return {
          label: 'INVALID SCHEDULE',
          classes: 'bg-rose-950/80 text-rose-300 border-rose-800',
          dot: 'bg-rose-500',
        };
      case 'AT_RISK':
        return {
          label: 'AT RISK',
          classes: 'bg-yellow-950/80 text-yellow-300 border-yellow-800',
          dot: 'bg-yellow-400',
        };
      case 'CANCELLED':
        return {
          label: 'CANCELLED',
          classes: 'bg-slate-800 text-slate-400 border-slate-700 line-through',
          dot: 'bg-slate-500',
        };
      default:
        return {
          label: 'CONFIRMED (ON TIME)',
          classes: 'bg-emerald-950/80 text-emerald-300 border-emerald-800',
          dot: 'bg-emerald-400',
        };
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-white tracking-tight">
              Itinerary Digital Twin • Directed Acyclic Graph (DAG)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic dependency representation with temporal and geographical constraints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            {isGraphValid ? 'DAG Invariant Verified (0 Cycles)' : 'Validation Alert'}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono">
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
                className={`p-4 rounded-xl border transition-all ${
                  impact && impact.impact_status !== 'UNAFFECTED'
                    ? 'bg-slate-850 border-amber-500/30 shadow-md shadow-amber-500/5'
                    : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  {/* Left: Icon, Title, Route */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-center ${
                        node.type === 'FLIGHT'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : node.type === 'HOTEL'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : node.type === 'TRANSFER'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {getItemIcon(node.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">Node #{node.id}</span>
                        <span className="text-sm font-bold text-white">{node.provider}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            node.priority === 'CRITICAL'
                              ? 'bg-red-950 text-red-300 border-red-800'
                              : node.priority === 'HIGH'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-slate-700 text-slate-300 border-slate-600'
                          }`}
                        >
                          {node.priority}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                          {node.flexibility}
                        </span>
                      </div>
                      <div className="text-xs text-slate-300 mt-1 font-medium">{node.route}</div>
                    </div>
                  </div>

                  {/* Right: Timings, Status Badge */}
                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-slate-200">
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
                      <div className="text-[11px] text-slate-400">
                        {new Date(node.start_time).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${statusBadge.classes}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${statusBadge.dot}`} />
                      <span>{statusBadge.label}</span>
                    </div>
                  </div>
                </div>

                {/* Causality Impact explanation if present */}
                {impact && impact.reason && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-start gap-2 text-xs">
                    <span className="text-amber-400 font-semibold shrink-0">Root Cause / Impact:</span>
                    <span className="text-slate-300">{impact.reason}</span>
                  </div>
                )}
              </div>

              {/* Edge connector to next node */}
              {outgoingEdges.length > 0 && index < graphData.nodes.length - 1 && (
                <div className="py-1 px-8 flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <div className="w-4 h-px bg-slate-700" />
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <span>
                    Edge:{' '}
                    <strong className="text-slate-400">
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
