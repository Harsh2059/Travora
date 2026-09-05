import { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Sliders,
  DollarSign,
  Clock,
  ShieldAlert,
  Sparkles,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { RecoveryPlan, TravelerPreferences, ItineraryItem } from '../types';
import { BeforeAfterItinerary } from './BeforeAfterItinerary';

interface RecoveryPlansViewProps {
  plans: RecoveryPlan[];
  originalItems?: ItineraryItem[];
  preferences: TravelerPreferences;
  onPreferencesChange: (newPrefs: TravelerPreferences) => void;
  onExecutePlan: (plan: RecoveryPlan) => void;
  executing: boolean;
}

export const RecoveryPlansView: React.FC<RecoveryPlansViewProps> = ({
  plans,
  originalItems = [],
  preferences,
  onPreferencesChange,
  onExecutePlan,
  executing,
}) => {
  const [showPreferences, setShowPreferences] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState(true);

  if (!plans || plans.length === 0) return null;

  const currentSelectedPlan =
    plans.find(
      (p) =>
        p.plan_id ===
        (selectedPlanId || (plans.find((p) => p.is_recommended)?.plan_id ?? plans[0].plan_id))
    ) || plans[0];

  const hasAnyFeasible = plans.some((p) => p.feasibility);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-white tracking-tight">
              Personalized Recovery Strategy Center
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic hard constraint validation, financial policy calculation, and multi-objective Pareto ranking.
          </p>
        </div>

        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-all"
        >
          <Sliders className="h-3.5 w-3.5 text-blue-400" />
          <span>Tune Traveler Preferences</span>
        </button>
      </div>

      {/* Preferences Slider Accordion */}
      {showPreferences && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
          <div className="text-xs font-semibold text-slate-300">
            Traveler Objective Weights (Automatic Normalization)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Time Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Time Minimization</span>
                <span className="font-mono text-blue-400">
                  {(preferences.time_weight * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={preferences.time_weight}
                onChange={(e) =>
                  onPreferencesChange({ ...preferences, time_weight: parseFloat(e.target.value) })
                }
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            {/* Cost Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Cost Savings</span>
                <span className="font-mono text-emerald-400">
                  {(preferences.cost_weight * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={preferences.cost_weight}
                onChange={(e) =>
                  onPreferencesChange({ ...preferences, cost_weight: parseFloat(e.target.value) })
                }
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Comfort Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Travel Comfort</span>
                <span className="font-mono text-purple-400">
                  {(preferences.comfort_weight * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={preferences.comfort_weight}
                onChange={(e) =>
                  onPreferencesChange({ ...preferences, comfort_weight: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500 cursor-pointer"
              />
            </div>

            {/* Directness Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Direct Flights</span>
                <span className="font-mono text-amber-400">
                  {(preferences.directness_weight * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={preferences.directness_weight}
                onChange={(e) =>
                  onPreferencesChange({ ...preferences, directness_weight: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* No Fully Feasible Plan Alert */}
      {!hasAnyFeasible && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-red-300">NO FULLY FEASIBLE RECOVERY FOUND</div>
            <p className="mt-1 text-slate-300">
              The currently available transport alternatives cannot satisfy all physical connection buffers or protect the critical Tech Conference.
            </p>
          </div>
        </div>
      )}

      {/* Candidate Plan Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isSelected = currentSelectedPlan.plan_id === plan.plan_id;
          const score = plan.overall_score ?? plan.composite_score ?? 0;
          const conf = plan.confidence || (plan.feasibility ? 'HIGH' : 'LOW');

          return (
            <div
              key={plan.plan_id}
              onClick={() => setSelectedPlanId(plan.plan_id)}
              className={`p-5 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all ${
                plan.is_recommended
                  ? isSelected
                    ? 'bg-slate-800/90 border-emerald-500 shadow-xl shadow-emerald-500/10'
                    : 'bg-slate-850 border-emerald-600/60 hover:border-emerald-500'
                  : !plan.feasibility
                  ? isSelected
                    ? 'bg-slate-900 border-red-500/80 opacity-90'
                    : 'bg-slate-900/60 border-red-900/40 hover:border-red-700/60 opacity-80'
                  : isSelected
                  ? 'bg-slate-800/90 border-blue-500 shadow-xl shadow-blue-500/10'
                  : 'bg-slate-850 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    {plan.is_recommended ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700">
                        <Award className="h-3 w-3 text-emerald-400" />
                        RECOMMENDED
                      </span>
                    ) : !plan.feasibility ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                        <ShieldAlert className="h-3 w-3 text-red-400" />
                        INFEASIBLE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        ALTERNATIVE
                      </span>
                    )}

                    {/* Confidence Badge */}
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                        conf === 'HIGH'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : conf === 'MEDIUM'
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                      }`}
                    >
                      {conf} CONFIDENCE
                    </span>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-400">
                    Score: {score > 0 ? score.toFixed(1) : 'FAIL'}
                  </span>
                </div>

                {/* Plan Title & Strategy */}
                <h3 className="text-sm font-bold text-white mb-1">{plan.title}</h3>
                <p className="text-xs text-slate-400 mb-4">{plan.description || plan.explanation_summary}</p>

                {/* Feasibility Indicator */}
                <div className="mb-4">
                  {plan.feasibility ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Preserves Critical Conference (Feasible)</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-900/80 text-xs text-red-300 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-red-400">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Violates Conference Arrival Buffer</span>
                      </div>
                      <div className="text-[11px] text-red-200">
                        {plan.infeasibility_reasons?.join('; ') || 'Connection constraint broken.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Key Numbers (Cost & Delay) */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs mb-4">
                  <div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <DollarSign className="h-3 w-3 text-emerald-400" />
                      <span>Net Cost:</span>
                    </div>
                    <div className="text-sm font-bold text-white mt-0.5 font-mono">
                      ₹{plan.net_cost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span>Delay Variance:</span>
                    </div>
                    <div className="text-sm font-bold text-amber-400 mt-0.5 font-mono">
                      +{plan.additional_delay_minutes}m (
                      {(plan.additional_delay_minutes / 60).toFixed(1)}h)
                    </div>
                  </div>
                </div>

                {/* Quality Metrics Pill Row */}
                {plan.quality_metrics && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3 text-[10px] text-center">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Conference</div>
                      <div className="font-bold text-emerald-400">
                        {plan.quality_metrics.critical_preservation_score}%
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Delay Score</div>
                      <div className="font-bold text-blue-400">
                        {plan.quality_metrics.delay_score}%
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="text-slate-400">Financial</div>
                      <div className="font-bold text-purple-400">
                        {plan.quality_metrics.financial_score}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Selection Pill */}
              <div className="pt-2">
                <div
                  className={`w-full py-1.5 rounded-lg text-center text-xs font-semibold border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                  }`}
                >
                  {isSelected ? 'Currently Selected' : 'Select Plan'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Plan Traveler-Facing Summary & Execution Bar */}
      {currentSelectedPlan && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                  TRAVELER-FACING SUMMARY:
                </span>
                <span className="text-xs font-bold text-white">{currentSelectedPlan.title}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {currentSelectedPlan.traveler_summary || currentSelectedPlan.explanation_summary}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {originalItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                >
                  {showBeforeAfter ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span>{showBeforeAfter ? 'Hide Comparison' : 'View Comparison'}</span>
                </button>
              )}

              <button
                onClick={() => onExecutePlan(currentSelectedPlan)}
                disabled={executing || !currentSelectedPlan.feasibility}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs shadow-lg transition-all ${
                  !currentSelectedPlan.feasibility
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-emerald-600/30'
                }`}
              >
                <Send className={`h-4 w-4 ${executing ? 'animate-spin' : ''}`} />
                <span>{executing ? 'Executing Transaction...' : 'Accept & Execute Plan'}</span>
              </button>
            </div>
          </div>

          {/* Side-by-Side Before/After Preview */}
          {showBeforeAfter && originalItems.length > 0 && (
            <BeforeAfterItinerary plan={currentSelectedPlan} originalItems={originalItems} />
          )}
        </div>
      )}
    </div>
  );
};
