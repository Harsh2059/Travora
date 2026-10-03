import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Upload,
  CheckCircle2,
  X,
  Plane,
  Building2,
  MapPin,
  Bell,
  RefreshCw,
  Smartphone,
  Shield,
  HelpCircle,
  Lock
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { createSupportTicket } from '../services/supportApi';
import type { SupportTicket } from '../services/supportApi';
import { getStoredUser } from '../services/auth';
import { AuthModal } from '../components/AuthModal';


interface CategoryOption {
  id: string;
  name: string;
  icon: React.FC<{ className?: string }>;
  description: string;
}

const CATEGORIES: CategoryOption[] = [
  { id: 'Flight / Transport Issue', name: 'Flight / Transport Issue', icon: Plane, description: 'Delays, cancellations, gate changes, baggage' },
  { id: 'Hotel / Stay Issue', name: 'Hotel / Stay Issue', icon: Building2, description: 'Check-in, booking confirmation, hotel vouchers' },
  { id: 'Journey / Timeline Issue', name: 'Journey / Timeline Issue', icon: MapPin, description: 'Timeline sync, itinerary legs, connecting hops' },
  { id: 'Notification / SMS Issue', name: 'Notification / SMS Issue', icon: Bell, description: 'SMS delays, WhatsApp alerts not arriving' },
  { id: 'Recovery Issue', name: 'Recovery Issue', icon: RefreshCw, description: 'AI rebooking failure, plan selection issues' },
  { id: 'App / Technical Issue', name: 'App / Technical Issue', icon: Smartphone, description: 'Crashes, loading errors, UI display glitches' },
  { id: 'Account / Security Issue', name: 'Account / Security Issue', icon: Shield, description: 'Login, phone verification, profile data' },
  { id: 'Other', name: 'Other', icon: HelpCircle, description: 'General travel inquiries and operational help' },
];

