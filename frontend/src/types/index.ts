export interface ItineraryItem {
  id: number;
  trip_id: number;
  type: string;
  provider: string;
  origin?: string;
  destination?: string;
  location?: string;
  start_time: string;
  end_time: string;
  cost: number;
  currency: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  flexibility: 'FIXED' | 'STRICT' | 'FLEXIBLE' | 'VERY_FLEXIBLE';
  status:
    | 'SCHEDULED'
    | 'CONFIRMED'
    | 'AT_RISK'
    | 'DELAYED'
    | 'MISSED'
    | 'CANCELLED'
    | 'MODIFIED'
    | 'COMPLETED'
    | 'REFUNDED'
    | 'REPLACED';
  booking_id?: string;
  refundable?: boolean;
  refund_percentage?: number;
  cancellation_fee?: number;
  changeable?: boolean;
  change_fee?: number;
  non_refundable_amount?: number;
  item_metadata?: Record<string, any>;
}

export interface Trip {
  id: number;
  title: string;
  version: number;
  user_id: number;
  created_at?: string;
  items: ItineraryItem[];
}

export interface GraphEdge {
  source: string;
  target: string;
  dependency_type: string;
  min_connection_minutes?: number;
  scheduled_buffer_minutes?: number;
}

export interface GraphNode {
  id: string;
  type: string;
  provider: string;
  title: string;
  route: string;
  start_time: string;
  end_time: string;
  priority: string;
  flexibility: string;
  status: string;
}

export interface DigitalTwinGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
}

export type ImpactNodeStatus = 'INTACT' | 'AT_RISK' | 'NEEDS_CHANGE' | 'BROKEN';

/**
 * Journey-level feasibility status produced by the Part 3 engine.
 *
 * NORMAL    — the original journey is executable as planned.
 * DISRUPTED — an active disruption makes the original journey no longer
 *              executable as planned (at least one node is BROKEN or NEEDS_CHANGE).
 *
 * AT_RISK alone does NOT make the journey DISRUPTED — it means the journey
 * may be at risk but is not yet confirmed infeasible.
 */
export type JourneyStatus = 'NORMAL' | 'DISRUPTED' | 'RECOVERED';

export interface ImpactSource {
  disruption_id?: any;
  kind: 'DIRECT' | 'PROPAGATED';
  reason: string;
  status: ImpactNodeStatus;
  cause?: string;
  scope?: string;
}

export interface NodeImpactItem {
  node_id: string;
  item_id?: number;
  type: string;
  title: string;
  priority: string;
  flexibility: string;
  original_status?: string;
  status: ImpactNodeStatus;
  impact_status?: ImpactNodeStatus | string;
  reason: string;
  impact_sources?: ImpactSource[];
  details?: Record<string, any>;
}

export interface ImpactSummaryCounts {
  intact: number;
  at_risk: number;
  needs_change: number;
  broken: number;
}

export type NodeImpact = NodeImpactItem;

export interface ImpactResult {
  trip_id: number;
  root_node_ids?: string[];
  disruption_id?: any;
  root_node_id?: string;
  summary?: ImpactSummaryCounts | string | any;
  nodes?: NodeImpactItem[];
  node_impacts?: Record<string, NodeImpactItem>;
  /**
   * Journey-level feasibility — authoritative value from the backend engine.
   * DISRUPTED when any active disruption produces a BROKEN or NEEDS_CHANGE node.
   * AT_RISK alone keeps the journey NORMAL.
   */
  journey_status?: JourneyStatus;

  // ── Legacy / display-layer fields (produced by older API shape) ──────────
  /** Human-readable disruption event label, e.g. "FLIGHT_DELAY_4H" */
  event_type?: string;
  /** ID of the primary affected itinerary item */
  entity_id?: number;
  /** Total number of itinerary components evaluated */
  total_components?: number;
  /** Number of components with a non-INTACT status */
  components_affected?: number;
  /** Percentage of itinerary affected (0-100) */
  affected_percentage?: number;
  /** Total number of CRITICAL-priority components */
  critical_components?: number;
  /** Number of CRITICAL components that are affected */
  critical_components_affected?: number;
  /** Composite impact severity score (0-100) */
  impact_score?: number;
  /** Ordered chains of affected node IDs */
  cascade_paths?: string[][];
  /**
   * Human-readable disruption summary shown in the traveler UI.
   * NOTE: conflicts with ImpactSummaryCounts on `summary` — this field
   * is only present on the legacy API shape where `summary` is a string.
   * When both are present prefer the ImpactSummaryCounts form.
   */
  summary_text?: string;
  /** Authoritative fingerprint of active disruption IDs, e.g. "3_7_12" (sorted, joined by "_").
   * Computed by the backend. Use this — NOT a client-side derivation from history — to detect
   * when the disruption set has changed between polls. */
  disruption_fingerprint?: string;
  /** Sorted list of active DisruptionEvent.id values used to produce this impact result. */
  disruption_ids?: number[];
}

