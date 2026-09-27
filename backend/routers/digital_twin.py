"""
Digital Twin What-If Weather Simulation Router

Provides read-only What-If simulation engine capabilities for weather-driven travel disruptions.
Combines Live Weather, Extended RandomForest ML Predictions, NetworkX Graph Impact Propagation,
and Nugen AI Domain Reasoning without mutating actual database journey state.
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
import logging

import database
import models
from services.graph.builder import build_dependency_graph
from services.impact.engine import ImpactEngine
from services.ml.disruption_model import DisruptionRiskModel
from services.ml.nugen_service import NugenReasoningService
from services.weather.weather_service import LiveWeatherService
from services.recovery.engine import analyze_part4_recovery

logger = logging.getLogger("travel_recovery.digital_twin")

router = APIRouter(prefix="/api/digital-twin", tags=["Digital Twin"])


@router.post("/simulate")
def run_digital_twin_simulation(
    payload: Dict[str, Any] = Body(default={}),
    db: Session = Depends(database.get_db)
):
    """
    Executes a Weather-Driven What-If Digital Twin Simulation.
    Evaluates cascading impacts across Flights, Cabs, Trains, and Hotels.
    GUARANTEE: Read-Only simulation. Does NOT mutate real database journey state.
    """
    try:
        raw_id = payload.get("journey_id") or payload.get("trip_id") or 1
        try:
            trip_id = int(raw_id)
        except (ValueError, TypeError):
            trip_id = 1

        # Fetch trip from database
        trip = db.query(models.Trip).filter(models.Trip.id == trip_id).first()
        if not trip:
            # Fallback to first trip in database
            trip = db.query(models.Trip).first()

        if not trip:
            raise HTTPException(status_code=404, detail=f"Journey ID {trip_id} not found")

        actual_trip_id = trip.id

        # Active items in trip
        items = db.query(models.ItineraryItem).filter(
            models.ItineraryItem.trip_id == actual_trip_id,
            models.ItineraryItem.status.notin_(["CANCELLED", "REPLACED", "RESTORED_DEMO"])
        ).order_by(models.ItineraryItem.start_time.asc()).all()

        if not items:
            items = db.query(models.ItineraryItem).filter(
                models.ItineraryItem.trip_id == actual_trip_id
            ).order_by(models.ItineraryItem.start_time.asc()).all()

        first_flight = next((it for it in items if it.type == "FLIGHT"), items[0] if items else None)
        loc_name = payload.get("location") or (first_flight.origin if first_flight else "Mumbai")

        # Fetch baseline live weather
        live_w = LiveWeatherService.get_current_weather(location=str(loc_name))

        # Weather parameter validation and override for simulation
        sim_rainfall = float(payload.get("rainfall", live_w["rainfall"]))
        sim_wind = float(payload.get("wind", live_w["wind"]))
        sim_vis = float(payload.get("visibility", live_w["visibility"]))
        sim_temp = float(payload.get("temperature", live_w["temperature"]))

        # Sanitize values
        sim_rainfall = max(0.0, sim_rainfall)
        sim_wind = max(0.0, sim_wind)
        sim_vis = max(0.1, min(20.0, sim_vis))

        condition_override = live_w["condition"]
        if sim_rainfall > 100 or sim_wind > 50:
            condition_override = "Severe Storm / Torrential Rain"
        elif sim_rainfall > 20 or sim_wind > 30:
            condition_override = "Heavy Rain & Wind"
        elif sim_vis < 2.0:
            condition_override = "Fog / Low Visibility"

        sim_weather = {
            "location": live_w["location"],
            "airport": live_w["airport"],
            "latitude": live_w["latitude"],
            "longitude": live_w["longitude"],
            "temperature": sim_temp,
            "rainfall": sim_rainfall,
            "wind": sim_wind,
            "visibility": sim_vis,
            "condition": condition_override,
            "source": "Digital Twin What-If Simulator"
        }

        # Predict numerical risk via Extended RF Model
        target_dict = {
            "id": first_flight.id if first_flight else 1,
            "type": first_flight.type if first_flight else "FLIGHT",
            "provider": first_flight.provider if first_flight else "IndiGo",
            "origin": first_flight.origin if first_flight else "BOM",
            "destination": first_flight.destination if first_flight else "JAI",
            "start_time": first_flight.start_time if first_flight else None
        } if first_flight else {"id": 1, "type": "FLIGHT"}

        rf_model = DisruptionRiskModel()
        ml_pred = rf_model.predict_item_risk(target_dict, sim_weather)

        # Build simulated disruption event if risk is present
        sim_event = None
        if ml_pred["disruption_probability"] > 0.35 or sim_rainfall > 20 or sim_wind > 30 or sim_vis < 3.0:
            delay_mins = ml_pred["estimated_delay_minutes"]
            sim_event = {
                "disruption_id": 9999,
                "id": 9999,
                "trip_id": actual_trip_id,
                "entity_id": first_flight.id if first_flight else (items[0].id if items else 1),
                "event_type": "WEATHER_DELAY" if delay_mins > 0 else "CANCELLED",
                "type": "WEATHER_DELAY" if delay_mins > 0 else "CANCELLED",
                "severity": "HIGH" if ml_pred["disruption_probability"] > 0.65 else "MEDIUM",
                "event_metadata": {
                    "delay_minutes": delay_mins,
                    "cause": "WEATHER",
                    "reason": f"Simulated {condition_override} (Rain: {sim_rainfall}mm/h, Wind: {sim_wind}km/h)"
                }
            }

        # Build dependency graph & run read-only Impact Engine
        G = build_dependency_graph(items)
        events_to_propagate = [sim_event] if sim_event else []
        impact_result = ImpactEngine.propagate_impact(G, events_to_propagate)

        # Format affected entities list
        affected_entities = []
        cascading_effects = []

        for n_imp in impact_result.nodes:
            if n_imp.status.value != "INTACT":
                affected_entities.append({
                    "type": n_imp.type,
                    "name": n_imp.title,
                    "node_id": n_imp.node_id,
                    "status": n_imp.status.value,
                    "impact": "high" if n_imp.status.value in ["BROKEN", "NEEDS_CHANGE"] else "medium",
                    "reason": n_imp.reason
                })
                cascading_effects.append(f"{n_imp.title}: {n_imp.reason}")

        # Nugen Domain AI Reasoning Interface
        nugen_service = NugenReasoningService()
        nugen_reasoning = nugen_service.generate_domain_reasoning(
            journey_title=trip.title,
            weather=sim_weather,
            disruption_pred=ml_pred,
            affected_nodes=affected_entities,
            scenario_name=payload.get("scenario_name")
        )

        # Pre-resolve recovery plans for what-if scenario
        journey_dict = {
            "id": actual_trip_id,
            "title": trip.title,
            "nodes": [
                {
                    "id": it.id,
                    "backendId": it.id,
                    "type": it.type,
                    "title": f"{it.provider or it.type} ({it.origin or ''} → {it.destination or it.location or ''})".strip(),
                    "provider": it.provider,
                    "origin": it.origin,
                    "destination": it.destination,
                    "start_time": it.start_time.isoformat() if it.start_time else None,
                    "end_time": it.end_time.isoformat() if it.end_time else None,
                    "status": it.status,
                    "item_metadata": it.item_metadata or {}
                }
                for it in items
            ]
        }

        recovery_res = analyze_part4_recovery(
            journey=journey_dict,
            impact_result=impact_result.model_dump(),
            disruptions=events_to_propagate
        )

        return {
            "journey_id": actual_trip_id,
            "trip_id": actual_trip_id,
            "journey_title": trip.title,
            "mode": "SIMULATED",
            "weather": sim_weather,
            "prediction": ml_pred,
            "affected_entities": affected_entities,
            "cascading_effects": cascading_effects,
            "nugen_reasoning": nugen_reasoning,
            "recovery_plans_count": recovery_res.total_feasible_plans,
            "simulated_recovery_options": recovery_res.model_dump().get("plans", []),
            "is_real_journey_mutated": False
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error in Digital Twin simulation: {exc}")
        raise HTTPException(status_code=500, detail="Digital Twin simulation failed to execute")