export default function SkyWayReportIssueScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Form State
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  // Journey Context
  const [journeyId, setJourneyId] = useState<number | null>(() => {
    const fromParam = searchParams.get('tripId') || searchParams.get('journeyId');
    if (fromParam && !isNaN(Number(fromParam))) return Number(fromParam);
    try {
      const activeId = localStorage.getItem('travora_active_trip_id');
      if (activeId && !isNaN(Number(activeId))) return Number(activeId);
    } catch {}
    return null;
  });

  // Flow State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    const handleAuthChange = () => setUser(getStoredUser());
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, []);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setValidationError('Screenshot file size must be less than 5MB.');
      return;
    }

    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setScreenshotPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshotPreview(null);
    setScreenshotName(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    if (!category.trim()) {
      setValidationError('Please select a category for what went wrong.');
      return;
    }

    if (!description.trim() || description.trim().length < 5) {
      setValidationError('Please provide a detailed description (at least 5 characters).');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const ticket = await createSupportTicket({
        category: category.trim(),
        description: description.trim(),
        journey_id: journeyId,
        attachment_url: screenshotPreview,
        priority: priority,
      });

      setSubmittedTicket(ticket);
    } catch (err: any) {
      setValidationError(err.message || 'Something went wrong while submitting your issue. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSubmittedTicket(null);
    setCategory('');
    setDescription('');
    setScreenshotPreview(null);
    setScreenshotName(null);
    setValidationError(null);
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

        {submittedTicket ? (
          /* ── Success Confirmation Screen ── */
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm text-center animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto mb-6 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100/70 text-emerald-800 mb-3 font-mono">
              {submittedTicket.ticket_number}
            </span>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Issue Reported Successfully
            </h1>

            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
              Thanks for letting us know. Our support team has received your issue and an operations specialist is reviewing your ticket.
            </p>

            <div className="mt-8 p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left max-w-lg mx-auto space-y-2 text-xs text-slate-700">
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Ticket Reference:</span>
                <span className="font-mono font-bold text-slate-900">{submittedTicket.ticket_number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="font-semibold text-slate-500">Category:</span>
                <span className="font-bold text-slate-800">{submittedTicket.category}</span>
              </div>
              {submittedTicket.journey_id && (
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="font-semibold text-slate-500">Associated Journey:</span>
                  <span className="font-bold text-sky-700">Trip #{submittedTicket.journey_id}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="font-semibold text-slate-500">Status:</span>
                <span className="font-bold text-amber-600 uppercase tracking-wider">{submittedTicket.status}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => navigate('/support/requests')}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                View My Support Requests
              </button>
              <button
                onClick={resetForm}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Report Another Issue
              </button>
            </div>
          </div>
        ) : (
          /* ── Report an Issue Form ── */
          <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-9 shadow-xs">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Report an Issue
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Let us know what went wrong with your journey or booking so we can assist you.
                </p>
              </div>
            </div>

            {/* Auth Notice if not logged in */}
            {!user && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-800">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>You need to be signed in to submit and track support requests.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 shrink-0 transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Journey Context Banner */}
            {journeyId && (
              <div className="mb-6 p-3.5 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Plane className="w-4 h-4 text-sky-600 shrink-0" />
                  <span className="font-semibold text-sky-900">
                    Auto-linking issue to active journey: <span className="font-mono font-bold">Trip #{journeyId}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setJourneyId(null)}
                  className="text-[11px] font-bold text-sky-600 hover:text-sky-800 underline shrink-0"
                >
                  Unlink
                </button>
              </div>
            )}

            {/* Error Message */}
            {validationError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. What went wrong? */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-2">
                  What went wrong? <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setCategory(cat.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCategory(cat.id);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all flex items-start gap-3 ${
                          isSelected
                            ? 'bg-sky-50/90 border-sky-500 ring-2 ring-sky-500/20 shadow-xs'
                            : 'bg-white border-slate-200/90 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">{cat.name}</p>
                          <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{cat.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Describe the problem */}
              <div>
                <label htmlFor="issue-description" className="block text-sm font-bold text-slate-900 mb-1.5">
                  Describe the problem <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="issue-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what went wrong..."
                  className="w-full bg-slate-50/50 border border-slate-200/90 rounded-2xl p-4 text-xs sm:text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 shadow-inner placeholder:text-slate-400 leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Please provide relevant booking IDs, flight numbers, or timestamps if available.
                </p>
              </div>

              {/* 3. Priority Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Urgency / Priority
                </label>
                <div className="flex items-center gap-2">
                  {(['LOW', 'MEDIUM', 'HIGH'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                        priority === lvl
                          ? lvl === 'HIGH'
                            ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-500/20'
                            : 'bg-sky-50 text-sky-700 border-sky-300 ring-2 ring-sky-500/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {lvl === 'HIGH' ? '🔥 High / Immediate' : lvl === 'MEDIUM' ? 'Standard (Medium)' : 'Low'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Attach Screenshot (Optional) */}
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Attach Screenshot <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>

                {screenshotPreview ? (
                  <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 p-2 flex items-center gap-3">
                    <img
                      src={screenshotPreview}
                      alt="Attachment Preview"
                      className="w-16 h-16 object-cover rounded-xl border border-slate-200"
                    />
                    <div className="flex-1 truncate">
                      <p className="text-xs font-bold text-slate-800 truncate">{screenshotName || 'Screenshot attachment'}</p>
                      <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Ready to upload</p>
                    </div>
                    <button
                      type="button"
                      onClick={clearScreenshot}
                      className="w-8 h-8 rounded-full bg-slate-200 hover:bg-rose-100 hover:text-rose-600 text-slate-600 flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200/90 hover:border-sky-400 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/40 hover:bg-sky-50/20">
                    <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                    <span className="text-xs font-bold text-slate-700">Click to upload screenshot</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG, or WEBP up to 5MB</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* 5. Submit Action */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/support')}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !category || !description.trim()}
                  className="px-7 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-bold text-xs shadow-md transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white" />
                      <span>Submitting Issue...</span>
                    </>
                  ) : (
                    <span>Submit Issue</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}
