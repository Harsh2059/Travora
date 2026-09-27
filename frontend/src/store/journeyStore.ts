/**
 * journeyStore.ts
 *
 * Persistence contract:
 *   sessionStorage['travora_draft']          — draft JourneyNode[] before creation
 *   localStorage['travora_active_trip_id']   — numeric backend trip ID after creation
 *
 * Backend is the source of truth once a journey is created.
 * localStorage never stores a full journey copy.
 *
 * If the backend is unreachable at creation time the journey is stored as
 * { syncStatus: 'local' } — it MUST NOT be consumed by the disruption/recovery
 * engine until synced. A 'local' journey is surfaced with a clear warning.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import type { Journey, JourneyNode } from '../types';
import { notifyTripUpdated, subscribeToTripUpdates } from './tripSync';

// Attach JWT bearer token to all outgoing axios requests if available
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('travora_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Config ────────────────────────────────────────────────────────────────────

/** Fixed demo user ID for Part 1. Replace with auth when authentication is added. */
export const DEMO_USER_ID = 1;

export const API_BASE_URL = (() => {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const renderUrl = 'https://travora-dqgn.onrender.com/api';
  if (!configured || configured === '') return renderUrl;
  // In a production build, never redirect to localhost
  if (import.meta.env.PROD && configured.includes('localhost')) return renderUrl;
  return configured;
})();
// ── Storage keys ──────────────────────────────────────────────────────────────

const DRAFT_KEY = 'travora_draft';
const ACTIVE_TRIP_ID_KEY = 'travora_active_trip_id';
const LOCAL_JOURNEY_KEY = 'travora_local_journey';

function currentUserStorageSuffix(): string | null {
  try {
    const rawUser = localStorage.getItem('travora_user');
    const userId = rawUser ? JSON.parse(rawUser)?.id : null;
    return userId ? String(userId) : null;
  } catch {
    return null;
  }
}

function userScopedStorageKey(baseKey: string): string | null {
  const userId = currentUserStorageSuffix();
  return userId ? `${baseKey}:${userId}` : null;
}

// ── Draft helpers (sessionStorage) ───────────────────────────────────────────

