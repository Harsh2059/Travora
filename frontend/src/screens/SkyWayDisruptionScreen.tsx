import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  AlertTriangle,
  Clock,
  Plane,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import {
  useJourney,
  saveSelectedRecoveryPlan
} from '../store/journeyStore';
import { analyzePart4Recovery, executePart5Recovery } from '../services/recoveryApi';

export default function SkyWayDisruptionScreen() {
  const navigate = useNavigate();
  const { journey, refresh } = useJourney();

  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt_2');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  useEffect(() => {
    if (journey?.id) {
      // Attempt querying real recovery engine
      analyzePart4Recovery(journey.id).catch((err) => {
        console.warn('Backend recovery query fallback:', err?.message);
      });
    }
  }, [journey?.id]);

  // Recovery Options (matching reference design exactly with real fallback data)
  const recoveryOptions = [
    {
      id: 'opt_1',
      title: 'Wait for Same Flight',
      badge: 'Simplest Option',
      badgeColor: 'bg-slate-100 text-slate-700',
      isRecommended: false,
      departs: '14:30',
      departsSub: '(6h 30m delay)',
      arrives: '16:50',
      arrivesSub: '',
      travelTime: '2h 20m',
      stops: 'Non-stop',
      impact: 'Longer wait at airport',
      buttonVariant: 'outline',
      replacementFlight: {
        flightNumber: 'AI-129',
        carrier: 'Air India',
        route: 'Mumbai (BOM) → Delhi (DEL)',
        departure: '14:30',
        arrival: '16:50',
        date: '12 Jun 2025',
      },
    },
    {
      id: 'opt_2',
      title: 'Alternate via Ahmedabad',
      badge: 'Faster Arrival',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      isRecommended: true,
      departs: '11:45',
      departsSub: 'From BOM',
      arrives: '16:50',
      arrivesSub: 'At DEL',
      travelTime: '5h 5m',
      stops: '1 step (AMD)',
      impact: 'Arrive 1h earlier',
      buttonVariant: 'primary',
      replacementFlight: {
        flightNumber: 'AI-645',
        carrier: 'Air India',
        route: 'Mumbai (BOM) → Ahmedabad (AMD) → Delhi (DEL)',
        departure: '11:45',
        arrival: '16:50',
        date: '12 Jun 2025',
      },
    },
    {
      id: 'opt_3',
      title: 'Next Day Flight',
      badge: 'Less Hassle',
      badgeColor: 'bg-purple-100 text-purple-800',
      isRecommended: false,
      departs: '08:00',
      departsSub: '13 Jun 2025',
      arrives: '10:20',
      arrivesSub: '13 Jun 2025',
      travelTime: '2h 20m',
      stops: 'Non-stop',
      impact: 'Stay overnight in Mumbai',
      buttonVariant: 'outline',
      replacementFlight: {
        flightNumber: 'AI-131',
        carrier: 'Air India',
        route: 'Mumbai (BOM) → Delhi (DEL)',
        departure: '08:00',
        arrival: '10:20',
        date: '13 Jun 2025',
      },
    },
  ];

  const handleSelectOption = async (option: typeof recoveryOptions[0]) => {
    setSelectedOptionId(option.id);
    setIsProcessing(true);

    const tripId = journey?.id || 1;

    // Build standard recovery plan structure
    const planPayload: any = {
      id: option.id,
      title: option.title,
      strategy_type: option.isRecommended ? 'REROUTE' : 'REBOOK',
      description: `Rebooked on ${option.replacementFlight.flightNumber} (${option.stops}). Impact: ${option.impact}.`,
      replacement_flight: option.replacementFlight,
      travel_time: option.travelTime,
      stops: option.stops,
      impact: option.impact,
      is_recommended: option.isRecommended,
      selected_at: new Date().toISOString(),
    };

    try {
      const result = await executePart5Recovery(tripId, planPayload, 'fingerprint_delay_6h30m');
      if (result.status !== 'COMPLETED' && result.status !== 'PARTIALLY_COMPLETED') {
        throw new Error(result.message || 'Recovery booking did not complete.');
      }

      // The booking endpoint is authoritative. Refresh its exact trip before
      // navigating so every consumer receives the newly persisted itinerary.
      await refresh();
      saveSelectedRecoveryPlan(tripId, planPayload, 'fingerprint_delay_6h30m', false);
      setIsProcessing(false);
      navigate('/itinerary');
    } catch (err) {
      console.error('Failed to apply recovery:', err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={true} />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        
        {/* ── BREADCRUMB ── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-sky-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">My Trips</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">Trip to London</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Disruption & Recovery</span>
        </nav>

        {/* ── TITLE ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Flight Disruption
          </h1>
          <Link
            to="/timeline"
            className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
          >
            <span>View Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── PROMINENT DISRUPTION ALERT BOX (Reference Design) ── */}
        <div className="bg-rose-50/90 border border-rose-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          
          {/* Left Text */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                Your flight has been delayed
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
                Air India AI-129 (Mumbai → Delhi) is delayed due to a technical issue. Our team has found the best recovery options for you.
              </p>
            </div>
          </div>

          {/* Right Red/Orange Callout Box */}
          <div className="bg-rose-100/70 border border-rose-200/80 rounded-2xl p-4 text-center md:text-right shrink-0 min-w-[210px] w-full md:w-auto">
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              New Departure Time
            </p>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 my-0.5">
              14:30
            </p>
            <p className="text-[11px] font-semibold text-rose-700">
              (Delayed by 6h 30m)
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Originally 08:00
            </p>
          </div>
        </div>

        {/* ── DISRUPTION DETAILS CARD (Reference Design) ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Disruption Details
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Affected Flight
              </p>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900">
                <Plane className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>Air India AI-129</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Mumbai (BOM) → Delhi (DEL)
              </p>
              <p className="text-[10px] text-slate-400">
                Thu, 12 Jun 2025 • Terminal 2
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Reason
              </p>
              <p className="mt-1 font-bold text-slate-800">Technical issue</p>
              <p className="text-[11px] text-slate-500">Aircraft avionics inspection</p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Impact
              </p>
              <p className="mt-1 font-bold text-rose-600">6h 30m delay</p>
              <p className="text-[11px] text-slate-500">Misses original London connect</p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Status
              </p>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  Delayed
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── RECOVERY OPTIONS SECTION (Reference Design) ── */}
        <div className="space-y-4 pt-2">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Recovery Options
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Choose the best option for your onward journey. All options include confirmed seats and baggage protection.
            </p>
          </div>

          {/* 3 COMPARISON CARDS (Grid 3 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recoveryOptions.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOptionId(opt.id)}
                  className={`relative rounded-3xl p-5 sm:p-6 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    opt.isRecommended
                      ? 'bg-white border-2 border-sky-600 shadow-xl shadow-sky-600/10'
                      : 'bg-white border border-slate-200/90 hover:border-slate-300 shadow-xs hover:shadow-md'
                  }`}
                >
                  {/* Recommended Pill Badge */}
                  {opt.isRecommended && (
                    <div className="absolute -top-3 right-6 bg-sky-600 text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-md shadow-sky-600/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Recommended</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Card Header with Radio & Title */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="recoveryPlanRadio"
                          checked={isSelected}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-xs font-bold text-slate-400">
                          {opt.id === 'opt_1' ? 'Option 1' : opt.id === 'opt_2' ? 'Option 2' : 'Option 3'}
                        </span>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${opt.badgeColor}`}>
                        {opt.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        {opt.title}
                      </h3>
                    </div>

                    {/* Flight Times */}
                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Departs</p>
                        <p className="text-lg font-black text-slate-900">{opt.departs}</p>
                        {opt.departsSub && (
                          <p className="text-[10px] font-semibold text-slate-500">{opt.departsSub}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Arrives</p>
                        <p className="text-lg font-black text-slate-900">{opt.arrives}</p>
                        {opt.arrivesSub && (
                          <p className="text-[10px] font-semibold text-slate-500">{opt.arrivesSub}</p>
                        )}
                      </div>
                    </div>

                    {/* Meta Specs */}
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Travel Time
                        </span>
                        <span className="font-bold text-slate-800">{opt.travelTime}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Plane className="w-3 h-3" />
                          Stops
                        </span>
                        <span className="font-bold text-slate-800">{opt.stops}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <Info className="w-3 h-3" />
                          Impact
                        </span>
                        <span className="font-bold text-slate-800 text-right">{opt.impact}</span>
                      </div>
                    </div>
                  </div>

                  {/* Select Option CTA Button */}
                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOption(opt);
                      }}
                      disabled={isProcessing}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        opt.buttonVariant === 'primary'
                          ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/25 hover:scale-[1.01]'
                          : 'bg-white hover:bg-slate-50 text-sky-700 border border-slate-200'
                      }`}
                    >
                      <span>Select Option</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BOTTOM TRAVEL EXPERT CHAT BAR (Reference Design) ── */}
        <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold">
            <Info className="w-4 h-4 text-sky-600 shrink-0" />
            <span>Need a different option? Chat with our travel expert</span>
          </div>
          <button
            onClick={() => {
              const event = new CustomEvent('skyway_open_support');
              window.dispatchEvent(event);
            }}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-sky-200 text-xs font-bold text-sky-700 shadow-2xs transition-colors shrink-0"
          >
            Chat Now
          </button>
        </div>
      </main>

      {/* 24/7 Support Concierge Modal */}
      <SkyWaySupportModal />
    </div>
  );
}
