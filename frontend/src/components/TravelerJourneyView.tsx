import React, { useState } from 'react';
import {
  Plane,
  Train,
  Car,
  Hotel,
  Ticket,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sliders,
  TrendingDown,
  Timer,
  Star,
  MapPin,
  Compass,
  Info,
  ArrowUpRight,
  PlaneTakeoff,
  Ban,
  Building2,
  CalendarClock,
  CalendarDays,
} from 'lucide-react';
import type { ItineraryItem, ImpactAssessment, RecoveryPlan, TravelerPreferences } from '../types';

interface TravelerJourneyViewProps {
  items: ItineraryItem[];
  tripTitle: string;
  tripVersion: number;
  assessment: ImpactAssessment | null;
  recoveryPlans: RecoveryPlan[];
  preferences: TravelerPreferences;
  onPreferencesChange: (newPrefs: TravelerPreferences) => void;
  onExecutePlan: (plan: RecoveryPlan) => Promise<void>;
  onOpenTechnicalDrawer: () => void;
  onResetDemo: () => void;
  onSimulateScenario: (scenarioType: string) => void;
  executing: boolean;
}

const SEGMENT_COLORS: Record<string, { border: string; icon: string; bg: string; text: string }> = {
  FLIGHT:        { border: '#bae6fd', icon: '#0284c7', bg: '#f0f9ff', text: '#0369a1' },
  TRAIN:         { border: '#a7f3d0', icon: '#059669', bg: '#ecfdf5', text: '#047857' },
  RAIL:          { border: '#a7f3d0', icon: '#059669', bg: '#ecfdf5', text: '#047857' },
  TRANSFER:      { border: '#bfdbfe', icon: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  CAB:           { border: '#bfdbfe', icon: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  CAR:           { border: '#bfdbfe', icon: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' },
  HOTEL:         { border: '#e9d5ff', icon: '#7c3aed', bg: '#faf5ff', text: '#6d28d9' },
  ACCOMMODATION: { border: '#e9d5ff', icon: '#7c3aed', bg: '#faf5ff', text: '#6d28d9' },
  EVENT:         { border: '#fde68a', icon: '#d97706', bg: '#fffbeb', text: '#b45309' },
  ACTIVITY:      { border: '#99f6e4', icon: '#0d9488', bg: '#f0fdfa', text: '#0f766e' },
};

export const TravelerJourneyView: React.FC<TravelerJourneyViewProps> = ({
  items,
  tripTitle,
  tripVersion,
  assessment,
  recoveryPlans,
  onExecutePlan,
  onOpenTechnicalDrawer,
  onResetDemo,
  onSimulateScenario,
  executing,
}) => {
  const [selectedPlanForReview, setSelectedPlanForReview] = useState<RecoveryPlan | null>(null);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);
  const [lastExecutedPlan, setLastExecutedPlan] = useState<RecoveryPlan | null>(null);

  const getModeIcon = (type: string, colorOverride?: string) => {
    const color = colorOverride || '#64748b';
    const style = { color };
    switch (type.toUpperCase()) {
      case 'FLIGHT':        return <Plane className="h-5 w-5" style={style} />;
      case 'TRAIN':
      case 'RAIL':          return <Train className="h-5 w-5" style={style} />;
      case 'TRANSFER':
      case 'CAB':
      case 'CAR':           return <Car className="h-5 w-5" style={style} />;
      case 'HOTEL':
      case 'ACCOMMODATION': return <Hotel className="h-5 w-5" style={style} />;
      case 'EVENT':         return <Calendar className="h-5 w-5" style={style} />;
      case 'ACTIVITY':      return <Ticket className="h-5 w-5" style={style} />;
      default:              return <Compass className="h-5 w-5" style={style} />;
    }
  };

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' }); }
    catch { return ''; }
  };

  const feasiblePlans = recoveryPlans.filter((p) => p.feasibility);
  const bestPlan = feasiblePlans.find((p) => p.is_recommended) || feasiblePlans[0];
  const sortedByCost = [...feasiblePlans].sort((a, b) => a.net_cost - b.net_cost);
  const cheapestPlan = sortedByCost.find((p) => p.plan_id !== bestPlan?.plan_id) || sortedByCost[0];
  const sortedByDelay = [...feasiblePlans].sort((a, b) => a.additional_delay_minutes - b.additional_delay_minutes);
  const fastestPlan = sortedByDelay.find(
    (p) => p.plan_id !== bestPlan?.plan_id && p.plan_id !== cheapestPlan?.plan_id
  ) || sortedByDelay[0];

  const handleConfirmAndExecute = async (plan: RecoveryPlan) => {
    await onExecutePlan(plan);
    setSelectedPlanForReview(null);
    setLastExecutedPlan(plan);
    setShowCelebration(true);
  };

  const SECTION_HEADER = (
    stepNumber: number,
    title: string,
    subtitle: string,
    badgeText?: string
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-slate-200 gap-2">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shadow-xs">
          {stepNumber}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {badgeText && (
        <span className="self-start sm:self-auto text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          {badgeText}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ── Travel Hero Banner ── */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 via-sky-600 to-indigo-700 text-white p-6 sm:p-8 shadow-lg shadow-blue-500/10">
        {/* Subtle decorative background circles */}
        <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-sky-300/20 blur-xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            {/* Top badges */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider">
                <Compass className="h-3 w-3" />
                Autonomous Trip Protection
              </span>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-400/90 text-slate-950 text-xs font-black">
                Trip Version {tripVersion}
              </span>
              {assessment && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-rose-500 text-white text-xs font-bold animate-pulse">
                  ⚠ Disruption Active
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white mb-2">
              {tripTitle}
            </h1>
            <p className="text-sm sm:text-base text-blue-100 font-medium leading-relaxed">
              Real-time disruption guardian. If flights are delayed or transfers break, Travora instantly resolves downstream connections so your conference and bookings remain 100% protected.
            </p>
          </div>

          {/* Right Action */}
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              onClick={onOpenTechnicalDrawer}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold bg-white text-blue-700 hover:bg-blue-50 shadow-md transition-all hover:scale-105"
            >
              <Sliders className="h-4 w-4 text-blue-600" />
              <span>View Technical DAG & ML</span>
            </button>
            <button
              onClick={onResetDemo}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-all"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset to Baseline (Trip v1)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── User Guidance: "How Travora Works" (Clear Explanation For Users) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              How It Works · Traveler Quick Guide
            </h3>
          </div>
          {!assessment && (
            <button
              onClick={() => onSimulateScenario('FLIGHT_DELAY_4H')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all hover:scale-105"
            >
              <span>⚡ Click to Start: Run 4h Flight Delay Demo</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-blue-700 mb-1">1. Active Itinerary</div>
            <p className="text-slate-600">Review your scheduled flights, transfers, hotel, and conference commitments below.</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-300 ring-2 ring-amber-200/60 relative">
            <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-600 text-white">
              Start Here
            </span>
            <div className="font-bold text-amber-800 mb-1">2. Test an Emergency</div>
            <p className="text-slate-700 mb-2">Simulate an incident (e.g. 4h flight delay, hotel overbooked) in Section 2.</p>
            {!assessment && (
              <button
                onClick={() => onSimulateScenario('FLIGHT_DELAY_4H')}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline flex items-center gap-1"
              >
                <span>Trigger Flight Delay</span>
                <ArrowRight className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-rose-700 mb-1">3. Automated Impact</div>
            <p className="text-slate-600">Travora calculates cascading delays and highlights broken connections in real time.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="font-bold text-emerald-700 mb-1">4. One-Click Rebook</div>
            <p className="text-slate-600">Select the Recommended, Cheapest, or Fastest AI solution to update all bookings.</p>
          </div>
        </div>
      </div>

      {/* ── Celebration State (After Successful Recovery) ── */}
      {showCelebration && lastExecutedPlan && (
        <div className="p-8 rounded-3xl text-center bg-white border border-emerald-300 shadow-md animate-fade-in relative overflow-hidden">
          <div className="inline-flex p-4 rounded-2xl mb-4 bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">You're All Set! Trip Rebooked ✓</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
            Your itinerary has been safely updated. All hotel vouchers, alternative flights, and transfers
            are re-synchronized to <span className="font-bold text-slate-900">Trip Version {tripVersion}</span>.
          </p>

          <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-slate-500">Chosen Strategy:</span>
              <span className="font-bold text-blue-700">{lastExecutedPlan.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Additional Cost:</span>
              <span className="font-bold text-slate-900 font-mono">
                {(() => {
                  const total = (lastExecutedPlan.additional_cost ?? lastExecutedPlan.new_booking_cost ?? 0)
                    + (lastExecutedPlan.change_fees ?? 0)
                    - (lastExecutedPlan.cancellation_fees ?? 0);
                  return total > 0 ? `+₹${total.toLocaleString()}` : '₹0';
                })()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tech Conference Keynote:</span>
              <span className="font-bold text-emerald-600">✓ 100% Protected</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCelebration(false)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
            >
              View Updated Timeline
            </button>
            <button
              onClick={onResetDemo}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Demo
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 1: Confirmed Trip Timeline ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
        {SECTION_HEADER(
          1,
          'My Trip Timeline',
          'Confirmed reservations & itinerary schedule',
          `${items.length} segments in order`
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, idx) => {
            const isCritical = item.priority === 'CRITICAL';
            const nodeImpact = assessment?.node_impacts?.[String(item.id)];
            const isDisrupted = nodeImpact && nodeImpact.impact_status !== 'UNAFFECTED';
            const colors = SEGMENT_COLORS[item.type.toUpperCase()] || SEGMENT_COLORS.ACTIVITY;

            return (
              <div
                key={item.id}
                className={`relative p-5 rounded-2xl transition-all duration-200 border ${
                  isDisrupted
                    ? 'bg-rose-50/60 border-rose-300 ring-2 ring-rose-200'
                    : isCritical
                    ? 'bg-amber-50/50 border-amber-300'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Top: Icon + Provider + Step Index */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="p-2 rounded-xl"
                      style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
                    >
                      {getModeIcon(item.type, colors.icon)}
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider block" style={{ color: colors.text }}>
                        {item.type}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{item.provider}</h3>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-400">#{idx + 1}</span>
                </div>

                {/* Route or Location */}
                <div className="mb-3 text-xs font-semibold">
                  {item.origin && item.destination ? (
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <span>{item.origin}</span>
                      <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>{item.destination}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.location || 'London City Center'}</span>
                    </div>
                  )}
                </div>

                {/* Timing */}
                <div className="flex items-center justify-between text-xs text-slate-500 py-2 mb-3 border-t border-b border-slate-100">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {formatTime(item.start_time)} – {formatTime(item.end_time)}
                    </span>
                  </div>
                  <span className="font-medium text-slate-500">{formatDate(item.start_time)}</span>
                </div>

                {/* Status Badges */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  {isDisrupted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      {nodeImpact?.reason || 'Disrupted'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Confirmed
                    </span>
                  )}

                  {isCritical && (
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                      ★ Critical Meeting
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP 2: Disruption Simulation (Interactive Emergency Launcher) ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
        {SECTION_HEADER(
          2,
          assessment ? 'Active Disruption Status' : 'Simulate a Disruption or Emergency',
          assessment
            ? 'Travora AI detected an operational event and computed recovery plans'
            : 'Click any scenario below to see how Travora rescues the itinerary with 0 manual effort',
          assessment ? 'Disruption Active' : 'Click to test'
        )}

        {assessment ? (
          /* Active Disruption Alert Box */
          <div className="p-5 sm:p-6 rounded-2xl bg-rose-50/80 border border-rose-200">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-200 shrink-0 text-rose-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                    Disruption Detected
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    Impact: {assessment.components_affected} of {assessment.total_components} items affected
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  {assessment.event_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-sm text-slate-700 leading-relaxed mb-4">
                  {assessment.summary || 'An operational disruption has invalidated your downstream itinerary. Travora has automatically generated 3 verified recovery options below.'}
                </p>

                {/* Quick switcher to test other scenarios */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200/80">
                  <span className="text-xs font-semibold text-slate-600">Simulate another event:</span>
                  {[
                    { label: '4h Flight Delay', scenario: 'FLIGHT_DELAY_4H' },
                    { label: 'Transfer Strike', scenario: 'TRANSFER_FAILURE' },
                    { label: 'Hotel Overbooked', scenario: 'HOTEL_UNAVAILABLE' },
                  ].map(({ label, scenario }) => (
                    <button
                      key={scenario}
                      onClick={() => onSimulateScenario(scenario)}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-rose-100 text-slate-800 border border-rose-200 transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {/* ── Onboarding Banner: Guided First Step ── */}
            <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500 text-white font-black text-xs shrink-0 tracking-wider">
                  START HERE
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Choose an emergency scenario to begin the demo</h4>
                  <p className="text-[11px] text-slate-600">
                    Click <strong>"4h Inbound Flight Delay"</strong> below to see Travora detect broken downstream nodes and generate 3 ranked recovery strategies.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSimulateScenario('FLIGHT_DELAY_4H')}
                className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all hover:scale-105 flex items-center gap-1.5"
              >
                <span>Launch Flight Delay</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scenarios Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {[
                {
                  label: '4h Inbound Flight Delay',
                  desc: 'Breaks Delhi connection, misses London flight & puts conference at risk.',
                  icon: <PlaneTakeoff className="h-4 w-4 text-amber-700" />,
                  iconBg: 'bg-amber-100 border-amber-200',
                  scenario: 'FLIGHT_DELAY_4H',
                  accent: 'border-amber-300 hover:border-amber-400 bg-amber-50/50 ring-2 ring-amber-200/50',
                  btnColor: 'bg-amber-600 hover:bg-amber-700',
                },
                {
                  label: 'Flight Cancellation',
                  desc: 'Full technical grounding at Mumbai. Complete re-routing required.',
                  icon: <Ban className="h-4 w-4 text-rose-700" />,
                  iconBg: 'bg-rose-100 border-rose-200',
                  scenario: 'FLIGHT_CANCEL',
                  accent: 'border-rose-200 hover:border-rose-400 bg-rose-50/40',
                  btnColor: 'bg-rose-600 hover:bg-rose-700',
                },
                {
                  label: 'Heathrow Transfer Strike',
                  desc: 'Express trains halted. Auto-dispatches partner cabs or shuttles.',
                  icon: <Car className="h-4 w-4 text-blue-700" />,
                  iconBg: 'bg-blue-100 border-blue-200',
                  scenario: 'TRANSFER_FAILURE',
                  accent: 'border-blue-200 hover:border-blue-400 bg-blue-50/40',
                  btnColor: 'bg-blue-600 hover:bg-blue-700',
                },
                {
                  label: 'Hotel Overbooking',
                  desc: 'Marriott London fully booked. Rebooks 4-star partner hotel within 1km.',
                  icon: <Building2 className="h-4 w-4 text-purple-700" />,
                  iconBg: 'bg-purple-100 border-purple-200',
                  scenario: 'HOTEL_UNAVAILABLE',
                  accent: 'border-purple-200 hover:border-purple-400 bg-purple-50/40',
                  btnColor: 'bg-purple-600 hover:bg-purple-700',
                },
                {
                  label: 'Conference Rescheduled',
                  desc: 'Tech sessions moved to evening. Adjusts free time and hotel check-in.',
                  icon: <CalendarClock className="h-4 w-4 text-teal-700" />,
                  iconBg: 'bg-teal-100 border-teal-200',
                  scenario: 'ACTIVITY_CANCELLED',
                  accent: 'border-teal-200 hover:border-teal-400 bg-teal-50/40',
                  btnColor: 'bg-teal-600 hover:bg-teal-700',
                },
                {
                  label: 'Advance Trip by 24h',
                  desc: 'User requests departing 1 day earlier. Re-evaluates entire digital twin.',
                  icon: <CalendarDays className="h-4 w-4 text-cyan-700" />,
                  iconBg: 'bg-cyan-100 border-cyan-200',
                  scenario: 'USER_REQUEST_ADVANCE',
                  accent: 'border-cyan-200 hover:border-cyan-400 bg-cyan-50/40',
                  btnColor: 'bg-cyan-600 hover:bg-cyan-700',
                },
              ].map(({ label, desc, icon, iconBg, scenario, accent, btnColor }) => (
                <div
                  key={scenario}
                  className={`relative p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${accent}`}
                >
                  {scenario === 'FLIGHT_DELAY_4H' && (
                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-600 text-white shadow-xs">
                      ★ Recommended First Click
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className={`p-2 rounded-xl border shrink-0 ${iconBg}`}>
                        {icon}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 leading-snug">{label}</h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-4">{desc}</p>
                  </div>

                  <button
                    onClick={() => onSimulateScenario(scenario)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white shadow-xs transition-all flex items-center justify-center gap-1.5 ${btnColor}`}
                  >
                    <span>Simulate This Scenario</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── STEP 3: Impact Summary (Only visible when disruption active) ── */}
      {assessment && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs animate-fade-in">
          {SECTION_HEADER(
            3,
            'What Does This Disruption Affect?',
            'Automated dependency analysis across your itinerary nodes',
            `${assessment.components_affected} segments breached`
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-rose-50/80 border border-rose-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 border border-rose-200">
                  <Plane className="h-4 w-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-800">
                  Connecting Flight Window
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Inbound delay breaches the minimum 60-minute connection threshold at Delhi. Connecting flight to London will be missed without intervention.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  ★ Tech Conference 2026
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-emerald-900 font-bold">100% Protected!</strong> The recovery solver strictly enforces your keynote arrival deadline before 09:00 AM.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-blue-50/80 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
                  <Building2 className="h-4 w-4" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-blue-800">
                  Hotel & Ground Transfer
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Heathrow Express train ticket and Marriott London check-in window automatically synchronize with your new arrival time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: Recovery Choices (Package cards matching Reference Image) ── */}
      {feasiblePlans.length > 0 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs animate-fade-in">
          {SECTION_HEADER(
            4,
            'Choose Your AI Recovery Plan',
            'Select the optimal rebooking strategy based on your preferences',
            `${feasiblePlans.length} verified solutions`
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Recommended Plan */}
            {bestPlan && (
              <PlanCardLight
                plan={bestPlan}
                badge="⭐ Best for You"
                badgeBg="bg-blue-600 text-white"
                tagLabel="Recommended"
                tagBg="bg-blue-50 text-blue-700 border-blue-200"
                icon={<Star className="h-4 w-4 text-blue-600" />}
                cardBorder="border-blue-500 ring-2 ring-blue-100 shadow-md"
                btnStyle="bg-blue-600 hover:bg-blue-700 text-white"
                onSelect={() => setSelectedPlanForReview(bestPlan)}
              />
            )}

            {/* Cheapest Plan */}
            {cheapestPlan && (
              <PlanCardLight
                plan={cheapestPlan}
                badge="💰 Lowest Cost"
                badgeBg="bg-emerald-600 text-white"
                tagLabel="Cost Saver"
                tagBg="bg-emerald-50 text-emerald-700 border-emerald-200"
                icon={<TrendingDown className="h-4 w-4 text-emerald-600" />}
                cardBorder="border-slate-200 hover:border-emerald-400 hover:shadow-md"
                btnStyle="bg-emerald-600 hover:bg-emerald-700 text-white"
                onSelect={() => setSelectedPlanForReview(cheapestPlan)}
              />
            )}

            {/* Fastest Plan */}
            {fastestPlan && (
              <PlanCardLight
                plan={fastestPlan}
                badge="⚡ Fastest Arrival"
                badgeBg="bg-purple-600 text-white"
                tagLabel="Speed Priority"
                tagBg="bg-purple-50 text-purple-700 border-purple-200"
                icon={<Timer className="h-4 w-4 text-purple-600" />}
                cardBorder="border-slate-200 hover:border-purple-400 hover:shadow-md"
                btnStyle="bg-purple-600 hover:bg-purple-700 text-white"
                onSelect={() => setSelectedPlanForReview(fastestPlan)}
              />
            )}
          </div>
        </div>
      )}

      {/* ── STEP 5: Review & Rebook Modal ── */}
      {selectedPlanForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-1">
                  Step 5 · Final Confirmation
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Review: {selectedPlanForReview.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPlanForReview(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Itinerary Diffs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800 block mb-2">✕ Cancelled / Inbound Delayed</span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {selectedPlanForReview.removed_items.map((it: any, i: number) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-rose-600">•</span>
                        <span>{it.provider || it.type} {it.origin ? `(${it.origin} → ${it.destination})` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 block mb-2">✓ Newly Rebooked Alternatives</span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {selectedPlanForReview.added_items.map((it: any, i: number) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-emerald-600">•</span>
                        <span>{it.provider || it.type} {it.origin ? `(${it.origin} → ${it.destination})` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Financial Ledger */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block mb-3">
                  Cost Breakdown
                </span>
                <div className="space-y-2 text-xs">
                  {(selectedPlanForReview.additional_cost ?? selectedPlanForReview.new_booking_cost ?? 0) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>New Booking (Alternative Flight / Hotel):</span>
                      <span className="font-mono font-semibold text-slate-900">
                        +₹{(selectedPlanForReview.additional_cost ?? selectedPlanForReview.new_booking_cost ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPlanForReview.change_fees > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Reschedule / Change Fee:</span>
                      <span className="font-mono font-semibold text-amber-700">
                        +₹{selectedPlanForReview.change_fees.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {selectedPlanForReview.cancellation_fees > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Refund from Cancelled Booking:</span>
                      <span className="font-mono font-semibold text-emerald-600">
                        −₹{selectedPlanForReview.cancellation_fees.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-3 border-t border-slate-200">
                    <span className="text-slate-900">Total Additional Expense:</span>
                    <span className="font-mono text-base text-blue-600 font-extrabold">
                      {(() => {
                        const total = (selectedPlanForReview.additional_cost ?? selectedPlanForReview.new_booking_cost ?? 0)
                          + (selectedPlanForReview.change_fees ?? 0)
                          - (selectedPlanForReview.cancellation_fees ?? 0);
                        return total > 0 ? `+₹${total.toLocaleString()}` : '₹0 (No extra cost)';
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Constraint Guarantee */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Conference Safe:</strong> Tech Conference 2026 arrival is mathematically verified before keynote begins.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                onClick={() => setSelectedPlanForReview(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => handleConfirmAndExecute(selectedPlanForReview)}
                disabled={executing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {executing ? (
                  <>
                    <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Executing Rebooking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm & Rebook Itinerary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Light Plan Card Sub-Component (Matching Pricing Style from Ref Image) ── */
interface PlanCardLightProps {
  plan: RecoveryPlan;
  badge: string;
  badgeBg: string;
  tagLabel: string;
  tagBg: string;
  icon: React.ReactNode;
  cardBorder: string;
  btnStyle: string;
  onSelect: () => void;
}

const PlanCardLight: React.FC<PlanCardLightProps> = ({
  plan,
  badge,
  badgeBg,
  tagLabel,
  tagBg,
  icon,
  cardBorder,
  btnStyle,
  onSelect,
}) => (
  <div className={`relative flex flex-col bg-white rounded-3xl overflow-hidden transition-all duration-200 ${cardBorder}`}>
    {/* Top Ribbon */}
    <div className={`px-4 py-2 text-xs font-black uppercase tracking-wider text-center ${badgeBg}`}>
      {badge}
    </div>

    <div className="flex-1 p-6 flex flex-col justify-between">
      <div>
        {/* Tag & Delay indicator */}
        <div className="flex items-center justify-between mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tagBg}`}>
            {icon}
            <span>{tagLabel}</span>
          </div>
          <span className="text-xs font-bold font-mono text-slate-500">
            +{plan.additional_delay_minutes}m delay
          </span>
        </div>

        <h3 className="text-base font-extrabold text-slate-900 mb-2 leading-snug">
          {plan.title}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed mb-4">
          {plan.traveler_summary || plan.explanation_summary}
        </p>

        {/* What you gain / What you give up */}
        <div className="rounded-xl p-3.5 bg-slate-50 border border-slate-200 text-xs space-y-2 mb-5">
          <div>
            <span className="font-bold text-emerald-700 block mb-0.5">✓ What you gain</span>
            <span className="text-slate-600">{plan.trade_offs?.what_you_gain || 'Protects keynote presentation'}</span>
          </div>
          <div className="pt-2 border-t border-slate-200">
            <span className="font-bold text-amber-700 block mb-0.5">✕ Trade-off</span>
            <span className="text-slate-600">{plan.trade_offs?.what_you_give_up || `Net cost: ₹${plan.net_cost.toLocaleString()}`}</span>
          </div>
        </div>
      </div>

      <div>
        {/* Net Price */}
        <div className="flex items-center justify-between py-3 border-t border-slate-100 mb-4">
          <span className="text-xs text-slate-500 font-medium">Additional Cost</span>
          <span className="text-xl font-black font-mono text-slate-900">
            {(() => {
              const total = (plan.additional_cost ?? plan.new_booking_cost ?? 0)
                + (plan.change_fees ?? 0)
                - (plan.cancellation_fees ?? 0);
              return total > 0 ? `+₹${total.toLocaleString()}` : '₹0 (No extra cost)';
            })()}
          </span>
        </div>

        {/* Select Button */}
        <button
          onClick={onSelect}
          className={`w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all hover:scale-[1.01] ${btnStyle}`}
        >
          <span>Select & Review Plan</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
);
