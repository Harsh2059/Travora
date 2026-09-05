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
  status: 'CONFIRMED' | 'DELAYED' | 'CANCELLED' | 'MODIFIED' | 'COMPLETED';
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
  created_at: string;
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

export interface NodeImpact {
  id: string;
  type: string;
  title: string;
  priority: string;
  impact_status: 'UNAFFECTED' | 'AFFECTED' | 'AT_RISK' | 'MISSED' | 'INVALID' | 'CANCELLED';
  reason: string;
  original_start: string;
  simulated_start: string;
  details: Record<string, any>;
}

export interface ImpactAssessment {
  trip_id: number;
  event_type: string;
  entity_id: number;
  total_components: number;
  components_affected: number;
  affected_percentage: number;
  critical_components: number;
  critical_components_affected: number;
  impact_score: number;
  node_impacts: Record<string, NodeImpact>;
  cascade_paths: string[][];
  summary: string;
}

export interface RecoveryPlan {
  plan_id: string;
  strategy_type: string;
  title: string;
  description: string;
  feasibility: boolean;
  infeasibility_reasons: string[];
  preserves_critical_commitment: boolean;
  composite_score: number;
  time_score: number;
  cost_score: number;
  comfort_score: number;
  directness_score: number;
  additional_delay_minutes: number;
  new_booking_cost: number;
  change_fees: number;
  cancellation_fees: number;
  refunds_recovered: number;
  net_cost: number;
  is_recommended: boolean;
  explanation_summary: string;
  explanation_details: Record<string, any>;
  removed_items: any[];
  modified_items: any[];
  added_items: any[];
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
  timestamp: string;
}

export interface TravelerPreferences {
  time_weight: number;
  cost_weight: number;
  comfort_weight: number;
  directness_weight: number;
}
