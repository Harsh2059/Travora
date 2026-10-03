/**
 * ImpactPropagationPipeline.tsx
 *
 * Visual Directed Graph pipeline for Travora Digital Twin:
 * Mumbai Airport → Flight → Airport Transfer → Hotel
 * Nodes display status via badges, labels, and icons (LOW, MEDIUM, HIGH, CRITICAL).
 */

import React from 'react';
import {
  Building2,
  Plane,
  Train,
  Hotel,
  ArrowRight,
  AlertTriangle,
  Clock,
  MapPin,
} from 'lucide-react';
import type { AffectedEntity, ImpactSeverity } from '../../types/digitalTwin';

interface ImpactPropagationPipelineProps {
  affectedEntities: AffectedEntity[];
  estimatedDelayMinutes: number;
}

function getEntityIcon(type: string) {
  switch (type) {
    case 'airport':
      return <Building2 className="w-5 h-5" />;
    case 'flight':
      return <Plane className="w-5 h-5" />;
    case 'transport':
      return <Train className="w-5 h-5" />;
    case 'hotel':
      return <Hotel className="w-5 h-5" />;
    default:
      return <MapPin className="w-5 h-5" />;
  }
}

function getSeverityDetails(severity: ImpactSeverity | string) {
  const s = String(severity || 'low').toLowerCase();
  if (s.includes('crit')) {
    return {
      badgeText: 'HIGH RISK',
      dotEmoji: '🔴',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      cardBorder: 'border-rose-400 bg-rose-50/50',
      iconBg: 'bg-rose-600 text-white',
      pulse: true,
    };
  }
  if (s.includes('high')) {
    return {
      badgeText: 'DELAY EXPECTED',
      dotEmoji: '🟠',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      cardBorder: 'border-amber-300 bg-amber-50/40',
      iconBg: 'bg-amber-600 text-white',
      pulse: false,
    };
  }
  if (s.includes('med')) {
    return {
      badgeText: 'POTENTIAL DELAY',
      dotEmoji: '🟡',
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      cardBorder: 'border-yellow-200 bg-yellow-50/30',
      iconBg: 'bg-yellow-500 text-slate-900',
      pulse: false,
    };
  }
  return {
    badgeText: 'ON TIME',
    dotEmoji: '🟢',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    cardBorder: 'border-emerald-200 bg-emerald-50/20',
    iconBg: 'bg-emerald-600 text-white',
    pulse: false,
  };
}

export const ImpactPropagationPipeline: React.FC<ImpactPropagationPipelineProps> = ({
  affectedEntities,
  estimatedDelayMinutes,
}) => {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>How Delays Impact Your Trip Step-by-Step</span>
          </h2>
          <p className="text-xs text-slate-500">
            See how a flight delay carries over to your cab pickup and hotel check-in.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
            {affectedEntities.length} Trip Steps Evaluated
          </span>
        </div>
      </div>

      {/* Propagation Sequence */}
      <div className="relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          {affectedEntities.map((entity, index) => {
            const sev = getSeverityDetails(entity.impact);
            const isLast = index === affectedEntities.length - 1;

            return (
              <div key={index} className="flex flex-col relative group">
                {/* Node Card */}
                <div
                  className={`p-4 rounded-2xl border-2 transition-all shadow-2xs h-full flex flex-col justify-between ${sev.cardBorder}`}
                >
                  <div className="space-y-3">
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${sev.iconBg}`}
                      >
                        {getEntityIcon(entity.type)}
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                          sev.badgeClass
                        } ${sev.pulse ? 'animate-pulse' : ''}`}
                      >
                        <span>{sev.dotEmoji}</span>
                        <span>{sev.badgeText}</span>
                      </span>
                    </div>

                    {/* Entity Details */}
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Step 0{index + 1} • {entity.type}
                      </div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug mt-0.5">
                        {entity.name}
                      </h3>
                      {entity.location && (
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{entity.location}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Impact Description & Status Box */}
                  <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-1.5">
                    <p className="text-xs text-slate-700 font-medium">
                      {entity.details || 'Normal schedule'}
                    </p>

                    {entity.type === 'flight' && entity.delay_minutes ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" />
                        <span>+{entity.delay_minutes} min flight delay</span>
                      </div>
                    ) : null}

                    {entity.type === 'transport' && estimatedDelayMinutes > 45 ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Cab Pickup Missed</span>
                      </div>
                    ) : null}

                    {entity.type === 'hotel' && estimatedDelayMinutes > 60 ? (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        <Clock className="w-3 h-3" />
                        <span>Late Check-in Expected</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Right Arrow indicator on desktop between cards */}
                {!isLast && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-6 rounded-full bg-white border border-slate-300 shadow-xs items-center justify-center text-slate-400">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
