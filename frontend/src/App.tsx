/**
 * App.tsx — SkyWay Routing Shell
 *
 * Primary SkyWay Experience Routes:
 *   /                          SkyWayHomeScreen (Page 1: Home / Search Page)
 *   /my-trips                  SkyWayMyTripScreen (Page 2: My Trip / Booking Details)
 *   /trip/:tripId              SkyWayMyTripScreen (Page 2: My Trip / Booking Details)
 *   /timeline                  SkyWayTimelineScreen (Page 3: Journey Timeline)
 *   /trip/:tripId/timeline     SkyWayTimelineScreen (Page 3: Journey Timeline)
 *   /disruption                SkyWayDisruptionScreen (Page 4: Disruption & Recovery)
 *   /trip/:tripId/disruption   SkyWayDisruptionScreen (Page 4: Disruption & Recovery)
 *   /itinerary                 SkyWayItineraryScreen (Page 5: Updated Itinerary / Confirmation)
 *   /trip/:tripId/itinerary    SkyWayItineraryScreen (Page 5: Updated Itinerary / Confirmation)
 *
 * Operational & Builder Routes:
 *   /build                     TripBuilderScreen
 *   /review                    ReviewJourneyScreen
 *   /admin                     AdminConsoleScreen
 *   /home                      HomeScreen (Full Advanced Workspace)
 *   /workspace                 HomeScreen (Full Advanced Workspace)
 *   /welcome                   WelcomeScreen
 *   /app                       LegacyDisruptionApp
 *   /privacy                   PrivacyScreen
 *   /data-deletion             DataDeletionScreen
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Plane } from 'lucide-react';

// SkyWay Redesigned 5-Page Journey Experience
const SkyWayHomeScreen       = lazy(() => import('./screens/SkyWayHomeScreen.tsx'));
const SkyWayMyTripScreen     = lazy(() => import('./screens/SkyWayMyTripScreen.tsx'));
const SkyWayTimelineScreen   = lazy(() => import('./screens/SkyWayTimelineScreen.tsx'));
const SkyWayDisruptionScreen = lazy(() => import('./screens/SkyWayDisruptionScreen.tsx'));
const SkyWayItineraryScreen  = lazy(() => import('./screens/SkyWayItineraryScreen.tsx'));

// Builder & Admin screens
const TripBuilderScreen      = lazy(() => import('./screens/TripBuilderScreen.tsx'));
const ReviewJourneyScreen    = lazy(() => import('./screens/ReviewJourneyScreen.tsx'));
const HomeScreen             = lazy(() => import('./screens/HomeScreen.tsx'));
const AdminConsoleScreen     = lazy(() => import('./screens/AdminConsoleScreen.tsx'));
const WelcomeScreen          = lazy(() => import('./screens/WelcomeScreen.tsx'));

// Public meta/whatsapp pages
const PrivacyScreen          = lazy(() => import('./screens/PrivacyScreen.tsx'));
const DataDeletionScreen     = lazy(() => import('./screens/DataDeletionScreen.tsx'));

// Legacy Phase 2 disruption demo
const LegacyDisruptionApp    = lazy(() => import('./legacy/LegacyDisruptionApp.tsx'));

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-[#f8fbff] flex items-center justify-center">
      <div className="relative">
        <div className="h-12 w-12 rounded-full animate-spin border-4 border-slate-200 border-t-sky-500" />
        <div className="absolute inset-2 flex items-center justify-center">
          <Plane className="h-4 w-4 text-sky-500" style={{ transform: 'rotate(-30deg)' }} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Primary SkyWay Target Product Journey */}
          <Route path="/"                           element={<SkyWayHomeScreen />} />
          <Route path="/my-trips"                   element={<SkyWayMyTripScreen />} />
          <Route path="/trip/:tripId"               element={<SkyWayMyTripScreen />} />
          <Route path="/timeline"                   element={<SkyWayTimelineScreen />} />
          <Route path="/trip/:tripId/timeline"      element={<SkyWayTimelineScreen />} />
          <Route path="/disruption"                 element={<SkyWayDisruptionScreen />} />
          <Route path="/trip/:tripId/disruption"    element={<SkyWayDisruptionScreen />} />
          <Route path="/itinerary"                  element={<SkyWayItineraryScreen />} />
          <Route path="/trip/:tripId/itinerary"     element={<SkyWayItineraryScreen />} />

          {/* Builder, Workspace & Admin */}
          <Route path="/build"                      element={<TripBuilderScreen />} />
          <Route path="/review"                     element={<ReviewJourneyScreen />} />
          <Route path="/workspace"                  element={<HomeScreen />} />
          <Route path="/home"                       element={<HomeScreen />} />
          <Route path="/admin"                      element={<AdminConsoleScreen />} />
          <Route path="/welcome"                    element={<WelcomeScreen />} />

          {/* Legacy Demo & Compliance */}
          <Route path="/app"                        element={<LegacyDisruptionApp />} />
          <Route path="/privacy"                    element={<PrivacyScreen />} />
          <Route path="/data-deletion"              element={<DataDeletionScreen />} />

          {/* Catch-all -> Home */}
          <Route path="*"                           element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
