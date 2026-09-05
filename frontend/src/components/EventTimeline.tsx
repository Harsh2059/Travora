import { CheckCircle2, Clock, Activity } from 'lucide-react';

interface EventTimelineProps {
  currentVersion: number;
  hasDisruption: boolean;
  recoveryCount: number;
  isExecuting: boolean;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({
  currentVersion,
  hasDisruption,
  recoveryCount,
  isExecuting,
}) => {
  const steps = [
    {
      label: `Trip Baseline (v1)`,
      detail: '6 initial commitments confirmed',
      status: 'completed',
      time: 'Initial',
    },
    {
      label: hasDisruption ? 'Disruption Event' : 'Monitoring Network',
      detail: hasDisruption ? 'ATC Delay / Operational Event' : 'No active disruptions detected',
      status: hasDisruption ? 'completed' : 'pending',
      time: hasDisruption ? '+2m' : 'Now',
    },
    {
      label: 'Digital Twin Impact Propagation',
      detail: hasDisruption ? 'Graph downstream paths calculated' : 'DAG verified acyclic',
      status: hasDisruption ? 'completed' : 'pending',
      time: hasDisruption ? '+3m' : '--',
    },
    {
      label: 'Recovery Strategy Engine',
      detail: recoveryCount > 0 ? `${recoveryCount} candidate plans ranked` : 'Standing by',
      status: recoveryCount > 0 ? 'completed' : 'pending',
      time: recoveryCount > 0 ? '+4m' : '--',
    },
    {
      label: currentVersion > 1 ? `Itinerary Version ${currentVersion}` : 'Atomic State Transition',
      detail: currentVersion > 1 ? `Recovered & version bumped to v${currentVersion}` : isExecuting ? 'Executing transactional booking...' : 'Awaiting traveler acceptance',
      status: currentVersion > 1 ? 'completed' : isExecuting ? 'active' : 'pending',
      time: currentVersion > 1 ? '+5m' : '--',
    },
  ];

  return (
    <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Activity className="h-4 w-4 text-blue-600" />
          Recovery Workflow Engine Timeline
        </h3>
        <span className="text-[11px] text-slate-500 font-mono">
          Engine State: <strong className="text-emerald-600">ACTIVE</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
        {steps.map((s, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-2xl border flex flex-col justify-between text-xs transition-all ${
              s.status === 'completed'
                ? 'bg-slate-50 border-blue-200 text-slate-800'
                : s.status === 'active'
                ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs animate-pulse'
                : 'bg-slate-50/50 border-slate-200 text-slate-400'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  Step {idx + 1}
                </span>
                {s.status === 'completed' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <div className="font-bold text-slate-900 text-xs leading-tight">{s.label}</div>
              <p className="text-[11px] text-slate-500 mt-1">{s.detail}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-200/80 text-[10px] font-mono text-slate-400">
              {s.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
