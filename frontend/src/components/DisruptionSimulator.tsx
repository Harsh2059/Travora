import { useState } from 'react';
import { AlertCircle, Clock, XCircle, Calendar, Play } from 'lucide-react';

interface DisruptionSimulatorProps {
  onSimulate: (scenarioType: string, customMinutes?: number) => void;
  loading: boolean;
  activeDisruption: boolean;
}

export const DisruptionSimulator = ({
  onSimulate,
  loading,
  activeDisruption,
}: DisruptionSimulatorProps) => {
  const [customDelay, setCustomDelay] = useState<number>(240);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Disruption Simulator & Event Injection
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Simulate disruptions to trigger real-time graph propagation and candidate recovery generation.
          </p>
        </div>

        {activeDisruption && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/60 border border-red-800/80 text-xs text-red-300 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="font-semibold">Disruption Active</span>
          </div>
        )}
      </div>

      {/* Preset Scenarios Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Scenario 1: 4-Hour Delay */}
        <button
          onClick={() => onSimulate('FLIGHT_DELAY_4H', customDelay)}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-amber-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 group-hover:scale-105 transition-transform">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/50">
              ✈️ Flight Delay
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
            4-Hour Flight Delay
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Flight A delayed 240 mins. Breaks Delhi connection & triggers cascade.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-amber-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-amber-400" />
          </div>
        </button>

        {/* Scenario 2: Flight Cancellation */}
        <button
          onClick={() => onSimulate('FLIGHT_CANCEL')}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 group-hover:scale-105 transition-transform">
              <XCircle className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-900/50">
              ✈️ Flight Grounded
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-red-300 transition-colors">
            Flight Cancellation
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Grounding due to technical failure. Downstream items invalidated.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-red-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-red-400" />
          </div>
        </button>

        {/* Scenario 3: Transfer Failure */}
        <button
          onClick={() => onSimulate('TRANSFER_FAILURE')}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-blue-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 group-hover:scale-105 transition-transform">
              <span className="text-sm">🚕</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-900/50">
              🚕 Transfer / Cab
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
            Transfer Failure / Strike
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Heathrow Express halted. Dispatches priority cab & shuttle alternatives.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-blue-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-blue-400" />
          </div>
        </button>

        {/* Scenario 4: Hotel Unavailable */}
        <button
          onClick={() => onSimulate('HOTEL_UNAVAILABLE')}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-purple-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 group-hover:scale-105 transition-transform">
              <span className="text-sm">🏨</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-900/50">
              🏨 Hotel Emergency
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors">
            Hotel Room Unavailable
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Marriott London overbooked. Rebooks partner luxury & boutique rooms.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-purple-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-purple-400" />
          </div>
        </button>

        {/* Scenario 5: Activity Cancelled */}
        <button
          onClick={() => onSimulate('ACTIVITY_CANCELLED')}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 group-hover:scale-105 transition-transform">
              <span className="text-sm">🎟️</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
              🎟️ Event / Activity
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
            Activity / Venue Disruption
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Tech session venue closed. Offers evening reschedule or full credit.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-emerald-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-emerald-400" />
          </div>
        </button>

        {/* Scenario 6: User Early Advance */}
        <button
          onClick={() => onSimulate('USER_REQUEST_ADVANCE')}
          disabled={loading}
          className="flex flex-col text-left p-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 transition-all group disabled:opacity-50 hover:shadow-lg hover:shadow-cyan-500/5"
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 group-hover:scale-105 transition-transform">
              <Calendar className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/50">
              👤 Change Request
            </span>
          </div>
          <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
            Advance Trip by 24h
          </span>
          <span className="text-xs text-slate-400 mt-1">
            Traveler requests departure 1 day earlier. Re-evaluates entire trip twin.
          </span>
          <div className="mt-3 pt-2 border-t border-slate-700/50 flex items-center justify-between text-xs text-cyan-400 font-medium">
            <span>Simulate Disruption</span>
            <Play className="h-3 w-3 fill-cyan-400" />
          </div>
        </button>
      </div>

      {/* Manual Fine-Grained Delay Slider */}
      <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-300 whitespace-nowrap">
            Custom Delay Minutes:
          </label>
          <input
            type="range"
            min="30"
            max="720"
            step="30"
            value={customDelay}
            onChange={(e) => setCustomDelay(Number(e.target.value))}
            className="w-48 accent-amber-500 cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-amber-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
            {customDelay} mins ({customDelay / 60} hrs)
          </span>
        </div>
      </div>
    </div>
  );
};
