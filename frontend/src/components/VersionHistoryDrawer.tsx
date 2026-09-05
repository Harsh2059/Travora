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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Itinerary Version & Audit Log
              </h2>
              <p className="text-xs text-slate-500">
                Current Active Version:{' '}
                <span className="font-bold text-amber-700">Version {currentVersion}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* History Timeline */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              <History className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="font-bold text-slate-700">No disruptions recovered yet.</p>
              <p className="text-slate-500 mt-1">
                Trigger a disruption simulation and execute a plan to log version transitions.
              </p>
            </div>
          ) : (
            history.map((entry, idx) => (
              <div
                key={entry.id || idx}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
                {/* Version transition */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded">
                      v{entry.previous_version}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                      v{entry.new_version}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {entry.recovery_id}
                  </span>
                </div>

                {/* Plan Info */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{entry.plan_title}</h4>
                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
                    <span>
                      Net Cost:{' '}
                      <strong className="text-slate-900 font-mono">
                        ₹{entry.net_cost.toLocaleString()}
                      </strong>
                    </span>
                    <span>
                      Delay:{' '}
                      <strong className="text-amber-700 font-mono">
                        +{entry.additional_delay_minutes}m
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Changes metadata */}
                {entry.changes && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-[11px] text-slate-700 font-mono space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Strategy:</span>
                      <span className="text-blue-700 font-semibold">{entry.changes.strategy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modifications:</span>
                      <span className="text-slate-700">
                        +{entry.changes.added_count} added, -{entry.changes.removed_count} cancelled
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex justify-between items-center">
                  <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    Atomic DB Execution
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 text-center">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-colors"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
