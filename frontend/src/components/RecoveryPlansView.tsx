import { useState } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  Sliders,
  DollarSign,
  Clock,
  ShieldAlert,
  Compass,
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
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showPreferences, setShowPreferences] = useState<boolean>(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState<boolean>(true);

  if (plans.length === 0) {
    return null;
  }

  const currentSelectedPlan =
    plans.find(
      (p) =>
        p.plan_id ===
        (selectedPlanId || (plans.find((p) => p.is_recommended)?.plan_id ?? plans[0].plan_id))
    ) || plans[0];

  const hasAnyFeasible = plans.some((p) => p.feasibility);

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Compass className="h-4 w-4" />
            </span>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Personalized Recovery Strategy Center
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic hard constraint validation, financial policy calculation, and multi-objective Pareto ranking.
          </p>
        </div>

        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 border border-slate-200 transition-all"
        >
          <Sliders className="h-3.5 w-3.5 text-blue-600" />
          <span>Tune Traveler Preferences</span>
        </button>
      </div>

      {/* Preferences Slider Accordion */}
      {showPreferences && (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="text-xs font-bold text-slate-800">
            Traveler Objective Weights (Automatic Normalization)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Time Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Time Minimization</span>
                <span className="font-mono text-blue-600 font-bold">
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
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            {/* Cost Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Cost Savings</span>
                <span className="font-mono text-emerald-600 font-bold">
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
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Comfort Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Travel Comfort</span>
                <span className="font-mono text-purple-600 font-bold">
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
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            {/* Directness Weight */}
            <div>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Direct Flights</span>
                <span className="font-mono text-amber-600 font-bold">
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
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Infeasible Alert */}
      {!hasAnyFeasible && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm text-rose-900">NO FULLY FEASIBLE RECOVERY FOUND</div>
            <p className="mt-1 text-slate-700">
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
                    ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-200'
                    : 'bg-white border-blue-300 hover:border-blue-400'
                  : !plan.feasibility
                  ? isSelected
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-200'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                  : isSelected
                  ? 'bg-slate-50 border-slate-400 shadow-sm ring-2 ring-slate-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    {plan.is_recommended ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        <Award className="h-3 w-3 text-emerald-600" />
                        RECOMMENDED
                      </span>
                    ) : !plan.feasibility ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                        <ShieldAlert className="h-3 w-3 text-rose-600" />
                        INFEASIBLE
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        ALTERNATIVE
                      </span>
                    )}

                    {/* Confidence Badge */}
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                        conf === 'HIGH'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : conf === 'MEDIUM'
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-rose-50 border-rose-200 text-rose-700'
                      }`}
                    >
                      {conf} CONFIDENCE
                    </span>
                  </div>

                  <span className="text-xs font-mono font-bold text-slate-500">
                    Score: {score > 0 ? score.toFixed(1) : 'FAIL'}
                  </span>
                </div>

                {/* Plan Title & Strategy */}
                <h3 className="text-sm font-bold text-slate-900 mb-1">{plan.title}</h3>
                <p className="text-xs text-slate-600 mb-4">{plan.description || plan.explanation_summary}</p>

                {/* Feasibility Indicator */}
                <div className="mb-4">
                  {plan.feasibility ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>Preserves Critical Conference (Feasible)</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-700">
                        <XCircle className="h-4 w-4 shrink-0" />
                        <span>Violates Conference Arrival Buffer</span>
                      </div>
                      <div className="text-[11px] text-slate-700">
                        {plan.infeasibility_reasons?.join('; ') || 'Connection constraint broken.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Key Numbers (Cost & Delay) */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs mb-4">
                  <div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <DollarSign className="h-3 w-3 text-emerald-600" />
                      <span>Extra Cost:</span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                      {(() => {
                        const total = (plan.additional_cost ?? plan.new_booking_cost ?? 0)
                          + (plan.change_fees ?? 0)
                          - (plan.cancellation_fees ?? 0);
                        return total > 0 ? `+\u20b9${total.toLocaleString()}` : '\u20b90';
                      })()}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3 text-amber-600" />
                      <span>Delay Variance:</span>
                    </div>
                    <div className="text-sm font-bold text-amber-700 mt-0.5 font-mono">
                      +{plan.additional_delay_minutes}m (
                      {(plan.additional_delay_minutes / 60).toFixed(1)}h)
                    </div>
                  </div>
                </div>

                {/* Quality Metrics Pill Row */}
                {plan.quality_metrics && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3 text-[10px] text-center">
                    <div className="p-1.5 rounded bg-slate-100 border border-slate-200">
                      <div className="text-slate-500">Conference</div>
                      <div className="font-bold text-emerald-700">
                        {plan.quality_metrics.critical_preservation_score}%
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 border border-slate-200">
                      <div className="text-slate-500">Delay Score</div>
                      <div className="font-bold text-blue-700">
                        {plan.quality_metrics.delay_score}%
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-100 border border-slate-200">
                      <div className="text-slate-500">Financial</div>
                      <div className="font-bold text-purple-700">
                        {plan.quality_metrics.financial_score}%
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Selection Pill */}
              <div className="pt-2">
                <div
                  className={`w-full py-2 rounded-xl text-center text-xs font-bold border transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
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
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  TRAVELER-FACING SUMMARY:
                </span>
                <span className="text-xs font-bold text-slate-900">{currentSelectedPlan.title}</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {currentSelectedPlan.traveler_summary || currentSelectedPlan.explanation_summary}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {originalItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBeforeAfter(!showBeforeAfter)}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center gap-1.5 shadow-xs"
                >
                  {showBeforeAfter ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <span>{showBeforeAfter ? 'Hide Comparison' : 'View Comparison'}</span>
                </button>
              )}

              <button
                onClick={() => onExecutePlan(currentSelectedPlan)}
                disabled={executing || !currentSelectedPlan.feasibility}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-xs shadow-md transition-all ${
                  !currentSelectedPlan.feasibility
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20'
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
