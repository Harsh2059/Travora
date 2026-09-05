from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import copy

from services.policy.engine import PolicyEngine
from services.constraints.engine import ConstraintEngine
from services.ml.preferences import TravelerPreferences
from services.explanation.engine import ExplanationEngine
from .models import RecoveryPlanModel

class RecoveryEngine:
    @classmethod
    def generate_and_rank_recovery_plans(
        cls,
        original_items: List[Dict[str, Any]],
        event: Dict[str, Any],
        preferences: Optional[TravelerPreferences] = None,
        source_itinerary_version: Optional[int] = None,
        trip_id: Optional[int] = None
    ) -> List[RecoveryPlanModel]:
        """
        End-to-End Recovery Pipeline:
        CANDIDATE GENERATION -> POLICY ENGINE -> CONSTRAINT FILTER -> OPTIMIZATION -> PERSONALIZED RANKING -> EXPLANATION
        """
        pref = preferences or TravelerPreferences()
        event_type = event.get("event_type", "DELAY")
        entity_id = event.get("entity_id")
        event_meta = event.get("event_metadata", {})
        delay_minutes = event_meta.get("delay_minutes", 240)

        # Normalize items
        items = copy.deepcopy(original_items)
        for it in items:
            if isinstance(it["start_time"], str):
                it["start_time"] = datetime.fromisoformat(it["start_time"])
            if isinstance(it["end_time"], str):
                it["end_time"] = datetime.fromisoformat(it["end_time"])

        total_components = len(items)
        raw_plans = []

        # =========================================================================
        # Strategy A: Direct Reroute (Direct Flight BOM -> LHR)
        # Replaces Flight 1 & Flight 2 with a Direct Express flight
        # =========================================================================
        plan_a_items = []
        flight_a = next((it for it in items if it.get("id") == 1 or "mumbai" in str(it.get("origin", "")).lower()), None)
        flight_b = next((it for it in items if it.get("id") == 2 or "london" in str(it.get("destination", "")).lower()), None)
        
        if flight_a and flight_b:
            # Direct flight departing 1 hour after initial scheduled start
            direct_dep = flight_a["start_time"] + timedelta(hours=1)
            direct_arr = direct_dep + timedelta(hours=9, minutes=30) # Direct Mumbai to London is ~9.5h
            
            direct_flight = {
                "id": 101,
                "type": "FLIGHT",
                "provider": "Air India Direct Express",
                "origin": "Mumbai (BOM)",
                "destination": "London (LHR)",
                "start_time": direct_arr - timedelta(hours=9, minutes=30),
                "end_time": direct_arr,
                "cost": 52000,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "AI-DIR-99",
                "available": True
            }
            # Direct arrival arrives earlier than delayed connecting flight!
            additional_delay_a = max(0, int((direct_arr - flight_b["end_time"]).total_seconds() / 60.0))

            removed_a = [flight_a, flight_b]
            added_a = [direct_flight]
            # Downstream items preserved intact
            preserved_a = [it for it in items if it["id"] not in [flight_a["id"], flight_b["id"]]]
            modified_a = []

            raw_plans.append({
                "plan_id": "plan_a",
                "title": "Direct Express Reroute",
                "strategy_type": "REROUTE_DIRECT",
                "added_items": added_a,
                "removed_items": removed_a,
                "modified_items": modified_a,
                "preserved_items": preserved_a,
                "additional_delay_minutes": additional_delay_a,
                "is_direct": True,
                "hotel_preserved": True
            })

        # =========================================================================
        # Strategy B: Rebook Same Route with Next Available Connection
        # Keeps Flight A delayed, Rebooks Flight B on later flight, updates transfer
        # =========================================================================
        if flight_a and flight_b:
            flight_a_delayed = copy.deepcopy(flight_a)
            flight_a_delayed["start_time"] += timedelta(minutes=delay_minutes)
            flight_a_delayed["end_time"] += timedelta(minutes=delay_minutes)
            flight_a_delayed["status"] = "CONFIRMED_DELAYED"

            # Connecting flight from Delhi departed or missed -> Rebook next BA/Virgin connecting flight
            new_flight_b_dep = flight_a_delayed["end_time"] + timedelta(hours=2)
            new_flight_b_arr = new_flight_b_dep + timedelta(hours=9)

            rebooked_flight_b = {
                "id": 102,
                "type": "FLIGHT",
                "provider": "British Airways (Rebooked)",
                "origin": "Delhi (DEL)",
                "destination": "London (LHR)",
                "start_time": new_flight_b_dep,
                "end_time": new_flight_b_arr,
                "cost": 48000,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "BA-REBOOK-404",
                "available": True
            }

            # Transfer in London also pushed
            transfer = next((it for it in items if it.get("type") == "TRANSFER"), None)
            new_transfer = None
            if transfer:
                new_transfer = copy.deepcopy(transfer)
                new_transfer["id"] = 103
                new_transfer["start_time"] = new_flight_b_arr + timedelta(minutes=45)
                new_transfer["end_time"] = new_transfer["start_time"] + timedelta(minutes=45)
                new_transfer["cost"] = 2500
                new_transfer["booking_id"] = "HEX-NEW-1"

            additional_delay_b = int((new_flight_b_arr - flight_b["end_time"]).total_seconds() / 60.0)

            removed_b = [flight_b]
            if transfer:
                removed_b.append(transfer)
            added_b = [rebooked_flight_b]
            if new_transfer:
                added_b.append(new_transfer)
            modified_b = [flight_a_delayed]
            preserved_b = [it for it in items if it["id"] not in [flight_a["id"], flight_b["id"], (transfer["id"] if transfer else -1)]]

            raw_plans.append({
                "plan_id": "plan_b",
                "title": "Next Connection & Rescheduled Transfer",
                "strategy_type": "REBOOK_SAME_ROUTE",
                "added_items": added_b,
                "removed_items": removed_b,
                "modified_items": modified_b,
                "preserved_items": preserved_b,
                "additional_delay_minutes": max(0, additional_delay_b),
                "is_direct": False,
                "hotel_preserved": True
            })

        # =========================================================================
        # Strategy C: Alternate Hub Reroute (e.g. via Doha / Dubai)
        # =========================================================================
        if flight_a and flight_b:
            dep_c = flight_a["start_time"] + timedelta(hours=2)
            mid_c = dep_c + timedelta(hours=3, minutes=30)
            dep_c2 = mid_c + timedelta(hours=1, minutes=45)
            arr_c = dep_c2 + timedelta(hours=7, minutes=30)

            hub_flight_1 = {
                "id": 104,
                "type": "FLIGHT",
                "provider": "Qatar Airways Leg 1",
                "origin": "Mumbai (BOM)",
                "destination": "Doha (DOH)",
                "start_time": dep_c,
                "end_time": mid_c,
                "cost": 22000,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "QR-LEG1",
                "available": True
            }
            hub_flight_2 = {
                "id": 105,
                "type": "FLIGHT",
                "provider": "Qatar Airways Leg 2",
                "origin": "Doha (DOH)",
                "destination": "London (LHR)",
                "start_time": dep_c2,
                "end_time": arr_c,
                "cost": 32000,
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "QR-LEG2",
                "available": True
            }

            additional_delay_c = int((arr_c - flight_b["end_time"]).total_seconds() / 60.0)

            removed_c = [flight_a, flight_b]
            added_c = [hub_flight_1, hub_flight_2]
            modified_c = []
            preserved_c = [it for it in items if it["id"] not in [flight_a["id"], flight_b["id"]]]

            raw_plans.append({
                "plan_id": "plan_c",
                "title": "Alternate Hub Reroute (via Doha)",
                "strategy_type": "REROUTE_HUB",
                "added_items": added_c,
                "removed_items": removed_c,
                "modified_items": modified_c,
                "preserved_items": preserved_c,
                "additional_delay_minutes": max(0, additional_delay_c),
                "is_direct": False,
                "hotel_preserved": True
            })

        # =========================================================================
        # Strategy D: INFEASIBLE Plan (Fails Critical Commitment Invariant)
        # Arrives 24h later, missing the Tech Conference (CRITICAL commitment)
        # =========================================================================
        if flight_a and flight_b:
            late_dep = flight_a["start_time"] + timedelta(hours=28)
            late_arr = late_dep + timedelta(hours=10)
            late_flight = {
                "id": 106,
                "type": "FLIGHT",
                "provider": "Next-Day Standby Flight",
                "origin": "Mumbai (BOM)",
                "destination": "London (LHR)",
                "start_time": late_dep,
                "end_time": late_arr,
                "cost": 15000, # Cheap but misses conference
                "currency": "INR",
                "priority": "HIGH",
                "flexibility": "FLEXIBLE",
                "status": "CONFIRMED",
                "booking_id": "STANDBY-99",
                "available": True
            }
            raw_plans.append({
                "plan_id": "plan_infeasible",
                "title": "Standby Next-Day Budget Flight",
                "strategy_type": "STANDBY_DELAYED",
                "added_items": [late_flight],
                "removed_items": [flight_a, flight_b],
                "modified_items": [],
                "preserved_items": [it for it in items if it["id"] not in [flight_a["id"], flight_b["id"]]],
                "additional_delay_minutes": int((late_arr - flight_b["end_time"]).total_seconds() / 60.0),
                "is_direct": True,
                "hotel_preserved": False
            })

        # =========================================================================
        # Policy & Constraint Evaluation + Optimization + Ranking Pipeline
        # =========================================================================
        processed_plans: List[RecoveryPlanModel] = []

        for p_raw in raw_plans:
            # 1. Financial Calculation via Policy Engine
            fin_breakdown = PolicyEngine.calculate_net_cost(
                removed_items=p_raw["removed_items"],
                added_items=p_raw["added_items"],
                modified_items=p_raw["modified_items"]
            )

            # Assemble full recovered items
            recovered_items = p_raw["preserved_items"] + p_raw["modified_items"] + p_raw["added_items"]

            # 2. Hard Constraint Validation
            is_feasible, violations = ConstraintEngine.validate_candidate_plan(
                original_items=items,
                candidate_items=recovered_items,
                policy_results=fin_breakdown.item_policies
            )

            infeas_reasons = [v.message for v in violations]
            preserves_critical = not any(v.rule.startswith("CRITICAL") for v in violations)

            # 3. Metrics
            components_affected = len(p_raw["removed_items"]) + len(p_raw["modified_items"])
            affected_pct = round((components_affected / total_components) * 100.0, 1)
            crit_components = len([it for it in items if it.get("priority") == "CRITICAL"])
            crit_affected = 0 if preserves_critical else 1

            # Impact score for this plan
            impact_score = round(components_affected * 1.5 + (0.0 if preserves_critical else 5.0), 1)

            # 4. Personalization Match Score
            plan_features = {
                "additional_delay_minutes": p_raw["additional_delay_minutes"],
                "net_cost": fin_breakdown.net_cost,
                "hotel_preserved": p_raw.get("hotel_preserved", True),
                "is_direct": p_raw.get("is_direct", False)
            }
            pref_score = pref.score_plan(plan_features)

            # 5. Overall Optimization Score (Higher is better)
            # Recovery Score = critical_preservation + itinerary_preservation - delay_cost - financial_cost + preference_match
            # Strict penalty if infeasible
            if is_feasible:
                score = (
                    1000.0 # Base feasible
                    + (100.0 - affected_pct) * 2.0
                    + pref_score * 3.0
                    - (p_raw["additional_delay_minutes"] / 10.0)
                    - (fin_breakdown.net_cost / 1000.0)
                )
            else:
                score = -10000.0 # Strict barrier

            delay_m = p_raw["additional_delay_minutes"]
            delay_str = f"+{delay_m // 60}h {delay_m % 60}m" if delay_m >= 60 else f"+{delay_m}m"

            # Quality Metrics Breakdown
            quality_metrics = {
                "critical_preservation_score": 100.0 if preserves_critical else 0.0,
                "itinerary_preservation_score": round(max(0.0, 100.0 - affected_pct), 1),
                "delay_score": round(max(0.0, 100.0 - (delay_m / 6.0)), 1),
                "financial_score": round(max(0.0, 100.0 - (max(0.0, fin_breakdown.net_cost) / 500.0)), 1),
                "inconvenience_score": round(min(100.0, affected_pct * 0.4 + (delay_m / 10.0) * 0.6), 1),
                "preference_score": pref_score,
                "overall_recovery_score": round(score, 1),
                "components_preserved": len(p_raw["preserved_items"]),
                "components_modified": len(p_raw["modified_items"]),
                "components_removed": len(p_raw["removed_items"]),
                "components_added": len(p_raw["added_items"]),
                "affected_percentage": affected_pct,
                "critical_components_affected": crit_affected
            }

            confidence = "HIGH" if (is_feasible and preserves_critical) else ("MEDIUM" if is_feasible else "LOW")
            confidence_reasons = [
                "Full route and schedule verification complete." if is_feasible else "Violates schedule constraints."
            ]

            traveler_summary = (
                f"Your {event_type.lower().replace('_', ' ')} affects {components_affected} of {total_components} itinerary components. "
                f"{p_raw['title']} {'preserves your critical commitments' if preserves_critical else 'jeopardizes your critical conference'}, "
                f"{'adds ₹' + f'{int(fin_breakdown.net_cost):,}' if fin_breakdown.net_cost >= 0 else 'saves ₹' + f'{int(abs(fin_breakdown.net_cost)):,}'}, "
                f"and results in {delay_str} of additional delay."
            )

            plan_model = RecoveryPlanModel(
                plan_id=p_raw["plan_id"],
                title=p_raw["title"],
                strategy_type=p_raw["strategy_type"],
                modified_items=p_raw["modified_items"],
                removed_items=p_raw["removed_items"],
                added_items=p_raw["added_items"],
                preserved_items=p_raw["preserved_items"],
                full_recovered_items=recovered_items,
                additional_cost=fin_breakdown.new_booking_cost,
                refund_received=fin_breakdown.refund_received,
                change_fees=fin_breakdown.change_fees,
                cancellation_fees=fin_breakdown.cancellation_fees,
                net_cost=fin_breakdown.net_cost,
                currency=fin_breakdown.currency,
                additional_delay_minutes=delay_m,
                additional_delay_str=delay_str,
                components_affected=components_affected,
                total_components=total_components,
                affected_percentage=affected_pct,
                critical_components=crit_components,
                critical_components_affected=crit_affected,
                impact_score=impact_score,
                preference_score=pref_score,
                overall_score=round(score, 1),
                feasibility=is_feasible,
                infeasibility_reasons=infeas_reasons,
                preserves_critical_commitment=preserves_critical,
                is_recommended=False,
                source_itinerary_version=source_itinerary_version,
                trip_id=trip_id,
                quality_metrics=quality_metrics,
                confidence=confidence,
                confidence_reasons=confidence_reasons,
                traveler_summary=traveler_summary
            )
            processed_plans.append(plan_model)

        # Sort plans: Feasible plans first, ordered by overall_score descending
        feasible_plans = [p for p in processed_plans if p.feasibility]
        infeasible_plans = [p for p in processed_plans if not p.feasibility]

        feasible_plans.sort(key=lambda p: p.overall_score, reverse=True)

        if feasible_plans:
            feasible_plans[0].is_recommended = True

        # Generate explanations for all plans
        all_ordered = feasible_plans + infeasible_plans
        for p in all_ordered:
            exp = ExplanationEngine.generate_explanation(p.model_dump())
            p.explanation_summary = exp["summary"]
            p.explanation_details = exp

        return all_ordered