export interface ImpactAssessment extends ImpactResult {}

export interface QualityMetrics {
  critical_preservation_score: number;
  itinerary_preservation_score: number;
  delay_score: number;
  financial_score: number;
  inconvenience_score: number;
  preference_score: number;
  overall_recovery_score: number;
  components_preserved: number;
  components_modified: number;
  components_removed: number;
  components_added: number;
  affected_percentage: number;
  critical_components_affected: number;
}

export interface RecoveryPlan {
  plan_id: string;
  strategy_type: string;
  title: string;
  description?: string;
  feasibility: boolean;
  infeasibility_reasons: string[];
  preserves_critical_commitment: boolean;
  composite_score?: number;
  overall_score?: number;
  preference_score?: number;
  impact_score?: number;
  time_score?: number;
  cost_score?: number;
  comfort_score?: number;
  directness_score?: number;
  additional_delay_minutes: number;
  additional_delay_str?: string;
  new_booking_cost?: number;
  additional_cost?: number;
  change_fees: number;
  cancellation_fees: number;
  refunds_recovered?: number;
  refund_received?: number;
  net_cost: number;
  currency?: string;
  is_recommended: boolean;
  explanation_summary: string;
  explanation_details: Record<string, any>;
  removed_items: any[];
  modified_items: any[];
  added_items: any[];
  preserved_items?: any[];
  full_recovered_items?: any[];
  source_itinerary_version?: number;
  recovery_id?: string;
  trip_id?: number;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence_reasons?: string[];
  quality_metrics?: QualityMetrics;
  traveler_summary?: string;
  trade_offs?: {
    what_you_gain?: string;
    what_you_give_up?: string;
  };
}

export interface RecoveryHistoryEntry {
  id: number;
  recovery_id: string;
  previous_version: number;
  new_version: number;
  event_type: string;
  selected_plan_id: string;
  plan_title: string;
  net_cost: number;
  additional_delay_minutes: number;
  changes: Record<string, any>;
  plan_details?: Record<string, any>;
  status?: string;
  timestamp: string;
}

export interface TravelerPreferences {
  time_weight: number;
  cost_weight: number;
  comfort_weight: number;
  directness_weight: number;
  flexibility_weight?: number;
  airline_preference?: string;
  hotel_preference?: string;
  airport_preference?: string;
  max_wait_minutes?: number;
  max_additional_cost?: number;
  max_extra_travel_minutes?: number;
}

export interface VersionComparisonData {
  trip_id: number;
  version_a: number;
  version_b: number;
  is_identical: boolean;
  financial_diff: {
    net_cost_change: number;
    currency: string;
  };
  operational_diff: {
    delay_difference_minutes: number;
    delay_str: string;
  };
  commitments: {
    critical_commitment_preserved: boolean;
    active_components_count: number;
    cancelled_components_count: number;
  };
  item_breakdown: {
    added_count: number;
    removed_count: number;
    modified_count: number;
    added_items: any[];
    removed_items: any[];
    modified_items: any[];
  };
  transition_history: Array<{
    recovery_id: string;
    from_version: number;
    to_version: number;
    plan_title: string;
    event_type: string;
    net_cost: number;
    additional_delay_minutes: number;
    timestamp: string;
  }>;
}

// ============================================================================
// PART 4: RECOVERY ENGINE TYPES
// ============================================================================

