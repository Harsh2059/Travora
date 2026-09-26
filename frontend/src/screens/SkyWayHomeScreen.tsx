import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Plane,
  Building2,
  Package,
  Car,
  Compass,
  Calendar,
  Users,
  ArrowRight,
  ArrowLeftRight,
  ShieldCheck,
  Headphones,
  Zap,
  Tag,
  Bell,
  RefreshCw,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Search
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import { useJourney, fetchTripDisruptions, setActiveTripId } from '../store/journeyStore';

export default function SkyWayHomeScreen() {
  const navigate = useNavigate();
  const { journey } = useJourney();

  const [activeTab, setActiveTab] = useState<'flights' | 'hotels' | 'packages' | 'cars' | 'experiences'>('flights');
  const [tripType, setTripType] = useState<'one-way' | 'round-trip' | 'multi-city'>('round-trip');

  // Search Fields
  const [origin, setOrigin] = useState('Mumbai (BOM)');
  const [destination, setDestination] = useState('London (LHR)');
  const [departureDate, setDepartureDate] = useState('12 Jun, 2025');
  const [returnDate, setReturnDate] = useState('20 Jun, 2025');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  const [isTravellerPickerOpen, setIsTravellerPickerOpen] = useState(false);

  // Active Disruption state for live indicator
  const [hasDisruption, setHasDisruption] = useState(false);

  useEffect(() => {
    if (journey?.id) {
      fetchTripDisruptions(journey.id)
        .then((disruptions) => {
          const active = (disruptions || []).filter((d: any) => (d.status || 'ACTIVE') === 'ACTIVE');
          setHasDisruption(active.length > 0);
        })
        .catch(() => setHasDisruption(false));
    }
  }, [journey?.id]);

  const handleSwapAirports = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (journey?.id) {
      setActiveTripId(journey.id);
    }
    navigate('/my-trips');
  };

  const destinations = [
    {
      city: 'Dubai',
      price: '₹24,999',
      image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80',
    },
    {
      city: 'Singapore',
      price: '₹28,999',
      image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=600&q=80',
    },
    {
      city: 'Bali',
      price: '₹32,999',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80',
    },
    {
      city: 'London',
      price: '₹45,999',
      image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80',
    },
    {
      city: 'Paris',
      price: '₹48,999',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col">
      <SkyWayNavbar hasActiveDisruption={hasDisruption} />

      {/* ── Active Trip Quick Banner (if user has active disruption or booking) ── */}
      {journey && (
        <div className="bg-white border-b border-sky-100 shadow-2xs py-2.5 px-4 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              {hasDisruption ? (
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div className="text-xs">
                <span className="font-bold text-slate-800">Active Journey: </span>
                <span className="text-slate-600 font-medium">{journey.title || 'Trip to London (SW12345678)'}</span>
                {hasDisruption ? (
                  <span className="ml-2 font-bold text-rose-600">
                    • Delay Detected (6h 30m) — Smart Recovery Options Ready
                  </span>
                ) : (
                  <span className="ml-2 font-semibold text-emerald-600">
                    • Confirmed (12 Jun – 20 Jun 2025)
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasDisruption ? (
                <Link
                  to="/disruption"
                  className="px-3 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>Resolve Disruption</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <Link
                  to="/my-trips"
                  className="px-3 py-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <span>View My Trip</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf4fe] via-[#f1f7fe] to-[#f8fbff] pt-8 pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Headlines, Trust badges, Search Widget */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            
            {/* Main Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Travel <br />
                <span className="bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                  Made Simple
                </span>
              </h1>
              <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal max-w-xl">
                Book, manage and recover your journey — all in one place.
              </p>
            </div>

            {/* Trust Badges Row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-sky-100 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                <span>Trusted by 10M+ travelers</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-sky-100 shadow-2xs">
                <Headphones className="w-3.5 h-3.5 text-sky-600" />
                <span>24/7 Support</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-sky-100 shadow-2xs">
                <Zap className="w-3.5 h-3.5 text-sky-600 fill-sky-500" />
                <span>Smart Recovery</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3 py-1.5 rounded-full border border-sky-100 shadow-2xs">
                <Tag className="w-3.5 h-3.5 text-sky-600" />
                <span>Best Prices</span>
              </div>
            </div>

            {/* ── Search Widget Card ── */}
            <div id="search-flights" className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-sky-950/5 border border-sky-100/80">
              
              {/* Product Tabs */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-100 pb-4 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveTab('flights')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'flights'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Plane className="w-3.5 h-3.5" />
                  <span>Flights</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('hotels')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'hotels'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Hotels</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('packages')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'packages'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Packages</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cars')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'cars'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Cars</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('experiences')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    activeTab === 'experiences'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Experiences</span>
                </button>
              </div>

              {/* Flight Options Radio */}
              <div className="flex items-center gap-6 py-3 text-xs font-semibold text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === 'one-way'}
                    onChange={() => setTripType('one-way')}
                    className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>One Way</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === 'round-trip'}
                    onChange={() => setTripType('round-trip')}
                    className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Round Trip</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="tripType"
                    checked={tripType === 'multi-city'}
                    onChange={() => setTripType('multi-city')}
                    className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                  />
                  <span>Multi City</span>
                </label>
              </div>

              {/* Search Inputs Grid */}
              <form onSubmit={handleSearchSubmit} className="space-y-3.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
                  
                  {/* From Field */}
                  <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      From
                    </label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                      placeholder="City or Airport"
                    />
                  </div>

                  {/* Swap Button */}
                  <button
                    type="button"
                    onClick={handleSwapAirports}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300 shadow-md flex items-center justify-center z-10 transition-transform active:scale-95 hidden md:flex"
                    title="Swap Origin & Destination"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                  </button>

                  {/* To Field */}
                  <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      To
                    </label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                      placeholder="City or Airport"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Departure */}
                  <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-sky-600" />
                      <span>Departure</span>
                    </label>
                    <input
                      type="text"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                    />
                  </div>

                  {/* Return */}
                  <div
                    className={`p-3 bg-slate-50 rounded-2xl border border-slate-200/90 transition-colors ${
                      tripType === 'one-way' ? 'opacity-40 pointer-events-none' : 'hover:bg-slate-100/80 focus-within:border-sky-500 focus-within:bg-white'
                    }`}
                  >
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-sky-600" />
                      <span>Return</span>
                    </label>
                    <input
                      type="text"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      disabled={tripType === 'one-way'}
                      className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                    />
                  </div>

                  {/* Travellers */}
                  <div className="relative p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-sky-600" />
                      <span>Travellers</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTravellerPickerOpen(!isTravellerPickerOpen)}
                      className="w-full text-left text-xs sm:text-sm font-bold text-slate-800 mt-0.5 flex items-center justify-between"
                    >
                      <span>{adults} Adults, {children} Child</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </button>

                    {/* Stepper Popover */}
                    {isTravellerPickerOpen && (
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-30 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Adults</p>
                            <p className="text-[10px] text-slate-400">12+ years</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAdults(Math.max(1, adults - 1))}
                              className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-800 w-4 text-center">{adults}</span>
                            <button
                              type="button"
                              onClick={() => setAdults(adults + 1)}
                              className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <div>
                            <p className="text-xs font-bold text-slate-800">Children</p>
                            <p className="text-[10px] text-slate-400">2-11 years</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setChildren(Math.max(0, children - 1))}
                              className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-slate-800 w-4 text-center">{children}</span>
                            <button
                              type="button"
                              onClick={() => setChildren(children + 1)}
                              className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsTravellerPickerOpen(false)}
                          className="w-full mt-2 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit CTA Button */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-lg shadow-sky-600/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>Search Flights</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Aegean/Santorini airplane visual (Reference Image) */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-sky-900/10 border-4 border-white aspect-[4/3] group">
              <img
                src="/santorini_hero.jpg"
                alt="SkyWay commercial airplane banking over Santorini Greece"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 text-white p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-200">Featured Destination</p>
                <p className="text-sm font-extrabold">Santorini, Greece • Flights from ₹34,999</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── POPULAR DESTINATIONS SECTION ── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Popular Destinations</h2>
          <button
            onClick={() => navigate('/my-trips')}
            className="text-xs sm:text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Destination Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {destinations.map((dest) => (
            <div
              key={dest.city}
              onClick={() => {
                setDestination(`${dest.city}`);
                navigate('/my-trips');
              }}
              className="group bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={dest.image}
                  alt={dest.city}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              </div>
              <div className="p-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                    {dest.city}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-500">
                    From <span className="text-slate-900 font-bold">{dest.price}</span>
                  </p>
                </div>
                <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center transition-colors">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 SERVICE & RECOVERY CARDS (Reference Design) ── */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Real-time Alerts */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Real-time Alerts</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Get instant updates on any disruptions.
              </p>
            </div>
          </div>

          {/* Card 2: Smart Recovery */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Smart Recovery</h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Rebooking options in seconds.
              </p>
            </div>
          </div>

          {/* Card 3: 24/7 Support */}
          <div
            onClick={() => {
              const event = new CustomEvent('skyway_open_support');
              window.dispatchEvent(event);
            }}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex items-start gap-3.5 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                24/7 Support
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                We're here whenever you need us.
              </p>
            </div>
          </div>

          {/* Card 4: Manage Everything */}
          <div
            onClick={() => navigate('/my-trips')}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow flex items-start gap-3.5 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                Manage Everything
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Flights, hotels, cars in one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="mt-auto bg-white border-t border-slate-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">SkyWay</span>
            <span>© 2026 SkyWay Travel Technologies Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/my-trips" className="hover:text-sky-600">My Trips</Link>
            <Link to="/timeline" className="hover:text-sky-600">Journey Timeline</Link>
            <Link to="/admin" className="hover:text-purple-600 font-semibold">Admin Console</Link>
            <Link to="/privacy" className="hover:text-sky-600">Privacy Policy</Link>
            <Link to="/data-deletion" className="hover:text-sky-600">Data Deletion</Link>
          </div>
        </div>
      </footer>

      {/* 24/7 Support Concierge Modal */}
      <SkyWaySupportModal />
    </div>
  );
}
