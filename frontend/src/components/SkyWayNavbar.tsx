import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Menu,
  X,
  ChevronDown,
  Plane,
  Settings,
  LogOut,
  Bell
} from 'lucide-react';
import { getStoredUser, clearAuth } from '../services/auth';
import type { UserProfile } from '../services/auth';
import { AuthModal } from './AuthModal';
import { ProfileModal } from './ProfileModal';

interface SkyWayNavbarProps {
  hasActiveDisruption?: boolean;
}

export const SkyWayNavbar: React.FC<SkyWayNavbarProps> = ({ hasActiveDisruption = false }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handleAuthChange = () => setCurrentUser(getStoredUser());
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, []);

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'Flights', path: '/#search-flights' },
    { label: 'Hotels', path: '/#search-hotels' },
    { label: 'Packages', path: '/#search-packages' },
    { label: 'My Trips', path: '/my-trips', hasDisruption: hasActiveDisruption },
    { label: 'Support', path: '#support' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path.startsWith('/#')) return false;
    if (path === '/my-trips') {
      return (
        location.pathname === '/my-trips' ||
        location.pathname.startsWith('/trip') ||
        location.pathname === '/timeline' ||
        location.pathname === '/disruption' ||
        location.pathname === '/itinerary'
      );
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    if (path === '#support') {
      e.preventDefault();
      const event = new CustomEvent('skyway_open_support');
      window.dispatchEvent(event);
      setIsMobileMenuOpen(false);
      return;
    }
    if (path.startsWith('/#')) {
      e.preventDefault();
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => {
          const el = document.getElementById(path.replace('/#', ''));
          el?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        const el = document.getElementById(path.replace('/#', ''));
        el?.scrollIntoView({ behavior: 'smooth' });
      }
      setIsMobileMenuOpen(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/my-trips?q=${encodeURIComponent(searchQuery.trim())}`);
      setIsSearchOpen(false);
    }
  };

  // Default display name: Shubham Shah (matching reference design) or logged in user
  const displayName = currentUser?.name || 'Shubham Shah';
  const displayInitials = currentUser?.name
    ? currentUser.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SS';

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4">
          
          {/* ── Brand Logo ── */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            {/* Custom SkyWay Origami Plane Icon */}
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-blue-600 flex items-center justify-center shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white"
              >
                <path
                  d="M21.5 2.5L10 14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M21.5 2.5L14.5 21.5L10 14L2.5 9.5L21.5 2.5Z"
                  fill="currentColor"
                  fillOpacity="0.25"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 font-sans leading-none">
                SkyWay
              </span>
              <span className="text-[10px] font-semibold text-sky-600 tracking-wider uppercase mt-0.5">
                Travel & Recovery
              </span>
            </div>
          </Link>

          {/* ── Desktop Navigation Links ── */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.label}
                  to={link.path}
                  onClick={(e) => handleNavClick(e, link.path)}
                  className={`relative px-3.5 py-2 rounded-full text-sm font-semibold transition-colors duration-150 flex items-center gap-1.5 ${
                    active
                      ? 'text-sky-600 font-bold bg-sky-50/80'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.hasDisruption && (
                    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                  {active && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-sky-600 rounded-full" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* ── Right Controls: Search, Auth / Profile, Mobile Toggle ── */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Search Trigger */}
            <div className="relative">
              {isSearchOpen ? (
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center bg-slate-100 rounded-full pl-3 pr-1 py-1 border border-slate-300 focus-within:border-sky-500 shadow-inner"
                >
                  <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search trips, flights..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                    className="w-36 sm:w-48 bg-transparent text-xs text-slate-800 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors border border-slate-200/80"
                  title="Search SkyWay"
                  aria-label="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* User Profile Pill or Sign In Button (Reference Design) */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/90 transition-all shadow-xs"
              >
                <div className="w-7 h-7 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                  {displayInitials}
                </div>
                <span className="text-xs font-semibold max-w-[110px] truncate hidden sm:inline">
                  {displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 animate-fade-in"
                  onMouseLeave={() => setIsUserMenuOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs text-slate-400 font-medium">Signed in as</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {currentUser?.email || 'shubham.shah@example.com'}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/my-trips"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                    >
                      <Plane className="w-4 h-4 text-sky-600" />
                      <span>My Bookings & Trips</span>
                    </Link>
                    <Link
                      to="/timeline"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors"
                    >
                      <Bell className="w-4 h-4 text-indigo-600" />
                      <span>Journey Timeline</span>
                    </Link>
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-colors text-left"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      <span>Profile & Travel Preferences</span>
                    </button>
                    <Link
                      to="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-50 transition-colors"
                    >
                      <Settings className="w-4 h-4 text-purple-600" />
                      <span>Admin & Disruption Simulator</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    {currentUser ? (
                      <button
                        onClick={() => {
                          clearAuth();
                          setCurrentUser(null);
                          setIsUserMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setIsAuthModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-sky-600 hover:bg-sky-50 transition-colors text-left"
                      >
                        <User className="w-4 h-4" />
                        <span>Switch User / Sign In</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Navigation Drawer ── */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-5 space-y-1.5 shadow-lg animate-fade-in">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.label}
                  to={link.path}
                  onClick={(e) => handleNavClick(e, link.path)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold ${
                    active
                      ? 'bg-sky-50 text-sky-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.hasDisruption && (
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                      Alert
                    </span>
                  )}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-xs font-bold text-purple-600 hover:underline px-3.5 py-1.5"
              >
                Admin & Simulation Console →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Auth & Profile Modals */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
    </>
  );
};
