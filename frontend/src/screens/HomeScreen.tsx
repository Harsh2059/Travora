import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  Bell,
  Settings,
  Phone,
  Search,
  MessageCircle,
  Activity,
  Plane,
  Car,
  Hotel,
  AlertTriangle,
  CheckCircle2,
  FileDown,
  Send,
  Check,
  ShieldCheck,
  X,
  RefreshCw
} from 'lucide-react';

export default function HomeScreen() {
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-30 relative shrink-0">
        <div className="p-6 flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-full text-white">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight text-slate-900 flex items-center gap-1">
              Travora
            </h1>
            <p className="text-[9px] font-bold text-slate-500 tracking-widest mt-0.5">TRAVEL INTELLIGENCE</p>
          </div>
        </div>
        
        <div className="px-4 py-2 mt-4">
          <p className="text-[10px] font-bold text-slate-400 mb-4 px-2 tracking-wider">WORKSPACE</p>
          <nav className="space-y-1">
            <a href="#" className="flex items-center gap-3 bg-blue-600 text-white px-3 py-2.5 rounded-lg font-bold text-sm shadow-md shadow-blue-600/20">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </a>
            <a href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors">
              <Briefcase className="w-4 h-4" />
              My Journeys
            </a>
            <a href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm justify-between transition-colors">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4" />
                Alerts & Live Feed
              </div>
              <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            </a>
            <a href="#" className="flex items-center gap-3 text-slate-600 hover:bg-slate-50 px-3 py-2.5 rounded-lg font-semibold text-sm transition-colors">
              <Settings className="w-4 h-4" />
              Travel Settings
            </a>
          </nav>
        </div>

        <div className="mt-auto p-4 mb-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Live Sync Active
              </div>
              <div className="bg-white p-1 rounded border border-slate-200 shadow-sm">
                 <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
              WhatsApp & SMS dispatch channel connected to live carrier feeds.
            </p>
            <button className="w-full py-2 bg-white border border-slate-200 shadow-sm rounded-xl text-[13px] font-bold text-blue-600 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
              <Phone className="w-4 h-4" />
              Emergency Hotline
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#FAFAFA]">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20 relative">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-blue-600 font-semibold">Travora</span>
            <span className="text-slate-300">›</span>
            <span className="font-bold text-slate-800">Concierge Desk</span>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search PNR, flight #, hotel code, or airport..." 
                className="pl-9 pr-4 py-1.5 bg-slate-100 border border-transparent rounded-full text-sm w-[400px] focus:outline-none focus:bg-white focus:border-slate-300 focus:ring-4 focus:ring-slate-100 transition-all font-medium text-slate-700 placeholder:text-slate-400"
              />
            </div>
            
            <button className="flex items-center gap-2 bg-[#FFEDD5] text-[#C2410C] px-4 py-1.5 rounded-full text-[13px] font-bold hover:bg-[#FED7AA] transition-colors">
              <Phone className="w-3.5 h-3.5" />
              24x7 Assistance
            </button>
            
            <div className="relative cursor-pointer hover:bg-slate-100 p-2 rounded-full transition-colors">
              <Bell className="w-5 h-5 text-slate-600" />
              <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-white"></div>
            </div>
            
            <div className="flex items-center gap-3 border-l border-slate-200 pl-6 cursor-pointer group">
              <div className="text-right">
                <p className="text-[13px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors">Marcus Vance</p>
                <p className="text-[11px] text-slate-500 font-semibold">Platinum Member</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-white ring-offset-1">
                <span className="text-sm font-bold">M</span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          <div className="max-w-[1100px] mx-auto">
            
            {/* Top Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Plane className="w-6 h-6 transform rotate-45" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-[17px] font-extrabold text-slate-900">Mumbai (BOM) → Delhi (DEL)</h2>
                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-slate-200">PNR: ABC123</span>
                  </div>
                  <p className="text-[13px] text-slate-500 font-medium">Thu, 25 Sep 2025 • Marcus Vance (Lead Traveler) • 1 Adult, Economy</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[11px] font-bold border border-emerald-100 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  WhatsApp & SMS Sync Active
                </div>
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-bold px-2">
                  <Activity className="w-3.5 h-3.5" />
                  Feed Live
                </div>
              </div>
            </div>

            {/* Disruption Alert Card */}
            <div className="bg-[#FFF5F5] border border-[#FECDD3] rounded-2xl mb-8 overflow-hidden shadow-sm">
              <div className="bg-[#E11D48] px-5 py-3.5 flex items-center justify-between text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-sm shadow-inner">
                    <Plane className="w-5 h-5 transform rotate-45" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-0.5">
                      <h3 className="font-bold text-[17px]">Flight 6E 1234 Cancelled by Airline</h3>
                      <span className="bg-rose-950/40 text-rose-50 text-[10px] font-bold px-2.5 py-0.5 rounded uppercase tracking-wider border border-rose-500/30">CANCELLED</span>
                    </div>
                    <p className="text-[13px] text-rose-100/90 font-medium">Detected at 10:15AM, 25 Sep 2025 • Technical schedule withdrawal by IndiGo Operations</p>
                  </div>
                </div>
                <div className="bg-white text-rose-600 px-3.5 py-2 rounded-xl text-[13px] font-bold flex items-center gap-2 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  3 Impacted Journey Segments
                </div>
              </div>
              
              <div className="p-5">
                <div className="grid grid-cols-3 gap-5 mb-5">
                  <div className="bg-white rounded-xl p-4 flex gap-3.5 border border-rose-100 shadow-[0_2px_8px_-4px_rgba(225,29,72,0.1)]">
                    <div className="bg-rose-50 text-rose-600 p-2.5 rounded-xl h-fit border border-rose-100"><Plane className="w-4 h-4 transform rotate-45"/></div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm mb-0.5">Flight 6E 1234</p>
                      <p className="text-rose-600 text-[11px] font-bold uppercase tracking-wide">Directly Cancelled</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 flex gap-3.5 border border-orange-100 shadow-[0_2px_8px_-4px_rgba(234,88,12,0.1)]">
                    <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl h-fit border border-orange-100"><Car className="w-4 h-4"/></div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm mb-0.5">Airport Cab (1:00 PM)</p>
                      <p className="text-orange-600 text-[11px] font-bold uppercase tracking-wide">Driver At Risk</p>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 flex gap-3.5 border border-slate-200 shadow-sm">
                    <div className="bg-slate-50 text-slate-600 p-2.5 rounded-xl h-fit border border-slate-100"><Hotel className="w-4 h-4"/></div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm mb-0.5">The Leela Palace</p>
                      <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wide">Check-in at risk (2:00 PM)</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="bg-emerald-100 p-1 rounded-full text-emerald-600 border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-emerald-900">Travora Instant Recovery Active: </span>
                      <span className="text-emerald-800 font-medium">We have cross-checked 14 flight schedules and pre-blocked 3 guaranteed rebooking slots with automatic taxi and hotel sync.</span>
                    </div>
                  </div>
                  <div className="text-blue-700 font-black text-[13px] tracking-widest px-4 shrink-0">ZERO OUT-OF-POCKET FEES</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[380px_1fr] gap-8 pb-48">
              
              {/* Left Column - Timeline */}
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2">
                  <div>
                    <h3 className="font-extrabold text-[17px] text-slate-900">Journey Timeline</h3>
                    <p className="text-[13px] font-medium text-slate-500 mt-0.5">Original flow vs real-time impact</p>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">3 Stages</span>
                </div>
                
                <div className="relative pl-7 space-y-8 before:absolute before:inset-0 before:ml-[1.95rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-rose-500 before:via-slate-200 before:to-emerald-500">
                  
                  {/* Timeline Item 1 */}
                  <div className="relative flex gap-5">
                    <div className="absolute -left-[1.6rem] bg-rose-600 text-white w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#FAFAFA] z-10 shadow-sm">
                      <Plane className="w-3.5 h-3.5 transform rotate-45" />
                    </div>
                    <div className="flex-1 bg-white border border-rose-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-rose-300 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">IndiGo 6E 1234</h4>
                          <p className="text-[12px] text-slate-500 mt-1 font-medium">Mumbai T2 → Delhi T3</p>
                        </div>
                        <div className="text-right">
                          <span className="bg-rose-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide">Cancelled</span>
                          <p className="text-[11px] font-bold text-slate-400 line-through mt-2">10:30 AM BOM</p>
                          <p className="text-[11px] font-bold text-rose-500 line-through mt-0.5">12:40 PM DEL</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-rose-600 text-[11px] font-bold mt-3 bg-rose-50 p-2 rounded-lg border border-rose-100">
                        <X className="w-3.5 h-3.5 shrink-0" />
                        Will not land in Delhi at 12:40 PM
                      </div>
                    </div>
                  </div>

                  {/* Timeline Item 2 */}
                  <div className="relative flex gap-5">
                    <div className="absolute -left-[1.6rem] bg-orange-500 text-white w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#FAFAFA] z-10 shadow-sm">
                      <Car className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 bg-white border border-orange-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-orange-300 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-400"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">Delhi Airport Cab</h4>
                          <p className="text-[12px] text-slate-500 mt-1 font-medium">Driver: Ramesh Kumar</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-bold">(DL01AB1234)</p>
                        </div>
                        <div className="text-right">
                          <span className="bg-orange-50 text-orange-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-orange-200">At Risk</span>
                          <p className="text-[11px] font-bold text-slate-900 mt-2">1:00 PM Pickup</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Toyota Innova</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-orange-700 text-[11px] font-bold mt-3 bg-orange-50 p-2 rounded-lg border border-orange-100">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                        Pickup window invalid due to flight disruption
                      </div>
                    </div>
                  </div>

                  {/* Timeline Item 3 */}
                  <div className="relative flex gap-5">
                    <div className="absolute -left-[1.6rem] bg-emerald-600 text-white w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-[#FAFAFA] z-10 shadow-sm">
                      <Hotel className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-colors">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">The Leela Palace Delhi</h4>
                          <p className="text-[11px] text-slate-500 mt-1 leading-snug font-medium">Chanakyapuri, New Delhi</p>
                        </div>
                        <div className="text-right">
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wide border border-emerald-200">Confirmed</span>
                          <p className="text-[11px] font-bold text-slate-900 mt-2">2:00 PM Check-in</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5">Booking #HTL7890</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold mt-3 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Late check-in hold requested automatically
                      </div>
                    </div>
                  </div>

                </div>

                {/* Recovery Guarantee */}
                <div className="bg-[#F0F9FF] rounded-2xl p-5 border border-blue-100 mt-8 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
                  <h4 className="font-bold text-[11px] text-blue-900/60 mb-3.5 tracking-widest uppercase">RECOVERY GUARANTEE</h4>
                  <div className="space-y-3.5 text-[13px]">
                    <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">DGCA & Travora Auto-Claim</span><span className="font-bold text-emerald-600 bg-white border border-emerald-100 px-2.5 py-1 rounded-md shadow-sm">₹0 Rebooking Fee</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Cab Reschedule Allowance</span><span className="font-bold text-slate-900">Free 1x adjustment</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-600 font-medium">Hotel Late Arrival Notice</span><span className="font-bold text-slate-900">Dispatched via API</span></div>
                  </div>
                </div>

                {/* Destination Intel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 flex gap-4 items-center shadow-sm">
                  <div className="w-20 h-20 bg-blue-100 rounded-xl overflow-hidden shrink-0 shadow-inner">
                    <img src="https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=200&q=80" alt="India Gate" className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="flex-1 py-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-[9px] text-blue-600 tracking-widest uppercase mb-1.5">DESTINATION INTEL</h4>
                        <h5 className="font-extrabold text-slate-900 text-sm">New Delhi (DEL)</h5>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-600 text-[10px] font-bold">On Schedule</span>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">Terminal 2/3</p>
                      </div>
                    </div>
                    <p className="text-[12px] text-slate-500 mt-2 font-medium">Weather 29°C • T3 Baggage flow normal</p>
                  </div>
                </div>

              </div>

              {/* Right Column - Recovery Options */}
              <div>
                <div className="flex items-center gap-2 mb-6 p-1 bg-slate-200/50 rounded-xl border border-slate-200 w-fit">
                  <button className="bg-blue-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-md">Recommended (Best Match)</button>
                  <button className="text-slate-600 px-5 py-2 rounded-lg text-xs font-bold hover:bg-slate-200/50 transition-colors">Lowest Cost</button>
                  <button className="text-slate-600 px-5 py-2 rounded-lg text-xs font-bold hover:bg-slate-200/50 transition-colors">Earliest Arrival</button>
                </div>
                <div className="flex justify-end mb-4">
                  <div className="text-[11px] text-slate-500 font-medium">Sorted by: <span className="font-bold text-slate-800">Min Ripple Delay</span></div>
                </div>

                <div className="space-y-4">
                  {/* Option 1 (Selected) */}
                  <div className="bg-white rounded-2xl border-2 border-blue-500 p-6 shadow-xl shadow-blue-900/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50/80 to-transparent rounded-bl-full -z-10"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <div className="bg-emerald-100 p-0.5 rounded text-emerald-600"><Check className="w-3 h-3" /></div> Option 1 • Best Match
                        </span>
                        <span className="text-blue-700 bg-blue-50 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-blue-100">Auto-aligned Cab</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[26px] font-extrabold text-slate-900 tracking-tight leading-none">₹4,500</div>
                        <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mt-1.5">100% Airline Rebooking Credit</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white text-blue-600 border border-slate-200 shadow-sm rounded-xl flex items-center justify-center">
                          <Plane className="w-6 h-6 transform rotate-45" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-lg">IndiGo 6E 5678</h4>
                          <p className="text-[12px] text-slate-500 font-medium mt-0.5">Airbus A321 • Terminal 2 • Seat 18C</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[22px] font-bold text-slate-900 leading-none">5:20 <span className="text-sm font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">BOM (T2)</div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-600 font-bold mb-1.5">2h 20m</span>
                          <div className="w-24 h-0.5 bg-slate-200 relative flex justify-center rounded-full">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 absolute top-1/2 -translate-y-1/2 ring-4 ring-white shadow-sm"></div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold mt-2">Non-stop</span>
                        </div>
                        <div>
                          <div className="text-[22px] font-bold text-slate-900 leading-none">7:40 <span className="text-sm font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">DEL (T3)</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 mb-6">
                      <div className="flex items-center gap-2 text-[12px] text-slate-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Arrives today (7:40 PM)
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-slate-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cab auto-rescheduled 8:15 PM
                      </div>
                      <div className="flex items-center gap-2 text-[12px] text-slate-700 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Hotel late check-in secured
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                      <div className="flex items-center gap-2.5 text-[12px] text-slate-600 font-bold">
                        <div className="bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg text-emerald-600"><Check className="w-3.5 h-3.5" /></div>
                        Complimentary Meal & Fast Forward Baggage
                      </div>
                      <button className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-colors">
                        <Check className="w-4 h-4" /> Selected as Primary Option
                      </button>
                    </div>
                  </div>

                  {/* Option 2 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm opacity-90 hover:opacity-100 transition-all cursor-pointer group hover:border-slate-300 hover:shadow-md">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-slate-50 text-slate-600 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">Option 2 • Alternative Airline</span>
                        <span className="text-slate-600 bg-slate-50 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">Terminal 1 BOM</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-none">₹3,200</div>
                        <div className="text-[9px] font-bold text-emerald-600 mt-1.5 uppercase tracking-widest">Zero Rebooking Surcharge</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white text-rose-600 border border-slate-200 shadow-sm rounded-xl flex items-center justify-center">
                          <Plane className="w-6 h-6 transform rotate-45" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-[17px]">Air India AI 203</h4>
                          <p className="text-[12px] text-slate-500 font-medium mt-0.5">Boeing 787-8 • Seat 22A • Window</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[20px] font-bold text-slate-900 leading-none">6:10 <span className="text-[12px] font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">BOM (T1)</div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-bold mb-1.5">2h 20m</span>
                          <div className="w-20 h-0.5 bg-slate-200 relative flex justify-center rounded-full"></div>
                          <span className="text-[10px] text-slate-400 font-bold mt-2">Non-stop</span>
                        </div>
                        <div>
                          <div className="text-[20px] font-bold text-slate-900 leading-none">8:30 <span className="text-[12px] font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">DEL (T3)</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                      <div className="flex items-center gap-2.5 text-[12px] text-rose-600 font-bold">
                        <div className="bg-rose-50 border border-rose-100 p-1.5 rounded-lg text-rose-600"><AlertTriangle className="w-3.5 h-3.5" /></div>
                        Requires terminal change in Mumbai (T2 → T1)
                      </div>
                      <button className="bg-blue-50 text-blue-700 px-8 py-2.5 rounded-xl text-sm font-bold group-hover:bg-blue-100 transition-colors border border-blue-100">
                        Select Option 2
                      </button>
                    </div>
                  </div>

                  {/* Option 3 */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm opacity-90 hover:opacity-100 transition-all cursor-pointer group hover:border-slate-300 hover:shadow-md">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-2.5">
                        <span className="bg-slate-50 text-slate-600 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">Option 3 • Later Evening</span>
                        <span className="text-slate-600 bg-slate-50 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-sm">Terminal 2 BOM</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[22px] font-extrabold text-slate-900 tracking-tight leading-none">₹5,800</div>
                        <div className="text-[9px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">Covered by waiver</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white text-purple-600 border border-slate-200 shadow-sm rounded-xl flex items-center justify-center">
                          <Plane className="w-6 h-6 transform rotate-45" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-[17px]">Vistara UK 994</h4>
                          <p className="text-[12px] text-slate-500 font-medium mt-0.5">Airbus A321neo • Seat 12F • Extra Legroom</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <div className="text-[20px] font-bold text-slate-900 leading-none">7:00 <span className="text-[12px] font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">BOM (T2)</div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] text-slate-500 font-bold mb-1.5">2h 15m</span>
                          <div className="w-20 h-0.5 bg-slate-200 relative flex justify-center rounded-full"></div>
                          <span className="text-[10px] text-slate-400 font-bold mt-2">Non-stop</span>
                        </div>
                        <div>
                          <div className="text-[20px] font-bold text-slate-900 leading-none">9:15 <span className="text-[12px] font-semibold">PM</span></div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-1">DEL (T3)</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                      <div className="flex items-center gap-2.5 text-[12px] text-slate-700 font-bold">
                        <div className="bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg text-emerald-600"><Check className="w-3.5 h-3.5" /></div>
                        Late check-in window compatible with The Leela Palace
                      </div>
                      <button className="bg-blue-50 text-blue-700 px-8 py-2.5 rounded-xl text-sm font-bold group-hover:bg-blue-100 transition-colors border border-blue-100">
                        Select Option 3
                      </button>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-slate-200 p-5 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] z-40">
          <div className="max-w-[1100px] mx-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 shadow-inner border border-emerald-200">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-extrabold text-[17px] text-slate-900">Updated Itinerary Preview (Option 1 Selected)</h3>
                  <p className="text-[13px] font-medium text-slate-500 mt-1">Instant rebooking ready • Zero cancellation or ticket change charges</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button className="bg-slate-50 hover:bg-slate-100 text-slate-700 px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors border border-slate-200 shadow-sm">
                  <FileDown className="w-4 h-4" />
                  Download PDF
                </button>
                <button className="bg-[#047857] hover:bg-[#065F46] text-white px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5">
                  <Send className="w-4 h-4" />
                  Confirm & Push to WhatsApp
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5 mb-5">
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-200">New Flight</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">Seat 18C Assigned</span>
                </div>
                <h4 className="font-bold text-slate-900 text-[15px] mt-1">IndiGo 6E 5678</h4>
                <p className="text-[12px] text-slate-600 font-medium mt-1">Dep: BOM 5:20 PM • Arr: DEL 7:40 PM</p>
                <div className="mt-3.5 pt-3.5 border-t border-blue-100/50">
                  <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 text-slate-400"/> PNR updated automatically</p>
                </div>
              </div>
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-200">Rescheduled Cab</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">Free Sync</span>
                </div>
                <h4 className="font-bold text-slate-900 text-[15px] mt-1">Delhi Airport → The Leela</h4>
                <p className="text-[12px] text-slate-600 font-medium mt-1">New Pickup: 8:15 PM • Ramesh Kumar notified</p>
                <div className="mt-3.5 pt-3.5 border-t border-blue-100/50">
                  <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400"/> Driver standby confirmed via SMS</p>
                </div>
              </div>
              <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded uppercase tracking-wider border border-blue-200">Hotel Hold</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">Room Guaranteed</span>
                </div>
                <h4 className="font-bold text-slate-900 text-[15px] mt-1">The Leela Palace Delhi</h4>
                <p className="text-[12px] text-slate-600 font-medium mt-1">Estimated Check-in: 9:10 PM • Room 412</p>
                <div className="mt-3.5 pt-3.5 border-t border-blue-100/50">
                  <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-500"/> Digital room key pre-activated</p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-400" /> Protected under DGCA Passenger Charter & Travora Zero-Disruption Cover.
              </p>
              <p className="text-[11px] font-semibold text-slate-500">
                Need custom changes? <a href="#" className="text-blue-600 font-bold hover:underline">Call Priority Concierge</a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
