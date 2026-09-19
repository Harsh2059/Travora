import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../store/journeyStore';
import { Part1JourneyView } from '../components/Part1JourneyView';
import type { Journey, JourneyNode } from '../types';

export default function TripViewScreen() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();

  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      setError('Invalid trip ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    axios
      .get(`${API_BASE_URL}/trips/${tripId}`)
      .then((res) => {
        const data = res.data;
        const nodes: JourneyNode[] = (data.items ?? []).map((it: any) => {
          const meta = it.item_metadata ?? {};
          const hasExactStart = meta.hasExactStartTime ?? (Boolean(it.start_time) && !it.start_time.endsWith('T00:00:00'));
          const hasExactEnd = meta.hasExactEndTime ?? (Boolean(it.end_time) && !it.end_time.endsWith('T23:59:59'));

          return {
            id: String(it.id),
            backendId: it.id,
            type: it.type as JourneyNode['type'],
            title: it.provider,
            startTime: hasExactStart ? it.start_time : undefined,
            endTime: hasExactEnd ? it.end_time : undefined,
            startDate: meta.startDate ?? (it.start_time ? it.start_time.split('T')[0] : undefined),
            endDate: meta.endDate ?? (it.end_time ? it.end_time.split('T')[0] : undefined),
            timeStatus: meta.timeStatus ?? (hasExactStart ? 'FIXED' : 'UNKNOWN'),
            isTimeFlexible: meta.isTimeFlexible ?? (!hasExactStart),
            origin: it.origin ?? undefined,
            destination: it.destination ?? undefined,
            location: it.location ?? undefined,
            bookingRef: it.booking_id ?? undefined,
            metadata: meta,
          };
        });

        nodes.sort((a, b) => {
          const timeA = a.startTime ? new Date(a.startTime).getTime() : a.startDate ? new Date(a.startDate).getTime() : 0;
          const timeB = b.startTime ? new Date(b.startTime).getTime() : b.startDate ? new Date(b.startDate).getTime() : 0;
          return timeA - timeB;
        });

        setJourney({
          id: data.id,
          title: data.title,
          nodes,
          syncStatus: 'saved',
        });
      })
      .catch((err) => {
        console.error('Failed to fetch trip:', err);
        setError('Trip not found or backend server unavailable');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tripId]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/home')}
            className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>

          <h1 className="text-base font-bold text-slate-900 dark:text-white">
            Trip #{tripId}
          </h1>

          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center my-20">
            <Loader2 className="h-8 w-8 text-sky-500 animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading trip details...</p>
          </div>
        ) : error || !journey ? (
          <div className="max-w-md mx-auto my-16 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 text-center">
            <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Unable to Load Trip</h2>
            <p className="text-xs text-slate-500 mt-1">{error}</p>
            <button
              onClick={() => navigate('/home')}
              className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
            >
              Return Home
            </button>
          </div>
        ) : (
          <Part1JourneyView journey={journey} />
        )}
      </main>
    </div>
  );
}
