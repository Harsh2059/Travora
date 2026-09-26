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
  Search,
  MapPin,
  Clock,
  Star,
  Bed,
  Check,
  Loader2,
  X
} from 'lucide-react';
import { SkyWayNavbar } from '../components/SkyWayNavbar';
import { SkyWaySupportModal } from '../components/SkyWaySupportModal';
import { useJourney, fetchTripDisruptions, setActiveTripId } from '../store/journeyStore';

export default function SkyWayHomeScreen() {
  const navigate = useNavigate();
  const { journey } = useJourney();

  const [activeTab, setActiveTab] = useState<'flights' | 'hotels' | 'packages' | 'cars' | 'experiences'>('flights');
  
  // Flights state
  const [tripType, setTripType] = useState<'one-way' | 'round-trip' | 'multi-city'>('round-trip');
  const [origin, setOrigin] = useState('Mumbai (BOM)');
  const [destination, setDestination] = useState('London (LHR)');
  const [departureDate, setDepartureDate] = useState('12 Jun, 2025');
  const [returnDate, setReturnDate] = useState('20 Jun, 2025');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(1);
  const [isTravellerPickerOpen, setIsTravellerPickerOpen] = useState(false);

  // Hotels state
  const [hotelStayType, setHotelStayType] = useState<'hotels' | 'apartments' | 'villas' | 'luxury'>('hotels');
  const [hotelDestination, setHotelDestination] = useState('London, United Kingdom');
  const [hotelCheckIn, setHotelCheckIn] = useState('12 Jun, 2025');
  const [hotelCheckOut, setHotelCheckOut] = useState('18 Jun, 2025');
  const [hotelGuests, setHotelGuests] = useState(2);
  const [hotelRooms, setHotelRooms] = useState(1);
  const [isHotelPickerOpen, setIsHotelPickerOpen] = useState(false);

  // Packages state
  const [packageCategory, setPackageCategory] = useState<'all' | 'honeymoon' | 'family' | 'luxury'>('all');
  const [packageOrigin, setPackageOrigin] = useState('Mumbai (BOM)');
  const [packageDestination, setPackageDestination] = useState('Santorini & Athens, Greece');
  const [packageMonth, setPackageMonth] = useState('June 2025');
  const [packageTravellers, setPackageTravellers] = useState('2 Adults, 1 Child');

  // Cars state
  const [carService, setCarService] = useState<'airport' | 'city' | 'self' | 'chauffeur'>('airport');
  const [carPickup, setCarPickup] = useState('Heathrow Airport (LHR)');
  const [carDropoff, setCarDropoff] = useState('Central London (Hotel)');
  const [carDateTime, setCarDateTime] = useState('12 Jun, 2025 • 10:30 AM');
  const [carType, setCarType] = useState('Executive Sedan');

  // Experiences state
  const [expCategory, setExpCategory] = useState<'all' | 'tours' | 'water' | 'food'>('all');
  const [expLocation, setExpLocation] = useState('London, United Kingdom');
  const [expActivity, setExpActivity] = useState('Thames Cruise & Tower of London');
  const [expDate, setExpDate] = useState('14 Jun, 2025');
  const [expGuests, setExpGuests] = useState(2);

  // Interactive search state & feedback
  const [isSearching, setIsSearching] = useState(false);
  const [searchedTab, setSearchedTab] = useState<'flights' | 'hotels' | 'packages' | 'cars' | 'experiences' | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [addedItems, setAddedItems] = useState<string[]>([]);

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

  const handleTabChange = (tab: 'flights' | 'hotels' | 'packages' | 'cars' | 'experiences') => {
    setActiveTab(tab);
    if (searchedTab) {
      setSearchedTab(tab);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'flights') {
      if (journey?.id) {
        setActiveTripId(journey.id);
      }
      navigate('/my-trips');
    } else {
      setIsSearching(true);
      setTimeout(() => {
        setIsSearching(false);
        setSearchedTab(activeTab);
        // Smoothly scroll down to results section
        const el = document.getElementById('search-results-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 350);
    }
  };

  const handleAddToTrip = (id: string, title: string) => {
    if (!addedItems.includes(id)) {
      setAddedItems([...addedItems, id]);
    }
    setToastMessage(`Added "${title}" to your trip!`);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Curated Catalog Data for dynamic tabs
  const hotelResults = [
    {
      id: 'hotel-1',
      title: 'The Langham, London',
      type: '5-Star Luxury Hotel',
      location: 'Regent Street, Marylebone, London',
      rating: 4.9,
      reviews: 1420,
      badge: 'Exceptional 5★',
      price: '₹21,500',
      period: 'per night',
      perks: ['Free Airport Shuttle', 'Michelin Dining', 'Chuan Spa & Pool', 'Free High-Speed WiFi'],
      image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'hotel-2',
      title: 'Shangri-La The Shard',
      type: 'Iconic Panoramic Tower',
      location: 'London Bridge, Southwark, London',
      rating: 4.8,
      reviews: 2180,
      badge: 'Best City View',
      price: '₹38,900',
      period: 'per night',
      perks: ['Sky Pool Level 52', 'Floor-to-Ceiling Windows', '24/7 Butler Service', 'Marble Bathrooms'],
      image: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'hotel-3',
      title: 'citizenM Tower of London',
      type: 'Design Boutique Stay',
      location: '40 Trinity Square, City of London',
      rating: 4.7,
      reviews: 3400,
      badge: 'Top Value',
      price: '₹14,200',
      period: 'per night',
      perks: ['King XL Beds', 'Rooftop CloudM Bar', 'Self Check-in 1 min', 'Soundproof Rooms'],
      image: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80',
    },
  ];

  const packageResults = [
    {
      id: 'pkg-1',
      title: 'Santorini & Athens Greek Odyssey',
      duration: '7 Days / 6 Nights',
      location: 'Santorini & Athens, Greece',
      rating: 4.9,
      reviews: 420,
      badge: 'Top Selling Package',
      price: '₹89,999',
      period: 'per person',
      perks: ['Roundtrip Flights Included', '5★ Caldera View Suite', 'Sunset Catamaran Cruise', 'Inter-island Ferries'],
      image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'pkg-2',
      title: 'Royal London & Romantic Paris Escape',
      duration: '6 Days / 5 Nights',
      location: 'London & Paris (Eurostar High-Speed)',
      rating: 4.8,
      reviews: 680,
      badge: 'All Inclusive',
      price: '₹1,12,000',
      period: 'per person',
      perks: ['Direct International Flights', '4★ City Central Hotels', 'Eurostar High Speed Train', 'Thames Cruise Pass'],
      image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'pkg-3',
      title: 'Dubai Ultra-Luxury & Desert Dunes',
      duration: '5 Days / 4 Nights',
      location: 'Dubai & Abu Dhabi, UAE',
      rating: 4.9,
      reviews: 890,
      badge: 'Family Favorite',
      price: '₹64,500',
      period: 'per person',
      perks: ['Emirates Flights', '5★ Marina Resort', 'VIP 4x4 Desert Safari & Dinner', 'Burj Khalifa Level 148'],
      image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80',
    },
  ];

  const carResults = [
    {
      id: 'car-1',
      title: 'Mercedes-Benz E-Class Executive',
      type: 'Premium Chauffeur Transfer',
      location: 'Heathrow (LHR) ⇄ Central London',
      rating: 4.9,
      reviews: 950,
      badge: 'Business Class',
      price: '₹4,800',
      period: 'total fare',
      perks: ['Flight Delay Tracking', 'Meet & Greet with Name Sign', 'Complimentary Water & WiFi', 'Free 60m Wait Time'],
      image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'car-2',
      title: 'Tesla Model Y Dual-Motor AWD',
      type: 'Green Eco Chauffeur',
      location: 'Heathrow (LHR) ⇄ Central London',
      rating: 4.9,
      reviews: 620,
      badge: '100% Electric',
      price: '₹5,200',
      period: 'total fare',
      perks: ['Zero Emissions', 'Quiet Acoustic Glass', 'Supercharger Included', 'Priority Curbside Pick-up'],
      image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'car-3',
      title: 'Range Rover Sport VIP Edition',
      type: 'Luxury Full-Size SUV',
      location: 'Heathrow (LHR) ⇄ Central London',
      rating: 5.0,
      reviews: 310,
      badge: 'VIP Ultra',
      price: '₹8,500',
      period: 'total fare',
      perks: ['Up to 4 Passengers + 4 Luggage', 'Panoramic Sunroof', 'Chilled Beverages', 'Professional Chauffeur'],
      image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    },
  ];

  const expResults = [
    {
      id: 'exp-1',
      title: 'Thames Sunset Sightseeing Cruise & Champagne',
      duration: '2 Hours • Live Acoustic Music',
      location: 'Westminster Pier, London',
      rating: 4.9,
      reviews: 1150,
      badge: 'Top Rated Tour',
      price: '₹3,200',
      period: 'per guest',
      perks: ['Glass of Sparkling Wine', 'Views of Tower Bridge & Big Ben', 'Multilingual Audio Guide', 'Instant Mobile Voucher'],
      image: 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'exp-2',
      title: 'Tower of London & Crown Jewels Early VIP Tour',
      duration: '3.5 Hours • Skip-the-line Admission',
      location: 'Tower Hill, London',
      rating: 4.8,
      reviews: 2890,
      badge: 'Historic Landmark',
      price: '₹5,400',
      period: 'per guest',
      perks: ['Early Access Before Crowds', 'Yeoman Warder ("Beefeater") Guide', 'White Tower & Armoury', 'Crown Jewels Vaults'],
      image: 'https://images.unsplash.com/photo-1520986606214-8b456906c813?auto=format&fit=crop&w=600&q=80',
    },
    {
      id: 'exp-3',
      title: 'Santorini Caldera Luxury Catamaran Cruise with BBQ',
      duration: '5 Hours • Hot Springs & Red Beach',
      location: 'Vlychada Port, Santorini',
      rating: 5.0,
      reviews: 940,
      badge: 'Award Winner',
      price: '₹12,800',
      period: 'per guest',
      perks: ['Fresh Greek BBQ & Open Bar', 'Snorkeling Equipment Provided', 'Thermal Springs Swim', 'Hotel Transfer Included'],
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80',
    },
  ];

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
    <div className="min-h-screen bg-[#f8fbff] text-slate-900 font-sans flex flex-col relative">
      <SkyWayNavbar hasActiveDisruption={hasDisruption} />

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-white">{toastMessage}</p>
            <p className="text-slate-300 text-[11px]">Synced with London Journey (SW12345678)</p>
          </div>
          <button
            onClick={() => navigate('/my-trips')}
            className="ml-2 px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            View Trip
          </button>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            <div id="search-flights" className="bg-white rounded-3xl p-5 sm:p-6 shadow-xl shadow-sky-950/5 border border-sky-100/80 transition-all">
              
              {/* Product Tabs */}
              <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-100 pb-4 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleTabChange('flights')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
                  onClick={() => handleTabChange('hotels')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
                  onClick={() => handleTabChange('packages')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
                  onClick={() => handleTabChange('cars')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
                  onClick={() => handleTabChange('experiences')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'experiences'
                      ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Experiences</span>
                </button>
              </div>

              {/* ── DYNAMIC SUB-FILTERS ROW ACCORDING TO ACTIVE TAB ── */}
              {activeTab === 'flights' && (
                <div className="flex items-center gap-6 py-3 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tripType"
                      checked={tripType === 'one-way'}
                      onChange={() => setTripType('one-way')}
                      className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>One Way</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tripType"
                      checked={tripType === 'round-trip'}
                      onChange={() => setTripType('round-trip')}
                      className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Round Trip</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tripType"
                      checked={tripType === 'multi-city'}
                      onChange={() => setTripType('multi-city')}
                      className="text-sky-600 focus:ring-sky-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>Multi City</span>
                  </label>
                </div>
              )}

              {activeTab === 'hotels' && (
                <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setHotelStayType('hotels')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      hotelStayType === 'hotels'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Hotels & Resorts
                  </button>
                  <button
                    type="button"
                    onClick={() => setHotelStayType('apartments')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      hotelStayType === 'apartments'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Apartments
                  </button>
                  <button
                    type="button"
                    onClick={() => setHotelStayType('villas')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      hotelStayType === 'villas'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Villas & Homestays
                  </button>
                  <button
                    type="button"
                    onClick={() => setHotelStayType('luxury')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      hotelStayType === 'luxury'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    ★ 5-Star Luxury
                  </button>
                </div>
              )}

              {activeTab === 'packages' && (
                <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setPackageCategory('all')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      packageCategory === 'all'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Packages
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageCategory('honeymoon')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      packageCategory === 'honeymoon'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Honeymoon Specials
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageCategory('family')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      packageCategory === 'family'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Family Vacation
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageCategory('luxury')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      packageCategory === 'luxury'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Luxury Escapes
                  </button>
                </div>
              )}

              {activeTab === 'cars' && (
                <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setCarService('airport')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      carService === 'airport'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Airport Transfers
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarService('city')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      carService === 'city'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    City Rides
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarService('self')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      carService === 'self'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Self-Drive Rental
                  </button>
                  <button
                    type="button"
                    onClick={() => setCarService('chauffeur')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      carService === 'chauffeur'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    VIP Chauffeur
                  </button>
                </div>
              )}

              {activeTab === 'experiences' && (
                <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setExpCategory('all')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      expCategory === 'all'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All Activities
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpCategory('tours')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      expCategory === 'tours'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    City Tours & Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpCategory('water')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      expCategory === 'water'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cruises & Water
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpCategory('food')}
                    className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                      expCategory === 'food'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 font-bold'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Food & Dining
                  </button>
                </div>
              )}

              {/* ── DYNAMIC SEARCH FORM INPUTS ── */}
              <form onSubmit={handleSearchSubmit} className="space-y-3.5">
                
                {/* 1. FLIGHTS FORM */}
                {activeTab === 'flights' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative">
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

                      <button
                        type="button"
                        onClick={handleSwapAirports}
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-500 hover:text-sky-600 hover:border-sky-300 shadow-md flex items-center justify-center z-10 transition-transform active:scale-95 hidden md:flex"
                        title="Swap Origin & Destination"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                      </button>

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

                      <div className="relative p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-sky-600" />
                          <span>Travellers</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsTravellerPickerOpen(!isTravellerPickerOpen)}
                          className="w-full text-left text-xs sm:text-sm font-bold text-slate-800 mt-0.5 flex items-center justify-between cursor-pointer"
                        >
                          <span>{adults} Adults, {children} Child</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

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
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold text-slate-800 w-4 text-center">{adults}</span>
                                <button
                                  type="button"
                                  onClick={() => setAdults(adults + 1)}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
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
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold text-slate-800 w-4 text-center">{children}</span>
                                <button
                                  type="button"
                                  onClick={() => setChildren(children + 1)}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsTravellerPickerOpen(false)}
                              className="w-full mt-2 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* 2. HOTELS FORM */}
                {activeTab === 'hotels' && (
                  <>
                    <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-sky-600" />
                        <span>City, Location or Hotel Name</span>
                      </label>
                      <input
                        type="text"
                        value={hotelDestination}
                        onChange={(e) => setHotelDestination(e.target.value)}
                        className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                        placeholder="Where do you want to stay?"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-sky-600" />
                          <span>Check-In</span>
                        </label>
                        <input
                          type="text"
                          value={hotelCheckIn}
                          onChange={(e) => setHotelCheckIn(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-sky-600" />
                          <span>Check-Out</span>
                        </label>
                        <input
                          type="text"
                          value={hotelCheckOut}
                          onChange={(e) => setHotelCheckOut(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="relative p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Bed className="w-3 h-3 text-sky-600" />
                          <span>Guests & Rooms</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsHotelPickerOpen(!isHotelPickerOpen)}
                          className="w-full text-left text-xs sm:text-sm font-bold text-slate-800 mt-0.5 flex items-center justify-between cursor-pointer"
                        >
                          <span>{hotelGuests} Guests, {hotelRooms} Room</span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {isHotelPickerOpen && (
                          <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-30 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-bold text-slate-800">Guests</p>
                                <p className="text-[10px] text-slate-400">Total occupants</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHotelGuests(Math.max(1, hotelGuests - 1))}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold text-slate-800 w-4 text-center">{hotelGuests}</span>
                                <button
                                  type="button"
                                  onClick={() => setHotelGuests(hotelGuests + 1)}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                              <div>
                                <p className="text-xs font-bold text-slate-800">Rooms</p>
                                <p className="text-[10px] text-slate-400">Hotel rooms</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setHotelRooms(Math.max(1, hotelRooms - 1))}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="text-xs font-bold text-slate-800 w-4 text-center">{hotelRooms}</span>
                                <button
                                  type="button"
                                  onClick={() => setHotelRooms(hotelRooms + 1)}
                                  className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsHotelPickerOpen(false)}
                              className="w-full mt-2 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* 3. PACKAGES FORM */}
                {activeTab === 'packages' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Plane className="w-3 h-3 text-sky-600" />
                          <span>Departing From</span>
                        </label>
                        <input
                          type="text"
                          value={packageOrigin}
                          onChange={(e) => setPackageOrigin(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="Your origin city"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Compass className="w-3 h-3 text-sky-600" />
                          <span>Holiday Destination</span>
                        </label>
                        <input
                          type="text"
                          value={packageDestination}
                          onChange={(e) => setPackageDestination(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="Where do you want to explore?"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-sky-600" />
                          <span>Travel Month / Dates</span>
                        </label>
                        <input
                          type="text"
                          value={packageMonth}
                          onChange={(e) => setPackageMonth(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-sky-600" />
                          <span>Travellers</span>
                        </label>
                        <input
                          type="text"
                          value={packageTravellers}
                          onChange={(e) => setPackageTravellers(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 4. CARS FORM */}
                {activeTab === 'cars' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          <span>Pick-Up Location</span>
                        </label>
                        <input
                          type="text"
                          value={carPickup}
                          onChange={(e) => setCarPickup(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="Airport, station or address"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          <span>Drop-Off Location</span>
                        </label>
                        <input
                          type="text"
                          value={carDropoff}
                          onChange={(e) => setCarDropoff(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="Hotel, terminal or landmark"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-sky-600" />
                          <span>Pick-Up Date & Time</span>
                        </label>
                        <input
                          type="text"
                          value={carDateTime}
                          onChange={(e) => setCarDateTime(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Car className="w-3 h-3 text-sky-600" />
                          <span>Vehicle Category</span>
                        </label>
                        <select
                          value={carType}
                          onChange={(e) => setCarType(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5 cursor-pointer"
                        >
                          <option value="Executive Sedan">Executive Sedan (Mercedes / BMW)</option>
                          <option value="Green EV">Green EV (Tesla Model Y)</option>
                          <option value="Luxury SUV">Luxury SUV (Range Rover Sport)</option>
                          <option value="Executive Van">Executive Van (Mercedes V-Class)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {/* 5. EXPERIENCES FORM */}
                {activeTab === 'experiences' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-sky-600" />
                          <span>Destination</span>
                        </label>
                        <input
                          type="text"
                          value={expLocation}
                          onChange={(e) => setExpLocation(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="City or region"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Compass className="w-3 h-3 text-sky-600" />
                          <span>Activity or Attraction</span>
                        </label>
                        <input
                          type="text"
                          value={expActivity}
                          onChange={(e) => setExpActivity(e.target.value)}
                          className="w-full bg-transparent text-sm sm:text-base font-bold text-slate-800 focus:outline-none mt-0.5"
                          placeholder="Tours, tickets, cruises..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-sky-600" />
                          <span>Experience Date</span>
                        </label>
                        <input
                          type="text"
                          value={expDate}
                          onChange={(e) => setExpDate(e.target.value)}
                          className="w-full bg-transparent text-xs sm:text-sm font-bold text-slate-800 focus:outline-none mt-0.5"
                        />
                      </div>

                      <div className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/90 transition-colors focus-within:border-sky-500 focus-within:bg-white">
                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-sky-600" />
                          <span>Participants</span>
                        </label>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-xs sm:text-sm font-bold text-slate-800">{expGuests} Guests</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setExpGuests(Math.max(1, expGuests - 1))}
                              className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpGuests(expGuests + 1)}
                              className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ── DYNAMIC SUBMIT BUTTON ── */}
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm shadow-lg shadow-sky-600/25 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Searching available options...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>
                          {activeTab === 'flights' && 'Search Flights'}
                          {activeTab === 'hotels' && 'Search Hotels'}
                          {activeTab === 'packages' && 'Search Holiday Packages'}
                          {activeTab === 'cars' && 'Search Cabs & Cars'}
                          {activeTab === 'experiences' && 'Explore Experiences'}
                        </span>
                      </>
                    )}
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

      {/* ── DYNAMIC LIVE RESULTS SECTION (When user searches Hotels, Packages, Cars, or Experiences) ── */}
      {searchedTab && searchedTab !== 'flights' && (
        <section id="search-results-section" className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full scroll-mt-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-xl shadow-sky-950/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-700 text-xs font-bold uppercase tracking-wider">
                    {searchedTab.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    • 3 Handpicked Verified Options
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  {searchedTab === 'hotels' && `Top Hotels & Stays in ${hotelDestination}`}
                  {searchedTab === 'packages' && `Holiday Packages: ${packageDestination}`}
                  {searchedTab === 'cars' && `Available Private Transfers (${carPickup})`}
                  {searchedTab === 'experiences' && `Curated Experiences in ${expLocation}`}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchedTab(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close Results</span>
                </button>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              
              {/* Hotels Cards */}
              {searchedTab === 'hotels' &&
                hotelResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-sky-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        {item.badge}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{item.type}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-slate-400 font-normal">({item.reviews})</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{item.location}</span>
                      </p>

                      <div className="mt-3 space-y-1">
                        {item.perks.slice(0, 3).map((perk, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{perk}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-slate-900">{item.price}</p>
                          <p className="text-[10px] text-slate-400">{item.period}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddToTrip(item.id, item.title)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            addedItems.includes(item.id)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                          }`}
                        >
                          {addedItems.includes(item.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Trip</span>
                            </>
                          ) : (
                            <>
                              <span>Select Room</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Packages Cards */}
              {searchedTab === 'packages' &&
                packageResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-sky-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        {item.badge}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-sky-600">{item.duration}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-slate-400 font-normal">({item.reviews})</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Compass className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{item.location}</span>
                      </p>

                      <div className="mt-3 space-y-1">
                        {item.perks.slice(0, 3).map((perk, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{perk}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-slate-900">{item.price}</p>
                          <p className="text-[10px] text-slate-400">{item.period}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddToTrip(item.id, item.title)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            addedItems.includes(item.id)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                          }`}
                        >
                          {addedItems.includes(item.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Trip</span>
                            </>
                          ) : (
                            <>
                              <span>Book Package</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Cars Cards */}
              {searchedTab === 'cars' &&
                carResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-sky-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        {item.badge}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{item.type}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-slate-400 font-normal">({item.reviews})</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{item.location}</span>
                      </p>

                      <div className="mt-3 space-y-1">
                        {item.perks.slice(0, 3).map((perk, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{perk}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-slate-900">{item.price}</p>
                          <p className="text-[10px] text-slate-400">{item.period}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddToTrip(item.id, item.title)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            addedItems.includes(item.id)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                          }`}
                        >
                          {addedItems.includes(item.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Reserved</span>
                            </>
                          ) : (
                            <>
                              <span>Reserve Ride</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* Experiences Cards */}
              {searchedTab === 'experiences' &&
                expResults.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs text-sky-700 text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        {item.badge}
                      </span>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span className="font-semibold text-sky-600">{item.duration}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{item.rating}</span>
                          <span className="text-slate-400 font-normal">({item.reviews})</span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{item.location}</span>
                      </p>

                      <div className="mt-3 space-y-1">
                        {item.perks.slice(0, 3).map((perk, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                            <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{perk}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-lg font-extrabold text-slate-900">{item.price}</p>
                          <p className="text-[10px] text-slate-400">{item.period}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddToTrip(item.id, item.title)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                            addedItems.includes(item.id)
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-600/20'
                          }`}
                        >
                          {addedItems.includes(item.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <span>Book Activity</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>
      )}

      {/* ── POPULAR DESTINATIONS SECTION ── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Popular Destinations</h2>
          <button
            onClick={() => navigate('/my-trips')}
            className="text-xs sm:text-sm font-bold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1 cursor-pointer"
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
