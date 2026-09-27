import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LifeBuoy,
  Plane,
  AlertTriangle,
  Bell,
  Building2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';

interface HelpGuideTopic {
  id: string;
  title: string;
  category: string;
  badge: string;
  icon: React.FC<{ className?: string }>;
  summary: string;
  actionTitle: string;
  actionPath: string;
  steps: Array<{ title: string; desc: string }>;
  tips: string;
}

const HELP_GUIDES: HelpGuideTopic[] = [
  {
    id: 'flight-disruptions',
    title: 'Flight Delay or Cancellation Recovery',
    category: 'Disruptions',
    badge: 'Urgent Guidance',
    icon: AlertTriangle,
    summary: 'What to do when your flight is delayed, rescheduled, or grounded due to weather.',
    actionTitle: 'Go to Disruption & Recovery',
    actionPath: '/disruption',
    steps: [
      {
        title: '1. Check the Live Disruption Alert',
        desc: 'When an airline delays or cancels a flight, Travora generates an instant alert banner at the top of your dashboard.'
      },
      {
        title: '2. Review Multi-Modal Recovery Plans',
        desc: 'Our AI compares alternative flights, high-speed rail, and express road transfers ranked by Speed, Cost, and Minimum Delay.'
      },
      {
        title: '3. Tap to Confirm & Re-issue Boarding Pass',
        desc: 'Select your preferred alternative. Digital boarding passes and new PNR references are generated immediately.'
      }
    ],
    tips: 'If a recovery plan requires hotel or cab vouchers, they are bundled automatically without extra fees.'
  },
  {
    id: 'timeline-connections',
    title: 'Managing Connected Journeys & Timelines',
    category: 'Journey',
    badge: 'Core Feature',
    icon: Plane,
    summary: 'How multi-city itineraries, connecting trains, and cab transfers stay synchronized.',
    actionTitle: 'View Journey Timeline',
    actionPath: '/timeline',
    steps: [
      {
        title: '1. Dynamic Dependency Graph',
        desc: 'Travora links each transport leg to downstream hotel check-ins and connection hops.'
      },
      {
        title: '2. Automatic Cascade Buffer',
        desc: 'If flight leg #1 slips by 45 minutes, downstream connections are evaluated for risk.'
      },
      {
        title: '3. Live Timeline Tracking',
        desc: 'Monitor real-time progress, terminal gates, and platform details from your Journey Timeline.'
      }
    ],
    tips: 'You can tap on any leg in your timeline to view full booking details and digital tickets.'
  },
  {
    id: 'whatsapp-sms-alerts',
    title: 'Real-Time SMS & WhatsApp Alerts Setup',
    category: 'Notifications',
    badge: 'Instant Setup',
    icon: Bell,
    summary: 'Configure push, SMS, and interactive WhatsApp 1-tap rebooking options.',
    actionTitle: 'Configure Notifications in Profile',
    actionPath: '/my-trips',
    steps: [
      {
        title: '1. Save Your WhatsApp Number',
        desc: 'Click your profile avatar in the navigation bar and ensure your mobile/WhatsApp number is verified.'
      },
      {
        title: '2. Receive Interactive WhatsApp Prompts',
        desc: 'During disruptions, Travora sends recovery options directly to your WhatsApp. Reply with 1, 2, or 3 to rebook on the go.'
      },
      {
        title: '3. High-Priority SMS Gateway Backup',
        desc: 'Critical boarding alerts are also dispatched via carrier-grade SMS gateway.'
      }
    ],
    tips: 'Standard notification delivery takes less than 3 seconds after an airline status update.'
  },
  {
    id: 'hotel-protection',
    title: 'Hotel Booking & Accommodation Protection',
    category: 'Hotels',
    badge: 'Protection',
    icon: Building2,
    summary: 'How hotel check-in times and emergency layover accommodations are handled.',
    actionTitle: 'Report Hotel Issue',
    actionPath: '/support/report-issue',
    steps: [
      {
        title: '1. Automatic Late Check-in Notice',
        desc: 'When flights arrive late, Travora notifies your partner hotel to hold your room guarantee.'
      },
      {
        title: '2. Emergency Layover Vouchers',
        desc: 'For overnight disruptions, our system selects vetted airport hotels with breakfast vouchers.'
      },
      {
        title: '3. Digital Voucher Check-in',
        desc: 'Show your Travora digital accommodation voucher at the hotel reception desk.'
      }
    ],
    tips: 'Non-refundable hotel policies are automatically shielded under Travora disruption guarantees.'
  },
  {
    id: 'digital-twin-weather',
    title: 'Predictive Weather & What-If Simulations',
    category: 'Digital Twin',
    badge: 'AI Technology',
    icon: Sparkles,
    summary: 'Explore how atmospheric telemetry detects storm bottlenecks before airlines announce them.',
    actionTitle: 'Launch Digital Twin Simulator',
    actionPath: '/digital-twin',
    steps: [
      {
        title: '1. 3D Airspace Weather Layer',
        desc: 'Live doppler radar, wind velocity, and precipitation layers mapped over Indian airport nodes.'
      },
      {
        title: '2. What-If Disruption Sandbox',
        desc: 'Simulate severe weather over Mumbai or Delhi to test AI contingency routing.'
      },
      {
        title: '3. Proactive Rerouting Alerts',
        desc: 'Receive advance warnings 2–4 hours before ATC ground delay programs take effect.'
      }
    ],
    tips: 'Use the Digital Twin tab in the main navigation to run live what-if scenarios on your current trip.'
  }
];

