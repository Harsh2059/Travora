import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Mail,
  Clock,
  AlertTriangle,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { fetchSupportContactInfo } from '../services/supportApi';
import type { SupportContactInfo } from '../services/supportApi';

export default function SkyWayContactSupportScreen() {
  const [contactInfo, setContactInfo] = useState<SupportContactInfo | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    fetchSupportContactInfo()
      .then((data) => setContactInfo(data))
      .catch(() => {});
  }, []);


  const handleCopyEmail = () => {
    if (contactInfo?.support_email) {
      navigator.clipboard.writeText(contactInfo.support_email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fbff] flex flex-col font-sans text-slate-800 antialiased">
      <SkyWayNavbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Breadcrumb ── */}
        <Link
          to="/support"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors mb-4 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Support Hub</span>
        </Link>

        {/* ── Header ── */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-xs mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 mb-1 border border-indigo-100">
                <ShieldCheck className="w-3 h-3" /> Official Support Channel
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Need additional help?
              </h1>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed max-w-xl">
            Contact the Travora support team and we'll help you with your issue. Our operations desk triages reported travel disruptions around the clock.
          </p>

          {/* ── Official Channels Cards ── */}
          <div className="mt-8 space-y-4">
            {/* 1. In-App Issue Reporting (Recommended) */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-50/70 to-pink-50/50 border border-rose-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md">
                    Recommended
                  </span>
                  <h3 className="text-sm font-bold text-slate-900">Priority Ticket Submission</h3>
                </div>
                <p className="text-xs text-slate-600">
                  Submit a structured issue report with your journey context, logs, and screenshots for rapid triage.
                </p>
              </div>
              <Link
                to="/support/report-issue"
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-colors text-center shrink-0 flex items-center justify-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report an Issue</span>
              </Link>
            </div>

            {/* 2. Official Support Email */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Official Support Email</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    For enterprise bookings, account verification, and non-emergency inquiries.
                  </p>
                  <p className="text-xs font-mono font-bold text-sky-700 mt-1.5">
                    {contactInfo?.support_email || 'support@travora.travel'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                {contactInfo?.support_email && (
                  <a
                    href={`mailto:${contactInfo.support_email}`}
                    className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <span>Email Us</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>

            {/* 3. Official Helpline (if configured in backend) */}
            {contactInfo?.support_phone && (
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Direct Helpline</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {contactInfo.operating_hours || 'Available 24/7'}
                    </p>
                    <p className="text-xs font-mono font-bold text-emerald-700 mt-1.5">
                      {contactInfo.support_phone}
                    </p>
                  </div>
                </div>
                <a
                  href={`tel:${contactInfo.support_phone}`}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors text-center shrink-0"
                >
                  Call Now
                </a>
              </div>
            )}

            {/* 4. Operating Hours & Guidance */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 text-xs text-slate-600 flex items-start gap-3">
              <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800">Operational Hours: </span>
                <span>{contactInfo?.operating_hours || '24/7 Operations Desk for Active Disruptions'}</span>
                <p className="text-slate-500 mt-1">
                  {contactInfo?.note || 'For active travel emergencies, support tickets submitted via Report an Issue receive priority triage.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