export type Part4ActionType = 'KEEP' | 'REPLACE' | 'MODIFY' | 'CANCEL';
export type Part4RecoveryFeasibility = 'FEASIBLE' | 'INFEASIBLE' | 'UNKNOWN';
export type Part4RecoveryCategory = 'PRIORITY_PRESERVING' | 'ALTERNATIVE';
export type RecoveryAnalysisStatus =
  | 'OPTIONS_AVAILABLE'
  | 'NO_FEASIBLE_RECOVERY'
  | 'BUDGET_EXCEEDED'
  | 'ANALYSIS_FAILED';

export interface CostEstimate {
  replacement_cost: number | null;
  modification_fees: number | null;
  cancellation_penalties: number | null;
  estimated_refunds: number | null;
  estimated_additional_cost: number | null;
  currency: string;
  is_partial: boolean;
}

export interface Part4RecoveryChange {
  node_id: string;
  action: Part4ActionType;
  original_title: string;
  original_details?: Record<string, any>;
  new_title?: string;
  new_details?: Record<string, any>;
  /** Explicit replacement airline/provider from recovery candidate */
  provider?: string | null;
  type?: string | null;
  origin?: string | null;
  destination?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  estimated_cost: number | null;
  estimated_refund: number | null;
  explanation: string;
}

export interface Part4RecoveryPlan {
  id: string;
  trip_id: number;
  category: Part4RecoveryCategory;
  title: string;
  feasibility: Part4RecoveryFeasibility;
  changes: Part4RecoveryChange[];
  preserved_node_ids: string[];
  changed_node_ids: string[];
  dropped_node_ids: string[];
  preserved_priorities: string[];
  sacrificed_priorities: string[];
  cost_estimate?: CostEstimate;
  estimated_additional_cost: number | null;
  estimated_refund: number | null;
  explanation: string;
  is_recommended?: boolean;
  total_transfers?: number;
  total_duration_minutes?: number;
  total_changes_count?: number;
  is_direct?: boolean;
}

export interface Part4RecoveryResult {
  trip_id: number;
  impact_status: string;
  status: RecoveryAnalysisStatus;
  total_feasible_plans: number;
  plans: Part4RecoveryPlan[];
  priority_preserving_count: number;
  alternative_count: number;
  message: string;
  /** Authoritative fingerprint matching the disruption snapshot used to generate these plans.
   * Frontend must check this before applying or saving a result to guard against stale responses. */
  disruption_fingerprint?: string;
  /** Sorted list of active DisruptionEvent.id values used to build this recovery analysis. */
  disruption_ids?: number[];
}

// ============================================================================
// JOURNEY BUILDER — Part 1 Types
// ============================================================================


export type JourneyNodeType =
  | 'FLIGHT' | 'TRAIN' | 'HOTEL' | 'CAB' | 'ACTIVITY'
  | 'flight' | 'train' | 'hotel' | 'activity' | 'taxi'
  | (string & {});

/**
 * API RESPONSE CONTRACT
 *
 * POST /api/users/{user_id}/trips  → { id: number, ... }
 * POST /api/trips/{trip_id}/items  → { id: number, ... }
 *
 * The frontend MUST populate backendId from the returned `id`.
 * Do NOT generate or guess backend IDs on the frontend.
 */
export type TimeStatus = 'FIXED' | 'APPROXIMATE' | 'FLEXIBLE' | 'UNKNOWN';
export type TravelerPriority = 'MUST_PRESERVE' | 'PREFER_TO_PRESERVE' | 'OPTIMIZE';

export interface JourneyNode {
  /** Frontend UUID — generated locally, used as React key and for draft mutations */
  id: string;
  /**
   * Set after backend persists the item.
   * Used for PUT /api/trips/:tripId/items/:backendId and
   *         DELETE /api/trips/:tripId/items/:backendId
   */
  backendId?: number;

  type: JourneyNodeType;

  /** Human-readable label (airline, hotel name, cab provider, etc.) */
  title: string;

  /** Service / booking provider name (airline, hotel brand, operator, etc.) */
  provider?: string;

  /** Exact ISO datetime strings (optional when exact time is unknown/flexible) */
  startTime?: string;
  endTime?: string;

  /** Date strings YYYY-MM-DD (e.g., "2026-09-24") */
  startDate?: string;
  endDate?: string;

  /** Time status indicating constraint rigidity: FIXED (exact time known), FLEXIBLE (time window flexible), UNKNOWN (time not decided) */
  timeStatus?: TimeStatus;
  isTimeFlexible?: boolean;

