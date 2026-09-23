/**
 * App.tsx — Routing shell
 *
 * Routes:
 *   /          WelcomeScreen
 *   /build     TripBuilderScreen
 *   /review    ReviewJourneyScreen
 *   /home      HomeScreen
 *   /trip/:id  TripViewScreen  (future-safe per-trip view)
 *   /app       LegacyDisruptionApp (Phase 2 demo — unchanged)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Plane } from 'lucide-react';

// New journey builder screens (lazy-loaded with explicit .tsx for IDE resolution)
const WelcomeScreen       = lazy(() => import('./screens/WelcomeScreen.tsx'));
const TripBuilderScreen   = lazy(() => import('./screens/TripBuilderScreen.tsx'));
const ReviewJourneyScreen = lazy(() => import('./screens/ReviewJourneyScreen.tsx'));
const HomeScreen          = lazy(() => import('./screens/HomeScreen.tsx'));
const TripViewScreen      = lazy(() => import('./screens/TripViewScreen.tsx'));

const AdminConsoleScreen = lazy(() => import('./screens/AdminConsoleScreen.tsx'));

// Public meta/whatsapp pages
const PrivacyScreen        = lazy(() => import('./screens/PrivacyScreen.tsx'));
const DataDeletionScreen   = lazy(() => import('./screens/DataDeletionScreen.tsx'));

// Legacy Phase 2 disruption demo
const LegacyDisruptionApp = lazy(() => import('./legacy/LegacyDisruptionApp.tsx'));

function FullPageLoader() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
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
          <Route path="/"          element={<WelcomeScreen />} />
          <Route path="/build"     element={<TripBuilderScreen />} />
          <Route path="/review"    element={<ReviewJourneyScreen />} />
          <Route path="/home"      element={<HomeScreen />} />
          <Route path="/admin"     element={<AdminConsoleScreen />} />
          <Route path="/trip/:tripId" element={<TripViewScreen />} />
          <Route path="/app"       element={<LegacyDisruptionApp />} />
          <Route path="/privacy"   element={<PrivacyScreen />} />
          <Route path="/data-deletion" element={<DataDeletionScreen />} />
          {/* Catch-all → welcome */}
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
