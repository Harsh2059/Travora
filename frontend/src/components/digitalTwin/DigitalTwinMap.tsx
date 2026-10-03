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

import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, ShieldAlert, Navigation } from 'lucide-react';
import type { AffectedEntity, ImpactSeverity } from '../../types/digitalTwin';
import type { Journey } from '../../types';

interface DigitalTwinMapProps {
  journey?: Journey | null;
  affectedEntities: AffectedEntity[];
  currentRainfall: number;
  currentWind: number;
  currentVisibility: number;
  disruptionProb: number;
  isSimulated: boolean;
}

const CITY_COORDINATES: Record<string, { coords: [number, number]; label: string; code: string }> = {
  mumbai: { coords: [19.0896, 72.8656], label: 'Mumbai Airport (BOM)', code: 'BOM' },
  bom: { coords: [19.0896, 72.8656], label: 'Mumbai Airport (BOM)', code: 'BOM' },
  jaipur: { coords: [26.8289, 75.8056], label: 'Jaipur Airport (JAI)', code: 'JAI' },
  jai: { coords: [26.8289, 75.8056], label: 'Jaipur Airport (JAI)', code: 'JAI' },
  delhi: { coords: [28.5562, 77.1000], label: 'Delhi Airport (DEL)', code: 'DEL' },
  del: { coords: [28.5562, 77.1000], label: 'Delhi Airport (DEL)', code: 'DEL' },
  bangalore: { coords: [13.1986, 77.7066], label: 'Bengaluru Airport (BLR)', code: 'BLR' },
  bengaluru: { coords: [13.1986, 77.7066], label: 'Bengaluru Airport (BLR)', code: 'BLR' },
  blr: { coords: [13.1986, 77.7066], label: 'Bengaluru Airport (BLR)', code: 'BLR' },
  goa: { coords: [15.3808, 73.8314], label: 'Goa Dabolim (GOI)', code: 'GOI' },
  goi: { coords: [15.3808, 73.8314], label: 'Goa Dabolim (GOI)', code: 'GOI' },
  london: { coords: [51.4700, -0.4543], label: 'London Heathrow (LHR)', code: 'LHR' },
  lhr: { coords: [51.4700, -0.4543], label: 'London Heathrow (LHR)', code: 'LHR' },
  chennai: { coords: [12.9941, 80.1709], label: 'Chennai Airport (MAA)', code: 'MAA' },
  maa: { coords: [12.9941, 80.1709], label: 'Chennai Airport (MAA)', code: 'MAA' },
  kolkata: { coords: [22.6547, 88.4467], label: 'Kolkata Airport (CCU)', code: 'CCU' },
  ccu: { coords: [22.6547, 88.4467], label: 'Kolkata Airport (CCU)', code: 'CCU' },
  hyderabad: { coords: [17.2403, 78.4294], label: 'Hyderabad Airport (HYD)', code: 'HYD' },
  hyd: { coords: [17.2403, 78.4294], label: 'Hyderabad Airport (HYD)', code: 'HYD' },
  pune: { coords: [18.5822, 73.9197], label: 'Pune Airport (PNQ)', code: 'PNQ' },
  pnq: { coords: [18.5822, 73.9197], label: 'Pune Airport (PNQ)', code: 'PNQ' },
  ahmedabad: { coords: [23.0772, 72.6347], label: 'Ahmedabad Airport (AMD)', code: 'AMD' },
  amd: { coords: [23.0772, 72.6347], label: 'Ahmedabad Airport (AMD)', code: 'AMD' },
};

