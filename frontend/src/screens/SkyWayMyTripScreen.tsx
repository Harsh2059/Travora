import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  ArrowRight
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import {
  useJourney,
  fetchTripDisruptions,
  triggerTripDisruption,
  resetTripDisruptions,
  getSelectedRecoveryPlanWithMeta
} from '../store/journeyStore';

export default function SkyWayMyTripScreen() {
  const navigate = useNavigate();
  const { journey, refresh } = useJourney();

  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'passengers' | 'baggage' | 'manage'>('overview');
  const [activeDisruptions, setActiveDisruptions] = useState<any[]>([]);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
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

  // Handle Simulate Disruption (AI-129 delayed by 6h 30m)
  const handleSimulateDelay = async () => {
    if (!journey?.id) return;
    setIsSimulating(true);
    setIsActionsMenuOpen(false);

    try {
      const affectedNode = journey.nodes?.[0];
      const payload = {
        trip_id: journey.id,
        affected_node_id: affectedNode?.backendId || 1,
        entity_id: affectedNode?.backendId || 1,
        type: 'FLIGHT_DELAYED',
        event_type: 'FLIGHT_DELAYED',
        detected_at: new Date().toISOString(),
        reason: 'Technical issue with aircraft avionics system',
        delay_minutes: 390, // 6h 30m delay
      };

      await triggerTripDisruption(journey.id, payload);
      await refresh();
      navigate('/disruption');
    } catch (err) {
      console.error('Failed to trigger disruption simulation:', err);
      // Even if offline/error, navigate to disruption screen
      navigate('/disruption');
    } finally {
      setIsSimulating(false);
    }
  };

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
    const printContent = `SkyWay Itinerary: ${journey?.title || 'Trip to London'}\nBooking Reference: SW12345678\nStatus: Confirmed\nPassengers: Shubham Shah, Priya Shah, Aarav Shah`;
    const blob = new Blob([printContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkyWay_Itinerary_SW12345678.txt`;
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

        {/* ── TRIP HEADER WITH LONDON BANNER (Reference Design) ── */}
        <div className="relative bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          
          {/* Background image fade on right flank */}
          <div className="absolute right-0 top-0 bottom-0 w-1/3 hidden lg:block pointer-events-none">
            <img
              src="/london_banner.jpg"
              alt="London River Thames & Big Ben"
              className="w-full h-full object-cover object-right opacity-30 mask-radial"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
          </div>

          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 z-10">
            
            {/* Title & Metadata */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                  {journey?.title || 'Trip to London'}
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
                  Booking Reference: <strong className="text-slate-800">SW12345678</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span>Thu, 12 Jun 2025 – Fri, 20 Jun 2025</span>
                <span className="text-slate-300">•</span>
                <span>2 Adults, 1 Child</span>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-2.5 shrink-0">
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
                    <button
                      onClick={handleSimulateDelay}
                      disabled={isSimulating}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-700 font-bold flex items-center gap-2"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Simulate Flight Delay (6h 30m)</span>
                    </button>
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

          {/* ── TABS (Overview, Journey Timeline, Passengers, Baggage & Seats, Manage) ── */}
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

        {/* ── DISRUPTION ALERT BANNER (If Active) ── */}
        {hasDisruption && (
          <div className="bg-rose-50 border border-rose-200 rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-rose-600/30">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-rose-900">
                  Flight Disruption Alert: Air India AI-129 Delayed
                </h3>
                <p className="text-xs text-rose-700 mt-0.5">
                  Delayed by 6h 30m due to a technical issue. Our automated engine has computed 3 smart recovery options for you.
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
        )}

        {/* ── MAIN CONTENT (2 COLUMNS: ITINERARY vs PASSENGERS & SUMMARY) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: FLIGHT ITINERARY (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Outbound Itinerary Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-600" />
                  <h2 className="text-base font-bold text-slate-900">Flight Itinerary (Outbound)</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">2 Segments</span>
              </div>

              {/* Segment 1: Mumbai -> Delhi */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Air India Logo Badge */}
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      AI
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Air India AI-129</p>
                      <p className="text-[11px] text-slate-500">Thu, 12 Jun 2025 • Economy (V)</p>
                    </div>
                  </div>
                  {hasDisruption ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                      🔴 Delayed to 14:30
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      🟢 Confirmed
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-7 items-center pt-2">
                  <div className="col-span-2">
                    <p className="text-xl font-extrabold text-slate-900">08:00</p>
                    <p className="text-xs font-bold text-slate-600">BOM</p>
                    <p className="text-[11px] text-slate-400 truncate">Mumbai Terminal 2</p>
                  </div>
                  <div className="col-span-3 flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-slate-400">2h 20m</span>
                    <div className="w-full flex items-center my-1">
                      <div className="h-0.5 w-full bg-slate-300" />
                      <Plane className="w-3.5 h-3.5 text-sky-600 mx-1 shrink-0" />
                      <div className="h-0.5 w-full bg-slate-300" />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600">Non-stop</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xl font-extrabold text-slate-900">10:20</p>
                    <p className="text-xs font-bold text-slate-600">DEL</p>
                    <p className="text-[11px] text-slate-400 truncate">New Delhi Terminal 3</p>
                  </div>
                </div>
              </div>

              {/* Layover alert in Delhi */}
              <div className="flex items-center justify-center gap-2 py-1 text-xs font-semibold text-slate-500 bg-sky-50/50 rounded-xl border border-dashed border-sky-200">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                <span>Layover in New Delhi (DEL): 2h 55m</span>
              </div>

              {/* Segment 2: Delhi -> London */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      AI
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Air India AI-161</p>
                      <p className="text-[11px] text-slate-500">Thu, 12 Jun 2025 • Boeing 777-300ER</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    🟢 Confirmed
                  </span>
                </div>

                <div className="grid grid-cols-7 items-center pt-2">
                  <div className="col-span-2">
                    <p className="text-xl font-extrabold text-slate-900">13:15</p>
                    <p className="text-xs font-bold text-slate-600">DEL</p>
                    <p className="text-[11px] text-slate-400 truncate">New Delhi Terminal 3</p>
                  </div>
                  <div className="col-span-3 flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-slate-400">9h 15m</span>
                    <div className="w-full flex items-center my-1">
                      <div className="h-0.5 w-full bg-slate-300" />
                      <Plane className="w-3.5 h-3.5 text-sky-600 mx-1 shrink-0" />
                      <div className="h-0.5 w-full bg-slate-300" />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600">Non-stop</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xl font-extrabold text-slate-900">18:30</p>
                    <p className="text-xs font-bold text-slate-600">LHR</p>
                    <p className="text-[11px] text-slate-400 truncate">London Heathrow Terminal 2</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Return Journey Card (Reference Design) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-600 rotate-180" />
                  <h2 className="text-base font-bold text-slate-900">Return Journey</h2>
                </div>
                <span className="text-xs font-semibold text-slate-500">2 Segments</span>
              </div>

              {/* Segment 3: London -> Delhi */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      AI
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Air India AI-162</p>
                      <p className="text-[11px] text-slate-500">Fri, 20 Jun 2025 • Economy</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    🟢 Confirmed
                  </span>
                </div>

                <div className="grid grid-cols-7 items-center pt-2">
                  <div className="col-span-2">
                    <p className="text-xl font-extrabold text-slate-900">20:30</p>
                    <p className="text-xs font-bold text-slate-600">LHR</p>
                    <p className="text-[11px] text-slate-400 truncate">London Heathrow</p>
                  </div>
                  <div className="col-span-3 flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-slate-400">8h 50m</span>
                    <div className="w-full flex items-center my-1">
                      <div className="h-0.5 w-full bg-slate-300" />
                      <Plane className="w-3.5 h-3.5 text-sky-600 mx-1 shrink-0" />
                      <div className="h-0.5 w-full bg-slate-300" />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600">Non-stop</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xl font-extrabold text-slate-900">
                      09:20 <sup className="text-rose-500 font-bold text-xs">+1</sup>
                    </p>
                    <p className="text-xs font-bold text-slate-600">DEL</p>
                    <p className="text-[11px] text-slate-400 truncate">New Delhi</p>
                  </div>
                </div>
              </div>

              {/* Segment 4: Delhi -> Mumbai */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      AI
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Air India AI-130</p>
                      <p className="text-[11px] text-slate-500">Sat, 21 Jun 2025 • Economy</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    🟢 Confirmed
                  </span>
                </div>

                <div className="grid grid-cols-7 items-center pt-2">
                  <div className="col-span-2">
                    <p className="text-xl font-extrabold text-slate-900">11:10</p>
                    <p className="text-xs font-bold text-slate-600">DEL</p>
                    <p className="text-[11px] text-slate-400 truncate">New Delhi</p>
                  </div>
                  <div className="col-span-3 flex flex-col items-center px-2">
                    <span className="text-[10px] font-bold text-slate-400">2h 15m</span>
                    <div className="w-full flex items-center my-1">
                      <div className="h-0.5 w-full bg-slate-300" />
                      <Plane className="w-3.5 h-3.5 text-sky-600 mx-1 shrink-0" />
                      <div className="h-0.5 w-full bg-slate-300" />
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600">Non-stop</span>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-xl font-extrabold text-slate-900">13:25</p>
                    <p className="text-xs font-bold text-slate-600">BOM</p>
                    <p className="text-[11px] text-slate-400 truncate">Mumbai Terminal 2</p>
                  </div>
                </div>
              </div>
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
                {/* Passenger 1 */}
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    SS
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">Shubham Shah</p>
                    <p className="text-[11px] text-slate-500">Adult • Passport: Z4321987</p>
                  </div>
                </div>

                {/* Passenger 2 */}
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    PS
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">Priya Shah</p>
                    <p className="text-[11px] text-slate-500">Adult • Passport: Z4321988</p>
                  </div>
                </div>

                {/* Passenger 3 */}
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="w-9 h-9 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    AS
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">Aarav Shah</p>
                    <p className="text-[11px] text-slate-500">Child • Passport: Z4321989</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trip Summary Card (Reference Design) */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
                Trip Summary
              </h2>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Fare (3 Travellers)</span>
                  <span className="font-semibold text-slate-900">₹1,38,000</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Taxes & Fees</span>
                  <span className="font-semibold text-slate-900">₹24,600</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Seats & Baggage</span>
                  <span className="font-semibold text-slate-900">₹6,000</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Total Paid</span>
                  <span className="text-xl font-extrabold text-slate-900">₹1,68,600</span>
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
