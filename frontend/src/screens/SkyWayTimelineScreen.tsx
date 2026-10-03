import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  CheckCircle2,
  Plane,
  Hotel,
  Car,
  AlertTriangle,
  Check,
  ArrowRight,
  Edit3,
  RotateCcw
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import {
  useJourney,
  fetchTripDisruptions,
  resetTripDisruptions,
  getSelectedRecoveryPlanWithMeta
} from '../store/journeyStore';
import { triggerMicroFeedback } from '../services/feedbackService';

function fmtDate(isoStr?: string | null): string {
  if (!isoStr) return 'Sep 28';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoStr || 'Sep 28';
  }
}

function fmtTime(isoStr?: string | null): string {
  if (!isoStr) return '09:00 AM';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : `${isoStr}T00:00:00`);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return isoStr || '09:00 AM';
  }
}

export default function SkyWayTimelineScreen() {
  const navigate = useNavigate();
  const { journey, refresh } = useJourney();

  const [activeDisruptions, setActiveDisruptions] = useState<any[]>([]);
  const [hasRecoverySelected, setHasRecoverySelected] = useState<boolean>(false);
  const [isTripCompleted, setIsTripCompleted] = useState(false);

  useEffect(() => {
    if (journey?.id) {
      fetchTripDisruptions(journey.id)
        .then((disruptions) => {
          const active = (disruptions || []).filter((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');
          setActiveDisruptions(active);
        })
        .catch(() => setActiveDisruptions([]));

      const planMeta = getSelectedRecoveryPlanWithMeta(journey.id);
      if (planMeta) {
        setHasRecoverySelected(true);
      } else {
        setHasRecoverySelected(false);
      }
    }
  }, [journey?.id]);

  const hasDisruption = activeDisruptions.length > 0;


  const handleCompleteJourney = () => {
    setIsTripCompleted(true);
    triggerMicroFeedback({
      eventType: 'JOURNEY_COMPLETED',
      journeyId: journey?.id || 1,
      title: '🎉 Journey completed!',
      question: 'How was your Travora experience overall?',
      responseType: 'RATING',
      options: [
        { label: 'Journey tracking', value: 'JOURNEY_TRACKING' },
        { label: 'Disruption alerts', value: 'DISRUPTION_ALERTS' },
        { label: 'Recovery', value: 'RECOVERY' },
        { label: 'Notifications', value: 'NOTIFICATIONS' },
        { label: 'Easy planning', value: 'EASY_PLANNING' },
      ],
      delayMs: 800,
    });
  };

  const handleReset = async () => {
    if (!journey?.id) return;
    try {
      await resetTripDisruptions(journey.id);
      localStorage.removeItem(`travora_selected_recovery_${journey.id}`);
      await refresh();
      setActiveDisruptions([]);
      setHasRecoverySelected(false);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
  };

  const nodes = journey?.nodes || [];
  const firstNode = nodes[0];
  const tripTitle = journey?.title || 'Active Journey';

  const timelineEvents: any[] = [
    {
      id: 'step_1',
      date: fmtDate(firstNode?.startDate || firstNode?.startTime),
      time: fmtTime(firstNode?.startTime),
      title: 'Booking Confirmed',
      description: `Your journey "${tripTitle}" is confirmed and active.`,
      icon: Check,
      iconBg: 'bg-sky-600 text-white',
      badge: null,
      isActive: true,
      isCompleted: true,
    },
  ];

  nodes.forEach((node, idx) => {
    const isNodeDisrupted = activeDisruptions.some(
      (d: any) => String(d.affected_node_id) === String(node.id) || String(d.affected_node_id) === String(node.backendId)
    );
    const nType = (node.type || '').toLowerCase();
    const isHotel = nType.includes('hotel');
    const isCab = nType.includes('cab') || nType.includes('transfer') || nType.includes('taxi');

    const IconComponent = isHotel ? Hotel : isCab ? Car : Plane;

    let routeDesc = '';
    if (isHotel) {
      routeDesc = `Location: ${node.location || node.destination || 'Hotel'}`;
    } else if (node.origin || node.destination) {
      routeDesc = `${node.origin || 'Origin'} → ${node.destination || 'Destination'}`;
    } else {
      routeDesc = node.location || 'Booking details confirmed';
    }

    timelineEvents.push({
      id: `node_${node.id || idx}`,
      date: fmtDate(node.startDate || node.startTime),
      time: fmtTime(node.startTime),
      title: `${node.title || node.provider} ${node.bookingRef ? '• #' + node.bookingRef : ''}`,
      description: isNodeDisrupted ? 'Rescheduled / Disrupted due to operational delay' : routeDesc,
      icon: IconComponent,
      iconBg: isNodeDisrupted ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white',
      badge: isNodeDisrupted ? (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Disrupted
        </span>
      ) : (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Confirmed
        </span>
      ),
      isActive: true,
      isCompleted: !isNodeDisrupted,
    });
  });

  if (hasDisruption) {
    timelineEvents.push({
      id: 'step_disruption_alert',
      date: fmtDate(activeDisruptions[0]?.detected_at),
      time: fmtTime(activeDisruptions[0]?.detected_at),
      title: 'Disruption Detected',
      description: activeDisruptions[0]?.reason || 'Operational delay detected on your itinerary.',
      icon: AlertTriangle,
      iconBg: 'bg-rose-600 text-white',
      badge: (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Action Required
        </span>
      ),
      isActive: true,
      isCompleted: true,
      action: !hasRecoverySelected ? (
        <Link
          to="/disruption"
          className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
        >
          <span>View Recovery Options</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      ) : null,
    });
  }

  if (hasRecoverySelected) {
    timelineEvents.push({
      id: 'step_recovery_confirm',
      date: 'Today',
      time: 'Just now',
      title: 'Recovery Option Selected',
      description: 'Your recovery option has been confirmed and updated in real-time.',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-600 text-white',
      badge: (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Recovered
        </span>
      ),
      isActive: true,
      isCompleted: true,
    });
  }

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={hasDisruption} />

      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        
        {/* ── BREADCRUMB ── */}
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <Link to="/" className="hover:text-sky-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">My Trips</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">{tripTitle}</Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-900 font-semibold">Journey Timeline</span>
        </nav>

        {/* ── HEADER ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Journey Timeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track every step of your journey, from booking to arrival.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/build')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Edit trip items in Trip Builder"
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-600" />
              <span>Edit Journey</span>
            </button>

            {hasDisruption && !hasRecoverySelected && (
              <Link
                to="/disruption"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Choose Recovery Option</span>
              </Link>
            )}

            {hasRecoverySelected && (
              <Link
                to="/itinerary"
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />
                <span>View Updated Itinerary</span>
              </Link>
            )}

            {(hasDisruption || hasRecoverySelected) && (
              <button
                onClick={handleReset}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors"
                title="Reset simulation to baseline"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={handleCompleteJourney}
              disabled={isTripCompleted}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isTripCompleted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>{isTripCompleted ? 'Completed' : 'Complete Journey'}</span>
            </button>
          </div>
        </div>

        {/* ── TIMELINE VERTICAL CONTAINER ── */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs">
          <div className="relative pl-2 sm:pl-4">
            
            {/* Continuous vertical line */}
            <div className="absolute left-[88px] sm:left-[112px] top-6 bottom-6 w-0.5 bg-slate-200" />

            <div className="space-y-7">
              {timelineEvents.map((event) => {
                const IconComponent = event.icon;
                return (
                  <div key={event.id} className="relative flex items-start gap-4 sm:gap-6 group">
                    
                    {/* Left: Date & Time */}
                    <div className="w-16 sm:w-20 text-right shrink-0 pt-0.5">
                      <p className="text-xs font-bold text-slate-800">{event.date}</p>
                      <p className="text-[11px] font-semibold text-slate-400">{event.time}</p>
                    </div>

                    {/* Middle: Icon circle node */}
                    <div
                      className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${event.iconBg}`}
                    >
                      <IconComponent className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    </div>

                    {/* Right: Content Card */}
                    <div className="flex-1 bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-4 border border-slate-100 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900">
                          {event.title}
                        </h3>
                        {event.badge}
                      </div>

                      <p className="text-xs text-slate-600 mt-1">
                        {event.description}
                      </p>

                      {event.action}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-2">
          <Link to="/my-trips" className="hover:text-sky-600 flex items-center gap-1 font-semibold">
            ← Back to Booking Details
          </Link>
          {hasRecoverySelected && (
            <Link to="/itinerary" className="text-sky-600 font-bold hover:underline flex items-center gap-1">
              View Updated Itinerary Confirmation →
            </Link>
          )}
        </div>
      </main>

      {/* 24/7 Support Concierge Modal */}
      <SkyWaySupportModal />
    </div>
  );
}