export default function SkyWaySupportHelpScreen() {
  const navigate = useNavigate();
  const [selectedTopicId, setSelectedTopicId] = useState<string>('flight-disruptions');

  const selectedTopic = HELP_GUIDES.find((g) => g.id === selectedTopicId) || HELP_GUIDES[0];

  return (
    <div className="min-h-screen bg-[#f8fbff] flex flex-col font-sans text-slate-800 antialiased">
      <SkyWayNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Breadcrumb & Header ── */}
        <Link
          to="/support"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Support Hub</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 mb-1 border border-emerald-100">
                <ShieldCheck className="w-3 h-3" /> Interactive Help Center
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Get Help & Guides
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Step-by-step problem solvers, operational guides, and disruption recovery workflows.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/support/faqs"
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <HelpCircle className="w-4 h-4 text-sky-600" />
              <span>Browse All FAQs</span>
            </Link>
          </div>
        </div>

        {/* ── Help Guide Workspace (Interactive Topic Selector + Detail Guide) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Topic Selector Cards */}
          <div className="lg:col-span-4 space-y-3">
            <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider px-1">
              Select a Help Guide
            </p>
            {HELP_GUIDES.map((topic) => {
              const Icon = topic.icon;
              const isSelected = topic.id === selectedTopicId;
              return (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-white border-sky-500 ring-2 ring-sky-500/15 shadow-md'
                      : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded">
                        {topic.category}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      {topic.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                      {topic.summary}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Column: Selected Guide Walkthrough */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 mb-2">
                    {selectedTopic.badge}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {selectedTopic.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedTopic.summary}
                  </p>
                </div>

                <button
                  onClick={() => navigate(selectedTopic.actionPath)}
                  className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                >
                  <span>{selectedTopic.actionTitle}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Step-by-Step Flow */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Recommended Action Steps
                </h3>
                <div className="space-y-3.5">
                  {selectedTopic.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70 flex items-start gap-3.5"
                    >
                      <div className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-bold text-slate-900">{step.title}</h4>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro Tip Callout */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Travora Pro-Tip: </span>
                  <span>{selectedTopic.tips}</span>
                </div>
              </div>

              {/* Quick Navigation Footer */}
              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-slate-500">Need specific help with an active booking?</span>
                <div className="flex items-center gap-3">
                  <Link
                    to="/support/report-issue"
                    className="font-bold text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Report an Issue</span>
                  </Link>
                  <span className="text-slate-300">|</span>
                  <Link
                    to="/support/contact"
                    className="font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Contact Operations Desk</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
