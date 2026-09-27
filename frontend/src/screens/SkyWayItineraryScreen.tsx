import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  CheckCircle2,
  Download,
  Share2,
  ArrowRight,
  Plane,
  Luggage,
  Armchair,
  Headphones,
  Car,
  Building
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import { useJourney, getSelectedRecoveryPlanWithMeta } from '../store/journeyStore';

function fmtDate(isoStr?: string | null): string {
  if (!isoStr) return '12 Jun';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  } catch {
    return isoStr || '12 Jun';
  }
}

function fmtTime(isoStr?: string | null): string {
  if (!isoStr) return '08:00';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return isoStr || '08:00';
  }
}

export default function SkyWayItineraryScreen() {
  const navigate = useNavigate();
  const { journey } = useJourney();

  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const itineraryNodes = journey?.nodes ?? [];
  const tripTitle = journey?.title || 'Active Journey';

  useEffect(() => {
    if (journey?.id) {
      const planMeta = getSelectedRecoveryPlanWithMeta(journey.id);
      if (planMeta?.plan) {
        setSelectedPlan(planMeta.plan);
      }
    }
  }, [journey?.id]);

  const handleDownload = () => {
    const content = [
      'Travora Updated Itinerary',
      `Trip: ${tripTitle}`,
      'Status: Recovery applied',
      ...itineraryNodes.map((node) => `${node.transportMode || node.type}: ${node.title} | ${node.origin || node.location || '—'} -> ${node.destination || '—'} | ${fmtTime(node.startTime)}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SkyWay_Updated_Itinerary.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const firstNode = itineraryNodes[0];

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={false} />

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        
        {/* ── BREADCRUMB ── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-sky-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">My Trips</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">{tripTitle}</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Updated Itinerary</span>
        </nav>

        {/* ── TITLE & ACTIONS HEADER ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                Itinerary Updated
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Your recovery option has been confirmed. Here's your updated journey.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Itinerary</span>
            </button>
            <button
              onClick={handleShare}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copyToast ? 'Link Copied!' : 'Share'}</span>
            </button>
          </div>
        </div>

        {/* ── ORIGINAL vs NEW FLIGHT COMPARISON CARD ── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-4">
            
            {/* Left: Original Segment (Cancelled/Changed) */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Original Flight (Disrupted)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">
                  Delayed
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  AI
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">{firstNode?.title || 'Air India AI-441'}</p>
                  <p className="text-[11px] text-slate-500">
                    {firstNode?.origin || 'Mumbai'} → {firstNode?.destination || 'Jaipur'} • {fmtDate(firstNode?.startTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1">
                <span>{fmtTime(firstNode?.startTime)}</span>
                <span className="text-slate-300">➜</span>
                <span>{fmtTime(firstNode?.endTime)}</span>
              </div>
            </div>

            {/* Center Arrow */}
            <div className="md:col-span-1 flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            {/* Right: New Flight (Confirmed) */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wider">
                  New Flight (Confirmed)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                  🟢 Confirmed
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  AI
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {selectedPlan?.replacement_flight?.carrier || selectedPlan?.title || 'Rescheduled Air India AI-441'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {selectedPlan?.replacement_flight?.route || `${firstNode?.origin || 'Mumbai'} → ${firstNode?.destination || 'Jaipur'}`} • {selectedPlan?.replacement_flight?.date || fmtDate(firstNode?.startTime)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-800 pt-1">
                <span>{selectedPlan?.replacement_flight?.departure_time || fmtTime(firstNode?.startTime)}</span>
                <span className="text-sky-400">➜</span>
                <span>{selectedPlan?.replacement_flight?.arrival_time || fmtTime(firstNode?.endTime)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── UPDATED JOURNEY TIMELINE ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Updated Journey Timeline
          </h2>

          <div className="space-y-4">
            {itineraryNodes.map((node, idx) => {
              const nType = (node.type || '').toLowerCase();
              const isHotel = nType.includes('hotel');
              const isCab = nType.includes('cab') || nType.includes('transfer') || nType.includes('taxi');

              const IconComp = isHotel ? Building : isCab ? Car : Plane;

              return (
                <div key={node.id || idx} className="flex items-start gap-4">
                  <div className="w-16 text-right shrink-0 pt-0.5">
                    <p className="text-xs font-black text-slate-900">{fmtTime(node.startTime)}</p>
                    <p className="text-[10px] font-semibold text-slate-400">{fmtDate(node.startTime)}</p>
                  </div>
                  <div className={`w-7 h-7 rounded-full ${isHotel ? 'bg-indigo-600' : isCab ? 'bg-sky-600' : 'bg-emerald-500'} text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5`}>
                    <IconComp className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{node.title || node.provider}</p>
                      <p className="text-[11px] text-slate-500">
                        {isHotel ? `Location: ${node.location || node.destination || 'Hotel'}` : isCab ? `Pickup: ${node.origin || 'Airport'} → Dropoff: ${node.destination || 'Hotel'}` : `${node.origin || 'Mumbai'} → ${node.destination || 'Jaipur'}`}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      Confirmed • {fmtTime(node.startTime)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ADDITIONAL 3 CARDS: BAGGAGE, SEATS, EXTRA SUPPORT ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Baggage */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Luggage className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Baggage</h3>
              <p className="text-[11px] font-bold text-slate-800 mt-0.5">15 kg</p>
              <p className="text-[10px] text-slate-500">Checked baggage (protected)</p>
            </div>
          </div>

          {/* Card 2: Seats */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Seats</h3>
              <p className="text-[11px] font-bold text-slate-800 mt-0.5">14B</p>
              <p className="text-[10px] text-emerald-600 font-semibold">Confirmed (protected)</p>
            </div>
          </div>

          {/* Card 3: Extra Support */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Extra Support</h3>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                Our team is monitoring your journey. You'll get real-time updates.
              </p>
            </div>
          </div>
        </div>

        {/* ── PRIMARY CTA: CONTINUE TO MY TRIP ── */}
        <div className="pt-2">
          <button
            onClick={() => navigate('/my-trips')}
            className="w-full py-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-sky-600/25 transition-all transform hover:scale-[1.005] active:scale-[0.995] flex items-center justify-center gap-2"
          >
            <span>Continue to My Trip</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      {/* 24/7 Support Concierge Modal */}
      <SkyWaySupportModal />
    </div>
  );
}