export function getDraftNodes(): JourneyNode[] {
  try {
    const key = userScopedStorageKey(DRAFT_KEY);
    const raw = key ? sessionStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraftNodes(nodes: JourneyNode[]): void {
  const key = userScopedStorageKey(DRAFT_KEY);
  if (key) sessionStorage.setItem(key, JSON.stringify(nodes));
}

export function clearDraft(): void {
  const key = userScopedStorageKey(DRAFT_KEY);
  if (key) sessionStorage.removeItem(key);
}

// ── Active trip ID helpers (localStorage) ────────────────────────────────────

export function getActiveTripId(): number | null {
  const key = userScopedStorageKey(ACTIVE_TRIP_ID_KEY);
  const rawScoped = key ? localStorage.getItem(key) : null;
  if (rawScoped) {
    const n = parseInt(rawScoped, 10);
    if (!isNaN(n)) return n;
  }
  const rawBase = localStorage.getItem(ACTIVE_TRIP_ID_KEY);
  if (rawBase) {
    const n = parseInt(rawBase, 10);
    if (!isNaN(n)) return n;
  }
  return null;
}

export function setActiveTripId(id: number): void {
  const key = userScopedStorageKey(ACTIVE_TRIP_ID_KEY);
  if (key) localStorage.setItem(key, String(id));
  localStorage.setItem(ACTIVE_TRIP_ID_KEY, String(id));
}

export function clearActiveTripId(): void {
  const key = userScopedStorageKey(ACTIVE_TRIP_ID_KEY);
  if (key) localStorage.removeItem(key);
  localStorage.removeItem(ACTIVE_TRIP_ID_KEY);
}

// ── Local (unsynced) journey helpers (localStorage) ──────────────────────────

export function getLocalJourney(): Journey | null {
  try {
    const key = userScopedStorageKey(LOCAL_JOURNEY_KEY);
    const raw = key ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalJourney(journey: Journey): void {
  const key = userScopedStorageKey(LOCAL_JOURNEY_KEY);
  if (key) localStorage.setItem(key, JSON.stringify(journey));
}

export function clearLocalJourney(): void {
  const key = userScopedStorageKey(LOCAL_JOURNEY_KEY);
  if (key) localStorage.removeItem(key);
}

// ── Selected Recovery Plan helpers (localStorage) ─────────────────────────────

const RECOVERY_PLAN_KEY_PREFIX = 'travora_selected_recovery_';

export function getSelectedRecoveryPlan(tripId: number): import('../types').Part4RecoveryPlan | null {
  try {
    const raw = localStorage.getItem(`${RECOVERY_PLAN_KEY_PREFIX}${tripId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.plan || data || null;
  } catch {
    return null;
  }
}

/**
 * Returns the stored selected recovery plan together with the disruption fingerprint
 * that was active when the user selected it. HomeScreen uses the fingerprint to detect
 * whether the disruption set has changed since the plan was chosen.
 */
export function getSelectedRecoveryPlanWithMeta(
  tripId: number
): { plan: import('../types').Part4RecoveryPlan; disruptionFingerprint: string; isUpdated: boolean } | null {
  try {
    const raw = localStorage.getItem(`${RECOVERY_PLAN_KEY_PREFIX}${tripId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const plan = data?.plan || data || null;
    if (!plan) return null;
    return {
      plan,
      disruptionFingerprint: data?.disruptionFingerprint ?? '',
      isUpdated: Boolean(data?.isUpdated),
    };
  } catch {
    return null;
  }
}

/**
 * Persists a selected recovery plan together with the disruption fingerprint it was
 * generated from and whether it was automatically updated as a successor plan.
 */
export function saveSelectedRecoveryPlan(
  tripId: number,
  plan: import('../types').Part4RecoveryPlan,
  disruptionFingerprint: string = '',
  isUpdated: boolean = false
): void {
  try {
    const payload = {
      selectedRecoveryPlanId: plan.id,
      tripId,
      selectedAt: new Date().toISOString(),
      disruptionFingerprint,
      isUpdated,
      plan,
    };
    localStorage.setItem(`${RECOVERY_PLAN_KEY_PREFIX}${tripId}`, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to save selected recovery plan:', err);
  }
}

export function clearSelectedRecoveryPlan(tripId: number): void {
  try {
    localStorage.removeItem(`${RECOVERY_PLAN_KEY_PREFIX}${tripId}`);
  } catch {
    // Ignore error
  }
}


// ── API helpers ───────────────────────────────────────────────────────────────

/** Convert a JourneyNode to the payload expected by POST /api/trips/{id}/items */
function nodeToItemPayload(node: JourneyNode) {
  const startTime = node.startTime
    ? node.startTime
    : node.startDate
      ? `${node.startDate}T00:00:00`
      : null;

  const endTime = node.endTime
    ? node.endTime
    : node.endDate
      ? `${node.endDate}T23:59:59`
      : node.startDate
        ? `${node.startDate}T23:59:59`
        : null;

  const isMetro = node.type === 'METRO' || node.type === 'metro' || node.transportMode === 'METRO';
  const backendType = isMetro ? 'TRAIN' : node.type;

  return {
    type: backendType,
    provider: node.title,
    origin: node.origin ?? null,
    destination: node.destination ?? null,
    location: node.location ?? null,
    start_time: startTime,
    end_time: endTime,
    booking_id: node.bookingRef ?? null,
    cost: 0,
    currency: 'INR',
    priority: node.priority ?? 'MUST_PRESERVE',
    flexibility: node.timeStatus === 'FIXED' ? 'FIXED' : 'FLEXIBLE',
    status: 'CONFIRMED',
    item_metadata: {
      ...(node.metadata ?? {}),
      startDate: node.startDate,
      endDate: node.endDate,
      timeStatus: node.timeStatus ?? (node.startTime ? 'FIXED' : 'UNKNOWN'),
      isTimeFlexible: node.isTimeFlexible ?? (node.timeStatus !== 'FIXED'),
      hasExactStartTime: Boolean(node.startTime),
      hasExactEndTime: Boolean(node.endTime),
      priority: node.priority ?? 'MUST_PRESERVE',
      transportMode: isMetro ? 'METRO' : (node.transportMode ?? null),
    },
  };
}

/**
 * Creates the trip on the backend and persists all draft nodes.
 * Returns the created Journey with backendId populated on each node.
 * Throws if backend is unreachable (caller handles 'local' fallback).
 */
export async function persistJourneyToBackend(
  title: string,
  nodes: JourneyNode[]
): Promise<Journey> {
  // 1. Create trip — use authenticated user if logged in, otherwise throw (user must be logged in)
  let currentUserId: string | null = null;
  try {
    const rawUser = localStorage.getItem('travora_user');
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed?.id) currentUserId = String(parsed.id);
    }
  } catch {}
  if (!currentUserId) throw new Error('You must be logged in to create a trip.');

  const tripRes = await axios.post(
    `${API_BASE_URL}/users/${currentUserId}/trips`,
    { title }
  );
  const tripId: number = tripRes.data.id;

  // 2. Add each item; populate backendId from returned id
  const persistedNodes: JourneyNode[] = [];
  for (const node of nodes) {
    const itemRes = await axios.post(
      `${API_BASE_URL}/trips/${tripId}/items`,
      nodeToItemPayload(node)
    );
    persistedNodes.push({
      ...node,
      backendId: itemRes.data.id, // always from API response, never guessed
    });
  }

  // 3. Record the active trip ID in localStorage
  setActiveTripId(tripId);
  clearDraft();

  notifyTripUpdated(tripId, 'persistJourneyToBackend');

  return {
    id: tripId,
    title,
    nodes: persistedNodes,
    syncStatus: 'saved',
  };
}

/**
 * Updates a single itinerary item on an existing backend trip.
 */
export async function updateItemOnBackend(
  tripId: number,
  backendItemId: number,
  node: JourneyNode
): Promise<JourneyNode> {
  const payload = nodeToItemPayload(node);
  const res = await axios.put(
    `${API_BASE_URL}/trips/${tripId}/items/${backendItemId}`,
    payload
  );
  notifyTripUpdated(tripId, 'updateItemOnBackend');
  return {
    ...node,
    backendId: res.data.id,
    id: String(res.data.id),
  };
}

/**
 * Deletes a single itinerary item from an existing backend trip.
 */
export async function deleteItemFromBackend(
  tripId: number,
  backendItemId: number
): Promise<void> {
  await axios.delete(`${API_BASE_URL}/trips/${tripId}/items/${backendItemId}`);
  notifyTripUpdated(tripId, 'deleteItemFromBackend');
}

/**
 * Adds a new itinerary item to an existing backend trip.
 */
export async function addItemToExistingTrip(
  tripId: number,
  node: JourneyNode
): Promise<JourneyNode> {
  const payload = nodeToItemPayload(node);
  const res = await axios.post(
    `${API_BASE_URL}/trips/${tripId}/items`,
    payload
  );
  notifyTripUpdated(tripId, 'addItemToExistingTrip');
  return {
    ...node,
    backendId: res.data.id,
    id: String(res.data.id),
  };
}

export async function fetchTripById(tripId: number, adminMode = false): Promise<Journey | null> {
  const url = adminMode
    ? `${API_BASE_URL}/trips/${tripId}?admin=true`
    : `${API_BASE_URL}/trips/${tripId}`;
  const res = await axios.get(url, { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } });
  const data = res.data;

  // Active items = active non-replaced, non-cancelled items returned from backend API
  const rawItems = (data.items && data.items.length > 0) ? data.items : (data.all_items ?? []);
  const rawOrigItems = (data.original_items && data.original_items.length > 0) ? data.original_items : rawItems;

  // Deduplicate items by booking_id or id
  const dedupMap = new Map<string, any>();
  for (const it of rawItems) {
    const key = it.booking_id ? `booking_${it.booking_id}` : `id_${it.id}`;
    if (!dedupMap.has(key)) dedupMap.set(key, it);
  }
  const deduplicatedItems = Array.from(dedupMap.values());

  const dedupOrigMap = new Map<string, any>();
  for (const it of rawOrigItems) {
    const key = it.booking_id ? `booking_${it.booking_id}` : `id_${it.id}`;
    if (!dedupOrigMap.has(key)) dedupOrigMap.set(key, it);
  }
  const deduplicatedOrigItems = Array.from(dedupOrigMap.values());

  // Determine primary travel date from transport legs (flight / train)
  let primaryTravelDate: string | undefined = undefined;
  for (const it of deduplicatedItems) {
    if (it.start_time && (it.type === 'FLIGHT' || it.type === 'TRAIN' || it.type === 'flight' || it.type === 'train')) {
      primaryTravelDate = String(it.start_time).split('T')[0];
      break;
    }
  }

  const mapItemToNode = (it: any): JourneyNode => {
    const meta = { ...(it.item_metadata ?? {}) };
    let startTimeIso = it.start_time;
    let endTimeIso = it.end_time;
    let startDateStr = meta.startDate ?? (it.start_time ? String(it.start_time).split('T')[0] : undefined);
    let endDateStr = meta.endDate ?? (it.end_time ? String(it.end_time).split('T')[0] : undefined);

    // If item is hotel/stay/cab and date is missing or earlier than primary travel date, align with primary travel date
    if (primaryTravelDate && (it.type === 'HOTEL' || it.type === 'hotel' || it.type === 'stay' || it.type === 'CAB' || it.type === 'cab')) {
      if (!startDateStr || startDateStr < primaryTravelDate) {
        startDateStr = primaryTravelDate;
        if (startTimeIso && String(startTimeIso).includes('T')) {
          startTimeIso = `${primaryTravelDate}T${String(startTimeIso).split('T')[1]}`;
        }
      }
    }

    const hasExactStart = meta.hasExactStartTime ?? (Boolean(startTimeIso) && !String(startTimeIso).endsWith('T00:00:00'));
    const hasExactEnd = meta.hasExactEndTime ?? (Boolean(endTimeIso) && !String(endTimeIso).endsWith('T23:59:59'));
    const isMetro = meta.transportMode === 'METRO' || (it.provider && it.provider.toLowerCase() === 'metro');

    return {
      id: String(it.id),
      backendId: it.id,
      type: isMetro ? 'METRO' : (it.type as JourneyNode['type']),
      title: it.provider || it.type,
      provider: it.provider || it.type,
      status: it.status || 'CONFIRMED',
      startTime: hasExactStart ? startTimeIso : undefined,
      endTime: hasExactEnd ? endTimeIso : undefined,
      startDate: startDateStr,
      endDate: endDateStr,
      timeStatus: meta.timeStatus ?? (hasExactStart ? 'FIXED' : 'UNKNOWN'),
      isTimeFlexible: meta.isTimeFlexible ?? (!hasExactStart),
      priority: meta.priority || (it.priority as any) || 'MUST_PRESERVE',
      transportMode: isMetro ? 'METRO' : meta.transportMode,
      origin: it.origin ?? undefined,
      destination: it.destination ?? undefined,
      location: it.location ?? undefined,
      bookingRef: it.booking_id ?? undefined,
      metadata: meta,
    };
  };

  const nodes: JourneyNode[] = deduplicatedItems.map(mapItemToNode);
  const originalNodes: JourneyNode[] = deduplicatedOrigItems.map(mapItemToNode);


  return {
    id: tripId,
    title: data.title,
    nodes,
    originalNodes,
    syncStatus: 'saved',
  } as Journey & { originalNodes?: JourneyNode[] };
}

export async function fetchUserTrips(
  userId?: string,
  adminMode = false
): Promise<Array<{ id: number; title: string; version: number }>> {
  let effectiveUserId: string | null = userId ?? null;
  if (!effectiveUserId) {
    try {
      const rawUser = localStorage.getItem('travora_user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.id) effectiveUserId = String(parsed.id);
      }
    } catch { }
  }

  // Only the admin console may enumerate every account's journeys. Traveler
  // screens must never use this endpoint as a fallback after an account switch.
  if (adminMode) {
    try {
      const adminRes = await axios.get(`${API_BASE_URL}/admin/trips`);
      if (Array.isArray(adminRes.data)) return adminRes.data;
    } catch {}
  }

  // 2. Fallback to user trips endpoint
  let trips: Array<{ id: number; title: string; version: number }> = [];
  if (effectiveUserId) {
    try {
      const res = await axios.get(`${API_BASE_URL}/users/${effectiveUserId}/trips`);
      if (Array.isArray(res.data)) trips = res.data;
    } catch {}
  }

  // 3. Include only the current user's scoped active trip ID.
  const activeId = getActiveTripId();
  if (activeId && !trips.some((t) => t.id === activeId)) {
    try {
      const activeTrip = await fetchTripById(activeId);
      if (activeTrip && activeTrip.id !== undefined) {
        trips.unshift({
          id: activeTrip.id,
          title: `#${activeTrip.id} · ${activeTrip.title}`,
          version: 1,
        });
      }
    } catch {}
  }

  return trips;
}

export async function triggerTripDisruption(tripId: number, payload: Record<string, any>, adminMode = false) {
  const url = adminMode
    ? `${API_BASE_URL}/trips/${tripId}/disruptions?admin=true`
    : `${API_BASE_URL}/trips/${tripId}/disruptions`;
  const res = await axios.post(url, payload);
  notifyTripUpdated(tripId, 'triggerTripDisruption');
  return res.data;
}

export async function fetchTripDisruptions(tripId: number) {
  const res = await axios.get(`${API_BASE_URL}/trips/${tripId}/disruptions`);
  return res.data ?? [];
}

export async function resetTripDisruptions(tripId: number) {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/disruptions/reset`);
  notifyTripUpdated(tripId, 'resetTripDisruptions');
  return res.data;
}

export async function resetIndividualDisruption(tripId: number, disruptionId: number) {
  const res = await axios.delete(`${API_BASE_URL}/trips/${tripId}/disruptions/${disruptionId}`);
  notifyTripUpdated(tripId, 'resetIndividualDisruption');
  return res.data;
}

export async function resetAllSimulations() {
  const res = await axios.post(`${API_BASE_URL}/disruptions/reset-all`);
  // Dispatch for the currently active trip if there is one
  const activeId = getActiveTripId();
  if (activeId) notifyTripUpdated(activeId, 'resetAllSimulations');
  return res.data;
}

export async function fetchTripImpact(tripId: number) {
  const res = await axios.get(`${API_BASE_URL}/trips/${tripId}/impact`);
  return res.data;
}

export async function analyzeTripImpact(tripId: number, disruptionId?: any) {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/impact/analyze`, { disruption_id: disruptionId });
  return res.data;
}

/**
 * Fetches the active journey from the backend.
 * Returns null if there is no active trip ID stored.
 */
export async function fetchActiveJourney(): Promise<Journey | null> {
  const tripId = getActiveTripId();
  if (!tripId) return null;
  return fetchTripById(tripId);
}

export function getBaselineDemoNodes(): JourneyNode[] {
  return [
    {
      id: 'demo_fl_701',
      type: 'flight',
      title: 'Air India Express AI-441',
      provider: 'Air India Express',
      origin: 'Mumbai Airport (BOM)',
      destination: 'Jaipur Airport (JAI)',
      location: 'Mumbai Airport (BOM)',
      startTime: '2026-09-28T08:45:00',
      endTime: '2026-09-28T10:35:00',
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      timeStatus: 'FIXED',
      isTimeFlexible: false,
      priority: 'MUST_PRESERVE',
      bookingRef: 'AIX-441-BOM',
    },
    {
      id: 'demo_tr_702',
      type: 'cab',
      title: 'Uber Ground Transport',
      provider: 'Uber',
      origin: 'Jaipur Airport (JAI)',
      destination: 'Hotel Ram Jaipur',
      location: 'Jaipur Airport (JAI)',
      startTime: '2026-09-28T11:15:00',
      endTime: '2026-09-28T12:00:00',
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      timeStatus: 'FLEXIBLE',
      isTimeFlexible: true,
      priority: 'PREFER_TO_PRESERVE',
      bookingRef: 'UBER-JAI-77',
    },
    {
      id: 'demo_ht_703',
      type: 'hotel',
      title: 'Hotel Ram Jaipur',
      provider: 'Hotel Ram',
      location: 'Jaipur City',
      origin: 'Hotel Ram Jaipur',
      destination: 'Hotel Ram Jaipur',
      startTime: '2026-09-28T14:00:00',
      endTime: '2026-09-30T11:00:00',
      startDate: '2026-09-28',
      endDate: '2026-09-30',
      timeStatus: 'FIXED',
      isTimeFlexible: false,
      priority: 'MUST_PRESERVE',
      bookingRef: 'HTL-RAM-JAI',
    },
  ];
}

export function getBaselineDemoJourney(): Journey {
  return {
    id: 7,
    title: 'Mumbai to Jaipur Express Journey (Trip #7)',
    nodes: getBaselineDemoNodes(),
    syncStatus: 'saved',
  };
}

// ── useJourney hook ───────────────────────────────────────────────────────────

let globalCachedJourney: Journey | null = null;
const journeySubscribers = new Set<(j: Journey | null) => void>();

function updateGlobalJourney(j: Journey | null): void {
  globalCachedJourney = j;
  journeySubscribers.forEach((subscriber) => subscriber(j));
}

export interface JourneyState {
  journey: Journey | null;
  loading: boolean;
  error: string | null;
  /** Reload the journey from backend */
  refresh: () => Promise<void>;
  /** Clear active trip (go back to empty state) */
  clearActive: () => void;
}

export function useJourney(): JourneyState {
  const [journey, setJourney] = useState<Journey | null>(globalCachedJourney);
  const [loading, setLoading] = useState<boolean>(!globalCachedJourney);
  const [error, setError] = useState<string | null>(null);
  // A slow earlier request must never overwrite a newer recovery refresh.
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const subscriber = (j: Journey | null) => {
      setJourney(j);
    };
    journeySubscribers.add(subscriber);
    return () => {
      journeySubscribers.delete(subscriber);
    };
  }, []);

  const load = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    if (!globalCachedJourney) setLoading(true);
    setError(null);

    // 1. Try fetching from backend first
    try {
      const userTrips = await fetchUserTrips();
      let targetId = getActiveTripId();

      if (userTrips && userTrips.length > 0) {
        if (!targetId || !userTrips.some((t) => t.id === targetId)) {
          targetId = userTrips[userTrips.length - 1].id;
        }
      }

      const fetchId = targetId || 1;
      const j = await fetchTripById(fetchId);
      if (j && j.nodes && j.nodes.length > 0) {
        if (requestId !== latestRequestRef.current) return;
        if (j.id !== undefined) setActiveTripId(j.id);
        clearLocalJourney(); // Clear unsynced local cache when backend trip exists
        updateGlobalJourney(j);
        setLoading(false);
        return;
      }
    } catch {
      // Backend unreachable — fall through to local fallback
    }

    // 2. Check local unsynced journey
    const local = getLocalJourney();
    if (local && local.nodes && local.nodes.length > 0) {
      if (requestId !== latestRequestRef.current) return;
      updateGlobalJourney(local);
      setLoading(false);
      return;
    }

    // 3. Fallback to active trip #1
    try {
      const fallbackTrip = await fetchTripById(1);
      if (fallbackTrip && fallbackTrip.nodes && fallbackTrip.nodes.length > 0) {
        if (requestId !== latestRequestRef.current) return;
        if (fallbackTrip.id !== undefined) setActiveTripId(fallbackTrip.id);
        updateGlobalJourney(fallbackTrip);
        setLoading(false);
        return;
      }
    } catch {}

    // 4. If no backend trip or local draft exists, set journey to null (empty state)
    if (requestId === latestRequestRef.current) {
      updateGlobalJourney(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // Authentication changes replace the account scope. Clear the prior account's
  // journey synchronously and load only the new account's trips.
  useEffect(() => {
    const handleAuthChange = () => {
      updateGlobalJourney(null);
      void load().finally(() => setLoading(false));
    };
    window.addEventListener('travora_auth_change', handleAuthChange);
    return () => window.removeEventListener('travora_auth_change', handleAuthChange);
  }, [load]);

  const refresh = useCallback(async () => {
    const tripId = journey?.id ?? globalCachedJourney?.id ?? getActiveTripId();
    if (!tripId) {
      updateGlobalJourney(null);
      setLoading(false);
      return;
    }

    const requestId = ++latestRequestRef.current;
    try {
      // Refresh the exact trip being displayed, rather than whichever trip happens
      // to be stored as active when the recovery response arrives.
      const j = await fetchTripById(tripId);
      if (requestId === latestRequestRef.current) {
        updateGlobalJourney(j);
        setError(null);
      }
    } catch {
      if (requestId === latestRequestRef.current) setError('fetch_failed');
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [journey?.id]);

  // Subscribe to canonical trip mutations (including a completed recovery).
  useEffect(() => {
    const activeId = journey?.id ?? globalCachedJourney?.id;
    if (activeId) {
      const unsubscribe = subscribeToTripUpdates(activeId, () => {
        void refresh();
      });
      return unsubscribe;
    }
  }, [journey?.id, refresh]);

  const clearActive = useCallback(() => {
    clearActiveTripId();
    clearLocalJourney();
    clearDraft(); // also wipe sessionStorage draft so next builder session starts fresh
    updateGlobalJourney(null);
  }, []);

  return { journey, loading, error, refresh, clearActive };
}
