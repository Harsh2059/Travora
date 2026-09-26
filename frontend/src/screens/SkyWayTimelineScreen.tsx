import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ChevronRight,
  CheckCircle2,
  Plane,
  AlertTriangle,
  Bell,
  Check,
  Flag,
  ArrowRight,
  RefreshCw
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

export default function SkyWayTimelineScreen() {
  const navigate = useNavigate();
  const { journey, refresh } = useJourney();

  const [activeDisruptions, setActiveDisruptions] = useState<any[]>([]);
  const [hasRecoverySelected, setHasRecoverySelected] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState(false);

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

  const handleSimulateDisruption = async () => {
    if (!journey?.id) return;
    setIsSimulating(true);
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
        delay_minutes: 390,
      };
      await triggerTripDisruption(journey.id, payload);
      await refresh();
      navigate('/disruption');
    } catch (err) {
      console.error('Failed to trigger simulation:', err);
      navigate('/disruption');
    } finally {
      setIsSimulating(false);
    }
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

  // Timeline events representing the full lifecycle in the reference design
  const timelineEvents = [
    {
      id: 'step_1',
      date: '12 Jun',
      time: '06:00',
      title: 'Booking Confirmed',
      description: 'Your trip to London has been confirmed.',
      icon: Check,
      iconBg: 'bg-sky-600 text-white',
      badge: null,
      isActive: true,
      isCompleted: true,
    },
    {
      id: 'step_2',
      date: '12 Jun',
      time: '08:00',
      title: 'Flight AI-129 • Mumbai → Delhi',
      description: hasDisruption
        ? 'Rescheduled departure due to technical delay'
        : 'On time • Terminal 2',
      icon: Plane,
      iconBg: hasDisruption ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white',
      badge: hasDisruption ? (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Delayed
        </span>
      ) : (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Departed
        </span>
      ),
      isActive: true,
      isCompleted: !hasDisruption,
    },
    ...(hasDisruption || hasRecoverySelected
      ? [
          {
            id: 'step_3',
            date: '12 Jun',
            time: '10:15',
            title: 'Disruption Occurred',
            description: 'Flight AI-129 delayed due to technical issue.',
            icon: AlertTriangle,
            iconBg: 'bg-rose-600 text-white',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Delayed
              </span>
            ),
            isActive: true,
            isCompleted: true,
            action: hasDisruption && !hasRecoverySelected ? (
              <Link
                to="/disruption"
                className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
              >
                <span>View Recovery Options</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : null,
          },
          {
            id: 'step_4',
            date: '12 Jun',
            time: '10:20',
            title: 'You Were Notified',
            description: 'We sent you a WhatsApp notification with recovery options.',
            icon: Bell,
            iconBg: 'bg-sky-500 text-white',
            badge: null,
            isActive: true,
            isCompleted: true,
          },
        ]
      : []),
    ...(hasRecoverySelected
      ? [
          {
            id: 'step_5',
            date: '12 Jun',
            time: '11:00',
            title: 'Recovery Option Selected',
            description: 'You chose Option 2: Alternate flight via Ahmedabad.',
            icon: CheckCircle2,
            iconBg: 'bg-emerald-600 text-white',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Completed
              </span>
            ),
            isActive: true,
            isCompleted: true,
          },
          {
            id: 'step_6',
            date: '12 Jun',
            time: '16:30',
            title: 'Replacement Flight • Mumbai → Ahmedabad',
            description: 'AI-645 • Departed • On time',
            icon: Plane,
            iconBg: 'bg-sky-600 text-white',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Completed
              </span>
            ),
            isActive: true,
            isCompleted: true,
          },
          {
            id: 'step_7',
            date: '12 Jun',
            time: '19:45',
            title: 'Connecting Flight • Ahmedabad → Delhi',
            description: 'AI-207 • On time',
            icon: Plane,
            iconBg: 'bg-white text-sky-600 border-2 border-sky-600',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                Upcoming
              </span>
            ),
            isActive: false,
            isCompleted: false,
          },
          {
            id: 'step_8',
            date: '12 Jun',
            time: '21:15',
            title: 'Arrive in Delhi',
            description: 'Expected arrival at 21:15 • Terminal 3',
            icon: Flag,
            iconBg: 'bg-slate-100 text-slate-600 border border-slate-300',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Upcoming
              </span>
            ),
            isActive: false,
            isCompleted: false,
          },
        ]
      : !hasDisruption
      ? [
          {
            id: 'step_upcoming_1',
            date: '12 Jun',
            time: '13:15',
            title: 'Connecting Flight AI-161 • Delhi → London',
            description: 'Scheduled departure from Terminal 3',
            icon: Plane,
            iconBg: 'bg-white text-sky-600 border-2 border-sky-600',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                Upcoming
              </span>
            ),
            isActive: false,
            isCompleted: false,
          },
          {
            id: 'step_upcoming_2',
            date: '12 Jun',
            time: '18:30',
            title: 'Arrive in London (LHR)',
            description: 'London Heathrow Terminal 2',
            icon: Flag,
            iconBg: 'bg-slate-100 text-slate-600 border border-slate-300',
            badge: (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                Upcoming
              </span>
            ),
            isActive: false,
            isCompleted: false,
          },
        ]
      : []),
  ];

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
          <Link to="/my-trips" className="hover:text-sky-600 transition-colors">Trip to London</Link>
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
            {!hasDisruption && !hasRecoverySelected ? (
              <button
                onClick={handleSimulateDisruption}
                disabled={isSimulating}
                className="px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Simulate Delay (6h 30m)</span>
              </button>
            ) : hasDisruption && !hasRecoverySelected ? (
              <Link
                to="/disruption"
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Choose Recovery Option</span>
              </Link>
            ) : (
              <Link
                to="/itinerary"
                className="px-4 py-2 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-colors flex items-center gap-1.5"
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
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
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
