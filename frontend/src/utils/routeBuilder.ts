/**
 * routeBuilder.ts
 *
 * Converts a flat list of JourneyNode items into an intermediate
 * JourneyRoute model that the UI can render.
 *
 * DESIGN PRINCIPLES
 * -----------------
 * • Completely data-driven. No city names, item titles, or journey
 *   sequences are hard-coded anywhere in this file.
 * • Relationships are derived solely from the item fields:
 *     - origin + destination  → transport segment (A → B)
 *     - location              → item anchored at a location
 * • Array position is NEVER used to infer geographic relationships.
 * • Disconnected items (no geographic info, or referencing an unknown
 *   location) are surfaced explicitly rather than silently attached.
 *
 * FUTURE PROOFING
 * ---------------
 * RouteSegment.item is a single JourneyNode today.
 * Part 3 can replace/extend it with a JourneyEdge that carries
 * dependency metadata (minimumBuffer, dependencyType, etc.).
 * The renderer (Part1JourneyView) only consumes JourneyRoute and
 * will not need to change when that edge model is introduced.
 */

import type { JourneyNode } from '../types';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A geographic location that appears as a horizontal dot on the route map. */
export interface RouteLocation {
  /** Stable identity key (normalized). Used for segment references. */
  readonly id: string;
  /** Display label derived from the raw data string. */
  readonly label: string;
  /**
   * Position in the ordered chain (0-based).
   * Determined from transport connectivity, NOT array index.
   */
  order: number;
  /** Items whose `location` field matches this location (hotels, activities). */
  attachedItems: JourneyNode[];
}

/** A transport leg that connects two RouteLocations. */
export interface RouteSegment {
  readonly id: string;
  readonly fromLocationId: string;
  readonly toLocationId: string;
  /** The JourneyNode that represents this transport leg. */
  readonly item: JourneyNode;
}

/**
 * A location that contains items but is NOT connected to the main
 * transport chain. Rendered separately so the UI never invents connections.
 */
export interface UnconnectedLocation {
  readonly id: string;
  readonly label: string;
  attachedItems: JourneyNode[];
}

/** An item that could not be placed anywhere because it lacks geographic data. */
export interface UnplacedItem {
  readonly item: JourneyNode;
  /** Raw string from the data that did not match any known location. */
  readonly rawLocation?: string;
}

/**
 * The complete intermediate route model.
 * The UI is a pure renderer of this structure.
 */
export interface JourneyRoute {
  /** Ordered chain of connected geographic locations. */
  readonly locations: RouteLocation[];
  /** Transport segments connecting the locations. */
  readonly segments: RouteSegment[];
  /**
   * Locations that have items but are not reachable via the transport
   * chain.  Rendered as isolated nodes with their attached items.
   */
  readonly unconnected: UnconnectedLocation[];
  /** Items that had no usable geographic information at all. */
  readonly unplaced: UnplacedItem[];
}

// ─── Location-type classification ─────────────────────────────────────────────

/**
 * Returns true when a JourneyNode represents a TRANSPORT item
 * (i.e., it has both an origin and a destination and therefore
 * creates a directed segment between two locations).
 *
 * Items classified as transport:
 *   FLIGHT, TRAIN, CAB, TAXI, BUS, FERRY, and any unknown type that
 *   carries both origin and destination.
 *
 * Items NOT classified as transport (they carry a `location`, not
 * a directed pair):
 *   HOTEL, ACTIVITY, TICKET, EVENT, STAY, ACCOMMODATION.
 */
const LOCATION_BASED_TYPES = new Set([
  'hotel', 'activity', 'ticket', 'event', 'stay', 'accommodation',
]);

export function isInactiveNode(node: JourneyNode): boolean {
  return node.status === 'REPLACED' || node.status === 'CANCELLED' || node.status === 'RESTORED_DEMO';
}

