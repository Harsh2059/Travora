import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  AlertTriangle,
  Clock,
  Plane,
  ArrowRight,
  Sparkles,
  Info,
  Building,
  Car,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import {
  useJourney,
  fetchTripDisruptions,
  saveSelectedRecoveryPlan
} from '../store/journeyStore';
import { analyzePart4Recovery, executePart5Recovery } from '../services/recoveryApi';

function fmtDate(isoStr?: string | null): string {
  if (!isoStr) return '28 Sep 2026';
  try {
    const raw = isoStr.includes('T') ? isoStr.split('T')[0] : isoStr;
    const parts = raw.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return isoStr;
  } catch {
    return isoStr || '28 Sep 2026';
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

export default function SkyWayDisruptionScreen() {
  const navigate = useNavigate();
  const { journey, refresh } = useJourney();

  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt_2');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [dynamicOptions, setDynamicOptions] = useState<any[] | null>(null);
  const [activeDisruptions, setActiveDisruptions] = useState<any[]>([]);

  useEffect(() => {
    if (journey?.id) {
      fetchTripDisruptions(journey.id)
        .then((disruptions) => {
          const active = (disruptions || []).filter((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');
          setActiveDisruptions(active);
        })
        .catch(() => setActiveDisruptions([]));

      analyzePart4Recovery(journey.id)
        .then((res) => {
          if (res?.plans && res.plans.length > 0) {
            setDynamicOptions(res.plans);
            setSelectedOptionId(res.plans[0]?.id || 'opt_2');
          }
        })
        .catch((err) => {
          console.warn('Backend recovery query fallback:', err?.message);
        });
    }
  }, [journey?.id]);

  const tripTitle = journey?.title || 'Active Journey';

  const activeDisp = activeDisruptions[0];
  const affectedNodeId = activeDisp?.affected_node_id || activeDisp?.entity_id;
  const disruptedNode = affectedNodeId
    ? journey?.nodes?.find((n) => String(n.backendId || n.id) === String(affectedNodeId)) || journey?.nodes?.[0]
    : journey?.nodes?.find((n) => (n.type || '').toUpperCase() === 'FLIGHT') || journey?.nodes?.[0];

  const nodeType = (disruptedNode?.type || 'FLIGHT').toUpperCase();
  const isHotelDisruption = nodeType === 'HOTEL' || nodeType === 'STAY';
  const isCabDisruption = nodeType === 'CAB' || nodeType === 'TAXI' || nodeType === 'TRANSFER';

  const affectedTitle = disruptedNode?.title || disruptedNode?.provider || (isHotelDisruption ? 'Courtyard Convention Hotel' : 'Air India Express AI-441');
  const originStr = disruptedNode?.origin || disruptedNode?.location || 'Mumbai (BOM)';
  const destStr = disruptedNode?.destination || (isHotelDisruption ? (disruptedNode?.location || 'Jodhpur') : 'Jaipur (JAI)');
  const delayMinutes = activeDisp?.delay_minutes || 390;
  const delayStr = `${Math.floor(delayMinutes / 60)}h ${delayMinutes % 60}m`;

  const disruptedNodeStartDate = disruptedNode?.startDate || (disruptedNode?.startTime ? disruptedNode.startTime.split('T')[0] : '2026-09-28');
  const disruptedNodeEndDate = disruptedNode?.endDate || (disruptedNode?.endTime ? disruptedNode.endTime.split('T')[0] : '2026-09-30');

  // Default fallback recovery options
  const defaultRecoveryOptions = [
    {
      id: 'opt_1',
      title: isHotelDisruption ? `Priority-Preserving (${affectedTitle})` : 'Wait for Same Flight',
      badge: 'Simplest Option',
      badgeColor: 'bg-slate-100 text-slate-700',
      isRecommended: false,
      isHotel: isHotelDisruption,
      departs: isHotelDisruption ? '08:00' : '14:30',
      departsSub: isHotelDisruption ? fmtDate(disruptedNodeStartDate) : '(6h 30m delay)',
      arrives: isHotelDisruption ? '12:00' : '16:50',
      arrivesSub: isHotelDisruption ? fmtDate(disruptedNodeEndDate) : '',
      travelTime: isHotelDisruption ? destStr : '2h 20m',
      stops: isHotelDisruption ? 'Guaranteed Late Hold' : 'Non-stop',
      impact: isHotelDisruption ? 'Confirmed late check-in protection' : 'Longer wait at airport',
      buttonVariant: 'outline',
      replacementFlight: {
        flightNumber: affectedTitle,
        carrier: disruptedNode?.provider || 'Air India',
        route: isHotelDisruption ? destStr : `${originStr} → ${destStr}`,
        departure: '14:30',
        arrival: '16:50',
        date: fmtDate(disruptedNodeStartDate),
      },
      replacementHotel: undefined as any,
    },
    {
      id: 'opt_2',
      title: isHotelDisruption ? 'Alternative (Heritage Grand Palace)' : 'Alternate via Connecting Hub',
      badge: 'Recommended Option',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      isRecommended: true,
      isHotel: isHotelDisruption,
      departs: isHotelDisruption ? '14:00' : '11:45',
      departsSub: isHotelDisruption ? fmtDate(disruptedNodeStartDate) : `From ${originStr.split(' ')[0]}`,
      arrives: isHotelDisruption ? '11:00' : '16:50',
      arrivesSub: isHotelDisruption ? fmtDate(disruptedNodeEndDate) : `At ${destStr.split(' ')[0]}`,
      travelTime: isHotelDisruption ? destStr : '5h 5m',
      stops: isHotelDisruption ? 'Upgraded Suite' : '1 step',
      impact: isHotelDisruption ? 'Arrive anytime with 24h reception' : 'Arrive 1h earlier',
      buttonVariant: 'primary',
      replacementFlight: {
        flightNumber: isHotelDisruption ? 'Heritage Grand Palace' : 'AI-645',
        carrier: disruptedNode?.provider || 'Air India',
        route: `${originStr} → ${destStr}`,
        departure: '11:45',
        arrival: '16:50',
        date: fmtDate(disruptedNodeStartDate),
      },
      replacementHotel: undefined as any,
    },
    {
      id: 'opt_3',
      title: isHotelDisruption ? 'Alternative (Marriott Business Hotel)' : 'Next Day Flight',
      badge: 'Alternative',
      badgeColor: 'bg-purple-100 text-purple-800',
      isRecommended: false,
      isHotel: isHotelDisruption,
      departs: isHotelDisruption ? '15:00' : '08:00',
      departsSub: isHotelDisruption ? fmtDate(disruptedNodeStartDate) : 'Next Day',
      arrives: isHotelDisruption ? '12:00' : '10:20',
      arrivesSub: isHotelDisruption ? fmtDate(disruptedNodeEndDate) : 'Next Day',
      travelTime: isHotelDisruption ? destStr : '2h 20m',
      stops: isHotelDisruption ? 'Standard King' : 'Non-stop',
      impact: isHotelDisruption ? 'Free breakfast included' : 'Stay overnight at origin',
      buttonVariant: 'outline',
      replacementFlight: {
        flightNumber: isHotelDisruption ? 'Marriott Business' : 'AI-131',
        carrier: disruptedNode?.provider || 'Air India',
        route: `${originStr} → ${destStr}`,
        departure: '08:00',
        arrival: '10:20',
        date: fmtDate(disruptedNodeStartDate),
      },
      replacementHotel: undefined as any,
    },
  ];

  const recoveryOptions = dynamicOptions && dynamicOptions.length > 0
    ? dynamicOptions.map((plan: any, idx: number) => {
        const isHotelPlan = Boolean(plan.replacement_hotel) || isHotelDisruption;
        const checkInTime = plan.replacement_hotel?.check_in || (disruptedNode?.startTime ? fmtTime(disruptedNode.startTime) : '14:00');
        const checkOutTime = plan.replacement_hotel?.check_out || (disruptedNode?.endTime ? fmtTime(disruptedNode.endTime) : '11:00');

        return {
          id: plan.id || `opt_${idx + 1}`,
          title: plan.title || 'Recovery Alternative',
          badge: plan.is_recommended ? 'Recommended Option' : 'Alternative',
          badgeColor: plan.is_recommended ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700',
          isRecommended: Boolean(plan.is_recommended),
          isHotel: isHotelPlan,
          departs: isHotelPlan ? checkInTime.replace(/^Check-in\s*/i, '') : (plan.replacement_flight?.departure_time || '14:30'),
          departsSub: isHotelPlan ? fmtDate(plan.replacement_hotel?.date || disruptedNodeStartDate) : (plan.replacement_flight?.date || fmtDate(disruptedNodeStartDate)),
          arrives: isHotelPlan ? checkOutTime.replace(/^Check-out\s*/i, '') : (plan.replacement_flight?.arrival_time || '16:50'),
          arrivesSub: isHotelPlan ? fmtDate(disruptedNodeEndDate) : '',
          travelTime: isHotelPlan ? (plan.replacement_hotel?.location || destStr) : (plan.travel_time || '2h 20m'),
          stops: isHotelPlan ? (plan.replacement_hotel?.room_type || 'Guaranteed Room Hold') : (plan.stops || 'Non-stop'),
          impact: plan.impact || 'Confirmed schedule',
          buttonVariant: plan.is_recommended ? 'primary' : 'outline',
          replacementFlight: plan.replacement_flight || {
            flightNumber: affectedTitle,
            carrier: disruptedNode?.provider || 'Air India',
            route: `${originStr} → ${destStr}`,
            departure: '14:30',
            arrival: '16:50',
            date: fmtDate(disruptedNodeStartDate),
          },
          replacementHotel: plan.replacement_hotel,
        };
      })
    : defaultRecoveryOptions;

  const handleSelectOption = async (option: typeof recoveryOptions[0], optionIndex: number) => {
    setSelectedOptionId(option.id);
    setIsProcessing(true);

    const tripId = journey?.id || 1;

    // 1. Match dynamic backend plan if available
    const matchedPlan = dynamicOptions?.find((p: any) => p.id === option.id) || dynamicOptions?.[optionIndex];
    const activeFp = matchedPlan?.disruption_fingerprint || (activeDisp?.id ? String(activeDisp.id) : '');

    let planPayload: any;

    if (matchedPlan && matchedPlan.changes && matchedPlan.changes.length > 0) {
      planPayload = {
        ...matchedPlan,
        selected_at: new Date().toISOString(),
      };
    } else {
      planPayload = {
        id: option.id,
        title: option.title,
        strategy_type: option.isRecommended ? 'REROUTE' : 'REBOOK',
        description: `Rebooked on ${option.title} (${option.stops}). Impact: ${option.impact}.`,
        replacement_flight: option.replacementFlight,
        replacement_hotel: option.replacementHotel,
        travel_time: option.travelTime,
        stops: option.stops,
        impact: option.impact,
        is_recommended: option.isRecommended,
        selected_at: new Date().toISOString(),
        changes: [
          {
            action: 'REPLACE',
            node_id: disruptedNode?.backendId || disruptedNode?.id,
            replacement_node: isHotelDisruption
              ? {
                  type: 'HOTEL',
                  provider: option.title,
                  location: destStr,
                  start_time: disruptedNode?.startTime || `${disruptedNodeStartDate}T14:00:00`,
                  end_time: disruptedNode?.endTime || `${disruptedNodeEndDate}T11:00:00`,
                  cost: 0,
                  currency: 'INR',
                  status: 'CONFIRMED',
                  item_metadata: {
                    is_replacement: true,
                    replaced_item_id: disruptedNode?.backendId || disruptedNode?.id,
                  },
                }
              : {
                  type: 'FLIGHT',
                  provider: option.replacementFlight?.carrier || 'Air India Express',
                  origin: originStr,
                  destination: destStr,
                  start_time: `${disruptedNodeStartDate}T${option.departs}:00`,
                  end_time: `${disruptedNodeStartDate}T${option.arrives}:00`,
                  cost: 0,
                  currency: 'INR',
                  status: 'CONFIRMED',
                  item_metadata: {
                    flight_number: option.replacementFlight?.flightNumber || 'AI-441',
                    is_replacement: true,
                    replaced_item_id: disruptedNode?.backendId || disruptedNode?.id,
                  },
                },
          },
        ],
      };
    }

    try {
      const result = await executePart5Recovery(tripId, planPayload, activeFp);

      if (result.status !== 'COMPLETED' && result.status !== 'PARTIALLY_COMPLETED') {
        await executePart5Recovery(tripId, planPayload, '').catch(() => null);
      }

      saveSelectedRecoveryPlan(tripId, planPayload, activeFp, false);
      await refresh();
      setIsProcessing(false);
      navigate('/itinerary');
    } catch (err) {
      console.warn('Backend execution fallback, persisting selected recovery locally:', err);
      saveSelectedRecoveryPlan(tripId, planPayload, activeFp, false);
      await refresh();
      setIsProcessing(false);
      navigate('/itinerary');
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
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">{tripTitle}</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Disruption & Recovery</span>
        </nav>

        {/* ── TITLE ── */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Itinerary Disruption
          </h1>
          <Link
            to="/timeline"
            className="text-xs font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
          >
            <span>View Timeline</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* ── PROMINENT DISRUPTION ALERT BOX ── */}
        <div className="bg-rose-50/90 border border-rose-200/90 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-600/30">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                {isHotelDisruption ? 'Your hotel schedule has been impacted' : isCabDisruption ? 'Your ground transfer is delayed' : 'Your schedule has been disrupted'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl leading-relaxed">
                {isHotelDisruption
                  ? `${affectedTitle} (${destStr}) is impacted due to weather / itinerary delay. Our automated recovery engine has calculated optimized alternatives for you.`
                  : `${affectedTitle} (${originStr} → ${destStr}) is delayed due to technical issues. Our automated recovery engine has calculated optimized alternatives for you.`}
              </p>
            </div>
          </div>

          <div className="bg-rose-100/70 border border-rose-200/80 rounded-2xl p-4 text-center md:text-right shrink-0 min-w-[210px] w-full md:w-auto">
            <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
              {isHotelDisruption ? 'Impact Status' : 'New Departure Time'}
            </p>
            <p className="text-2xl sm:text-3xl font-black text-rose-600 my-0.5">
              {isHotelDisruption ? 'Late Check-in' : '14:30'}
            </p>
            <p className="text-[11px] font-semibold text-rose-700">
              (Delayed by {delayStr})
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Originally {fmtTime(disruptedNode?.startTime)}
            </p>
          </div>
        </div>

        {/* ── DISRUPTION DETAILS CARD ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Disruption Details
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Affected Leg
              </p>
              <div className="mt-1 flex items-center gap-1.5 font-bold text-slate-900">
                {isHotelDisruption ? (
                  <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                ) : isCabDisruption ? (
                  <Car className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                ) : (
                  <Plane className="w-3.5 h-3.5 text-red-600 shrink-0" />
                )}
                <span className="truncate">{affectedTitle}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isHotelDisruption ? `Location: ${destStr}` : `${originStr} → ${destStr}`}
              </p>
              <p className="text-[10px] text-slate-400">
                {fmtDate(disruptedNodeStartDate)} • Scheduled
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Reason
              </p>
              <p className="mt-1 font-bold text-slate-800">
                {activeDisp?.reason || 'Technical issue'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isHotelDisruption ? 'Weather / delay propagation' : 'Avionics inspection'}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Impact
              </p>
              <p className="mt-1 font-bold text-rose-600">{delayStr} delay</p>
              <p className="text-[11px] text-slate-500">
                {isHotelDisruption ? 'Arrival past standard check-in' : 'Impacts onward connections'}
              </p>
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

        {/* ── RECOVERY OPTIONS SECTION ── */}
        <div className="space-y-4 pt-2">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Recovery Options
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Choose the best option for your onward journey. All options include confirmed seats and baggage protection.
            </p>
          </div>

          {/* 3 COMPARISON CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {recoveryOptions.map((opt, idx) => {
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
                  {opt.isRecommended && (
                    <div className="absolute -top-3 right-6 bg-sky-600 text-white text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-md shadow-sky-600/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>Recommended</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="recoveryPlanRadio"
                          checked={isSelected}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500"
                        />
                        <span className="text-xs font-bold text-slate-500">
                          Option {idx + 1}
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

                    <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {opt.isHotel ? 'Check-in' : 'Departs'}
                        </p>
                        <p className="text-lg font-black text-slate-900">{opt.departs}</p>
                        {opt.departsSub && (
                          <p className="text-[10px] font-semibold text-slate-500">{opt.departsSub}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          {opt.isHotel ? 'Check-out' : 'Arrives'}
                        </p>
                        <p className="text-lg font-black text-slate-900">{opt.arrives}</p>
                        {opt.arrivesSub && (
                          <p className="text-[10px] font-semibold text-slate-500">{opt.arrivesSub}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          {opt.isHotel ? <Building className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {opt.isHotel ? 'Location' : 'Travel Time'}
                        </span>
                        <span className="font-bold text-slate-800">{opt.travelTime}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          {opt.isHotel ? <CheckCircle2 className="w-3 h-3" /> : <Plane className="w-3 h-3" />}
                          {opt.isHotel ? 'Room Status' : 'Stops'}
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

                  <div className="pt-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectOption(opt, idx);
                      }}
                      disabled={isProcessing}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                        opt.buttonVariant === 'primary'
                          ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/25 hover:scale-[1.01]'
                          : 'bg-white hover:bg-slate-50 text-sky-700 border border-slate-200'
                      }`}
                    >
                      {isProcessing && selectedOptionId === opt.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Booking Recovery...</span>
                        </>
                      ) : (
                        <>
                          <span>Select Option</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── BOTTOM SUPPORT BAR ── */}
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
