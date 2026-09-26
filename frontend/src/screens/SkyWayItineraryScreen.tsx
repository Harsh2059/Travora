import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  CheckCircle2,
  Download,
  Share2,
  ArrowRight,
  Plane,
  Clock,
  Luggage,
  Armchair,
  Headphones,
  MapPin
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import { useJourney, getSelectedRecoveryPlanWithMeta } from '../store/journeyStore';

export default function SkyWayItineraryScreen() {
  const navigate = useNavigate();
  const { journey } = useJourney();

  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [copyToast, setCopyToast] = useState(false);

  useEffect(() => {
    if (journey?.id) {
      const planMeta = getSelectedRecoveryPlanWithMeta(journey.id);
      if (planMeta?.plan) {
        setSelectedPlan(planMeta.plan);
      }
    }
  }, [journey?.id]);

  const handleDownload = () => {
    const content = `SkyWay Updated Itinerary Confirmation\nTrip: ${journey?.title || 'Trip to London'}\nBooking Reference: SW12345678\nStatus: Confirmed - Recovery Applied\nNew Outbound: AI-645 (BOM -> AMD) -> AI-207 (AMD -> DEL)\nSeats: 12A, 12B, 12C Confirmed\nBaggage: 25 kg Checked baggage transferred`;
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
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">Trip to London</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Updated Itinerary</span>
        </nav>

        {/* ── TITLE & ACTIONS HEADER (Reference Design) ── */}
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

        {/* ── ORIGINAL vs NEW FLIGHT COMPARISON CARD (Reference Design) ── */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-11 items-center gap-4">
            
            {/* Left: Original Flight (Cancelled/Changed) */}
            <div className="md:col-span-5 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Original Flight (Cancelled/Changed)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">
                  Cancelled
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                  AI
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Air India AI-129</p>
                  <p className="text-[11px] text-slate-500">Mumbai → Delhi • 12 Jun 2025</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1">
                <span>08:00</span>
                <span className="text-slate-300">➜</span>
                <span>10:20</span>
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
                    {selectedPlan?.replacement_flight?.carrier || 'Air India'} {selectedPlan?.replacement_flight?.flightNumber || 'AI-645'}
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium">
                    {selectedPlan?.replacement_flight?.route || 'Mumbai → Ahmedabad'} • {selectedPlan?.replacement_flight?.date || '12 Jun 2025'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-800 pt-1">
                <span>{selectedPlan?.replacement_flight?.departure || '11:45'}</span>
                <span className="text-sky-400">➜</span>
                <span>{selectedPlan?.replacement_flight?.arrival || '13:45'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── UPDATED JOURNEY TIMELINE (Reference Design) ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Updated Journey Timeline
          </h2>

          <div className="space-y-4">
            
            {/* Step 1: Mumbai Departs 11:45 */}
            <div className="flex items-start gap-4">
              <div className="w-16 text-right shrink-0 pt-0.5">
                <p className="text-xs font-black text-slate-900">11:45</p>
                <p className="text-[10px] font-semibold text-slate-400">12 Jun</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Plane className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">Mumbai (BOM)</p>
                  <p className="text-[11px] text-slate-500">Air India AI-645 • Terminal 2</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Confirmed • Departs 11:45
                </span>
              </div>
            </div>

            {/* Step 2: Layover in Ahmedabad */}
            <div className="flex items-start gap-4">
              <div className="w-16 text-right shrink-0 pt-0.5">
                <p className="text-xs font-black text-slate-900">13:45</p>
                <p className="text-[10px] font-semibold text-slate-400">12 Jun</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 bg-sky-50/60 rounded-2xl p-3 border border-dashed border-sky-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">Ahmedabad (AMD)</p>
                  <p className="text-[11px] text-slate-600">1h 30m layover • Same terminal transfer</p>
                </div>
                <span className="text-[11px] font-semibold text-sky-700">Protected Transit</span>
              </div>
            </div>

            {/* Step 3: Ahmedabad Departs 15:15 */}
            <div className="flex items-start gap-4">
              <div className="w-16 text-right shrink-0 pt-0.5">
                <p className="text-xs font-black text-slate-900">15:15</p>
                <p className="text-[10px] font-semibold text-slate-400">12 Jun</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Plane className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">Ahmedabad (AMD)</p>
                  <p className="text-[11px] text-slate-500">Air India AI-207 • Connecting flight</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Confirmed • Departs 15:15
                </span>
              </div>
            </div>

            {/* Step 4: Delhi Arrival 16:50 */}
            <div className="flex items-start gap-4">
              <div className="w-16 text-right shrink-0 pt-0.5">
                <p className="text-xs font-black text-slate-900">16:50</p>
                <p className="text-[10px] font-semibold text-slate-400">12 Jun</p>
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900">Delhi (DEL)</p>
                  <p className="text-[11px] text-slate-500">Arrives 16:50 • Terminal 3</p>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  Onward International Transit Ready
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── ADDITIONAL 3 CARDS: BAGGAGE, SEATS, EXTRA SUPPORT (Reference Design) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Baggage */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Luggage className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Baggage</h3>
              <p className="text-[11px] font-bold text-slate-800 mt-0.5">25 kg</p>
              <p className="text-[10px] text-slate-500">Checked baggage (unchanged)</p>
            </div>
          </div>

          {/* Card 2: Seats */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Armchair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">Seats</h3>
              <p className="text-[11px] font-bold text-slate-800 mt-0.5">12A, 12B, 12C</p>
              <p className="text-[10px] text-emerald-600 font-semibold">Confirmed (unchanged)</p>
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

        {/* ── PRIMARY CTA: CONTINUE TO MY TRIP (Reference Design) ── */}
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