function resolveLocationCoords(str: string, fallbackCoords: [number, number]): { coords: [number, number]; label: string; code: string } {
  if (!str) return { coords: fallbackCoords, label: 'Origin Airport', code: 'ORIG' };
  const lower = str.toLowerCase();
  for (const key of Object.keys(CITY_COORDINATES)) {
    if (lower.includes(key)) return CITY_COORDINATES[key];
  }
  // Deterministic fallback derived from text string
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const lat = 19.0 + (Math.abs(hash) % 1000) / 100;
  const lng = 72.0 + (Math.abs(hash * 3) % 1000) / 100;
  const words = str.split(' ');
  const code = words.length > 1 ? words[0].substring(0, 3).toUpperCase() : str.substring(0, 3).toUpperCase();
  return { coords: [lat, lng], label: str, code };
}

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
  journey,
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

  // Dynamically extract origin, destination, and waypoints from journey nodes or affectedEntities
  const waypoints = useMemo(() => {
    const nodes = journey?.nodes || [];
    const flightNode = nodes.find((n) => n.type === 'FLIGHT' || n.type === 'flight');
    const cabNode = nodes.find((n) => n.type === 'CAB' || n.type === 'cab' || n.type === 'METRO' || n.type === 'metro');
    const hotelNode = nodes.find((n) => n.type === 'HOTEL' || n.type === 'hotel');

    const originStr = flightNode?.origin || nodes[0]?.origin || nodes[0]?.location || 'Mumbai (BOM)';
    const destStr = flightNode?.destination || nodes[0]?.destination || 'Jaipur (JAI)';

    const originInfo = resolveLocationCoords(originStr, [19.0896, 72.8656]);
    const destInfo = resolveLocationCoords(destStr, [26.8289, 75.8056]);

    const midLat = (originInfo.coords[0] + destInfo.coords[0]) / 2 + 0.3;
    const midLng = (originInfo.coords[1] + destInfo.coords[1]) / 2;

    const list: Array<{
      id: string;
      name: string;
      coords: [number, number];
      type: string;
      desc: string;
      code: string;
    }> = [
      {
        id: 'origin',
        name: flightNode?.origin || originInfo.label,
        coords: originInfo.coords,
        type: 'airport',
        desc: `Departure Node • ${originInfo.label}`,
        code: originInfo.code,
      },
      {
        id: 'flight',
        name: flightNode?.title || 'Air India Express AI-441',
        coords: [midLat, midLng],
        type: 'flight',
        desc: `${originInfo.code} → ${destInfo.code} Corridor • ${flightNode?.title || 'Flight Leg'}`,
        code: 'FLT',
      },
      {
        id: 'dest_airport',
        name: flightNode?.destination || destInfo.label,
        coords: destInfo.coords,
        type: 'airport',
        desc: `Arrival & Transfer Hub • ${destInfo.label}`,
        code: destInfo.code,
      },
    ];

    if (cabNode) {
      const cabCoords: [number, number] = [destInfo.coords[0] + 0.04, destInfo.coords[1] - 0.01];
      list.push({
        id: 'transport',
        name: cabNode.title || 'Uber Ground Transport',
        coords: cabCoords,
        type: 'transport',
        desc: `${cabNode.origin || destInfo.label} to ${cabNode.destination || 'Hotel'} Transfer`,
        code: 'CAB',
      });
    }

    if (hotelNode) {
      const hotelCoords: [number, number] = [destInfo.coords[0] + 0.08, destInfo.coords[1] - 0.02];
      list.push({
        id: 'hotel',
        name: hotelNode.title || 'Hotel Ram Jaipur',
        coords: hotelCoords,
        type: 'hotel',
        desc: `${hotelNode.location || hotelNode.destination || 'Lodging'} • Final Destination`,
        code: 'HTL',
      });
    }

    return list;
  }, [journey]);

  const originCode = waypoints[0]?.code || 'BOM';
  const destCode = waypoints[2]?.code || waypoints[waypoints.length - 1]?.code || 'JAI';
  const corridorTitle = `${originCode} → ${destCode} Corridor (${waypoints[0]?.name.split(' ')[0]} → ${waypoints[2]?.name.split(' ')[0]})`;

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
      const centerCoords = waypoints[0]?.coords || [19.0896, 72.8656];
      const map = L.map(mapContainerRef.current, {
        center: centerCoords,
        zoom: 6,
        minZoom: 3,
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

    const originPt = waypoints[0]?.coords || [19.0896, 72.8656];
    const flightMidPt = waypoints[1]?.coords || [22.95, 74.33];
    const destPt = waypoints[2]?.coords || [26.8289, 75.8056];
    const hotelPt = waypoints.find((w) => w.type === 'hotel')?.coords || [destPt[0] + 0.08, destPt[1] - 0.02];

    // Flight route polyline with simulated impact color
    const flightImpact = getEntityImpact('flight');
    const flightColor =
      flightImpact === 'critical' ? '#e11d48' : flightImpact === 'high' ? '#d97706' : '#0284c7';

    const flightLine = L.polyline([originPt, flightMidPt, destPt], {
      color: flightColor,
      weight: 4,
      opacity: 0.9,
      dashArray: isSimulated ? '6, 8' : undefined,
    });
    flightLine.bindTooltip(`${corridorTitle} (${waypoints[1]?.name || 'Flight'})`, {
      sticky: true,
      className: 'travora-map-tooltip',
    });
    layerGroup.addLayer(flightLine);

    // Ground Transfer Line
    const transferImpact = getEntityImpact('transport');
    const transferColor =
      transferImpact === 'critical'
        ? '#e11d48'
        : transferImpact === 'high'
        ? '#d97706'
        : '#10b981';

    const transferLine = L.polyline([destPt, hotelPt], {
      color: transferColor,
      weight: 4,
      dashArray: '4, 6',
      opacity: 0.9,
    });
    transferLine.bindTooltip('Ground Transport to Hotel Destination', {
      sticky: true,
    });
    layerGroup.addLayer(transferLine);

    // Weather Storm Danger Zone Circle around Origin if high rain or zero vis
    if (currentRainfall > 50 || currentVisibility <= 0.5) {
      const stormRadius = Math.min(140000, currentRainfall > 50 ? currentRainfall * 800 : 90000);
      const stormCircle = L.circle(originPt, {
        radius: stormRadius,
        color: '#e11d48',
        fillColor: '#f43f5e',
        fillOpacity: 0.18,
        weight: 1.5,
        dashArray: '4, 4',
      });
      stormCircle.bindPopup(
        `<div class="p-1">
          <div class="font-bold text-rose-700 text-xs">⛈️ Severe Weather Alert (${waypoints[0]?.name || 'Origin'})</div>
          <div class="text-[11px] text-slate-700 mt-1">Precipitation: <b>${currentRainfall} mm</b></div>
          <div class="text-[11px] text-slate-700">Visibility: <b>${currentVisibility} km</b></div>
          <div class="text-[11px] text-slate-700">Surface Wind: <b>${currentWind} km/h</b></div>
          <div class="text-[10px] text-rose-600 font-semibold mt-1">Terminal weather activity affecting departures</div>
        </div>`
      );
      layerGroup.addLayer(stormCircle);
    }

    // Interactive Markers for all Waypoints
    waypoints.forEach((wp) => {
      const impact = getEntityImpact(wp.type);
      const style = getImpactBadgeStyle(impact);

      let iconHtml = '';
      if (wp.id === 'origin') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <div class="w-8 h-8 rounded-full ${style.bg} ${style.border} border-2 text-white flex items-center justify-center font-bold text-xs shadow-md ${style.glow}">
              🛫
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 border border-slate-700">
              <span>${style.dot} ${wp.code}</span>
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
              ${wp.name}
            </div>
          </div>
        `;
      } else if (wp.id === 'dest_airport') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-8 h-8 rounded-full ${style.bg} ${style.border} border-2 text-white flex items-center justify-center font-bold text-xs shadow-md ${style.glow}">
              🛬
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-900/90 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow flex items-center gap-1 border border-slate-700">
              <span>${style.dot} ${wp.code}</span>
              <span class="${style.text} text-[9px] font-black">${style.label}</span>
            </div>
          </div>
        `;
      } else if (wp.id === 'transport') {
        iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer">
            <div class="w-7 h-7 rounded-full bg-slate-800 border-2 border-white text-white flex items-center justify-center shadow-md text-xs">
              🚗
            </div>
            <div class="absolute -bottom-5 whitespace-nowrap bg-white/95 text-slate-800 text-[9px] px-1.5 py-0.5 rounded font-bold shadow border border-slate-200">
              ${wp.name}
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
            ${wp.id === 'origin' ? `<div>Rainfall: <b>${currentRainfall} mm</b></div><div>Visibility: <b>${currentVisibility} km</b></div>` : ''}
            <div>Disruption Risk: <b>${Math.round(disruptionProb * 100)}%</b></div>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      layerGroup.addLayer(marker);
    });

    // Auto-fit bounds on waypoints
    if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => w.coords));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [waypoints, affectedEntities, currentRainfall, currentWind, currentVisibility, disruptionProb, isSimulated, corridorTitle]);

  const handleFitBounds = () => {
    if (mapInstanceRef.current && waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => w.coords));
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
            {corridorTitle}
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
