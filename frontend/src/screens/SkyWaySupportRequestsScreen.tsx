import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ExternalLink,
  Lock,
  ChevronDown,
  Plane,
  RefreshCw
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { fetchMySupportTickets } from '../services/supportApi';
import type { SupportTicket } from '../services/supportApi';

import { getStoredUser } from '../services/auth';
import { AuthModal } from '../components/AuthModal';

export default function SkyWaySupportRequestsScreen() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  useEffect(() => {
    const handleAuthChange = () => {
      const u = getStoredUser();
      setUser(u);
    };
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, []);

  useEffect(() => {
    if (user) {
      loadTickets();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMySupportTickets();
      setTickets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load your support requests.');
    } finally {
      setLoading(false);
    }
  };

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
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-400" /> Closed
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

  const toggleExpand = (id: number) => {
    setExpandedTicketId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] flex flex-col font-sans text-slate-800 antialiased">
      <SkyWayNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Breadcrumb ── */}
        <Link
          to="/support"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Support Hub</span>
        </Link>

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 flex items-center justify-center shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                My Support Requests
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Track status updates and history of tickets submitted from your account.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadTickets}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              title="Refresh requests"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            </button>
            <Link
              to="/support/report-issue"
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report an Issue</span>
            </Link>
          </div>
        </div>

        {/* ── Not Signed In State ── */}
        {!user ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-10 text-center shadow-xs">
            <Lock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h2 className="text-base font-bold text-slate-800">Sign in to view your tickets</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Please log in to your Travora account to see your past and ongoing support requests.
            </p>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="mt-4 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 rounded-full animate-spin border-2 border-slate-200 border-t-sky-500 mx-auto mb-3" />
            <span>Loading your support requests...</span>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-xs">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">Unable to load support requests</p>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={loadTickets}
              className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-xs">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-base font-bold text-slate-900">No Support Requests Found</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              You haven't submitted any support issues yet. If you encounter any problems with flights or bookings, let us know.
            </p>
            <button
              onClick={() => navigate('/support/report-issue')}
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Report an Issue</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => {
              const isExpanded = expandedTicketId === t.id;
              const formattedDate = new Date(t.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={t.id}
                  className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200"
                >
                  <div
                    onClick={() => toggleExpand(t.id)}
                    className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900 font-mono tracking-tight bg-slate-100 px-2 py-0.5 rounded-md">
                          {t.ticket_number}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200">
                          {t.category}
                        </span>
                        {getStatusBadge(t.status)}
                        {t.journey_id && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                            <Plane className="w-3 h-3" /> Trip #{t.journey_id}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                        {t.description}
                      </h3>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                        {t.priority && (
                          <span>Priority: <strong className="text-slate-600">{t.priority}</strong></span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
                        {isExpanded ? 'Hide Details' : 'View Details'}
                      </span>
                      <div
                        className={`w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 transition-transform ${
                          isExpanded ? 'rotate-180 bg-sky-50 text-sky-600' : ''
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 bg-[#f8fbff]/60 border-t border-slate-100 text-xs text-slate-700 space-y-4 animate-fade-in">
                      <div>
                        <h4 className="font-bold text-slate-900 mb-1">Full Description:</h4>
                        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/80 whitespace-pre-wrap leading-relaxed">
                          {t.description}
                        </div>
                      </div>

                      {t.attachment_url && (
                        <div>
                          <h4 className="font-bold text-slate-900 mb-1.5">Attached Screenshot:</h4>
                          <div className="inline-block rounded-2xl border border-slate-200 overflow-hidden bg-white p-2">
                            <img
                              src={t.attachment_url}
                              alt="Attached screenshot"
                              className="max-h-60 max-w-full rounded-xl object-contain"
                            />
                          </div>
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-slate-100/70 border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Our operations desk will notify you via SMS/email upon status changes.</span>
                        {t.journey_id && (
                          <Link
                            to={`/trip/${t.journey_id}/timeline`}
                            className="font-bold text-sky-600 hover:underline flex items-center gap-1"
                          >
                            <span>Open Journey Timeline</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