  /** Traveler Priority separate from timing flexibility */
  priority?: TravelerPriority;

  /** Transport mode override (e.g. "METRO" vs intercity train) */
  transportMode?: string;

  /** For FLIGHT / TRAIN / CAB */
  origin?: string;
  destination?: string;

  /** For HOTEL / CAB pickup location */
  location?: string;

  /** Optional booking reference / PNR */
  bookingRef?: string;

  /** Operational/Booking status: CONFIRMED, REPLACED, RESTORED_DEMO, CANCELLED, etc. */
  status?: string;

  /**
   * Extensible metadata bag.
   * Part 3 will introduce JourneyEdge for dependency relationships —
   * do NOT encode dependency logic here.
   */
  metadata?: Record<string, unknown>;
}

export interface Journey {
  /** Set once backend trip is created. Populated from API response. */
  id?: number;
  title: string;
  /** Nodes always ordered chronologically by startTime for Part 1 display */
  nodes: JourneyNode[];
  /**
   * 'draft'  — in sessionStorage only, not persisted to backend yet
   * 'saved'  — successfully persisted to backend (source of truth)
   * 'local'  — backend was unreachable during creation; stored on device only.
   *             Must NOT be consumed by the disruption/recovery engine.
   *             Will retry sync on next load.
   */
  syncStatus: 'draft' | 'saved' | 'local';
}

// ============================================================================
// PART 5: BOOKING & EXECUTION ENGINE TYPES
// ============================================================================
export type Part5ExecutionStatus =
  | 'PENDING_REVALIDATION'
  | 'REVALIDATION_FAILED'
  | 'READY_FOR_CONFIRMATION'
  | 'BOOKING_IN_PROGRESS'
  | 'PARTIALLY_COMPLETED'
  | 'COMPLETED'
  | 'FAILED'
  | 'UNAVAILABLE'
  | 'STALE_PLAN';

export interface Part5RevalidatedItem {
  node_id: string;
  original_title: string;
  replacement_title: string;
  provider: string;
  type: string;
  available: boolean;
  replacement_price?: number;
  current_price: number;
  modification_fee?: number;
  cancellation_penalty?: number;
  estimated_refund?: number;
  item_additional_cost?: number;
  currency: string;
  checked_at: string;
  booking_conditions?: string;
}

export interface Part5UnchangedItem {
  node_id: string;
  title: string;
}

export interface Part5CostBreakdown {
  replacement_cost: number;
  modification_fees: number;
  cancellation_penalties: number;
  estimated_refunds: number;
  current_estimated_additional_cost: number;
  part4_estimated_additional_cost: number;
  price_difference: number;
  currency: string;
}

export interface Part5RevalidationResult {
  execution_id?: string;
  status: Part5ExecutionStatus;
  message?: string;
  part4_estimated_additional_cost?: number;
  current_estimated_additional_cost?: number;
  earlier_estimated_additional_cost: number;
  current_total_price: number;
  price_difference: number;
  currency: string;
  cost?: Part5CostBreakdown;
  revalidated_items: Part5RevalidatedItem[];
  unchanged_items: Part5UnchangedItem[];
  checked_at: string;
  disruption_fingerprint?: string;
}

export interface Part5ConfirmedBooking {
  status: string;
  node_id: string;
  original_title: string;
  replacement_title: string;
  provider: string;
  type: string;
  booking_reference: string;
  pnr?: string;
  ticket_number?: string;
  confirmation_number?: string;
  flight_number?: string;
  seat?: string;
  cabin_class?: string;
  room_type?: string;
  vehicle_category?: string;
  final_price: number;
  currency: string;
  booked_at: string;
  error_message?: string;
}

export interface Part5ExecutionResult {
  execution_id: string;
  trip_id: number;
  disruption_fingerprint: string;
  status: Part5ExecutionStatus;
  message?: string;
  journey_status?: 'RECOVERED' | 'PARTIALLY_RECOVERED' | 'DISRUPTED';
  confirmed_bookings: Part5ConfirmedBooking[];
  failed_bookings: Part5ConfirmedBooking[];
  unchanged_items: Part5UnchangedItem[];
  total_final_price: number;
  currency: string;
  executed_at: string;
}
