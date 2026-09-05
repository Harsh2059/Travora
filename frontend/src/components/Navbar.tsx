import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  History,
  GitCompare,
  MessageSquarePlus,
  Plane,
  Map,
  Zap,
} from 'lucide-react';

interface NavbarProps {
  tripVersion: number;
  isGraphValid: boolean;
  onResetDemo: () => void;
  onOpenCompare: () => void;
  onOpenUserRequest: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  loading: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  tripVersion: _tripVersion,
  isGraphValid: _isGraphValid,
  onResetDemo,
  onOpenCompare,
  onOpenUserRequest,
  onOpenHistory,
  historyCount,
  loading,
}) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 bg-white ${
        scrolled
          ? 'border-b border-slate-200/90 shadow-sm'
          : 'border-b border-slate-200'
      }`}
    >
      {/* Top sky-blue accent strip */}
      <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-blue-600 to-indigo-600" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* ── Brand ── */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative">
            {/* Outer gradient ring */}
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-700 flex items-center justify-center shadow-md shadow-blue-500/25">
              {/* Inner layered icon: map + plane */}
              <div className="relative flex items-center justify-center">
                <Map className="h-5 w-5 text-white/70 absolute" />
                <Plane className="h-3.5 w-3.5 text-white relative z-10" style={{ transform: 'rotate(-35deg) translateY(-1px)' }} />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center">
              <Zap className="h-2 w-2 text-white fill-white" />
            </div>
          </div>
          <div>
            <span className="text-lg font-extrabold text-slate-900 tracking-tight">Travora</span>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Intelligent Itinerary Recovery · Real-Time Rebooking
            </p>
          </div>
        </div>



        {/* ── Action Buttons ── */}
        <div className="flex items-center gap-2">
          {/* Custom User Intent Request */}
          <button
            onClick={onOpenUserRequest}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-all duration-200 hover:shadow-xs"
            title="Request natural language itinerary change"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 text-purple-600" />
            <span className="hidden sm:inline">Request a Change</span>
          </button>

          {/* Compare Versions */}
          <button
            onClick={onOpenCompare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all duration-200 hover:shadow-xs"
            title="Compare itinerary versions"
          >
            <GitCompare className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">Compare</span>
          </button>

          {/* History Drawer */}
          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all duration-200 hover:shadow-xs"
            title="View recovery history"
          >
            <History className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs">
                {historyCount}
              </span>
            )}
          </button>

          {/* Reset Demo CTA */}
          <button
            onClick={onResetDemo}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-blue-700 shadow-sm shadow-blue-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            title="Reset trip to baseline"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
