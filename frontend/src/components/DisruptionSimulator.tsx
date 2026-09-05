import { useState } from 'react';
import {
  AlertCircle,
  Play,
  Zap,
  PlaneTakeoff,
  Ban,
  Car,
  Building2,
  CalendarClock,
  CalendarDays,
  UserX,
} from 'lucide-react';

interface DisruptionSimulatorProps {
  onSimulate: (scenarioType: string, customMinutes?: number) => void;
  loading: boolean;
  activeDisruption: boolean;
}

const SCENARIOS = [
  {
    type: 'FLIGHT_DELAY_4H',
    icon: <PlaneTakeoff className="h-4 w-4 text-amber-700" />,
    iconBg: 'bg-amber-100 border-amber-200',
    label: '4-Hour Flight Delay',
    desc: 'Flight A delayed 240 mins. Breaks Delhi connection & triggers downstream cascade.',
    color: '#d97706',
    border: 'border-amber-200 hover:border-amber-400 bg-amber-50/50',
    tag: 'Flight Delay',
    tagBg: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  {
    type: 'FLIGHT_CANCEL',
    icon: <Ban className="h-4 w-4 text-rose-700" />,
    iconBg: 'bg-rose-100 border-rose-200',
    label: 'Flight Cancellation',
    desc: 'Grounding due to technical failure. All downstream bookings invalidated.',
    color: '#e11d48',
    border: 'border-rose-200 hover:border-rose-400 bg-rose-50/50',
    tag: 'Flight Grounded',
    tagBg: 'bg-rose-100 text-rose-800 border-rose-200',
  },
  {
    type: 'TRANSFER_FAILURE',
    icon: <Car className="h-4 w-4 text-blue-700" />,
    iconBg: 'bg-blue-100 border-blue-200',
    label: 'Transfer Failure / Strike',
    desc: 'Heathrow Express halted. Priority cab & shuttle alternatives dispatched.',
    color: '#2563eb',
    border: 'border-blue-200 hover:border-blue-400 bg-blue-50/50',
    tag: 'Transfer',
    tagBg: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    type: 'HOTEL_UNAVAILABLE',
    icon: <Building2 className="h-4 w-4 text-purple-700" />,
    iconBg: 'bg-purple-100 border-purple-200',
    label: 'Hotel Unavailable',
    desc: 'Marriott London overbooked. Rebooks partner luxury & boutique rooms.',
    color: '#7c3aed',
    border: 'border-purple-200 hover:border-purple-400 bg-purple-50/50',
    tag: 'Hotel Emergency',
    tagBg: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    type: 'ACTIVITY_CANCELLED',
    icon: <CalendarClock className="h-4 w-4 text-teal-700" />,
    iconBg: 'bg-teal-100 border-teal-200',
    label: 'Activity / Venue Disruption',
    desc: 'Tech session venue closed. Evening reschedule or full credit offered.',
    color: '#0d9488',
    border: 'border-teal-200 hover:border-teal-400 bg-teal-50/50',
    tag: 'Event / Activity',
    tagBg: 'bg-teal-100 text-teal-800 border-teal-200',
  },
  {
    type: 'USER_REQUEST_ADVANCE',
    icon: <CalendarDays className="h-4 w-4 text-sky-700" />,
    iconBg: 'bg-sky-100 border-sky-200',
    label: 'Advance Trip by 24h',
    desc: 'Traveler requests 1-day earlier departure. Full digital twin re-evaluated.',
    color: '#0284c7',
    border: 'border-sky-200 hover:border-sky-400 bg-sky-50/50',
    tag: 'Change Request',
    tagBg: 'bg-sky-100 text-sky-800 border-sky-200',
  },
  {
    type: 'MISSED_FLIGHT_TRAVELER',
    icon: <UserX className="h-4 w-4 text-pink-700" />,
    iconBg: 'bg-pink-100 border-pink-200',
    label: 'Missed Flight (Your Side)',
    desc: 'Traveler missed departure — traffic, late check-in, or personal delay. No airline compensation. Full rebooking at own cost.',
    color: '#be185d',
    border: 'border-pink-200 hover:border-pink-400 bg-pink-50/50',
    tag: 'Traveler Fault',
    tagBg: 'bg-pink-100 text-pink-800 border-pink-200',
  },
];


export const DisruptionSimulator = ({
  onSimulate,
  loading,
  activeDisruption,
}: DisruptionSimulatorProps) => {
  const [customDelay, setCustomDelay] = useState<number>(240);

  return (
    <div className="rounded-3xl p-6 bg-white border border-slate-200 shadow-xs relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Engineering Disruption Simulator</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Inject real-world operational disruptions to evaluate graph propagation & recovery generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeDisruption && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 border border-rose-200 text-rose-700 animate-pulse">
              <span className="h-2 w-2 rounded-full bg-rose-600" />
              Active Disruption Injected
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700">
              <div className="h-3 w-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
              Processing Graph
            </div>
          )}
        </div>
      </div>

      {/* Scenario Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {SCENARIOS.map(({ type, icon, iconBg, label, desc, color, border, tag, tagBg }) => (
          <button
            key={type}
            onClick={() => onSimulate(type, type === 'FLIGHT_DELAY_4H' ? customDelay : undefined)}
            disabled={loading}
            className={`text-left p-4 rounded-2xl transition-all duration-200 border disabled:opacity-50 disabled:cursor-not-allowed ${border}`}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className={`p-2 rounded-xl border shrink-0 ${iconBg}`}>
                {icon}
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${tagBg}`}>
                {tag}
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900 block mb-1">{label}</span>
            <span className="text-xs text-slate-600 leading-snug block mb-3">{desc}</span>
            <div className="flex items-center justify-between text-xs font-semibold pt-2 border-t border-slate-200/80" style={{ color }}>
              <span>Simulate Node Disruption</span>
              <Play className="h-3 w-3" style={{ fill: color }} />
            </div>
          </button>
        ))}
      </div>

      {/* Custom Delay Slider */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
            Custom Delay Slider:
          </span>
        </div>
        <input
          type="range"
          min="30"
          max="720"
          step="30"
          value={customDelay}
          onChange={(e) => setCustomDelay(Number(e.target.value))}
          className="flex-1 cursor-pointer accent-blue-600"
        />
        <span className="text-xs font-bold font-mono px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 whitespace-nowrap shadow-xs">
          {customDelay}m · {(customDelay / 60).toFixed(1)}h
        </span>
      </div>
    </div>
  );
};
