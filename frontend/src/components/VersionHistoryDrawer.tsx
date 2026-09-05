import { X, History, ArrowRight, ShieldCheck } from 'lucide-react';
import type { RecoveryHistoryEntry } from '../types';


interface VersionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: number;
  history: RecoveryHistoryEntry[];
}

export const VersionHistoryDrawer = ({
  isOpen,
  onClose,
  currentVersion,
  history,
}: VersionHistoryDrawerProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg bg-slate-900 h-full shadow-2xl border-l border-slate-800 flex flex-col justify-between">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Itinerary Version & Audit Log
              </h2>
              <p className="text-xs text-slate-400">
                Current Active Version:{' '}
                <span className="font-bold text-amber-400">v{currentVersion}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* History Timeline */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs">
              <History className="h-8 w-8 mx-auto mb-2 text-slate-600 opacity-50" />
              <p>No disruptions recovered yet.</p>
              <p className="text-slate-500 mt-1">
                Trigger a disruption simulation and execute a plan to log version transitions.
              </p>
            </div>
          ) : (
            history.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="p-4 rounded-xl bg-slate-850 border border-slate-700/80 space-y-3"
              >
                {/* Version transition */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                      v{entry.previous_version}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                      v{entry.new_version}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {entry.recovery_id}
                  </span>
                </div>

                {/* Plan Info */}
                <div>
                  <h4 className="text-sm font-bold text-white">{entry.plan_title}</h4>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span>
                      Net Cost:{' '}
                      <strong className="text-slate-200">
                        INR {entry.net_cost.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Delay:{' '}
                      <strong className="text-amber-400">
                        +{entry.additional_delay_minutes}m
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Changes metadata */}
                {entry.changes && (
                  <div className="p-2.5 rounded-lg bg-slate-900 text-[11px] text-slate-300 font-mono space-y-1">
                    <div className="flex justify-between">
                      <span>Strategy:</span>
                      <span className="text-blue-400">{entry.changes.strategy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Modifications:</span>
                      <span className="text-slate-400">
                        +{entry.changes.added_count} added, -{entry.changes.removed_count} cancelled
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex justify-between items-center">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    Atomic DB Execution
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
