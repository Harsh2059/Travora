/**
 * digitalTwin.ts
 *
 * TypeScript contracts for Weather-Driven Digital Twin Enhancement
 * API Contracts:
 *   GET  /api/weather/current?location=Mumbai
 *   GET  /api/weather/forecast?location=Mumbai&hours=24
 *   GET  /api/journeys/{trip_id}/weather
 *   GET  /api/trips/{trip_id}/weather
 *   GET  /api/social-signals?location=Mumbai
 *   GET  /api/social-signals/{location}
 *   POST /api/digital-twin/simulate
 */

export type ImpactSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface WeatherCondition {
  condition: string;
  temperature_c: number;
  rainfall_mm: number;
  wind_kmh: number;
  visibility_km: number;
  humidity_percent?: number;
  timestamp: string;
  source?: string;
  is_live?: boolean;
  // Backend alias fields
  location?: string;
  airport?: string;
  temperature?: number;
  rainfall?: number;
  wind?: number;
  visibility?: number;
}

export interface WeatherForecastItem {
  time: string;
  condition: string;
  temp_c: number;
  rain_mm: number;
  wind_kmh: number;
  risk_level: ImpactSeverity;
}

export interface WeatherDataResponse {
  location: string;
  current: WeatherCondition;
  forecast: WeatherForecastItem[];
  is_live: boolean;
}

export interface AffectedEntity {
  type: 'airport' | 'flight' | 'transport' | 'hotel' | 'activity' | string;
  name: string;
  impact: ImpactSeverity | string;
  details?: string;
  original_time?: string;
  simulated_time?: string;
  delay_minutes?: number;
  location?: string;
  coordinates?: [number, number];
}

export interface DigitalTwinPrediction {
  disruption_probability: number;
  estimated_delay_minutes: number;
  transport_impact: number;
  hotel_impact: number;
  confidence: number;
  is_synthetic: boolean;
  risk_level?: string;
  risk_category?: ImpactSeverity;
}

export interface NugenReasoning {
  explanation: string;
  reasoning?: string;
  severity_assessment?: string;
  affected_entities?: string[] | AffectedEntity[];
  cascading_effects?: string[];
  confidence?: number;
  nugen_aligned?: boolean;
  model_id?: string;
  alignment_verified?: boolean;
  key_factors?: string[];
  recommended_action?: string;
}

export interface DigitalTwinSimulateRequest {
  journey_id: number | string;
  location?: string;
  rainfall?: number;
  wind?: number;
  visibility?: number;
  temperature?: number;
  // Nested representation for internal UI convenience
  weather?: {
    rainfall?: number;
    wind?: number;
    visibility?: number;
    temperature?: number;
  };
}

export interface DigitalTwinSimulateResponse {
  journey_id: string | number;
  trip_id?: string | number;
  journey_title?: string;
  mode: 'SIMULATED' | 'LIVE' | string;
  weather: {
    location?: string;
    airport?: string;
    temperature?: number;
    rainfall: number;
    wind: number;
    visibility: number;
    condition?: string;
    source?: string;
  };
  prediction: DigitalTwinPrediction;
  affected_entities: AffectedEntity[];
  cascading_effects: string[];
  nugen_reasoning: NugenReasoning;
  recovery_plans_count?: number;
  is_real_journey_mutated?: boolean;
}

export interface PublicSignalItem {
  id: string;
  title: string;
  text?: string;
  author?: string;
  sentiment?: string;
  source: string;
  time_ago: string;
  severity: ImpactSeverity;
  timestamp: string;
  verified?: boolean;
  category?: 'weather' | 'flight' | 'traffic' | 'general' | string;
}

export interface SocialSignalsResponse {
  location: string;
  is_live: boolean;
  signals: PublicSignalItem[];
}
