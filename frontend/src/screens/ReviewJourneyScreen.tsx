import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
  PlusCircle,
} from 'lucide-react';
import {
  getDraftNodes,
  persistJourneyToBackend,
  saveLocalJourney,
  clearDraft,
} from '../store/journeyStore';
import { Part1JourneyView } from '../components/Part1JourneyView';
import type { JourneyNode, Journey } from '../types';

export default function ReviewJourneyScreen() {
  const navigate = useNavigate();
  const [draftNodes] = useState<JourneyNode[]>(() => getDraftNodes());
  const [tripTitle, setTripTitle] = useState('My Travora Journey');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (draftNodes.length === 0) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
        <div className="h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">No draft journey found</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">
          You haven't added any journey legs yet. Return to the builder to map your route.
        </p>
        <button
          onClick={() => navigate('/build')}
          className="mt-6 px-5 py-2.5 rounded-xl bg-sky-500 text-white font-semibold text-sm hover:bg-sky-600 transition-colors shadow-md shadow-sky-500/20"
        >
          Go to Journey Builder
        </button>
      </div>
    );
  }

  // Preview Journey object
  const previewJourney: Journey = {
    title: tripTitle || 'Untitled Journey',
    nodes: draftNodes,
    syncStatus: 'draft',
  };

  const handleConfirmAndCreate = async () => {
    if (!tripTitle.trim()) {
      setErrorMsg('Please enter a journey title');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      await persistJourneyToBackend(
        tripTitle.trim(),
        draftNodes
      );
      navigate('/home');
    } catch (err: any) {
      console.warn('Backend unavailable, storing journey locally:', err);
      const localJourney: Journey = {
        title: tripTitle.trim(),
        nodes: draftNodes.map((n) => ({ ...n, syncStatus: 'local' })),
        syncStatus: 'local',
      };
      saveLocalJourney(localJourney);
      clearDraft();
      navigate('/home');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 pb-28">
      {/* Floating Header */}
      <header className="px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/build')}
            className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Builder</span>
          </button>

          <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-sky-500" />
            <span>Review Your Journey</span>
          </h1>

          <div className="w-16" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {/* Journey Title Box */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/30 space-y-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-600">
            <Sparkles className="h-4 w-4" />
            <span>Name Your Journey</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Trip Name *
            </label>
            <input
              type="text"
              value={tripTitle}
              onChange={(e) => setTripTitle(e.target.value)}
              placeholder="e.g. Mumbai → Delhi Escape"
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-base font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-500">{errorMsg}</p>
          )}
        </div>

        {/* HERO HORIZONTAL ROUTE RAIL PREVIEW */}
        <Part1JourneyView journey={previewJourney} />
      </main>

      {/* STICKY BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/build')}
            className="px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 font-semibold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="h-4 w-4 text-sky-500" />
            <span>+ Add to journey</span>
          </button>

          <button
            onClick={handleConfirmAndCreate}
            disabled={isSaving}
            className="px-8 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center gap-2 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Creating journey...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                <span>Create my journey</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
