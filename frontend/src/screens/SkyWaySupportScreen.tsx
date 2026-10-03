import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LifeBuoy,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
  ArrowRight,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { fetchMySupportTickets } from '../services/supportApi';
import type { SupportTicket } from '../services/supportApi';

export default function SkyWaySupportScreen() {
  const navigate = useNavigate();
  const [recentTickets, setRecentTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const loadRequests = () => {
    setLoadingTickets(true);
    fetchMySupportTickets()
      .then((tickets) => setRecentTickets(tickets.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  };

  useEffect(() => {
    loadRequests();

    const handleUpdate = () => loadRequests();
    window.addEventListener('travora_support_ticket_created', handleUpdate);
    window.addEventListener('travora_auth_change', handleUpdate);
    return () => {
      window.removeEventListener('travora_support_ticket_created', handleUpdate);
      window.removeEventListener('travora_auth_change', handleUpdate);
    };
  }, []);


  const supportOptions = [
    {
      id: 'get-help',
      title: 'Get Help',
      subtitle: 'Find answers quickly',
      description: 'Explore organized guides on journeys, flight disruptions, rebooking & notifications.',
      icon: LifeBuoy,
      iconBg: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
      tag: '🆘 Option 1',
      path: '/support/help',
      accent: 'hover:border-emerald-300 hover:shadow-emerald-500/5',
    },
    {
      id: 'report-issue',
      title: 'Report an Issue',
      subtitle: 'Tell us what went wrong',
      description: 'Report flight delays, hotel problems, recovery failures, or technical app glitches.',
      icon: AlertTriangle,
      iconBg: 'bg-rose-500/10 text-rose-600 border border-rose-500/20',
      tag: '🚨 Option 2',
      path: '/support/report-issue',
      accent: 'hover:border-rose-300 hover:shadow-rose-500/5',
      highlight: true,
    },
    {
      id: 'faqs',
      title: 'FAQs',
      subtitle: 'Common questions',
      description: 'Browse our searchable knowledge base of frequently asked questions and troubleshooting.',
      icon: HelpCircle,
      iconBg: 'bg-sky-500/10 text-sky-600 border border-sky-500/20',
      tag: '❓ Option 3',
      path: '/support/faqs',
      accent: 'hover:border-sky-300 hover:shadow-sky-500/5',
    },
    {
      id: 'contact-support',
      title: 'Contact Support',
      subtitle: 'Get additional help',
      description: 'Reach out to the official Travora operations team and active disruption desk.',
      icon: MessageSquare,
      iconBg: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
      tag: '💬 Option 4',
      path: '/support/contact',
      accent: 'hover:border-indigo-300 hover:shadow-indigo-500/5',
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" /> Open
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <AlertCircle className="w-3 h-3 text-sky-500" /> In Progress
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] flex flex-col font-sans text-slate-800 antialiased">
      <SkyWayNavbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* ── Hero Header ── */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-bold mb-3.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-sky-600" />
            <span>Travora Customer Care & Operations</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Support
          </h1>
          <p className="text-lg sm:text-xl font-semibold text-slate-700 mt-2">
            How can we help you?
          </p>
          <p className="text-sm text-slate-500 mt-2 max-w-lg mx-auto">
            Choose from the options below to browse our knowledge base, report travel disruptions, or connect with our support desk.
          </p>
        </div>

        {/* ── Core Four Options Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-12">
          {supportOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <div
                key={opt.id}
                onClick={() => navigate(opt.path)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(opt.path);
                  }
                }}
                className={`group relative bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between cursor-pointer ${opt.accent} ${
                  opt.highlight ? 'ring-1 ring-rose-500/20' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${opt.iconBg}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
                      {opt.tag}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors flex items-center gap-1.5">
                    <span>{opt.title}</span>
                  </h2>
                  <p className="text-sm font-semibold text-slate-600 mt-0.5">
                    {opt.subtitle}
                  </p>
                  <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                    {opt.description}
                  </p>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-600 group-hover:underline flex items-center gap-1">
                    Open {opt.title}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 group-hover:bg-sky-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-all duration-200 shadow-2xs">
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── User Support Requests Preview (if authenticated) ── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">My Support Requests</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Track the progress of issues and tickets you have reported.
              </p>
            </div>
            <Link
              to="/support/requests"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100/80 px-3.5 py-2 rounded-xl transition-colors shrink-0"
            >
              <span>View All Requests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loadingTickets ? (
            <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
              <div className="w-4 h-4 rounded-full animate-spin border-2 border-slate-200 border-t-sky-500" />
              <span>Loading your recent support requests...</span>
            </div>
          ) : recentTickets.length > 0 ? (
            <div className="space-y-3">
              {recentTickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => navigate('/support/requests')}
                  className="p-4 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all hover:border-slate-300"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 font-mono tracking-tight">
                        {t.ticket_number}
                      </span>
                      <span className="text-xs font-semibold text-slate-700 px-2 py-0.5 rounded-md bg-white border border-slate-200/70">
                        {t.category}
                      </span>
                      {getStatusBadge(t.status)}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">
                      {t.description}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs font-medium text-slate-500">
                You have no open support requests right now.
              </p>
              <Link
                to="/support/report-issue"
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline"
              >
                <span>Report an Issue now</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
