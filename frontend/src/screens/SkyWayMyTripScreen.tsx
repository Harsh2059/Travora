import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  MoreVertical,
  Plane,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Users,
  Settings,
  RefreshCw,
  ArrowRight,
  Sparkles,
  CloudRain,
  Building,
  Car
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import {
  useJourney,
  fetchTripDisruptions,
  resetTripDisruptions,
  getSelectedRecoveryPlanWithMeta
} from '../store/journeyStore';
import { getStoredUser } from '../services/auth';

function fmtDateFull(isoStr?: string | null): string {
  if (!isoStr) return '12 Jun 2025';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoStr || '12 Jun 2025';
  }
}

function fmtTimeStr(isoStr?: string | null): string {
  if (!isoStr) return '08:00';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return isoStr || '08:00';
  }
}

function cleanRouteLocation(orig?: string | null, dest?: string | null, type?: string | null) {
  let o = (orig || '').trim();
  let d = (dest || '').trim();
  const isFlight = (type || '').toLowerCase().includes('flight');

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const parseLocation = (text: string, defaultCode: string) => {
    if (!text) return { label: '', code: defaultCode };

    // Check if parentheses contain code e.g. "Mumbai (BOM)" or "Delhi (DEL)"
    const match = text.match(/\(([A-Z]{3,4})\)/i);
    if (match) {
      return { label: text, code: match[1].toUpperCase() };
    }

    const t = norm(text);
    if (t.includes('mumbai') || t === 'bom') return { label: 'Mumbai (BOM)', code: 'BOM' };
    if (t.includes('delhi') || t === 'del') return { label: 'Delhi (DEL)', code: 'DEL' };
    if (t.includes('jaipur') || t === 'jai') return { label: 'Jaipur (JAI)', code: 'JAI' };
    if (t.includes('london') || t.includes('heathrow') || t === 'lhr') return { label: 'London Heathrow (LHR)', code: 'LHR' };
    if (t.includes('amritsar') || t === 'atq') return { label: 'Amritsar (ATQ)', code: 'ATQ' };
    if (t.includes('bengaluru') || t.includes('bangalore') || t === 'blr') return { label: 'Bengaluru (BLR)', code: 'BLR' };
    if (t.includes('hyderabad') || t === 'hyd') return { label: 'Hyderabad (HYD)', code: 'HYD' };
    if (t.includes('chennai') || t === 'maa') return { label: 'Chennai (MAA)', code: 'MAA' };
    if (t.includes('kolkata') || t === 'ccu') return { label: 'Kolkata (CCU)', code: 'CCU' };
    if (t.includes('pune') || t === 'pnq') return { label: 'Pune (PNQ)', code: 'PNQ' };

    const cleanName = text.charAt(0).toUpperCase() + text.slice(1);
    const code = text.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || defaultCode;
    const label = isFlight && !cleanName.toLowerCase().includes('airport') ? `${cleanName} Airport` : cleanName;
    return { label, code };
  };

  let origInfo = parseLocation(o, 'BOM');
  let destInfo = parseLocation(d, 'JAI');

  if (origInfo.label && destInfo.label && norm(origInfo.label) === norm(destInfo.label)) {
    destInfo = {
      label: `${destInfo.label} (Arrival)`,
      code: destInfo.code
    };
  }

  return {
    origTitle: origInfo.label || o || 'Origin',
    destTitle: destInfo.label || d || 'Destination',
    origCode: origInfo.code,
    destCode: destInfo.code,
  };
}

