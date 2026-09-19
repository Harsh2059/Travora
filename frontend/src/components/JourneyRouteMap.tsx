/**
 * JourneyRouteMap.tsx
 *
 * Pure renderer for a JourneyRoute.
 * This component knows NOTHING about specific locations, item names,
 * or journey sequences. It renders whatever the route model contains.
 *
 * Layout model (horizontal rail):
 *
 *   [Label]   [spacer]   [Label]   [spacer]   [Label]
 *   [● dot] ──[ Leg  ]── [● dot] ──[ Leg  ]── [● dot]
 *             attached             attached
 *              items                items
 *
 * Unconnected locations are rendered in a separate row below.
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  Plane, Train, Car, Hotel, Ticket, MapPin,
  Plus, TrainFront, AlertCircle,
} from 'lucide-react';
import type { JourneyNode, ImpactNodeStatus } from '../types';
import type { JourneyRoute, RouteLocation, RouteSegment } from '../utils/routeBuilder';
import { segmentTo } from '../utils/routeBuilder';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface JourneyRouteMapProps {
  route: JourneyRoute;
  onItemClick: (node: JourneyNode) => void;
  onAddStop?: () => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
}

// ─── Type-to-icon mapping — data-driven, no hardcoding ───────────────────────

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  flight: Plane,   FLIGHT: Plane,
  train:  Train,   TRAIN:  Train,
  metro:  TrainFront, METRO: TrainFront,
  hotel:  Hotel,   HOTEL:  Hotel,
  activity: Ticket, ACTIVITY: Ticket, ticket: Ticket, TICKET: Ticket,
  event:  Ticket,  EVENT:  Ticket,
  taxi:   Car,     TAXI:   Car,
  cab:    Car,     CAB:    Car,
  bus:    Car,     BUS:    Car,
  ferry:  Plane,   FERRY:  Plane,
};

function iconFor(type: string, transportMode?: string): React.FC<{ className?: string }> {
  if (transportMode) {
    const m = transportMode.toUpperCase();
    if (TYPE_ICONS[m]) return TYPE_ICONS[m];
  }
  return TYPE_ICONS[type] ?? TYPE_ICONS[type.toLowerCase()] ?? MapPin;
}

// ─── Item-type colour tokens — derived from type, never from name ─────────────

type ColourScheme = {
  card:  string;
  text:  string;
  icon:  string;
  badge: string;
};

function colourFor(type: string): ColourScheme {
  const t = type.toLowerCase();
  if (t === 'hotel' || t === 'stay' || t === 'accommodation')
    return {
      card:  'bg-purple-50/90 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100 dark:hover:bg-purple-900/50',
      text:  'text-purple-600 dark:text-purple-400',
      icon:  'text-purple-500',
      badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    };
  if (t === 'activity' || t === 'ticket' || t === 'event')
    return {
      card:  'bg-amber-50/90 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50',
      text:  'text-amber-600 dark:text-amber-400',
      icon:  'text-amber-500',
      badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    };
  // Default: teal for any other location-based item
  return {
    card:  'bg-teal-50/90 dark:bg-teal-950/40 border-teal-200 dark:border-teal-800/60 hover:bg-teal-100 dark:hover:bg-teal-900/50',
    text:  'text-teal-600 dark:text-teal-400',
    icon:  'text-teal-500',
    badge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  };
}

// ─── Timing helpers ───────────────────────────────────────────────────────────

function fmtDate(s?: string): string {
  if (!s) return '';
  try {
    const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return s; }
}

function fmtTime(s?: string): string {
  if (!s || !s.includes('T')) return '';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return ''; }
}

interface TimeBadge { text: string; dot: string }

function timeBadge(node: JourneyNode): TimeBadge {
  const isHotel   = ['hotel', 'stay', 'accommodation'].includes(node.type.toLowerCase());
  const sD = fmtDate(node.startDate || node.startTime);
  const eD = fmtDate(node.endDate   || node.endTime);
  const sT = fmtTime(node.startTime);
  const eT = fmtTime(node.endTime);
  const unknown  = node.timeStatus === 'UNKNOWN' || (!node.startTime && node.timeStatus !== 'FIXED');
  const flexible = node.timeStatus === 'FLEXIBLE';

  if (isHotel) {
    const range = sD && eD ? `${sD} → ${eD}` : '';
    if (unknown)  return { text: range ? `${range} · Check-in unknown`  : 'Check-in unknown',  dot: '⚪' };
    if (flexible) return { text: range ? `${range} · Flexible check-in` : 'Flexible check-in', dot: '🟡' };
    return { text: `${sD}${sT ? ` ${sT}` : ''} → ${eD}${eT ? ` ${eT}` : ''}`, dot: '🟢' };
  }
  if (unknown)  return { text: `${sD ? `${sD} · ` : ''}Time not decided`, dot: '⚪' };
  if (flexible) return { text: `${sD ? `${sD} · ` : ''}Flexible timing`,  dot: '🟡' };
  if (sT && eT) return { text: `${sD ? `${sD} · ` : ''}${sT} → ${eT}`,   dot: '🟢' };
  if (sT)       return { text: `${sD ? `${sD} · ` : ''}${sT}`,            dot: '🟢' };
  return          { text: `${sD ? `${sD} · ` : ''}Time not decided`,       dot: '⚪' };
}

interface BufferResult { text: string; cls: string }

function calcBuffer(arrivalItem: JourneyNode, departureItem: JourneyNode): BufferResult | null {
  if (!arrivalItem.endTime || !departureItem.startTime) return null;
  if (arrivalItem.timeStatus !== 'FIXED' || departureItem.timeStatus !== 'FIXED') return null;
  try {
    const end   = new Date(arrivalItem.endTime).getTime();
    const start = new Date(departureItem.startTime).getTime();
    if (isNaN(end) || isNaN(start)) return null;
    const diffMs = start - end;
    if (diffMs <= 0) return null;
    const totalMin = Math.round(diffMs / 60000);
    if (totalMin > 360) return null; // > 6h gap is intentional, not a buffer
    const h = Math.floor(totalMin / 60), m = totalMin % 60;
    const label = `${h > 0 ? `${h}h ` : ''}${m}m buffer`;
    if (totalMin < 15) return { text: `🚨 ${label}`, cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' };
    if (totalMin < 45) return { text: `⚠ ${label}`,  cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' };
    return { text: label, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' };
  } catch { return null; }
}

function getImpactInfo(node: JourneyNode, impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>) {
  if (!impactNodeMap) return null;
  return impactNodeMap[node.id] || (node.backendId ? impactNodeMap[String(node.backendId)] : null) || null;
}

function renderImpactBadge(status?: ImpactNodeStatus) {
  if (!status) return null;
  if (status === 'BROKEN') {
    return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-rose-600 text-white shadow-sm shrink-0">🔴 BROKEN</span>;
  }
  if (status === 'NEEDS_CHANGE') {
    return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-orange-500 text-white shadow-sm shrink-0">🟠 NEEDS CHANGE</span>;
  }
  if (status === 'AT_RISK') {
    return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500 text-white shadow-sm shrink-0">🟡 AT RISK</span>;
  }
  if (status === 'INTACT') {
    return <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm shrink-0">🟢 INTACT</span>;
  }
  return null;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A clickable card representing a location-based item (hotel, activity, etc.) */
