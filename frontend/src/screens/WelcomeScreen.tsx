import { useNavigate } from 'react-router-dom';
import {
  Compass,
  PlusCircle,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Plane,
  Clock,
  Layout,
  User,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useJourney } from '../store/journeyStore';
import { getStoredUser } from '../services/auth';
import type { UserProfile } from '../services/auth';
import { AuthModal } from '../components/AuthModal';
import { ProfileModal } from '../components/ProfileModal';

// --- Keyframes injected once ---
const KEYFRAMES = `
@keyframes routeMarch {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -80; }
}
@keyframes planeFloat {
  0%   { transform: translateY(0px); }
  50%  { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
}
@keyframes cloudDrift {
  0%   { transform: translateX(0px); }
  100% { transform: translateX(-8px); }
}
@media (prefers-reduced-motion: reduce) {
  .route-animated, .plane-float, .cloud-drift { animation: none !important; }
}
`;

function TravelBackground() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      viewBox="0 0 1440 700"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wsSkyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#e0f2fe" stopOpacity="1" />
          <stop offset="40%"  stopColor="#f0f9ff" stopOpacity="1" />
          <stop offset="75%"  stopColor="#f8fafc" stopOpacity="1" />
          <stop offset="100%" stopColor="#f1f5f9" stopOpacity="1" />
        </linearGradient>

        <style>{`
          .route-animated {
            stroke-dasharray: 8 10;
            animation: routeMarch 3.5s linear infinite;
          }
          .plane-float {
            animation: planeFloat 4s ease-in-out infinite;
          }
          .cloud-drift {
            animation: cloudDrift 18s ease-in-out infinite alternate;
          }
        `}</style>

        <filter id="wsNodeGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        <linearGradient id="wsFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f8fafc" stopOpacity="0" />
          <stop offset="100%" stopColor="#f8fafc" stopOpacity="1" />
        </linearGradient>

        <linearGradient id="wsLeftFade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="#f8fafc" stopOpacity="1" />
          <stop offset="8%"  stopColor="#f8fafc" stopOpacity="0" />
        </linearGradient>

        <linearGradient id="wsRightFade" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%"  stopColor="#f8fafc" stopOpacity="1" />
          <stop offset="8%"  stopColor="#f8fafc" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sky fill */}
      <rect width="1440" height="700" fill="url(#wsSkyGrad)" />

      {/* Clouds - safe zones: upper strip Y<90 or flanks X<180 / X>1260 */}
      <g className="cloud-drift" opacity="0.42">
        <ellipse cx="90"  cy="72"  rx="54" ry="20" fill="white" />
        <ellipse cx="120" cy="58"  rx="34" ry="24" fill="white" />
        <ellipse cx="65"  cy="78"  rx="30" ry="16" fill="white" />
      </g>

      <g opacity="0.32" className="cloud-drift" style={{ animationDelay: '-6s', animationDuration: '22s' }}>
        <ellipse cx="680" cy="52"  rx="72" ry="22" fill="white" />
        <ellipse cx="718" cy="38"  rx="44" ry="26" fill="white" />
        <ellipse cx="648" cy="60"  rx="38" ry="17" fill="white" />
      </g>

      <g opacity="0.30" className="cloud-drift" style={{ animationDelay: '-11s', animationDuration: '26s' }}>
        <ellipse cx="1360" cy="74"  rx="62" ry="20" fill="white" />
        <ellipse cx="1390" cy="60"  rx="38" ry="23" fill="white" />
        <ellipse cx="1330" cy="80"  rx="32" ry="15" fill="white" />
      </g>

      <g opacity="0.25">
        <ellipse cx="110" cy="168" rx="44" ry="15" fill="white" />
        <ellipse cx="138" cy="156" rx="26" ry="19" fill="white" />
      </g>

      <g opacity="0.22">
        <ellipse cx="1330" cy="148" rx="46" ry="15" fill="white" />
        <ellipse cx="1360" cy="136" rx="28" ry="20" fill="white" />
      </g>

      {/* Airplane - upper right flank X=1290 Y=108, outside 1200px content band */}
      <g className="plane-float" transform="translate(1290, 108)" opacity="0.60">
        <ellipse cx="0" cy="0" rx="36" ry="9" fill="#0ea5e9" />
        <path d="M 36 0 Q 53 0 56 -2 Q 53 2 36 0 Z" fill="#0284c7" />
        <path d="M -36 0 L -50 -5 L -36 -2 Z" fill="#0284c7" />
        <path d="M -2 0 L 18 -24 L 26 -24 L 9 0 Z" fill="#38bdf8" />
        <path d="M -28 0 L -20 -14 L -15 -14 L -22 0 Z" fill="#7dd3fc" />
        <ellipse cx="12" cy="8" rx="8" ry="4" fill="#0284c7" />
      </g>
      <circle cx="1254" cy="111" r="2.5" fill="#7dd3fc" opacity="0.45" />
      <circle cx="1237" cy="115" r="1.8" fill="#7dd3fc" opacity="0.30" />
      <circle cx="1222" cy="119" r="1.2" fill="#7dd3fc" opacity="0.18" />

      {/* Animated travel route - Y >= 430, clear of headline content zone */}
      <path
        className="route-animated"
        d="M 148 490 Q 430 400 720 435"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="2.5"
        opacity="0.65"
      />
      <path
        className="route-animated"
        d="M 720 435 Q 1010 400 1292 472"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth="2.5"
        opacity="0.65"
        style={{ animationDelay: '-1.75s' }}
      />
      <path
        d="M 148 490 Q 430 400 720 435 Q 1010 400 1292 472"
        fill="none"
        stroke="#bae6fd"
        strokeWidth="1.5"
        opacity="0.30"
      />

      <g filter="url(#wsNodeGlow)" opacity="0.85">
        <circle cx="148" cy="490" r="10" fill="#38bdf8" />
        <circle cx="148" cy="490" r="5.5" fill="#0ea5e9" />
      </g>
      <g filter="url(#wsNodeGlow)" opacity="0.75">
        <circle cx="720" cy="435" r="9" fill="#818cf8" />
        <circle cx="720" cy="435" r="5" fill="#6366f1" />
      </g>
      <g filter="url(#wsNodeGlow)" opacity="0.85">
        <circle cx="1292" cy="472" r="10" fill="#38bdf8" />
        <circle cx="1292" cy="472" r="5.5" fill="#0ea5e9" />
      </g>

      <text x="148"  y="510" textAnchor="middle" fontSize="11" fill="#64748b" opacity="0.40" fontFamily="system-ui,sans-serif">Origin</text>
      <text x="720"  y="420" textAnchor="middle" fontSize="11" fill="#64748b" opacity="0.38" fontFamily="system-ui,sans-serif">Layover</text>
      <text x="1292" y="492" textAnchor="middle" fontSize="11" fill="#64748b" opacity="0.40" fontFamily="system-ui,sans-serif">Destination</text>

      {/* City silhouette - bottom strip Y >= 530 */}
      <g opacity="0.048">
        <rect x="0"   y="530" width="32"  height="120" fill="#334155" />
        <rect x="34"  y="548" width="22"  height="102" fill="#334155" />
        <rect x="58"  y="518" width="42"  height="132" fill="#334155" />
        <rect x="102" y="540" width="26"  height="110" fill="#334155" />
        <rect x="130" y="555" width="20"  height="95"  fill="#334155" />
        <rect x="152" y="508" width="36"  height="142" fill="#334155" />
        <rect x="190" y="478" width="14"  height="172" fill="#334155" />
        <rect x="195" y="468" width="4"   height="20"  fill="#334155" />
        <rect x="240" y="545" width="30"  height="105" fill="#334155" />
        <rect x="272" y="558" width="22"  height="92"  fill="#334155" />
        <rect x="296" y="526" width="38"  height="124" fill="#334155" />
        <rect x="336" y="548" width="24"  height="102" fill="#334155" />
        <rect x="540" y="570" width="220" height="50"  rx="5" fill="#334155" />
        <rect x="562" y="554" width="176" height="22"  rx="4" fill="#334155" />
        <rect x="598" y="543" width="104" height="18"  rx="3" fill="#334155" />
        <rect x="724" y="502" width="14"  height="80"  fill="#334155" />
        <rect x="718" y="497" width="26"  height="14"  rx="3" fill="#334155" />
        <rect x="860"  y="546" width="30"  height="104" fill="#334155" />
        <rect x="892"  y="530" width="40"  height="120" fill="#334155" />
        <rect x="934"  y="555" width="24"  height="95"  fill="#334155" />
        <rect x="960"  y="538" width="32"  height="112" fill="#334155" />
        <rect x="1050" y="532" width="36"  height="118" fill="#334155" />
        <rect x="1088" y="548" width="24"  height="102" fill="#334155" />
        <rect x="1114" y="514" width="44"  height="136" fill="#334155" />
        <rect x="1160" y="536" width="28"  height="114" fill="#334155" />
        <rect x="1190" y="552" width="22"  height="98"  fill="#334155" />
        <rect x="1214" y="520" width="40"  height="130" fill="#334155" />
        <rect x="1256" y="542" width="26"  height="108" fill="#334155" />
        <rect x="1284" y="528" width="42"  height="122" fill="#334155" />
        <rect x="1328" y="538" width="30"  height="112" fill="#334155" />
        <rect x="1360" y="512" width="38"  height="138" fill="#334155" />
        <rect x="1400" y="524" width="40"  height="126" fill="#334155" />
        <rect x="0" y="648" width="1440" height="8" fill="#475569" />
        <ellipse cx="420" cy="600" rx="13" ry="17" fill="#334155" />
        <rect    x="418" y="614"  width="4" height="12" fill="#334155" />
        <ellipse cx="468" cy="606" rx="11" ry="14" fill="#334155" />
        <rect    x="466" y="618"  width="4" height="9"  fill="#334155" />
        <ellipse cx="800" cy="598" rx="13" ry="17" fill="#334155" />
        <rect    x="798" y="612"  width="4" height="12" fill="#334155" />
        <ellipse cx="990" cy="604" rx="12" ry="15" fill="#334155" />
        <rect    x="988" y="617"  width="4" height="11" fill="#334155" />
        <rect   x="300" y="618" width="36" height="16" rx="3" fill="#334155" />
        <rect   x="306" y="610" width="22" height="11" rx="2" fill="#334155" />
        <circle cx="308" cy="636" r="5" fill="#334155" />
        <circle cx="330" cy="636" r="5" fill="#334155" />
        <rect   x="1140" y="620" width="80" height="20" rx="4" fill="#334155" />
        <rect   x="1145" y="611" width="20" height="12" rx="2" fill="#334155" />
        <rect   x="1168" y="611" width="20" height="12" rx="2" fill="#334155" />
        <rect   x="1191" y="611" width="20" height="12" rx="2" fill="#334155" />
        <circle cx="1152" cy="641" r="5" fill="#334155" />
        <circle cx="1172" cy="641" r="5" fill="#334155" />
        <circle cx="1192" cy="641" r="5" fill="#334155" />
        <circle cx="1208" cy="641" r="5" fill="#334155" />
      </g>

      {/* Edge fades */}
      <rect x="0"    y="0" width="80" height="700" fill="url(#wsLeftFade)"  />
      <rect x="1360" y="0" width="80" height="700" fill="url(#wsRightFade)" />

      {/* Bottom fade */}
      <rect y="530" width="1440" height="170" fill="url(#wsFade)" />
    </svg>
  );
}

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { journey, loading, clearActive } = useJourney();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getStoredUser());
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div className="min-h-screen text-slate-900 dark:text-slate-100 flex flex-col">

        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20">
                <Compass className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-600 via-sky-500 to-indigo-600 bg-clip-text text-transparent">
                Travora
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/app')}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 transition-colors flex items-center gap-1.5"
              >
                <Layout className="h-3.5 w-3.5" />
                <span>Disruption Demo</span>
              </button>

              {currentUser ? (
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors text-xs font-bold"
                >
                  <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px]">
                    {(currentUser.name || 'T')[0].toUpperCase()}
                  </div>
                  <span>{currentUser.name || 'Profile'}</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors text-xs font-bold shadow-sm"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Hero section */}
        <section
          className="relative flex-1 flex flex-col overflow-hidden"
          style={{ minHeight: '640px' }}
        >

          {/* Background layer - purely decorative, no layout effect */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            <TravelBackground />
          </div>

          {/* Content layer - z-index 10, controls all layout height */}
          <main
            className="relative flex-1 flex flex-col items-center justify-center text-center py-16 px-6"
            style={{ zIndex: 10 }}
          >
            <div className="w-full max-w-3xl mx-auto flex flex-col items-center">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-sky-200 text-sky-700 text-xs font-medium mb-6 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                <span>Your Calm Travel Companion</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight max-w-2xl leading-tight">
                Give Travora your trip, and turn it into{' '}
                <span className="bg-gradient-to-r from-sky-500 via-indigo-500 to-sky-600 bg-clip-text text-transparent">
                  one simple journey.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                No scattered PDFs or overwhelming flight dashboards. Bring your bookings together into one fluid timeline.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                {!loading && journey && (
                  <button
                    onClick={() => navigate('/home')}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/95 backdrop-blur-sm border-2 border-sky-500 text-sky-600 font-semibold hover:bg-sky-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>View Active Journey ({journey.title})</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => {
                    clearActive();
                    navigate('/build');
                  }}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-all shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 flex items-center justify-center gap-2"
                >
                  <PlusCircle className="h-5 w-5" />
                  <span>Create a Journey</span>
                </button>
              </div>

              {/* Feature Cards */}
              <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5 text-left w-full">

                <div
                  className="p-5 rounded-2xl border border-white/70 shadow-md shadow-sky-100/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-100/80"
                  style={{
                    background: 'rgba(255,255,255,0.90)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
                    <Plane className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Multi-Leg Planning</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Combine flights, hotels, trains, and cabs effortlessly in chronological sequence.
                  </p>
                </div>

                <div
                  className="p-5 rounded-2xl border border-white/70 shadow-md shadow-emerald-100/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-100/80"
                  style={{
                    background: 'rgba(255,255,255,0.90)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <Clock className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Unified Timeline</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Automatic layover calculation and clear visual gap indicators between legs.
                  </p>
                </div>

                <div
                  className="p-5 rounded-2xl border border-white/70 shadow-md shadow-purple-100/60 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-100/80"
                  style={{
                    background: 'rgba(255,255,255,0.90)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-base">Disruption Ready</h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Persisted safely to the backend so AI agents can watch over your itinerary.
                  </p>
                </div>
              </div>
            </div>
          </main>

          <footer
            className="py-5 px-6 text-center text-xs text-slate-400 border-t border-slate-200/40 bg-white/50 backdrop-blur-sm"
            style={{ position: 'relative', zIndex: 10 }}
          >
            Travora Journey Builder — Multi-User Travel Intelligence
          </footer>
        </section>
      </div>

      {/* Auth & Profile Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => setCurrentUser(getStoredUser())}
      />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={(u) => setCurrentUser(u)}
      />
    </>
  );
}
