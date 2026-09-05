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
  Sparkles,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sliders,
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

  // Helper to get travel mode icon
  const getModeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'FLIGHT':
        return <Plane className="h-4 w-4 text-sky-400" />;
      case 'TRAIN':
      case 'RAIL':
        return <Train className="h-4 w-4 text-emerald-400" />;
      case 'TRANSFER':
      case 'CAB':
      case 'CAR':
        return <Car className="h-4 w-4 text-blue-400" />;
      case 'HOTEL':
      case 'ACCOMMODATION':
        return <Hotel className="h-4 w-4 text-purple-400" />;
      case 'EVENT':
        return <Calendar className="h-4 w-4 text-amber-400" />;
      case 'ACTIVITY':
        return <Ticket className="h-4 w-4 text-teal-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-slate-400" />;
    }
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Categorize candidate recovery plans into Top 3 Traveler choices
  const feasiblePlans = recoveryPlans.filter((p) => p.feasibility);
  const bestPlan = feasiblePlans.find((p) => p.is_recommended) || feasiblePlans[0];
  
  // Cheapest plan (lowest net_cost, distinct from best if possible)
  const sortedByCost = [...feasiblePlans].sort((a, b) => a.net_cost - b.net_cost);
  const cheapestPlan = sortedByCost.find((p) => p.plan_id !== bestPlan?.plan_id) || sortedByCost[0];

  // Fastest plan (lowest delay, distinct if possible)
  const sortedByDelay = [...feasiblePlans].sort(
    (a, b) => a.additional_delay_minutes - b.additional_delay_minutes
  );
  const fastestPlan =
    sortedByDelay.find(
      (p) => p.plan_id !== bestPlan?.plan_id && p.plan_id !== cheapestPlan?.plan_id
    ) || sortedByDelay[0];

  const handleConfirmAndExecute = async (plan: RecoveryPlan) => {
    await onExecutePlan(plan);
    setSelectedPlanForReview(null);
    setLastExecutedPlan(plan);
    setShowCelebration(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Traveler Header & Assistant Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-950/30 border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              Traveler Assistant
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">Trip Version {tripVersion}</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">{tripTitle}</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Personalized, constraint-aware travel engine keeping your critical commitments intact.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenTechnicalDrawer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-xs font-bold text-slate-300 transition-all hover:text-white"
          >
            <Sliders className="h-4 w-4 text-blue-400" />
            <span>View Technical Details (DAG & ML)</span>
          </button>
        </div>
      </div>

      {/* Celebration State: Back on Track ✓ */}
      {showCelebration && lastExecutedPlan && (
        <div className="p-8 rounded-3xl bg-gradient-to-b from-emerald-950/50 to-slate-900 border border-emerald-500/30 shadow-2xl text-center relative overflow-hidden animate-fade-in">
          <div className="inline-flex p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 mb-4">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Back on Track! ✓</h2>
          <p className="text-sm text-slate-300 max-w-lg mx-auto mb-6">
            Your itinerary has been seamlessly updated. All new reservations, confirmed vouchers, and
            connecting transfers have been re-synchronized to Trip Version {tripVersion}.
          </p>

          <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-950/80 border border-emerald-800/40 text-left mb-6">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-400">Chosen Strategy:</span>
              <span className="font-bold text-emerald-400">{lastExecutedPlan.title}</span>
            </div>
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="text-slate-400">Net Additional Cost:</span>
              <span className="font-bold text-white">₹{lastExecutedPlan.net_cost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Critical Commitment (Tech Conference):</span>
              <span className="font-bold text-emerald-400">✓ 100% Protected</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowCelebration(false)}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all"
            >
              View Updated Trip
            </button>
            <button
              onClick={onResetDemo}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all flex items-center gap-2"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Demo State</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 1: My Trip Timeline */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
              Step 1
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">My Trip Timeline</h2>
          </div>
          <span className="text-xs text-slate-400">
            {items.length} Multi-Modal Segments (Flights, Transfers, Hotels & Activities)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, idx) => {
            const isCritical = item.priority === 'CRITICAL';
            const nodeImpact = assessment?.node_impacts?.[String(item.id)];
            const isDisrupted =
              nodeImpact && nodeImpact.impact_status !== 'UNAFFECTED';

            return (
              <div
                key={item.id}
                className={`relative p-5 rounded-2xl border transition-all ${
                  isDisrupted
                    ? 'bg-red-950/20 border-red-800/60 shadow-lg shadow-red-950/30'
                    : isCritical
                    ? 'bg-amber-950/10 border-amber-600/40'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Mode & Sequence Number */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700">
                      {getModeIcon(item.type)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {item.type}
                      </span>
                      <h3 className="text-sm font-bold text-white leading-none mt-0.5">
                        {item.provider}
                      </h3>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                </div>

                {/* Route / Location */}
                <div className="mb-3 text-xs">
                  {item.origin && item.destination ? (
                    <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                      <span>{item.origin}</span>
                      <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                      <span>{item.destination}</span>
                    </div>
                  ) : (
                    <div className="text-slate-300 font-medium">{item.location || 'London City'}</div>
                  )}
                </div>

                {/* Times */}
                <div className="flex items-center justify-between text-xs text-slate-400 py-2 border-t border-slate-800/60 mb-3">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>
                      {formatTime(item.start_time)} - {formatTime(item.end_time)}
                    </span>
                  </div>
                  <span>{formatDate(item.start_time)}</span>
                </div>

                {/* Status Badges */}
                <div className="flex items-center justify-between pt-1">
                  {isDisrupted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-full border border-red-800/60">
                      <AlertTriangle className="h-3 w-3" />
                      <span>{nodeImpact?.reason || 'Disrupted'}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-900/50">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Confirmed</span>
                    </span>
                  )}

                  {isCritical && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-800/60">
                      ★ Critical Event
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 2: What Happened? (Disruption Alert or Simulation Launcher) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400">
              Step 2
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">What Happened?</h2>
          </div>
          {assessment ? (
            <span className="px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-xs font-bold text-red-300 animate-pulse">
              ⚠️ Active Disruption Detected
            </span>
          ) : (
            <span className="text-xs text-slate-400">All trip items operating on schedule</span>
          )}
        </div>

        {assessment ? (
          <div className="p-5 rounded-2xl bg-red-950/30 border border-red-800/60">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white mb-1">
                  Disruption on {assessment.event_type.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {assessment.summary ||
                    'An operational disruption occurred. Our constraint engine evaluated downstream dependencies to determine affected connections.'}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400">
                    Need to simulate a different scenario?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSimulateScenario('TRANSFER_FAILURE')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors"
                    >
                      🚕 Transfer Failure
                    </button>
                    <button
                      onClick={() => onSimulateScenario('HOTEL_UNAVAILABLE')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors"
                    >
                      🏨 Hotel Overbooking
                    </button>
                    <button
                      onClick={() => onSimulateScenario('FLIGHT_DELAY_4H')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 transition-colors"
                    >
                      ✈️ Flight 4h Delay
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800 text-center">
            <p className="text-xs text-slate-400 mb-4">
              Your journey is currently on track. Test how the engine responds to unexpected events by
              selecting a scenario below:
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => onSimulateScenario('FLIGHT_DELAY_4H')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-amber-950/40 hover:border-amber-600/50 border border-slate-700 text-xs font-bold text-slate-200 transition-all"
              >
                ✈️ 4h Flight Delay
              </button>
              <button
                onClick={() => onSimulateScenario('FLIGHT_CANCEL')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-red-950/40 hover:border-red-600/50 border border-slate-700 text-xs font-bold text-slate-200 transition-all"
              >
                ✈️ Flight Cancelled
              </button>
              <button
                onClick={() => onSimulateScenario('TRANSFER_FAILURE')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-blue-950/40 hover:border-blue-600/50 border border-slate-700 text-xs font-bold text-slate-200 transition-all"
              >
                🚕 Heathrow Transfer Strike
              </button>
              <button
                onClick={() => onSimulateScenario('HOTEL_UNAVAILABLE')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-purple-950/40 hover:border-purple-600/50 border border-slate-700 text-xs font-bold text-slate-200 transition-all"
              >
                🏨 Marriott Unavailable
              </button>
              <button
                onClick={() => onSimulateScenario('ACTIVITY_CANCELLED')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/40 hover:border-emerald-600/50 border border-slate-700 text-xs font-bold text-slate-200 transition-all"
              >
                🎟️ Tech Conference Reschedule
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3: What Does This Affect? (Plain-English Impact) */}
      {assessment && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400">
                Step 3
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">What Does This Affect?</h2>
            </div>
            <span className="text-xs text-slate-400">
              {assessment.components_affected} of {assessment.total_components} items impacted
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Connecting Flights
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {assessment.components_affected > 1
                  ? 'Inbound delay breaches the minimum 60-minute connection window at Delhi (DEL). The flight to London will be missed without intervention.'
                  : 'No connecting flight segments broken.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-800/40">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                ★ Tech Conference 2026
              </span>
              <p className="text-xs text-emerald-200/90 leading-relaxed font-medium">
                Protected! Our recovery engine prioritizes your arrival before 9:00 AM so you will
                not miss your keynote presentation.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Hotel & City Transfer
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                Heathrow Express cab and Marriott hotel check-in timings will automatically adjust to
                your new arrival schedule.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Recovery Choices (Top 3 Simple Cards) */}
      {feasiblePlans.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl animate-fade-in">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                Step 4
              </span>
              <h2 className="text-lg font-bold text-white tracking-tight">Recovery Choices</h2>
            </div>
            <span className="text-xs text-slate-400">
              {feasiblePlans.length} verified feasible recovery options generated
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 1. Best For You */}
            {bestPlan && (
              <div className="relative flex flex-col justify-between p-6 rounded-3xl bg-gradient-to-b from-blue-950/40 to-slate-950 border-2 border-blue-500/80 shadow-xl shadow-blue-500/10">
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                  ⭐ Best for You
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 mb-2">
                    <span className="font-semibold text-blue-400">Recommended Plan</span>
                    <span className="font-mono text-slate-400">
                      +{bestPlan.additional_delay_minutes}m delay
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{bestPlan.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {bestPlan.traveler_summary || bestPlan.explanation_summary}
                  </p>

                  <div className="space-y-2.5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs mb-4">
                    <div>
                      <span className="font-bold text-emerald-400 block mb-0.5">What you gain:</span>
                      <span className="text-slate-300">
                        {bestPlan.trade_offs?.what_you_gain ||
                          'Preserves Tech Conference & avoids overnight hotel stay'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-amber-400 block mb-0.5">What you give up:</span>
                      <span className="text-slate-300">
                        {bestPlan.trade_offs?.what_you_give_up ||
                          `Additional net cost: ₹${bestPlan.net_cost.toLocaleString()}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 border-t border-slate-800 mb-4">
                    <span className="text-slate-400">Net Cost Impact:</span>
                    <span className="text-sm font-bold text-white font-mono">
                      {bestPlan.net_cost > 0
                        ? `+ ₹${bestPlan.net_cost.toLocaleString()}`
                        : `₹${bestPlan.net_cost.toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlanForReview(bestPlan)}
                  className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2"
                >
                  <span>Review & Choose This Plan</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 2. Cheapest Option */}
            {cheapestPlan && (
              <div className="relative flex flex-col justify-between p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl transition-all">
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                  💰 Cheapest Option
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 mb-2">
                    <span className="font-semibold text-emerald-400">Cost Saver</span>
                    <span className="font-mono text-slate-400">
                      +{cheapestPlan.additional_delay_minutes}m delay
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{cheapestPlan.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {cheapestPlan.traveler_summary || cheapestPlan.explanation_summary}
                  </p>

                  <div className="space-y-2.5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs mb-4">
                    <div>
                      <span className="font-bold text-emerald-400 block mb-0.5">What you gain:</span>
                      <span className="text-slate-300">
                        {cheapestPlan.trade_offs?.what_you_gain ||
                          'Minimizes out-of-pocket expenses'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-amber-400 block mb-0.5">What you give up:</span>
                      <span className="text-slate-300">
                        {cheapestPlan.trade_offs?.what_you_give_up ||
                          `Later arrival time (+${cheapestPlan.additional_delay_minutes}m)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 border-t border-slate-800 mb-4">
                    <span className="text-slate-400">Net Cost Impact:</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {cheapestPlan.net_cost > 0
                        ? `+ ₹${cheapestPlan.net_cost.toLocaleString()}`
                        : `₹${cheapestPlan.net_cost.toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlanForReview(cheapestPlan)}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <span>Review & Choose This Plan</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* 3. Fastest / Direct Option */}
            {fastestPlan && (
              <div className="relative flex flex-col justify-between p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-slate-700 shadow-xl transition-all">
                <div className="absolute -top-3 left-6 px-3 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                  ⚡ Fastest / Most Direct
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2 mb-2">
                    <span className="font-semibold text-purple-400">Fast Express Upgrade</span>
                    <span className="font-mono text-slate-400">
                      +{fastestPlan.additional_delay_minutes}m delay
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">{fastestPlan.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-4">
                    {fastestPlan.traveler_summary || fastestPlan.explanation_summary}
                  </p>

                  <div className="space-y-2.5 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs mb-4">
                    <div>
                      <span className="font-bold text-emerald-400 block mb-0.5">What you gain:</span>
                      <span className="text-slate-300">
                        {fastestPlan.trade_offs?.what_you_gain ||
                          'Fastest arrival with minimal overall trip delay'}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-amber-400 block mb-0.5">What you give up:</span>
                      <span className="text-slate-300">
                        {fastestPlan.trade_offs?.what_you_give_up ||
                          `Net cost difference: ₹${fastestPlan.net_cost.toLocaleString()}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs py-2 border-t border-slate-800 mb-4">
                    <span className="text-slate-400">Net Cost Impact:</span>
                    <span className="text-sm font-bold text-purple-400 font-mono">
                      {fastestPlan.net_cost > 0
                        ? `+ ₹${fastestPlan.net_cost.toLocaleString()}`
                        : `₹${fastestPlan.net_cost.toLocaleString()}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPlanForReview(fastestPlan)}
                  className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <span>Review & Choose This Plan</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 5: Review Changes Modal (Before vs After Diff) */}
      {selectedPlanForReview && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/80">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">
                  Step 5
                </span>
                <h3 className="text-lg font-bold text-white">
                  Review & Confirm: {selectedPlanForReview.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPlanForReview(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Diff summary */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  What Will Change in Your Itinerary:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 rounded-xl bg-red-950/20 border border-red-900/40">
                    <span className="font-bold text-red-400 block mb-1">Removed / Cancelled:</span>
                    <ul className="space-y-1 text-slate-300">
                      {selectedPlanForReview.removed_items.map((it: any, i: number) => (
                        <li key={i}>
                          ✕ {it.provider || it.type} ({it.origin ? `${it.origin} → ${it.destination}` : it.location})
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
                    <span className="font-bold text-emerald-400 block mb-1">Added / Rebooked:</span>
                    <ul className="space-y-1 text-slate-300">
                      {selectedPlanForReview.added_items.map((it: any, i: number) => (
                        <li key={i}>
                          ✓ {it.provider || it.type} ({it.origin ? `${it.origin} → ${it.destination}` : it.location})
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Financial summary breakdown */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Pricing & Refund Ledger
                </span>
                <div className="flex justify-between text-slate-400">
                  <span>New Booking Cost:</span>
                  <span className="font-mono text-white">
                    ₹{(selectedPlanForReview.additional_cost ?? selectedPlanForReview.new_booking_cost ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Airline / Hotel Refund Credit:</span>
                  <span className="font-mono text-emerald-400">
                    - ₹{(selectedPlanForReview.refund_received ?? selectedPlanForReview.refunds_recovered ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Change & Cancellation Fees:</span>
                  <span className="font-mono text-amber-400">
                    + ₹{(selectedPlanForReview.change_fees + selectedPlanForReview.cancellation_fees).toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold text-white">
                  <span>Net Additional Out-of-Pocket:</span>
                  <span className="font-mono text-blue-400">
                    ₹{selectedPlanForReview.net_cost.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Guarantee */}
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200">
                <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Constraint Invariant Guarantee:</strong> Tech Conference 2026 arrival
                  is guaranteed by deterministic solver proof.
                </span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <button
                onClick={() => setSelectedPlanForReview(null)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmAndExecute(selectedPlanForReview)}
                disabled={executing}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {executing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing Recovery...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Confirm Recovery & Update Itinerary</span>
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
