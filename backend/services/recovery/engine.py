"""
Part 4 Recovery Engine Core Logic
Consumes Part 3 ImpactResult and generates priority-preserving and alternative recovery plans.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import copy

from .models import (
    Part4RecoveryResult,
    Part4RecoveryPlan,
    RecoveryChange,
    ActionType,
    RecoveryFeasibility,
    RecoveryPlanCategory,
)
from .providers import (
    MockFlightProvider,
    MockTrainProvider,
    MockHotelProvider,
    MockCabProvider,
    MockActivityProvider,
)


def analyze_part4_recovery(
    journey: Dict[str, Any],
    impact_result: Optional[Dict[str, Any]],
    disruptions: Optional[List[Dict[str, Any]]] = None
) -> Part4RecoveryResult:
    """
    Core Part 4 Recovery Analysis Function.
    Consumes Part 3 ImpactResult without recalculating impacts or modifying original itinerary.
    """
    trip_id = journey.get("id") or 1
    
    # 1. Check if journey is disrupted
    journey_status = impact_result.get("journey_status") if impact_result else "NORMAL"
    impact_nodes = impact_result.get("nodes", []) if impact_result else []
    
    node_impact_map = {str(n.get("node_id")): n for n in impact_nodes}
    
    nodes = journey.get("nodes") or journey.get("items") or []
    
    # Identify affected vs intact nodes
    affected_nodes = []
    intact_nodes = []
    
    for node in nodes:
        node_id_str = str(node.get("id"))
        backend_id_str = str(node.get("backendId")) if node.get("backendId") is not None else ""
        
        # Match impact item by node_id or backendId
        imp = node_impact_map.get(node_id_str) or node_impact_map.get(backend_id_str)
        status = imp.get("status") if imp else "INTACT"
        
        if status in ["BROKEN", "NEEDS_CHANGE"]:
            affected_nodes.append((node, status, imp.get("reason", "Disruption detected") if imp else "Disrupted"))
        else:
            intact_nodes.append(node)
            
    if journey_status != "DISRUPTED" or len(affected_nodes) == 0:
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="NORMAL",
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="Your journey is intact and executable as planned. No recovery options required."
        )

    # 2. Providers lookup
    providers = {
        "FLIGHT": MockFlightProvider(),
        "TRAIN": MockTrainProvider(),
        "METRO": MockTrainProvider(),
        "HOTEL": MockHotelProvider(),
        "CAB": MockCabProvider(),
        "TAXI": MockCabProvider(),
        "ACTIVITY": MockActivityProvider(),
        "EVENT": MockActivityProvider(),
    }
    
    # 3. Generate Candidate Options per Affected Node
    node_candidates: Dict[str, List[Dict[str, Any]]] = {}
    for node, status, reason in affected_nodes:
        n_type = str(node.get("type", "")).upper()
        provider = providers.get(n_type) or MockFlightProvider()
        cands = provider.search_candidates(node)
        node_candidates[str(node.get("id"))] = cands

    # 4. Build Plan 1: PRIORITY_PRESERVING ("⭐ Preserves your priorities")
    plan1_changes: List[RecoveryChange] = []
    plan1_preserved_ids = [str(n.get("id")) for n in intact_nodes]
    plan1_changed_ids = []
    plan1_preserved_priorities = []
    
    plan1_additional_cost = 0.0
    plan1_refund = 0.0
    
    # Add KEEP entries for intact nodes (PRESERVATION RULE)
    for n in intact_nodes:
        p_val = n.get("priority") or "MUST_PRESERVE"
        if p_val in ["MUST_PRESERVE", "PREFER_TO_PRESERVE"]:
            plan1_preserved_priorities.append(f"{n.get('title', 'Booking')} preserved")
            
        plan1_changes.append(RecoveryChange(
            node_id=str(n.get("id")),
            action=ActionType.KEEP,
            original_title=n.get("title", "Booking"),
            original_details=n,
            new_title=None,
            new_details=None,
            estimated_cost=0.0,
            estimated_refund=0.0,
            explanation=f"Existing {n.get('title')} booking remains unchanged and intact."
        ))

    # Add REPLACE entries for affected nodes using Candidate Option 1
    for node, status, reason in affected_nodes:
        n_id_str = str(node.get("id"))
        plan1_changed_ids.append(n_id_str)
        
        cands = node_candidates.get(n_id_str, [])
        selected_cand = cands[0] if len(cands) > 0 else None
        
        if selected_cand:
            add_cost = float(selected_cand.get("cost", 0.0)) + float(selected_cand.get("modification_fee", 0.0))
            ref_amt = float(selected_cand.get("estimated_refund", 0.0))
            
            plan1_additional_cost += add_cost
            plan1_refund += ref_amt
            
            plan1_changes.append(RecoveryChange(
                node_id=n_id_str,
                action=ActionType.REPLACE,
                original_title=node.get("title", "Booking"),
                original_details=node,
                new_title=selected_cand.get("title"),
                new_details=selected_cand,
                estimated_cost=add_cost,
                estimated_refund=ref_amt,
                explanation=selected_cand.get("explanation", f"Replacement for {node.get('title')}")
            ))
            
            p_val = node.get("priority") or "MUST_PRESERVE"
            if p_val == "MUST_PRESERVE":
                plan1_preserved_priorities.append(f"Replaced {node.get('title')} while maintaining priority timing")

    plan1 = Part4RecoveryPlan(
        id=f"plan_p4_priority_{trip_id}",
        trip_id=trip_id,
        category=RecoveryPlanCategory.PRIORITY_PRESERVING,
        title="Priority-Preserving Recovery Plan",
        feasibility=RecoveryFeasibility.FEASIBLE,
        changes=plan1_changes,
        preserved_node_ids=plan1_preserved_ids,
        changed_node_ids=plan1_changed_ids,
        dropped_node_ids=[],
        preserved_priorities=plan1_preserved_priorities,
        sacrificed_priorities=[],
        estimated_additional_cost=round(plan1_additional_cost, 2),
        estimated_refund=round(plan1_refund, 2),
        explanation="Replaces disrupted bookings while fully preserving all intact bookings and critical journey priorities.",
        is_recommended=True
    )

    # 5. Build Plan 2: ALTERNATIVE ("Flex-Time Alternative")
    plan2_changes: List[RecoveryChange] = []
    plan2_preserved_ids = [str(n.get("id")) for n in intact_nodes]
    plan2_changed_ids = []
    
    plan2_additional_cost = 0.0
    plan2_refund = 0.0
    
    # Keep intact nodes
    for n in intact_nodes:
        plan2_changes.append(RecoveryChange(
            node_id=str(n.get("id")),
            action=ActionType.KEEP,
            original_title=n.get("title", "Booking"),
            original_details=n,
            new_title=None,
            new_details=None,
            estimated_cost=0.0,
            estimated_refund=0.0,
            explanation=f"Existing {n.get('title')} booking remains unchanged."
        ))

    # Add REPLACE entries using Candidate Option 2 (if available, else Option 1)
    for node, status, reason in affected_nodes:
        n_id_str = str(node.get("id"))
        plan2_changed_ids.append(n_id_str)
        
        cands = node_candidates.get(n_id_str, [])
        selected_cand = cands[1] if len(cands) > 1 else (cands[0] if len(cands) > 0 else None)
        
        if selected_cand:
            add_cost = float(selected_cand.get("cost", 0.0)) + float(selected_cand.get("modification_fee", 0.0))
            ref_amt = float(selected_cand.get("estimated_refund", 0.0))
            
            plan2_additional_cost += add_cost
            plan2_refund += ref_amt
            
            plan2_changes.append(RecoveryChange(
                node_id=n_id_str,
                action=ActionType.REPLACE,
                original_title=node.get("title", "Booking"),
                original_details=node,
                new_title=selected_cand.get("title"),
                new_details=selected_cand,
                estimated_cost=add_cost,
                estimated_refund=ref_amt,
                explanation=selected_cand.get("explanation", f"Alternative option for {node.get('title')}")
            ))

    plan2 = Part4RecoveryPlan(
        id=f"plan_p4_alt_{trip_id}",
        trip_id=trip_id,
        category=RecoveryPlanCategory.ALTERNATIVE,
        title="Flex-Time Alternative Plan",
        feasibility=RecoveryFeasibility.FEASIBLE,
        changes=plan2_changes,
        preserved_node_ids=plan2_preserved_ids,
        changed_node_ids=plan2_changed_ids,
        dropped_node_ids=[],
        preserved_priorities=["Flexible scheduling maintained"],
        sacrificed_priorities=["Shifted departure window"],
        estimated_additional_cost=round(plan2_additional_cost, 2),
        estimated_refund=round(plan2_refund, 2),
        explanation="Alternative replacement schedule with flexible timings.",
        is_recommended=False
    )

    plans = [plan1, plan2]
    
    return Part4RecoveryResult(
        trip_id=trip_id,
        impact_status="DISRUPTED",
        plans=plans,
        priority_preserving_count=1,
        alternative_count=1,
        message="Generated 2 feasible recovery options to restore your journey."
    )
