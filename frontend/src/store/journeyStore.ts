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

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import type { Journey, JourneyNode } from '../types';

// ── Config ────────────────────────────────────────────────────────────────────

/** Fixed demo user ID for Part 1. Replace with auth when authentication is added. */
export const DEMO_USER_ID = 1;

export const API_BASE_URL = import.meta.env.PROD
  ? '/api'
  : 'http://localhost:8000/api';

// ── Storage keys ──────────────────────────────────────────────────────────────

const DRAFT_KEY = 'travora_draft';
const ACTIVE_TRIP_ID_KEY = 'travora_active_trip_id';
const LOCAL_JOURNEY_KEY = 'travora_local_journey';

// ── Draft helpers (sessionStorage) ───────────────────────────────────────────

export function getDraftNodes(): JourneyNode[] {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDraftNodes(nodes: JourneyNode[]): void {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(nodes));
}

export function clearDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

// ── Active trip ID helpers (localStorage) ────────────────────────────────────

export function getActiveTripId(): number | null {
  const raw = localStorage.getItem(ACTIVE_TRIP_ID_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export function setActiveTripId(id: number): void {
  localStorage.setItem(ACTIVE_TRIP_ID_KEY, String(id));
}

export function clearActiveTripId(): void {
  localStorage.removeItem(ACTIVE_TRIP_ID_KEY);
}

// ── Local (unsynced) journey helpers (localStorage) ──────────────────────────

export function getLocalJourney(): Journey | null {
  try {
    const raw = localStorage.getItem(LOCAL_JOURNEY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveLocalJourney(journey: Journey): void {
  localStorage.setItem(LOCAL_JOURNEY_KEY, JSON.stringify(journey));
}

export function clearLocalJourney(): void {
  localStorage.removeItem(LOCAL_JOURNEY_KEY);
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
  // 1. Create trip — use DEMO_USER_ID as the single source for user identity
  const tripRes = await axios.post(
    `${API_BASE_URL}/users/${DEMO_USER_ID}/trips`,
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
  return {
    ...node,
    backendId: res.data.id,
    id: String(res.data.id),
  };
}

export async function fetchTripById(tripId: number): Promise<Journey | null> {
  const res = await axios.get(`${API_BASE_URL}/trips/${tripId}`);
  const data = res.data;

  const nodes: JourneyNode[] = (data.items ?? []).map((it: any) => {
    const meta = it.item_metadata ?? {};
    const hasExactStart = meta.hasExactStartTime ?? (Boolean(it.start_time) && !it.start_time.endsWith('T00:00:00'));
    const hasExactEnd = meta.hasExactEndTime ?? (Boolean(it.end_time) && !it.end_time.endsWith('T23:59:59'));
    const isMetro = meta.transportMode === 'METRO' || (it.provider && it.provider.toLowerCase() === 'metro');

    return {
      id: String(it.id),
      backendId: it.id,
      type: isMetro ? 'METRO' : (it.type as JourneyNode['type']),
      title: it.provider,
      startTime: hasExactStart ? it.start_time : undefined,
      endTime: hasExactEnd ? it.end_time : undefined,
      startDate: meta.startDate ?? (it.start_time ? it.start_time.split('T')[0] : undefined),
      endDate: meta.endDate ?? (it.end_time ? it.end_time.split('T')[0] : undefined),
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
  });

  return {
    id: tripId,
    title: data.title,
    nodes,
    syncStatus: 'saved',
  };
}

export async function fetchUserTrips(userId = DEMO_USER_ID): Promise<Array<{ id: number; title: string; version: number }>> {
  const res = await axios.get(`${API_BASE_URL}/users/${userId}/trips`);
  return res.data ?? [];
}

export async function triggerTripDisruption(tripId: number, payload: Record<string, any>) {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/disruptions`, payload);
  try {
    localStorage.setItem('travora_disruption_event_updated', String(Date.now()));
    window.dispatchEvent(new Event('storage'));
  } catch {}
  return res.data;
}

export async function fetchTripDisruptions(tripId: number) {
  const res = await axios.get(`${API_BASE_URL}/trips/${tripId}/disruptions`);
  return res.data ?? [];
}

export async function resetTripDisruptions(tripId: number) {
  const res = await axios.post(`${API_BASE_URL}/trips/${tripId}/disruptions/reset`);
  try {
    localStorage.setItem('travora_disruption_event_updated', String(Date.now()));
    window.dispatchEvent(new Event('storage'));
  } catch {}
  return res.data;
}

export async function resetIndividualDisruption(tripId: number, disruptionId: number) {
  const res = await axios.delete(`${API_BASE_URL}/trips/${tripId}/disruptions/${disruptionId}`);
  try {
    localStorage.setItem('travora_disruption_event_updated', String(Date.now()));
    window.dispatchEvent(new Event('storage'));
  } catch {}
  return res.data;
}

export async function resetAllSimulations() {
  const res = await axios.post(`${API_BASE_URL}/disruptions/reset-all`);
  try {
    localStorage.setItem('travora_disruption_event_updated', String(Date.now()));
    window.dispatchEvent(new Event('storage'));
  } catch {}
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

// ── useJourney hook ───────────────────────────────────────────────────────────

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
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // 1. Check if there is an active backend trip
    const tripId = getActiveTripId();
    if (tripId) {
      try {
        const j = await fetchActiveJourney();
        setJourney(j);
        return;
      } catch {
        // Backend unreachable — fall through to check local fallback
      }
    }

    // 2. No backend trip or backend down — check local unsynced journey
    const local = getLocalJourney();
    if (local) {
      setJourney(local);
      setError('not_synced'); // signals HomeScreen to show the unsynced banner
      return;
    }

    // 3. No journey at all
    setJourney(null);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const j = await fetchActiveJourney();
      setJourney(j);
      setError(null);
    } catch {
      setError('fetch_failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearActive = useCallback(() => {
    clearActiveTripId();
    clearLocalJourney();
    setJourney(null);
  }, []);

  return { journey, loading, error, refresh, clearActive };
}
