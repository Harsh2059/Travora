import { BrainCircuit, AlertTriangle, ShieldCheck } from 'lucide-react';

export const MLAdvisoryCard = () => {
  return (
    <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <BrainCircuit className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Machine Learning Advisory & Risk Forecasting
            </h3>
            <p className="text-xs text-slate-400">
              Probabilistic intelligence informing candidate priority ranking.
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 bg-purple-950/60 px-2.5 py-1 rounded-full border border-purple-800/80">
          <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
          Non-Overriding Advisory
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-slate-850 border border-slate-700/80">
          <div className="text-xs text-slate-400">Flight A Disruption Risk</div>
          <div className="text-lg font-bold text-amber-400 mt-1">74.2% Probability</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Heavy monsoon weather pattern</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-850 border border-slate-700/80">
          <div className="text-xs text-slate-400">Downstream Propagation Risk</div>
          <div className="text-lg font-bold text-red-400 mt-1">88.5% Probability</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Tight buffer at Delhi hub (120m)</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-850 border border-slate-700/80">
          <div className="text-xs text-slate-400">Conference Protection Confidence</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">96.0% Feasibility</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Protected by Direct Option</div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-400 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-300">Core Engine Principle:</strong> ML predicts risk. Graph models dependencies. Rules guarantee feasibility. Optimization decides. Personalization ranks. Execution atomically updates the database.
        </span>
      </div>
    </div>
  );
};
