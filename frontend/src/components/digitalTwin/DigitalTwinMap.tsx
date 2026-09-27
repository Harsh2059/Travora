/**
 * DigitalTwinMap.tsx
 *
 * Leaflet + OpenStreetMap interactive visualization for Travora Digital Twin.
 * Displays:
 *  - Mumbai Airport (BOM)
 *  - Flight corridor to London Heathrow (LHR)
 *  - Ground connection to Marriott London Hotel
 *  - Dynamic node status (LOW, MEDIUM, HIGH, CRITICAL)
 *  - Weather overlays and propagation indicators
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, ShieldAlert, Navigation } from 'lucide-react';
import type { AffectedEntity, ImpactSeverity } from '../../types/digitalTwin';

interface DigitalTwinMapProps {
  affectedEntities: AffectedEntity[];
  currentRainfall: number;
  currentWind: number;
  currentVisibility: number;
  disruptionProb: number;
  isSimulated: boolean;
}

const WAYPOINTS = [
  {
    id: 'bom',
    name: 'Mumbai Airport (BOM)',
    coords: [19.0896, 72.8656] as [number, number],
    type: 'airport',
    desc: 'Chhatrapati Shivaji Maharaj Intl • Departure Node',
  },
  {
    id: 'flight',
    name: 'Air India Express AI-441',
    coords: [22.95, 74.33] as [number, number],
    type: 'flight',
    desc: 'BOM → JAI Air Corridor • Nonstop Service',
  },
  {
    id: 'jai',
    name: 'Jaipur Airport (JAI)',
    coords: [26.8289, 75.8056] as [number, number],
    type: 'airport',
    desc: 'Jaipur International Airport • Arrival & Transfer Hub',
  },
  {
    id: 'uber',
    name: 'Uber Ground Transport',
    coords: [26.8706, 75.7964] as [number, number],
    type: 'transport',
    desc: 'Airport to Hotel Transfer • Ground Connection',
  },
  {
    id: 'hotel',
    name: 'Hotel Ram Jaipur',
    coords: [26.9124, 75.7873] as [number, number],
    type: 'hotel',
    desc: 'Jaipur City Lodging • Final Destination',
  },
];

function getImpactBadgeStyle(impact: ImpactSeverity) {
  switch (impact) {
    case 'critical':
      return {
        bg: 'bg-rose-600',
        text: 'text-white',
        border: 'border-rose-400',
        glow: 'shadow-lg shadow-rose-500/50',
        label: 'CRITICAL',
        dot: '🔴',
      };
    case 'high':
      return {
        bg: 'bg-amber-600',
        text: 'text-white',
        border: 'border-amber-400',
        glow: 'shadow-lg shadow-amber-500/50',
        label: 'HIGH',
        dot: '🟠',
      };
    case 'medium':
      return {
        bg: 'bg-yellow-500',
        text: 'text-slate-900',
        border: 'border-yellow-300',
        glow: 'shadow-md shadow-yellow-500/30',
        label: 'MEDIUM',
        dot: '🟡',
      };
    default:
      return {
        bg: 'bg-emerald-600',
        text: 'text-white',
        border: 'border-emerald-400',
        glow: 'shadow-md shadow-emerald-500/30',
        label: 'LOW',
        dot: '🟢',
      };
  }
}

export const DigitalTwinMap: React.FC<DigitalTwinMapProps> = ({
  affectedEntities,
  currentRainfall,
  currentWind,
  currentVisibility,
  disruptionProb,
  isSimulated,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Helper to lookup entity severity
  const getEntityImpact = (type: string): ImpactSeverity => {
    const match = affectedEntities.find((e) => e.type === type);
    const raw = match?.impact || (disruptionProb > 0.6 ? 'high' : 'low');
    const str = String(raw).toLowerCase();
    if (str.includes('crit')) return 'critical';
    if (str.includes('high')) return 'high';
    if (str.includes('med')) return 'medium';
    return 'low';
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map if not already initialized
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.5, 74.5],
        zoom: 6,
        minZoom: 4,
        maxZoom: 16,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | Travora Twin',
        maxZoom: 19,
      }).addTo(map);

      // Add zoom control in top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      layerGroupRef.current = layerGroup;
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const layerGroup = layerGroupRef.current;
    if (!layerGroup || !map) return;

    // Clear previous layers
    layerGroup.clearLayers();

    // ── 1. Flight Path & Ground Connection Lines (Journey #7 Mumbai → Jaipur) ──
    const bomCoords: [number, number] = [19.0896, 72.8656];
    const jaiCoords: [number, number] = [26.8289, 75.8056];
    const hotelCoords: [number, number] = [26.9124, 75.7873];

    // Flight route polyline with simulated impact color
    const flightImpact = getEntityImpact('flight');
    const flightColor =
      flightImpact === 'critical' ? '#e11d48' : flightImpact === 'high' ? '#d97706' : '#0284c7';

    // Route curve from Mumbai (BOM) to Jaipur (JAI) via airway corridor
    const flightCurve: [number, number][] = [
      bomCoords,
      [22.95, 74.33],
      jaiCoords,
    ];

    const flightLine = L.polyline(flightCurve, {
      color: flightColor,
      weight: 4,
      opacity: 0.9,
      dashArray: isSimulated ? '6, 8' : undefined,
    });
    flightLine.bindTooltip('BOM → JAI Air Corridor (Air India Express AI-441)', {
      sticky: true,
      className: 'travora-map-tooltip',
    });
    layerGroup.addLayer(flightLine);

    // Ground Transfer Line (Jaipur Airport -> Hotel Ram)
    const transferImpact = getEntityImpact('transport');
    const transferColor =
      transferImpact === 'critical'
        ? '#e11d48'
        : transferImpact === 'high'
        ? '#d97706'
        : '#10b981';

    const transferLine = L.polyline([jaiCoords, hotelCoords], {
      color: transferColor,
      weight: 4,
      dashArray: '4, 6',
      opacity: 0.9,
    });
    transferLine.bindTooltip('Uber Ground Transport to Hotel Ram Jaipur', {
      sticky: true,
    });
    layerGroup.addLayer(transferLine);

    // Weather Storm Danger Zone Circle around Origin if high rain
    if (currentRainfall > 50) {
      const stormRadius = Math.min(120000, currentRainfall * 800);
      const stormCircle = L.circle(bomCoords, {
        radius: stormRadius,
        color: '#e11d48',
        fillColor: '#f43f5e',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4',
      });
      stormCircle.bindPopup(
        `<div class="p-1">
          <div class="font-bold text-rose-700 text-xs">⛈️ Severe Weather Alert (Mumbai)</div>
          <div class="text-[11px] text-slate-700 mt-1">Precipitation: <b>${currentRainfall} mm</b></div>
          <div class="text-[11px] text-slate-700">Surface Wind: <b>${currentWind} km/h</b></div>
          <div class="text-[10px] text-rose-600 font-semibold mt-1">Terminal convective activity affecting departures</div>
        </div>`
      );
      layerGroup.addLayer(stormCircle);
    }

    // ── 2. Interactive Markers for all Waypoints ─────────────────────────────
    WAYPOINTS.forEach((wp) => {
      const impact = getEntityImpact(wp.type);
      const style = getImpactBadgeStyle(impact);

      let iconHtml = '';
      if (wp.id === 'bom') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <div class="w-8 h-8 rounded-full ${style.bg} ${style.border} border-2 text-white flex items-center justify-center font-bold text-xs shadow-md ${style.glow}">
              🛫
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 border border-slate-700">
              <span>${style.dot} BOM</span>
              <span class="${style.text} text-[9px] font-black">${style.label}</span>
            </div>
          </div>
        `;
      } else if (wp.id === 'flight') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-7 h-7 rounded-full bg-sky-600 border-2 border-white text-white flex items-center justify-center shadow-md">
              ✈️
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-white/95 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-bold shadow border border-slate-200">
              Air India Express
            </div>
          </div>
        `;
      } else if (wp.id === 'jai') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-8 h-8 rounded-full ${style.bg} ${style.border} border-2 text-white flex items-center justify-center font-bold text-xs shadow-md ${style.glow}">
              🛬
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 border border-slate-700">
              <span>${style.dot} JAI</span>
              <span class="${style.text} text-[9px] font-black">${style.label}</span>
            </div>
          </div>
        `;
      } else if (wp.id === 'uber') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-white text-white flex items-center justify-center shadow-md text-xs">
              🚗
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-white/95 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-bold shadow border border-slate-200">
              Uber
            </div>
          </div>
        `;
      } else {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-8 h-8 rounded-full ${style.bg} ${style.border} border-2 text-white flex items-center justify-center font-bold text-xs shadow-md ${style.glow}">
              🏨
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 border border-slate-700">
              <span>${style.dot} HOTEL</span>
              <span class="${style.text} text-[9px] font-black">${style.label}</span>
            </div>
          </div>
        `;
      }

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-leaflet-twin-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(wp.coords, { icon: customIcon });

      const popupContent = `
        <div class="p-2 min-w-[190px]">
          <div class="flex items-center justify-between border-b pb-1.5 mb-1.5">
            <span class="font-extrabold text-slate-900 text-xs">${wp.name}</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold ${style.bg} text-white uppercase">${style.label}</span>
          </div>
          <p class="text-[11px] text-slate-600 mb-1.5">${wp.desc}</p>
          <div class="bg-slate-50 rounded p-1.5 text-[10px] space-y-1 border border-slate-100">
            <div>Mode: <strong class="${isSimulated ? 'text-rose-600' : 'text-emerald-600'}">${isSimulated ? 'SIMULATED' : 'LIVE'}</strong></div>
            ${wp.id === 'bom' ? `<div>Rainfall: <b>${currentRainfall} mm</b></div><div>Visibility: <b>${currentVisibility} km</b></div>` : ''}
            <div>Disruption Risk: <b>${Math.round(disruptionProb * 100)}%</b></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroup.addLayer(marker);
    });
  }, [affectedEntities, currentRainfall, currentWind, currentVisibility, disruptionProb, isSimulated]);

  const handleFitBounds = () => {
    if (mapInstanceRef.current) {
      const bounds = L.latLngBounds(WAYPOINTS.map((w) => w.coords));
      mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200/90 shadow-xs bg-slate-900">
      {/* Map Header Overlay Bar */}
      <div className="absolute top-3 left-3 right-14 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-md border border-slate-200/80 flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
            <span className="text-xs font-extrabold text-slate-900">Digital Twin Route Map</span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-sky-600" />
            BOM → JAI Corridor (Mumbai → Jaipur)
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
            OpenStreetMap
          </span>
        </div>

        {/* Status Pills */}
        <div className="hidden md:flex items-center gap-1 bg-white/90 backdrop-blur-md p-1 rounded-full shadow border border-slate-200/80 text-[10px] font-bold pointer-events-auto">
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <span>🟢</span> LOW
          </span>
          <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 flex items-center gap-1">
            <span>🟡</span> MEDIUM
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
            <span>🟠</span> HIGH
          </span>
          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
            <span>🔴</span> CRITICAL
          </span>
        </div>
      </div>

      {/* Map Viewport Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-[380px] sm:h-[440px] lg:h-[480px] bg-slate-100 z-0"
      />

      {/* Map Bottom Footer Stats */}
      <div className="absolute bottom-3 left-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-sky-600" />
            <span className="font-extrabold text-slate-800">Route Feasibility:</span>
            <span
              className={`font-black uppercase ${
                disruptionProb >= 0.7
                  ? 'text-rose-600'
                  : disruptionProb >= 0.4
                  ? 'text-amber-600'
                  : 'text-emerald-600'
              }`}
            >
              {disruptionProb >= 0.7
                ? 'CRITICAL DISRUPTION EXPECTED'
                : disruptionProb >= 0.4
                ? 'POTENTIAL DELAYS DETECTED'
                : 'NOMINAL SCHEDULE INTACT'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFitBounds}
            className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] transition-colors flex items-center gap-1.5 shadow-2xs"
            title="Fit journey bounds"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Reset View</span>
          </button>
        </div>
      </div>
    </div>
  );
};