function isTransport(node: JourneyNode): boolean {
  if (isInactiveNode(node)) return false;
  const t = node.type.toLowerCase();
  // If the type is explicitly in the location-based set, it is NOT transport.
  if (LOCATION_BASED_TYPES.has(t)) return false;
  // Otherwise it is treated as transport IF it has at least an origin.
  return Boolean(node.origin);
}

function isLocationBased(node: JourneyNode): boolean {
  if (isInactiveNode(node)) return false;
  const t = node.type.toLowerCase();
  // Explicitly categorised types.
  if (LOCATION_BASED_TYPES.has(t)) return true;
  // A node that has a location but no transport origin is treated as anchored.
  return Boolean(node.location) && !node.origin;
}

// ─── Location normalisation & resolution ──────────────────────────────────────

/**
 * Extract 2-4 letter uppercase IATA / Station code (e.g. BOM, DEL, NDLS).
 */
export function extractLocationCode(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const parenMatch = trimmed.match(/\(([A-Z0-9]{2,4})\)/i);
  if (parenMatch) {
    return parenMatch[1].toUpperCase();
  }
  if (/^[A-Z0-9]{3,4}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return null;
}

/**
 * Extract base location text by stripping parenthesized codes.
 */
export function extractBaseText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\([A-Z0-9]{2,4}\)/gi, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Strip common geographic qualifiers (airport, station, city, etc.) to get root city/location name.
 */
/**
 * Known airport and station code to city root mappings.
 */
const KNOWN_CODE_CITIES: Record<string, string> = {
  BOM: 'mumbai',
  DEL: 'delhi',
  NDLS: 'delhi',
  BLR: 'bangalore',
  MAA: 'chennai',
  CCU: 'kolkata',
  HYD: 'hyderabad',
  GOI: 'goa',
  SXR: 'srinagar',
  JAI: 'jaipur',
  ATQ: 'amritsar',
  IXC: 'chandigarh',
  PNQ: 'pune',
  AMD: 'ahmedabad',
  COK: 'kochi',
  TRV: 'trivandrum',
  LHR: 'london',
  LGW: 'london',
  STN: 'london',
  LCY: 'london city',
  JFK: 'new york',
  EWR: 'new york',
  LGA: 'new york',
  CDG: 'paris',
  DXB: 'dubai',
  SIN: 'singapore',
};

function extractRootLocation(raw: string): string {
  const code = extractLocationCode(raw);
  if (code && KNOWN_CODE_CITIES[code]) {
    return KNOWN_CODE_CITIES[code];
  }
  const base = extractBaseText(raw);
  if (!base) return '';
  return base
    .replace(/\b(international|domestic)\b/g, '')
    .replace(/\b(airport|railway station|station|terminal|city|central)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeRaw(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Single source of truth location resolver.
 * Maps location strings (with variations in formatting, codes, aliases)
 * to stable canonical location keys and human-readable display labels.
 */
export class LocationResolver {
  private rawToKey = new Map<string, string>();
  private keyToLabel = new Map<string, string>();

  constructor(nodes: JourneyNode[]) {
    // Only analyze active nodes to determine connectivity and location equivalence
    const activeNodes = nodes.filter((n) => !isInactiveNode(n));

    // Track direct transport legs to ensure genuinely connected different locations are never merged
    const directLegs = new Set<string>();
    for (const n of activeNodes) {
      if (isTransport(n) && n.origin && n.destination) {
        const oNorm = normalizeRaw(n.origin);
        const dNorm = normalizeRaw(n.destination);
        if (oNorm !== dNorm) {
          directLegs.add(`${oNorm}::${dNorm}`);
          directLegs.add(`${dNorm}::${oNorm}`);
        }
      }
    }

    // Collect all raw locations present across active nodes
    const rawLocations = new Set<string>();
    for (const n of activeNodes) {
      if (n.origin) rawLocations.add(n.origin);
      if (n.destination) rawLocations.add(n.destination);
      if (n.location) rawLocations.add(n.location);
    }

    const codeToKey = new Map<string, string>();
    const rootToKey = new Map<string, string>();

    // Step 1: Assign keys based on explicit IATA / station codes first
    for (const raw of rawLocations) {
      const code = extractLocationCode(raw);
      const norm = normalizeRaw(raw);
      if (code) {
        const key = `code_${code}`;
        codeToKey.set(code, key);
        this.rawToKey.set(norm, key);
        const root = extractRootLocation(raw);
        if (root) rootToKey.set(root, key);
      }
    }

    // Step 2: Assign remaining raw locations matching existing codes or roots
    for (const raw of rawLocations) {
      const norm = normalizeRaw(raw);
      if (this.rawToKey.has(norm)) continue;

      const code = extractLocationCode(raw);
      const root = extractRootLocation(raw);

      let key: string | null = null;
      if (code && codeToKey.has(code)) {
        key = codeToKey.get(code)!;
      } else if (root && rootToKey.has(root)) {
        const candidateKey = rootToKey.get(root)!;
        // Safety check: ensure no direct transport leg exists between this raw location and any location in candidateKey
        let canMerge = true;
        for (const [existingNorm, existingKey] of this.rawToKey.entries()) {
          if (existingKey === candidateKey && directLegs.has(`${norm}::${existingNorm}`)) {
            canMerge = false;
            break;
          }
        }
        if (canMerge) key = candidateKey;
      }

      if (!key) {
        key = code ? `code_${code}` : `loc_${root || norm}`;
        if (root) rootToKey.set(root, key);
      }

      this.rawToKey.set(norm, key);
    }

    // Step 3: Determine optimal display label for each location key
    const keyToRaws = new Map<string, string[]>();
    for (const raw of rawLocations) {
      const norm = normalizeRaw(raw);
      const key = this.rawToKey.get(norm) || norm;
      if (!keyToRaws.has(key)) keyToRaws.set(key, []);
      keyToRaws.get(key)!.push(raw);
    }

    for (const [key, raws] of keyToRaws.entries()) {
      let bestLabel = raws[0];
      let bestScore = -1000;

      for (const r of raws) {
        const trimmed = r.trim();
        const hasParen = /\([A-Z0-9]{2,4}\)/i.test(trimmed);
        const isBareCode = /^[A-Z0-9]{3,4}$/.test(trimmed);
        let score = trimmed.length;

        if (isBareCode) score -= 100;
        else if (hasParen) score -= 15;

        if (score > bestScore) {
          bestScore = score;
          bestLabel = trimmed.replace(/\([A-Z0-9]{2,4}\)/gi, '').trim() || trimmed;
        }
      }

      this.keyToLabel.set(key, toDisplayLabel(bestLabel));
    }
  }

  public getKey(raw: string | undefined | null): string {
    if (!raw || !raw.trim()) return 'unspecified';
    const norm = normalizeRaw(raw);
    if (this.rawToKey.has(norm)) return this.rawToKey.get(norm)!;

    // Fallback resolution for raw strings not in initial constructor list
    const code = extractLocationCode(raw);
    if (code) return `code_${code}`;
    const root = extractRootLocation(raw);
    return `loc_${root || norm}`;
  }

  public getLabel(key: string): string {
    return this.keyToLabel.get(key) || toDisplayLabel(key.replace(/^(code_|loc_|raw_)/, ''));
  }
}

/**
 * Produces a stable, normalized lookup key for a raw location string.
 */
export function normalizeLocation(raw: string): string {
  if (!raw) return '';
  const code = extractLocationCode(raw);
  if (code) return `code_${code}`;
  const root = extractRootLocation(raw);
  return `loc_${root || normalizeRaw(raw)}`;
}

/**
 * Produce a human-readable display label from a raw location string.
 * Capitalises each word; does nothing else.
 */
function toDisplayLabel(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ─── Temporal helpers ─────────────────────────────────────────────────────────

function parseMs(node: JourneyNode, useEnd = false): number {
  const s = useEnd
    ? (node.endTime   || node.endDate)
    : (node.startTime || node.startDate);
  if (!s) return 0;
  try {
    const d = new Date(s.includes('T') ? s : `${s}T00:00:00`);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  } catch {
    return 0;
  }
}

// ─── Core builder ─────────────────────────────────────────────────────────────

let _segIdCounter = 0;
function nextSegId(): string {
  return `seg-${++_segIdCounter}`;
}

/**
 * Builds a JourneyRoute from a flat list of JourneyNodes.
 *
 * Algorithm
 * ---------
 * 1. Filter active nodes (ignoring REPLACED and CANCELLED items).
 * 2. Classify items into transport / location-based / unknown.
 * 3. Sort transport items chronologically (when times are available).
 * 4. Build a directed graph of locations connected by transport segments using LocationResolver.
 * 5. Topologically order the location graph to produce the horizontal chain.
 * 6. Match location-based items to their location nodes.
 * 7. Sort attached items chronologically within each location.
 */
export function buildJourneyRoute(nodes: JourneyNode[]): JourneyRoute {
  // ── 1. Filter active nodes & initialize single-source LocationResolver ────

  const activeNodes = nodes.filter((n) => !isInactiveNode(n));

  const resolver = new LocationResolver(nodes);

  const transportItems   = activeNodes.filter(isTransport);
  const locationItems    = activeNodes.filter(isLocationBased);
  const unclassified     = activeNodes.filter(
    (n) => !isTransport(n) && !isLocationBased(n),
  );

  // ── 2. Sort transport items chronologically ───────────────────────────────

  const sortedTransport = [...transportItems].sort(
    (a, b) => parseMs(a) - parseMs(b),
  );

  // ── 3. Build directed location graph ─────────────────────────────────────

  // locationMap: normalized key → RouteLocation
  const locationMap = new Map<string, RouteLocation>();

  // Adjacency: fromKey → [toKey] (for ordering)
  const outgoing  = new Map<string, string[]>(); // fromKey → toKey[]
  const incoming  = new Map<string, string[]>(); // toKey   → fromKey[]

  const segments: RouteSegment[] = [];

  function ensureLocation(raw: string): RouteLocation {
    const key = resolver.getKey(raw);
    if (!locationMap.has(key)) {
      locationMap.set(key, {
        id: key,
        label: resolver.getLabel(key),
        order: -1,
        attachedItems: [],
      });
    }
    return locationMap.get(key)!;
  }

  for (const item of sortedTransport) {
    const fromRaw = item.origin!; // guaranteed by isTransport
    const toRaw   = item.destination;

    const fromLoc = ensureLocation(fromRaw);

    if (!toRaw || !toRaw.trim()) {
      // Transport item with no destination: create a segment with an
      // "unknown destination" marker so the UI can show it as incomplete.
      const toRawFallback = '?';
      const toLoc = ensureLocation(toRawFallback);
      const fromKey = fromLoc.id;
      const toKey   = toLoc.id;
      if (!outgoing.has(fromKey)) outgoing.set(fromKey, []);
      if (!incoming.has(toKey))  incoming.set(toKey,  []);
      outgoing.get(fromKey)!.push(toKey);
      incoming.get(toKey)!.push(fromKey);
      segments.push({ id: nextSegId(), fromLocationId: fromKey, toLocationId: toKey, item });
      continue;
    }

    const toLoc   = ensureLocation(toRaw);
    const fromKey = fromLoc.id;
    const toKey   = toLoc.id;

    // Build adjacency (avoid duplicate edges from same pair)
    if (!outgoing.has(fromKey)) outgoing.set(fromKey, []);
    if (!incoming.has(toKey))  incoming.set(toKey,  []);
    outgoing.get(fromKey)!.push(toKey);
    incoming.get(toKey)!.push(fromKey);

    segments.push({ id: nextSegId(), fromLocationId: fromKey, toLocationId: toKey, item });
  }

  // ── 4. Topological ordering of connected location graph ───────────────────

  /**
   * We use Kahn's algorithm on the directed graph.
   * For journeys with cycles (A→B→A round trips), we fall back to
   * the visit-order from sorting the transport items chronologically.
   */
  const allLocationKeys = Array.from(locationMap.keys());

  // Compute in-degree for each location
  const inDegree = new Map<string, number>(
    allLocationKeys.map((k) => [k, (incoming.get(k) ?? []).length]),
  );

  const queue: string[] = allLocationKeys.filter((k) => inDegree.get(k) === 0);
  const orderedKeys: string[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    orderedKeys.push(key);
    for (const toKey of outgoing.get(key) ?? []) {
      const deg = (inDegree.get(toKey) ?? 1) - 1;
      inDegree.set(toKey, deg);
      if (deg === 0) queue.push(toKey);
    }
  }

  // Handle any remaining nodes (cycle or disconnected sub-graph)
  for (const key of allLocationKeys) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  // Assign order values
  orderedKeys.forEach((key, idx) => {
    const loc = locationMap.get(key);
    if (loc) loc.order = idx;
  });

  const orderedLocations: RouteLocation[] = orderedKeys
    .map((k) => locationMap.get(k)!)
    .filter(Boolean);

  // ── 5. Attach location-based items ───────────────────────────────────────

  // Map of unconnected locations: key → UnconnectedLocation
  const unconnectedMap = new Map<string, UnconnectedLocation>();
  const unplaced: UnplacedItem[] = [];

  for (const item of locationItems) {
    const rawLoc = item.location;
    if (!rawLoc || !rawLoc.trim()) {
      // No location string at all → unplaced
      unplaced.push({ item });
      continue;
    }

    const key = resolver.getKey(rawLoc);

    if (locationMap.has(key)) {
      // Exact key match → attach to known location
      locationMap.get(key)!.attachedItems.push(item);
    } else {
      // No match → create / reuse an unconnected location node
      if (!unconnectedMap.has(key)) {
        unconnectedMap.set(key, {
          id: key,
          label: resolver.getLabel(key),
          attachedItems: [],
        });
      }
      unconnectedMap.get(key)!.attachedItems.push(item);
    }
  }

  // Items with no geographic information at all
  for (const item of unclassified) {
    unplaced.push({ item, rawLocation: item.location });
  }

  // ── 6. Sort attached items chronologically within each location ───────────

  const byStartMs = (a: JourneyNode, b: JourneyNode) => parseMs(a) - parseMs(b);

  for (const loc of orderedLocations) {
    loc.attachedItems.sort(byStartMs);
  }
  for (const uc of unconnectedMap.values()) {
    uc.attachedItems.sort(byStartMs);
  }

  // ── 7. Return the complete route model ────────────────────────────────────

  return {
    locations: orderedLocations,
    segments,
    unconnected: Array.from(unconnectedMap.values()),
    unplaced,
  };
}

// ─── Convenience query helpers ─────────────────────────────────────────────────

/** Returns all segments departing FROM a given location id. */
export function segmentsFrom(
  route: JourneyRoute,
  locationId: string,
): RouteSegment[] {
  return route.segments.filter((s) => s.fromLocationId === locationId);
}

/** Returns the single segment arriving AT a given location id, or null. */
export function segmentTo(
  route: JourneyRoute,
  locationId: string,
): RouteSegment | null {
  return route.segments.find((s) => s.toLocationId === locationId) ?? null;
}

/**
 * Counts transport legs, stays, and activities from the raw nodes.
 * Used to power the header stat chips — never hard-coded.
 */
export function routeStats(nodes: JourneyNode[]): {
  total: number;
  legs: number;
  stays: number;
  activities: number;
} {
  let legs = 0, stays = 0, activities = 0;
  for (const n of nodes) {
    const t = n.type.toLowerCase();
    if (LOCATION_BASED_TYPES.has(t)) {
      if (t === 'hotel' || t === 'stay' || t === 'accommodation') stays++;
      else activities++;
    } else {
      legs++;
    }
  }
  return { total: nodes.length, legs, stays, activities };
}