const AttachedItemCard: React.FC<{
  node: JourneyNode;
  onClick: (n: JourneyNode) => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
}> = ({ node, onClick, impactNodeMap }) => {
  const Icon   = iconFor(node.type, node.transportMode);
  const colour = colourFor(node.type);
  const tb     = timeBadge(node);
  const impact = getImpactInfo(node, impactNodeMap);

  return (
    <button
      onClick={() => onClick(node)}
      className={`text-left border rounded-xl px-2.5 py-1.5 transition-all group w-full ${colour.card}`}
    >
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <div className="flex items-center gap-1.5 truncate">
          <Icon className={`h-3 w-3 shrink-0 ${colour.icon}`} />
          <span className="font-bold text-[11px] text-slate-800 dark:text-white truncate">
            {node.title}
          </span>
        </div>
        {impact && renderImpactBadge(impact.status)}
      </div>
      <span className={`text-[10px] leading-tight line-clamp-1 ${colour.text}`}>
        {tb.text}
      </span>
    </button>
  );
};

/** A clickable pill sitting on the horizontal rail representing a transport leg. */
const SegmentPill: React.FC<{
  segment: RouteSegment;
  buffer: BufferResult | null;
  onClick: (n: JourneyNode) => void;
  impactNodeMap?: Record<string, { status: ImpactNodeStatus; reason: string }>;
}> = ({ segment, buffer, onClick, impactNodeMap }) => {
  const { item } = segment;
  const Icon = iconFor(item.type, item.transportMode);
  const tb   = timeBadge(item);
  const impact = getImpactInfo(item, impactNodeMap);

  return (
    <div className="relative z-10 mx-auto flex flex-col items-center gap-0.5">
      {impact && renderImpactBadge(impact.status)}
      {buffer && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap leading-tight mb-0.5 ${buffer.cls}`}>
          {buffer.text}
        </span>
      )}
      <button
        onClick={() => onClick(item)}
        className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-600 rounded-2xl shadow-sm hover:shadow-md transition-all px-2.5 py-1.5 flex items-center gap-1.5 group cursor-pointer whitespace-nowrap"
      >
        <Icon className="h-3.5 w-3.5 text-sky-500 shrink-0 group-hover:scale-110 transition-transform" />
        <div className="flex flex-col text-left">
          <span className="font-bold text-[11px] text-slate-900 dark:text-white leading-tight">
            {item.title}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            {tb.text}
          </span>
        </div>
      </button>
    </div>
  );
};

// ─── Zone heights (keep dots aligned across all columns) ──────────────────────

const LABEL_H = 32; // px
const DOT_H   = 36; // px

// ─── Main renderer ────────────────────────────────────────────────────────────

export const JourneyRouteMap: React.FC<JourneyRouteMapProps> = ({
  route,
  onItemClick,
  onAddStop,
  impactNodeMap,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollWidth > el.clientWidth + 6);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [route]);

  const hasContent =
    route.locations.length > 0 ||
    route.unconnected.length > 0;

  if (!hasContent) return null;

  // ── Helper: find the segment between two adjacent ordered locations ─────
  function segmentBetween(
    fromLoc: RouteLocation,
    toLoc: RouteLocation,
  ): RouteSegment | null {
    return (
      route.segments.find(
        (s) => s.fromLocationId === fromLoc.id && s.toLocationId === toLoc.id,
      ) ?? null
    );
  }

  return (
    <div className="w-full space-y-4">

      {/* ── Overflow hint ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Route Map
        </span>
        {overflow && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">SWIPE →</span>
        )}
      </div>

      {/* ── Main connected route rail ────────────────────────────────────── */}
      {route.locations.length > 0 && (
        <div
          ref={railRef}
          className="overflow-x-auto overflow-y-visible no-scrollbar border border-slate-100 dark:border-slate-800/70 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 px-6 py-3"
        >
          <div
            className={`flex items-start ${route.locations.length <= 4 ? 'w-full justify-between' : 'min-w-max'}`}
          >
            {route.locations.map((loc, idx) => {
              const nextLoc    = route.locations[idx + 1] ?? null;
              const seg        = nextLoc ? segmentBetween(loc, nextLoc) : null;
              const arrivalSeg = segmentTo(route, loc.id);
              const hasAttach  = loc.attachedItems.length > 0;

              // Transfer buffer: between the arriving segment's item and the departing segment's item
              const departSeg    = seg;
              const bufResult =
                arrivalSeg && departSeg
                  ? calcBuffer(arrivalSeg.item, departSeg.item)
                  : null;

              const isFirst = idx === 0;
              const isLast  = idx === route.locations.length - 1;

              return (
                <React.Fragment key={loc.id}>
                  {/* ── LOCATION COLUMN ──────────────────────────────── */}
                  <div className="flex flex-col items-center relative">

                    {/* Zone 1: Location label */}
                    <div
                      className="flex items-end justify-center px-1"
                      style={{ height: LABEL_H }}
                    >
                      <span className="font-extrabold text-xs text-slate-800 dark:text-white bg-white/90 dark:bg-slate-900/90 px-2.5 py-0.5 rounded-lg border border-slate-200/70 dark:border-slate-800 whitespace-nowrap shadow-sm z-10">
                        {loc.label}
                      </span>
                    </div>

                    {/* Zone 2: Route dot + continuous route line passing through */}
                    <div
                      className="relative flex items-center justify-center w-full"
                      style={{ height: DOT_H }}
                    >
                      {/* Horizontal route line passing through the location node */}
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 h-[3px] bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 z-0 ${
                          isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'inset-x-0'
                        }`}
                      />

                      {/* Circular location dot */}
                      <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-900 border-[3px] border-sky-500 shadow-md flex items-center justify-center z-10 relative">
                        <div className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      </div>
                    </div>

                    {/* Zone 3: Attached items (vertical branch) */}
                    {hasAttach && (
                      <div className="flex flex-col items-center gap-1 mt-1 w-full z-10">
                        <div className="w-px h-3 bg-slate-300 dark:bg-slate-600" />
                        <div className="flex flex-col gap-1.5 items-stretch w-full max-w-[172px]">
                          {loc.attachedItems.map((item) => (
                            <AttachedItemCard
                              key={item.id}
                              node={item}
                              onClick={onItemClick}
                              impactNodeMap={impactNodeMap}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── SEGMENT COLUMN (only when there's a next location) ── */}
                  {seg && (
                    <div
                      className={`flex flex-col items-center relative ${route.locations.length <= 4 ? 'flex-1 min-w-[100px]' : 'min-w-[140px] px-2'}`}
                    >
                      {/* Zone 1: spacer */}
                      <div style={{ height: LABEL_H }} />

                      {/* Zone 2: continuous connecting edge + segment pill */}
                      <div
                        className="relative flex items-center w-full"
                        style={{ height: DOT_H }}
                      >
                        {/* Edge line extending across segment column connecting source dot to destination dot */}
                        <div className="absolute -inset-x-8 top-1/2 -translate-y-1/2 h-[3px] bg-gradient-to-r from-sky-400 via-sky-500 to-indigo-500 z-0" />

                        {/* Transport leg pill */}
                        <SegmentPill
                          segment={seg}
                          buffer={bufResult}
                          onClick={onItemClick}
                          impactNodeMap={impactNodeMap}
                        />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* ── Add next stop button ──────────────────────────────── */}
            {onAddStop && (
              <div className="flex flex-col items-center shrink-0 pl-2">
                <div style={{ height: LABEL_H }} />
                <div className="flex items-center relative" style={{ height: DOT_H }}>
                  <div className="w-6 h-[3px] bg-gradient-to-r from-indigo-400 to-sky-400/30 rounded-full mr-2" />
                  <button
                    onClick={onAddStop}
                    className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-900 hover:bg-sky-500 hover:text-white text-sky-600 dark:text-sky-400 border-2 border-dashed border-sky-400 font-semibold text-xs transition-all flex items-center gap-1.5 whitespace-nowrap hover:scale-105 z-10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add stop
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Unconnected locations ────────────────────────────────────────── */}
      {route.unconnected.length > 0 && (
        <div className="border border-amber-200/70 dark:border-amber-800/40 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Items not yet on the route
            </span>
          </div>
          <div className="flex flex-wrap gap-4">
            {route.unconnected.map((uc) => (
              <div key={uc.id} className="flex flex-col items-start gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                  {uc.label}
                </span>
                {uc.attachedItems.map((item) => (
                  <AttachedItemCard
                    key={item.id}
                    node={item}
                    onClick={onItemClick}
                    impactNodeMap={impactNodeMap}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Unplaced items (no location data at all) ─────────────────────── */}
      {route.unplaced.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/40 dark:bg-slate-900/40 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Location not specified
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {route.unplaced.map(({ item }) => (
              <AttachedItemCard
                key={item.id}
                node={item}
                onClick={onItemClick}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
