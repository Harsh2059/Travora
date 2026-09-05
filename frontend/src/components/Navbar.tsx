import { Compass, RefreshCw, History, ShieldCheck, Activity } from 'lucide-react';

interface NavbarProps {
  tripVersion: number;
  isGraphValid: boolean;
  onSeed: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  loading: boolean;
}

export const Navbar = ({
  tripVersion,
  isGraphValid,
  onSeed,
  onOpenHistory,
  historyCount,
  loading,
}: NavbarProps) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-30 shadow-lg backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/30">
            <Compass className="h-6 w-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Travel Recovery Engine
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Phase 2 Core
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Graph Digital Twin • Impact Propagation • Policy Optimization
            </p>
          </div>
        </div>

        {/* Status Indicators & Actions */}
        <div className="flex items-center gap-3">
          {/* Version Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200">
            <Activity className="h-3.5 w-3.5 text-blue-400" />
            <span>Itinerary:</span>
            <span className="font-bold text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
              v{tripVersion}
            </span>
          </div>

          {/* DAG Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{isGraphValid ? 'DAG Validated' : 'Graph Invalid'}</span>
          </div>

          {/* History Drawer Toggle */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-slate-700 hover:border-slate-600"
          >
            <History className="h-3.5 w-3.5 text-slate-300" />
            <span>Audit History</span>
            {historyCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                {historyCount}
              </span>
            )}
          </button>

          {/* Seed / Reset Button */}
          <button
            onClick={onSeed}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
