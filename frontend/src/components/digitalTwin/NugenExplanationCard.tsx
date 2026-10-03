/**
 * NugenExplanationCard.tsx
 *
 * Dedicated AI Travel Impact Analysis component powered by Nugen Domain AI.
 * Explains root cause meteorological drivers, affected entities, and cascading effects.
 * Truthfulness constraint: Disruption probability is computed by the disruption model,
 * while Nugen provides qualitative reasoning and domain interpretation.
 */

import React from 'react';
import {
  BrainCircuit,
  Sparkles,
  Layers,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { NugenReasoning, AffectedEntity } from '../../types/digitalTwin';

interface NugenExplanationCardProps {
  reasoning?: NugenReasoning | null;
  affectedEntities: AffectedEntity[];
  cascadingEffects: string[];
  confidence?: number;
}

export const NugenExplanationCard: React.FC<NugenExplanationCardProps> = ({
  reasoning,
  affectedEntities,
  cascadingEffects,
  confidence,
}) => {
  // HONEST STATUS: Nugen is currently waitlisted (nugen_aligned: false in backend)
  const isAligned = Boolean(reasoning?.nugen_aligned === true && reasoning?.alignment_verified === true);
  const explanationText = reasoning?.explanation || reasoning?.reasoning;
  const isAvailable = Boolean(explanationText && explanationText.trim() !== '');

  return (
    <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-indigo-800/60 relative overflow-hidden space-y-6">
      {/* Subtle background ambient light */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-sky-400 flex items-center justify-center shadow-md shadow-indigo-500/30">
            <BrainCircuit className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">
                AI TRAVEL IMPACT ANALYSIS
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider">
                Domain Reasoning Engine
              </span>
              {isAligned ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  Nugen Aligned
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800/80 text-slate-300 border border-slate-700 uppercase tracking-wider" title="Nugen API access waitlisted">
                  Nugen Layer (Waitlisted)
                </span>
              )}
            </div>
            <p className="text-xs text-indigo-200/80 mt-0.5">
              Domain reasoning synthesis over temporal journey dependencies and weather telemetry.
            </p>
          </div>
        </div>

        {/* Confidence metric (if provided) */}
        {confidence !== undefined && (
          <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-700/50 px-3 py-1.5 rounded-xl text-xs shrink-0">
            <span className="text-indigo-300 font-medium">Domain Confidence:</span>
            <span className="text-white font-mono font-extrabold text-sm">
              {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Main AI Explanation Paragraph or Graceful Unavailable State */}
      <div className="relative bg-white/5 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-sky-300 uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Domain AI Interpretation</span>
          </div>
          {reasoning?.severity_assessment && (
            <span className="text-[10px] text-indigo-300 font-mono">
              Assessment: {reasoning.severity_assessment}
            </span>
          )}
        </div>

        {isAvailable ? (
          <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed">
            "{explanationText}"
          </p>
        ) : (
          <p className="text-sm text-slate-400 italic">
            Domain AI analysis unavailable for this parameter configuration.
          </p>
        )}
      </div>

      {/* Two Column Grid: Affected Entities & Cascading Effects */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Affected Entities */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-indigo-200 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              Affected Entities
            </span>
            <span className="text-indigo-300 font-mono">{affectedEntities.length} Evaluated</span>
          </div>

          <div className="space-y-2">
            {affectedEntities.map((entity, i) => {
              const impactStr = String(entity.impact || 'low').toLowerCase();
              return (
                <div
                  key={i}
                  className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-center justify-between"
                >
                  <div>
                    <span className="font-extrabold text-white text-xs">{entity.name}</span>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                      Category: {entity.type}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                      impactStr.includes('crit')
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : impactStr.includes('high')
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : impactStr.includes('med')
                        ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {entity.impact}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cascading Effects */}
        <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
          <div className="flex items-center justify-between text-indigo-200 font-bold uppercase tracking-wider text-[11px]">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-sky-400" />
              Cascading Effects
            </span>
            <span className="text-sky-300 font-mono">{cascadingEffects.length} Downstream</span>
          </div>

          <div className="space-y-2">
            {cascadingEffects.map((effect, i) => (
              <div
                key={i}
                className="bg-black/20 p-2.5 rounded-xl border border-white/5 flex items-start gap-2.5"
              >
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0 text-[10px] font-mono font-bold mt-0.5">
                  {i + 1}
                </div>
                <div className="text-xs text-slate-200 font-medium leading-snug">
                  {typeof effect === 'string' ? effect : (effect as any).title || JSON.stringify(effect)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
