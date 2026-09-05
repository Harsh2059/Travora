import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

export const MLAdvisoryCard = () => {
  return (
    <div className="bg-white border border-purple-200 rounded-3xl p-6 shadow-xs relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Machine Learning Advisory & Risk Forecasting
            </h3>
            <p className="text-xs text-slate-500">
              Probabilistic intelligence informing candidate priority ranking.
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
          Non-Overriding Advisory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200">
          <div className="text-xs text-slate-600">Flight Disruption Risk</div>
          <div className="text-lg font-black text-amber-700 mt-1 font-mono">74.2% Probability</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Heavy monsoon weather pattern</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200">
          <div className="text-xs text-slate-600">Downstream Propagation Risk</div>
          <div className="text-lg font-black text-rose-700 mt-1 font-mono">88.5% Probability</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Tight buffer at Delhi hub (120m)</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
          <div className="text-xs text-slate-600">Conference Protection Confidence</div>
          <div className="text-lg font-black text-emerald-700 mt-1 font-mono">96.0% Feasibility</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Protected by Direct Option</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-800">Core Engine Principle:</strong> ML predicts risk. Graph models dependencies. Rules guarantee feasibility. Optimization decides. Personalization ranks. Execution atomically updates the database.
        </span>
      </div>
    </div>
  );
};