export default function SkyWayMyTripScreen() {
  const { journey, refresh } = useJourney();
  const user = getStoredUser();

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'passengers' | 'baggage' | 'manage'>('overview');
  const [activeDisruptions, setActiveDisruptions] = useState<any[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [hasRecoveredPlan, setHasRecoveredPlan] = useState(false);

  useEffect(() => {
    if (journey?.id) {
      fetchTripDisruptions(journey.id)
        .then((disruptions) => {
          const active = (disruptions || []).filter((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');
          setActiveDisruptions(active);
        })
        .catch(() => setActiveDisruptions([]));

      const planMeta = getSelectedRecoveryPlanWithMeta(journey.id);
      setHasRecoveredPlan(Boolean(planMeta));
    }
  }, [journey?.id]);

  const hasDisruption = activeDisruptions.length > 0;
  const nodes = journey?.nodes || [];
  const primaryUser = user?.name || 'Harsh Raut';
  const tripTitle = journey?.title || 'My Active Journey';
  const bookingRef = (journey as any)?.bookingReference || (journey?.id ? `SW${journey.id}84920` : 'SW78492015');

  const firstNode = nodes[0];
  const lastNode = nodes[nodes.length - 1];
  const dateRangeStr = firstNode && lastNode
    ? `${fmtDateFull(firstNode.startTime)} – ${fmtDateFull(lastNode.endTime || lastNode.startTime)}`
    : 'Date pending';

  const handleResetTrip = async () => {
    if (!journey?.id) return;
    setIsActionsMenuOpen(false);
    try {
      await resetTripDisruptions(journey.id);
      localStorage.removeItem(`travora_selected_recovery_${journey.id}`);
      await refresh();
      setActiveDisruptions([]);
      setHasRecoveredPlan(false);
    } catch (err) {
      console.error('Failed to reset disruptions:', err);
    }
  };

  const handleDownloadItinerary = () => {
    const printContent = `SkyWay Itinerary: ${tripTitle}\nBooking Reference: ${bookingRef}\nStatus: Confirmed\nPassenger: ${primaryUser}`;
    const blob = new Blob([printContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkyWay_Itinerary_${bookingRef}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={hasDisruption} />

      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        
        {/* ── BREADCRUMB ── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-sky-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">My Trips</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Booking Details</span>
        </nav>

        {/* ── TRIP HEADER BANNER ── */}
        <div className="relative bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block pointer-events-none">
            <img
              src="/london_banner.jpg"
              alt="Travel Banner"
              className="w-full h-full object-cover object-right opacity-30 mask-radial"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>

          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 z-10">
            
            {/* Title & Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {tripTitle}
                </h1>
                {hasDisruption ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                    Delayed (6h 30m)
                  </span>
                ) : hasRecoveredPlan ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                    Recovered Itinerary
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" />
                    Confirmed
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500 font-medium">
                <span>
                  Booking Reference: <strong className="text-slate-800">{bookingRef}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>{dateRangeStr}</span>
                <span className="text-slate-300">•</span>
                <span>1 Traveller</span>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                to={`/trip/${journey?.id || 7}/digital-twin`}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-600 via-indigo-600 to-purple-600 hover:from-sky-500 hover:to-indigo-500 shadow-md shadow-indigo-500/20 transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-200 animate-pulse" />
                <span>Digital Twin</span>
              </Link>
              <button
                onClick={() => setActiveTab('manage')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
              >
                Manage Booking
              </button>
              <button
                onClick={handleDownloadItinerary}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Itinerary</span>
              </button>

              {/* More Actions Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                  className="w-9 h-9 rounded-xl text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-2xs"
                  title="More actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {isActionsMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-30 animate-fade-in text-xs">
                    <div className="px-3 py-1.5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                      Disruption & Simulation
                    </div>
                    <Link
                      to={`/trip/${journey?.id || 7}/digital-twin`}
                      onClick={() => setIsActionsMenuOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 font-bold flex items-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Weather Digital Twin</span>
                    </Link>
                    {hasDisruption && (
                      <Link
                        to="/disruption"
                        onClick={() => setIsActionsMenuOpen(false)}
                        className="w-full text-left px-3.5 py-2 hover:bg-sky-50 text-sky-700 font-bold flex items-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
                        <span>Go to Disruption Page</span>
                      </Link>
                    )}
                    {hasRecoveredPlan && (
                      <Link
                        to="/itinerary"
                        onClick={() => setIsActionsMenuOpen(false)}
                        className="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 font-bold flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>View Updated Itinerary</span>
                      </Link>
                    )}
                    <button
                      onClick={handleResetTrip}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>Reset Disruption Simulation</span>
                    </button>
                    <Link
                      to="/admin"
                      onClick={() => setIsActionsMenuOpen(false)}
                      className="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-purple-700 font-bold flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5 text-purple-600" />
                      <span>Open Admin Console</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── TABS ── */}
          <div className="px-6 sm:px-8 border-t border-slate-100 flex items-center gap-6 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'overview'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Overview
            </button>
            <Link
              to="/timeline"
              className="py-3.5 text-xs sm:text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-sky-600 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <span>Journey Timeline</span>
              {hasDisruption && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </Link>
            <Link
              to={`/trip/${journey?.id || 7}/digital-twin`}
              className="py-3.5 text-xs sm:text-sm font-bold border-b-2 border-transparent text-indigo-600 hover:text-indigo-800 transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>Digital Twin</span>
            </Link>
            <button
              onClick={() => setActiveTab('passengers')}
              className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'passengers'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Passengers
            </button>
            <button
              onClick={() => setActiveTab('baggage')}
              className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'baggage'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Baggage & Seats
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-3.5 text-xs sm:text-sm font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'manage'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Manage
            </button>
          </div>
        </div>

        {/* ── WEATHER-DRIVEN DIGITAL TWIN BANNER CARD ── */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <CloudRain className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">Weather-Driven Digital Twin & What-If Simulation</h3>
              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Experience the live Digital Twin: simulate severe weather stress-tests (rainfall, wind, visibility, temp), observe AI delay predictions, map cascading impacts across Flight → Uber → Hotel, and review domain reasoning & recovery plans.
              </p>
            </div>
          </div>
          <Link
            to={`/trip/${journey?.id || 7}/digital-twin`}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-600 hover:from-sky-400 hover:to-indigo-400 text-white font-extrabold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 shrink-0 group hover:scale-[1.02]"
          >
            <Sparkles className="w-4 h-4 text-sky-200 group-hover:rotate-12 transition-transform" />
            <span>Launch Digital Twin</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* ── DISRUPTION ALERT BANNER (If Active) ── */}
        {hasDisruption && (() => {
          const activeDisp = activeDisruptions[0];
          const dispNode = activeDisp
            ? nodes.find(
                (n) =>
                  String(n.backendId || n.id) ===
                  String(activeDisp.affected_node_id || activeDisp.entity_id)
              ) || nodes[0]
            : null;
          const dispType = (dispNode?.type || '').toUpperCase();
          const delayText = activeDisp?.delay_minutes
            ? `${Math.floor(activeDisp.delay_minutes / 60)}h ${activeDisp.delay_minutes % 60}m`
            : '6h 30m';

          return (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-600/30">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-900">
                    {dispType === 'HOTEL'
                      ? 'Hotel Disruption Alert: Schedule Impact Detected'
                      : dispType === 'CAB' || dispType === 'TAXI'
                      ? 'Transport Disruption Alert: Delay Detected'
                      : 'Flight Disruption Alert: Delay Detected on Itinerary'}
                  </h3>
                  <p className="text-xs text-rose-700 mt-0.5">
                    {dispNode?.title || 'Segment'} delayed by {delayText} due to operational issues. Our automated recovery engine has generated smart alternatives for you.
                  </p>
                </div>
              </div>
              <Link
                to="/disruption"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 shrink-0"
              >
                <span>Review Recovery Options</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          );
        })()}

        {/* ── MAIN CONTENT (2 COLUMNS) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: ITINERARY SEGMENTS (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Outbound & Main Journey Segments Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-600" />
                  <h2 className="text-base font-bold text-slate-900">Active Journey Itinerary</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">{(() => {
                  const dedupMap = new Map<string, any>();
                  for (const n of nodes) {
                    const nType = (n.type || '').toLowerCase();
                    let k = n.id;
                    if (nType.includes('hotel') || nType.includes('stay')) {
                      k = `hotel_${(n.provider || '').toLowerCase()}_${(n.location || n.destination || '').toLowerCase()}`;
                    } else if (nType.includes('cab') || nType.includes('taxi') || nType.includes('transfer')) {
                      k = `cab_${(n.provider || '').toLowerCase()}_${(n.origin || '').toLowerCase()}_${(n.destination || '').toLowerCase()}`;
                    }
                    if (!dedupMap.has(k) || n.metadata?.is_replacement) dedupMap.set(k, n);
                  }
                  return dedupMap.size;
                })()} Segment{nodes.length === 1 ? '' : 's'}</span>
              </div>

              {(() => {
                const TYPE_ORDER: Record<string, number> = { flight: 1, train: 1, cab: 2, taxi: 2, transfer: 2, metro: 2, hotel: 3, stay: 3 };
                const dedupMap = new Map<string, any>();
                for (const n of nodes) {
                  const nType = (n.type || '').toLowerCase();
                  let k = n.id;
                  if (nType.includes('hotel') || nType.includes('stay')) {
                    k = `hotel_${(n.provider || '').toLowerCase()}_${(n.location || n.destination || '').toLowerCase()}`;
                  } else if (nType.includes('cab') || nType.includes('taxi') || nType.includes('transfer')) {
                    k = `cab_${(n.provider || '').toLowerCase()}_${(n.origin || '').toLowerCase()}_${(n.destination || '').toLowerCase()}`;
                  }
                  if (!dedupMap.has(k) || n.metadata?.is_replacement) dedupMap.set(k, n);
                }

                const displayNodes = Array.from(dedupMap.values()).sort((a, b) => {
                  const orderA = TYPE_ORDER[(a.type || '').toLowerCase()] || 4;
                  const orderB = TYPE_ORDER[(b.type || '').toLowerCase()] || 4;
                  return orderA - orderB;
                });

                return displayNodes.map((node, idx) => {
                  const nType = (node.type || '').toLowerCase();
                  const isHotel = nType.includes('hotel') || nType.includes('stay');
                  const isCab = nType.includes('cab') || nType.includes('transfer') || nType.includes('taxi');

                  const isDisrupted =
                    hasDisruption &&
                    activeDisruptions.some((d: any) => {
                      const nodeEnt = String(node.backendId || node.id);
                      const dispEnt = String(d.affected_node_id || d.entity_id || '');
                      return nodeEnt === dispEnt || (idx === 0 && (!dispEnt || dispEnt === '1'));
                    });

                  const startTimeFormatted = fmtTimeStr(node.startTime);
                  const endTimeFormatted = fmtTimeStr(node.endTime);

                  return (
                    <div key={node.id || idx} className="space-y-3">
                      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl ${isHotel ? 'bg-indigo-600' : isCab ? 'bg-sky-600' : 'bg-red-600'} text-white font-black text-xs flex items-center justify-center shadow-xs`}>
                              {isHotel ? <Building className="w-4 h-4" /> : isCab ? <Car className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{node.title || node.provider}</p>
                              <p className="text-[11px] text-slate-500">
                                {fmtDateFull(node.startTime)} • {node.transportMode || node.type}
                              </p>
                            </div>
                          </div>
                          {isDisrupted ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                              🔴 Delayed (+6h 30m)
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              🟢 Confirmed
                            </span>
                          )}
                        </div>

                        {isHotel ? (
                          <div className="pt-2 text-xs">
                            <p className="font-bold text-slate-800">Hotel Location: {node.location || node.destination || 'Jaipur'}</p>
                            <p className="text-slate-500 text-[11px] mt-0.5">
                              Check-in: {startTimeFormatted}
                              {endTimeFormatted !== '00:00' ? ` | Check-out: ${endTimeFormatted}` : ''}
                            </p>
                          </div>
                        ) : isCab ? (
                          <div className="pt-2 text-xs">
                            <p className="font-bold text-slate-800">Pickup: {node.origin || 'Airport'} → Dropoff: {node.destination || 'Hotel'}</p>
                            {startTimeFormatted !== '00:00' && (
                              <p className="text-slate-500 text-[11px] mt-0.5">Scheduled Pickup: {startTimeFormatted}</p>
                            )}
                          </div>
                        ) : (
                          (() => {
                            const route = cleanRouteLocation(node.origin, node.destination, node.type);
                            return (
                              <div className="grid grid-cols-7 items-center pt-2">
                                <div className="col-span-2">
                                  <p className="text-xl font-extrabold text-slate-900">{startTimeFormatted}</p>
                                  <p className="text-xs font-bold text-slate-600">{route.origCode}</p>
                                  <p className="text-[11px] text-slate-400 truncate" title={route.origTitle}>{route.origTitle}</p>
                                </div>
                                <div className="col-span-3 flex flex-col items-center px-2">
                                  <span className="text-[10px] font-bold text-slate-400">Direct</span>
                                  <div className="w-full flex items-center my-1">
                                    <div className="h-0.5 w-full bg-slate-300" />
                                    <Plane className="w-3.5 h-3.5 text-sky-600 mx-1 shrink-0" />
                                    <div className="h-0.5 w-full bg-slate-300" />
                                  </div>
                                  <span className="text-[10px] font-semibold text-emerald-600">Scheduled</span>
                                </div>
                                <div className="col-span-2 text-right">
                                  <p className="text-xl font-extrabold text-slate-900">{endTimeFormatted}</p>
                                  <p className="text-xs font-bold text-slate-600">{route.destCode}</p>
                                  <p className="text-[11px] text-slate-400 truncate" title={route.destTitle}>{route.destTitle}</p>
                                </div>
                              </div>
                            );
                          })()
                        )}
                      </div>

                      {/* Layover alert between segments if applicable */}
                      {idx < displayNodes.length - 1 && (
                        <div className="flex items-center justify-center gap-2 py-1 text-xs font-semibold text-slate-500 bg-sky-50/50 rounded-xl border border-dashed border-sky-200">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          <span>Connecting Transfer / Transit in Progress</span>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* RIGHT COLUMN: PASSENGERS & SUMMARY (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Passengers Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <h2 className="text-base font-bold text-slate-900">Passengers</h2>
                </div>
                <button className="text-xs font-bold text-sky-600 hover:underline">Edit</button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    HR
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{primaryUser}</p>
                    <p className="text-[11px] text-slate-500">Primary Traveller • Passport: Z7894562</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Summary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Trip Summary
              </h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Fare (1 Traveller)</span>
                  <span className="font-semibold text-slate-900">₹8,500</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Taxes & Fees</span>
                  <span className="font-semibold text-slate-900">₹1,200</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Seats & Baggage</span>
                  <span className="font-semibold text-slate-900">₹500</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total Paid</span>
                  <span className="text-xl font-extrabold text-slate-900">₹10,200</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100">
                <span className="flex items-center gap-1.5 font-medium">
                  <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                  Payment Method
                </span>
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="text-blue-600 font-extrabold text-[10px]">VISA</span>
                  •••• 4242
                </span>
              </div>
            </div>

            {/* Smart Recovery Support Widget */}
            <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl p-5 text-white shadow-md shadow-sky-600/20 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold">SkyWay Journey Guarantee</h3>
              </div>
              <p className="text-xs text-sky-100 leading-relaxed">
                Automated disruption monitoring is active. In case of schedule changes, you will receive real-time recovery alternatives.
              </p>
              <div className="pt-1 flex items-center gap-2">
                <Link
                  to="/timeline"
                  className="w-full py-2 bg-white text-sky-700 hover:bg-sky-50 rounded-xl text-center text-xs font-bold transition-colors"
                >
                  View Live Timeline →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 24/7 Support Concierge Modal */}
      <SkyWaySupportModal />
    </div>
  );
}

