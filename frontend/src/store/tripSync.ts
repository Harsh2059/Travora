/**
 * tripSync.ts
 *
 * Synchronization utilities for unifying state across Traveler UI and Admin Panel
 * without requiring hard page reloads.
 */

export type ViewMode = 'ORIGINAL' | 'RECOVERED';

/**
 * Notifies all consumers (current tab and cross-tab) that a trip's canonical
 * data has been mutated (e.g. recovery, disruption, journey edited).
 */
export function notifyTripUpdated(tripId: number, source: string): void {
  const payload = {
    tripId,
    updatedAt: Date.now(),
    source,
  };
  const payloadStr = JSON.stringify(payload);
  
  // 1. Update localStorage for cross-tab synchronization
  localStorage.setItem('travora_trip_updated', payloadStr);
  
  // 2. Dispatch a CustomEvent for the current tab
  window.dispatchEvent(
    new CustomEvent('travora_trip_updated', {
      detail: payload,
    })
  );
}

/**
 * Subscribes to canonical data mutations for a specific tripId.
 * Calls the provided callback when a mutation occurs.
 * Returns an unsubscribe function.
 */
export function subscribeToTripUpdates(tripId: number | null, callback: () => void): () => void {
  if (!tripId) return () => {};

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail?.tripId === tripId) {
      callback();
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'travora_trip_updated' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.tripId === tripId) {
          callback();
        }
      } catch (err) {
        console.error('Failed to parse travora_trip_updated payload', err);
      }
    }
  };

  window.addEventListener('travora_trip_updated', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('travora_trip_updated', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

/**
 * Notifies all consumers that the global view mode (Original vs Recovered)
 * has changed for a given trip.
 */
export function notifyViewModeChanged(tripId: number, viewMode: ViewMode): void {
  const payload = {
    tripId,
    viewMode,
    updatedAt: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  
  // 1. Persist the view mode per trip
  localStorage.setItem(`travora_view_mode_${tripId}`, payloadStr);
  
  // 2. Dispatch CustomEvent for the current tab
  window.dispatchEvent(
    new CustomEvent('travora_view_mode_changed', {
      detail: payload,
    })
  );
}

/**
 * Retrieves the persisted global view mode for a given trip.
 * Defaults to 'RECOVERED' if none is stored.
 */
export function getPersistedViewMode(tripId: number | null): ViewMode {
  if (!tripId) return 'RECOVERED';
  try {
    const raw = localStorage.getItem(`travora_view_mode_${tripId}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (data.viewMode === 'ORIGINAL' || data.viewMode === 'RECOVERED') {
        return data.viewMode as ViewMode;
      }
    }
  } catch (err) {
    // Ignore parse errors
  }
  return 'RECOVERED';
}

/**
 * Subscribes to global view mode changes for a specific tripId.
 * Calls the provided callback when the view mode is toggled.
 * Returns an unsubscribe function.
 */
export function subscribeToViewMode(tripId: number | null, callback: (mode: ViewMode) => void): () => void {
  if (!tripId) return () => {};

  const handleCustomEvent = (e: Event) => {
    const customEvent = e as CustomEvent;
    if (customEvent.detail?.tripId === tripId && customEvent.detail?.viewMode) {
      callback(customEvent.detail.viewMode as ViewMode);
    }
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === `travora_view_mode_${tripId}` && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (data.tripId === tripId && data.viewMode) {
          callback(data.viewMode as ViewMode);
        }
      } catch (err) {
        console.error(`Failed to parse travora_view_mode_${tripId} payload`, err);
      }
    }
  };

  window.addEventListener('travora_view_mode_changed', handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('travora_view_mode_changed', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}
