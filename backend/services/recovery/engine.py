"""
Part 4 Recovery Engine Core Logic
Consumes Part 3 ImpactResult and generates priority-preserving and alternative recovery plans.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import itertools
import copy

from .models import (
    Part4RecoveryResult,
    Part4RecoveryPlan,
    RecoveryChange,
    CostEstimate,
    ActionType,
    RecoveryFeasibility,
    RecoveryPlanCategory,
    RecoveryAnalysisStatus,
)
from .providers import (
    MockFlightProvider,
    MockTrainProvider,
    MockHotelProvider,
    MockCabProvider,
    MockActivityProvider,
)
from .feasibility import (
    MAX_VISIBLE_RECOVERY_OPTIONS,
    filter_flight_candidates,
    rank_flight_candidates,
    type_label,
)


def analyze_part4_recovery(
    journey: Dict[str, Any],
    impact_result: Optional[Dict[str, Any]],
    disruptions: Optional[List[Dict[str, Any]]] = None,
    preference: str = "PRESERVE_PRIORITIES",
    max_budget: Optional[float] = None,
    known_unavailable: Optional[List[Any]] = None,
) -> Part4RecoveryResult:
    """
    Core Part 4 Recovery Analysis Function.
    Consumes Part 3 ImpactResult without recalculating impacts or modifying original itinerary.
    Pipeline:
      Candidates -> Hard constraints -> MUST_PRESERVE check -> Cost calculation -> Deduplicate -> Budget filter -> Feasible plans -> User preference ordering.
    """
    trip_id = journey.get("id") or 1
    
    # Extract known_unavailable list if not passed explicitly
    known_unavail_list = known_unavailable or journey.get("known_unavailable") or (impact_result.get("known_unavailable") if impact_result else None) or []
    
    # 1. Check if journey is disrupted
    journey_status = impact_result.get("journey_status") if impact_result else "NORMAL"
    impact_nodes = impact_result.get("nodes", []) if impact_result else []
    
    node_impact_map = {str(n.get("node_id")): n for n in impact_nodes}
    nodes = journey.get("nodes") or journey.get("items") or []
    
    # Identify affected vs intact nodes (only direct disruptions are recovery targets)
    affected_nodes = []
    intact_nodes = []
    
    root_node_ids = impact_result.get("root_node_ids", []) if impact_result else []
    
    for node in nodes:
        node_id_str = str(node.get("id"))
        backend_id_str = str(node.get("backendId")) if node.get("backendId") is not None else ""
        
        # Match impact item by node_id or backendId
        imp = node_impact_map.get(node_id_str) or node_impact_map.get(backend_id_str)
        status = imp.get("status") if imp else "INTACT"
        
        # Check if it's a primary disruption (direct impact source or in root_node_ids)
        is_primary = False
        if node_id_str in root_node_ids or backend_id_str in root_node_ids:
            is_primary = True
        elif imp:
            sources = imp.get("impact_sources", [])
            has_direct = any(str(s.get("kind", "")).upper().endswith("DIRECT") for s in sources)
            has_propagated = any(str(s.get("kind", "")).upper().endswith("PROPAGATED") for s in sources)
            if has_direct:
                is_primary = True
            elif not has_propagated and not root_node_ids:
                is_primary = True
        else:
            is_primary = True
                
        if status in ["BROKEN", "NEEDS_CHANGE"] and is_primary:
            affected_nodes.append((node, status, imp.get("reason", "Disruption detected") if imp else "Disrupted"))
        else:
            intact_nodes.append(node)
            
    if journey_status != "DISRUPTED":
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="NORMAL",
            status=RecoveryAnalysisStatus.OPTIONS_AVAILABLE,
            total_feasible_plans=0,
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="Your journey is intact and executable as planned. No recovery options required."
        )

    if len(affected_nodes) == 0:
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="DISRUPTED",
            status=RecoveryAnalysisStatus.NO_FEASIBLE_RECOVERY,
            total_feasible_plans=0,
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="Journey is disrupted, but no recoverable bookings could be mapped to generate alternatives. Try resetting the simulation and re-triggering the disruption."
        )

    # 2. Providers lookup
    providers = {
        "FLIGHT": MockFlightProvider(),
        "TRAIN": MockTrainProvider(),
        "METRO": MockTrainProvider(),
        "HOTEL": MockHotelProvider(),
        "CAB": MockCabProvider(),
        "TAXI": MockCabProvider(),
        "TRANSFER": MockCabProvider(),
        "ACTIVITY": MockActivityProvider(),
        "EVENT": MockActivityProvider(),
    }
    
    # 3. Generate Candidate Options per Affected Node
    node_candidates: Dict[str, List[Dict[str, Any]]] = {}
    has_unrecoverable_must_preserve = False

    for node, status, reason in affected_nodes:
        n_id_str = str(node.get("id"))
        n_type = str(node.get("type", "")).upper()
        provider = providers.get(n_type)
        search_ctx = {
            "known_unavailable": known_unavail_list,
            "journey_nodes": nodes,
            "inventory": journey.get("flight_inventory"),
        }
        cands = provider.search_candidates(node, context=search_ctx) if provider else []
        if n_type == "FLIGHT":
            cands = rank_flight_candidates(filter_flight_candidates(cands, node, nodes))
        
        # If node priority is MUST_PRESERVE and zero candidates exist
        node_priority = str(node.get("priority") or "HIGH").upper()
        if len(cands) == 0 and node_priority == "MUST_PRESERVE":
            has_unrecoverable_must_preserve = True
            
        node_candidates[n_id_str] = cands


    if has_unrecoverable_must_preserve:
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="DISRUPTED",
            status=RecoveryAnalysisStatus.NO_FEASIBLE_RECOVERY,
            total_feasible_plans=0,
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="NO FEASIBLE RECOVERY. A critical journey requirement can no longer be preserved with the available recovery options."
        )

    # 4. Form Candidate Combinations Across Affected Nodes
    # Skip nodes with no candidates (they can't be recovered but don't block nodes that CAN be).
    # Only include affected nodes that have at least one candidate.
    recoverable_affected = [(node, status, reason) for (node, status, reason) in affected_nodes if len(node_candidates.get(str(node.get("id")), [])) > 0]
    unrecoverable_affected = [(node, status, reason) for (node, status, reason) in affected_nodes if len(node_candidates.get(str(node.get("id")), [])) == 0]
    
    if len(recoverable_affected) == 0:
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="DISRUPTED",
            status=RecoveryAnalysisStatus.NO_FEASIBLE_RECOVERY,
            total_feasible_plans=0,
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="NO FEASIBLE RECOVERY. No alternative options were found for the affected booking(s). The disrupted route may not be in the supported recovery inventory, or all alternatives are unavailable."
        )
    
    affected_node_ids = [str(node.get("id")) for node, _, _ in recoverable_affected]
    candidate_lists = [node_candidates.get(nid, []) for nid in affected_node_ids]

    # Generate Cartesian product combinations (up to 20 max)
    all_combinations = list(itertools.product(*candidate_lists))[:20]
    
    candidate_plans: List[Part4RecoveryPlan] = []
    seen_dedup_keys = set()
    
    for idx, combo in enumerate(all_combinations):
        plan_changes: List[RecoveryChange] = []
        preserved_ids = [str(n.get("id")) for n in intact_nodes]
        changed_ids = []
        preserved_priorities = []
        sacrificed_priorities = []
        
        # Keep intact nodes
        for n in intact_nodes:
            p_val = n.get("priority") or "MUST_PRESERVE"
            if p_val in ["MUST_PRESERVE", "PREFER_TO_PRESERVE"]:
                preserved_priorities.append(f"{n.get('title', 'Booking')} preserved")
            plan_changes.append(RecoveryChange(
                node_id=str(n.get("id")),
                action=ActionType.KEEP,
                original_title=n.get("title", "Booking"),
                original_details=n,
                new_title=None,
                new_details=None,
                estimated_cost=0.0,
                estimated_refund=0.0,
                explanation=(
                    f"Would keep {type_label(n)} — still feasible after the replacement arrival."
                )
            ))
            
        # Replaced affected nodes according to candidate combo
        dedup_tuples = []
        
        repl_cost_sum: Optional[float] = 0.0
        mod_fees_sum: Optional[float] = 0.0
        canc_pen_sum: Optional[float] = 0.0
        est_refund_sum: Optional[float] = 0.0
        
        plan_is_partial = False
        total_duration = 0
        total_transfers = 0
        all_direct = True
        
        for (node, status, reason), cand in zip(recoverable_affected, combo):
            n_id_str = str(node.get("id"))
            changed_ids.append(n_id_str)
            cand_id = cand.get("candidate_id") or cand.get("booking_id") or cand.get("title")
            dedup_tuples.append((n_id_str, cand_id))
            
            # Cost breakdown tracking
            c_cost = cand.get("cost")
            c_mod = cand.get("modification_fee")
            c_pen = cand.get("cancellation_penalty")
            c_ref = cand.get("estimated_refund")
            
            if c_cost is None: plan_is_partial = True
            else: repl_cost_sum = (repl_cost_sum or 0.0) + float(c_cost)
            
            if c_mod is None: plan_is_partial = True
            else: mod_fees_sum = (mod_fees_sum or 0.0) + float(c_mod)
            
            if c_pen is None: plan_is_partial = True
            else: canc_pen_sum = (canc_pen_sum or 0.0) + float(c_pen)
            
            if c_ref is None: plan_is_partial = True
            else: est_refund_sum = (est_refund_sum or 0.0) + float(c_ref)

            total_duration += cand.get("duration_minutes", 150)
            if not cand.get("is_direct", True):
                all_direct = False
                total_transfers += 1
            
            single_add_cost = float(c_cost or 0.0) + float(c_mod or 0.0)
            single_refund = float(c_ref or 0.0)
            
            plan_changes.append(RecoveryChange(
                node_id=n_id_str,
                action=ActionType.REPLACE,
                original_title=node.get("title", "Booking"),
                original_details=node,
                new_title=cand.get("title"),
                new_details=cand,
                provider=cand.get("provider") or node.get("provider"),
                type=cand.get("type") or node.get("type") or "FLIGHT",
                origin=cand.get("origin") or node.get("origin"),
                destination=cand.get("destination") or node.get("destination"),
                start_time=cand.get("start_time") or cand.get("startTime") or cand.get("departure_time"),
                end_time=cand.get("end_time") or cand.get("endTime") or cand.get("arrival_time"),
                estimated_cost=single_add_cost,
                estimated_refund=single_refund,
                explanation=cand.get("explanation", f"Replacement candidate for {node.get('title')}")
            ))
            
            p_val = node.get("priority") or "MUST_PRESERVE"
            if p_val in ["MUST_PRESERVE", "PREFER_TO_PRESERVE"]:
                preserved_priorities.append(f"Replaced {node.get('title')} with {cand.get('provider')}")

        # Deduplication check
        dedup_key = tuple(sorted(dedup_tuples))
        if dedup_key in seen_dedup_keys:
            continue
        seen_dedup_keys.add(dedup_key)
        
        # Calculate Total Cost Estimate
        if not plan_is_partial and repl_cost_sum is not None and mod_fees_sum is not None and canc_pen_sum is not None and est_refund_sum is not None:
            net_additional_cost = round(repl_cost_sum + mod_fees_sum + canc_pen_sum - est_refund_sum, 2)
        else:
            partial_base = (repl_cost_sum or 0.0) + (mod_fees_sum or 0.0) + (canc_pen_sum or 0.0) - (est_refund_sum or 0.0)
            net_additional_cost = round(partial_base, 2)
            
        cost_est = CostEstimate(
            replacement_cost=repl_cost_sum,
            modification_fees=mod_fees_sum,
            cancellation_penalties=canc_pen_sum,
            estimated_refunds=est_refund_sum,
            estimated_additional_cost=net_additional_cost,
            currency="INR",
            is_partial=plan_is_partial
        )

        category = RecoveryPlanCategory.PRIORITY_PRESERVING if idx == 0 else RecoveryPlanCategory.ALTERNATIVE
        primary_cand_title = combo[0].get("provider") or combo[0].get("title", "Option")
        plan_title = f"Priority-Preserving ({primary_cand_title})" if idx == 0 else f"Alternative ({primary_cand_title})"

        combo_would_change = []
        combo_would_keep = []
        for cand in combo:
            for label in cand.get("would_change") or []:
                if label not in combo_would_change:
                    combo_would_change.append(label)
            for label in cand.get("would_keep") or [type_label(n) for n in intact_nodes]:
                if label not in combo_would_keep and label not in combo_would_change:
                    combo_would_keep.append(label)
        if not combo_would_change:
            combo_would_change = [type_label(n) for n, _, _ in affected_nodes]
        if not combo_would_keep:
            combo_would_keep = [type_label(n) for n in intact_nodes]

        keep_change_summary = (
            f"Would change: {', '.join(combo_would_change) or '—'}. "
            f"Would keep: {', '.join(combo_would_keep) or '—'}."
        )
        cand_expl = combo[0].get("explanation", "Feasible recovery option preserving your journey.")
        plan = Part4RecoveryPlan(
            id=f"plan_p4_{idx+1}_{trip_id}",
            trip_id=trip_id,
            category=category,
            title=plan_title,
            feasibility=RecoveryFeasibility.FEASIBLE,
            changes=plan_changes,
            preserved_node_ids=preserved_ids,
            changed_node_ids=changed_ids,
            dropped_node_ids=[],
            preserved_priorities=preserved_priorities,
            sacrificed_priorities=sacrificed_priorities,
            cost_estimate=cost_est,
            estimated_additional_cost=net_additional_cost,
            estimated_refund=round(est_refund_sum or 0.0, 2),
            explanation=f"{cand_expl} {keep_change_summary}",
            is_recommended=(idx == 0),
            total_transfers=total_transfers,
            total_duration_minutes=total_duration,
            total_changes_count=len(changed_ids),
            is_direct=all_direct,
            would_change=combo_would_change,
            would_keep=combo_would_keep,
        )
        candidate_plans.append(plan)

    if len(candidate_plans) == 0:
        return Part4RecoveryResult(
            trip_id=trip_id,
            impact_status="DISRUPTED",
            status=RecoveryAnalysisStatus.NO_FEASIBLE_RECOVERY,
            total_feasible_plans=0,
            plans=[],
            priority_preserving_count=0,
            alternative_count=0,
            message="NO FEASIBLE RECOVERY. A critical journey requirement can no longer be preserved with the available recovery options."
        )

    # 5. Budget Filtering (Applied BEFORE Preference Ordering)
    if max_budget is not None and max_budget > 0:
        plans_within_budget = [
            p for p in candidate_plans
            if p.estimated_additional_cost is not None and p.estimated_additional_cost <= max_budget
        ]
        if len(plans_within_budget) == 0:
            return Part4RecoveryResult(
                trip_id=trip_id,
                impact_status="DISRUPTED",
                status=RecoveryAnalysisStatus.BUDGET_EXCEEDED,
                total_feasible_plans=0,
                plans=[],
                priority_preserving_count=0,
                alternative_count=0,
                message="No recovery option within your budget. The available recovery options exceed your selected budget."
            )
    else:
        plans_within_budget = candidate_plans

    # 6. User Preference Ordering
    pref_upper = (preference or "PRESERVE_PRIORITIES").upper().replace(" ", "_")
    
    if pref_upper == "LOWEST_COST":
        plans_within_budget.sort(
            key=lambda p: (p.estimated_additional_cost is None, p.estimated_additional_cost or 0.0)
        )
    elif pref_upper == "MORE_COMFORTABLE":
        plans_within_budget.sort(
            key=lambda p: (p.total_transfers, p.total_changes_count, p.total_duration_minutes, not p.is_direct)
        )
    elif pref_upper == "FEWEST_CHANGES":
        plans_within_budget.sort(
            key=lambda p: (p.total_changes_count, p.estimated_additional_cost or 0.0)
        )
    elif pref_upper == "PRESERVE_PRIORITIES":
        plans_within_budget.sort(
            key=lambda p: (p.category != RecoveryPlanCategory.PRIORITY_PRESERVING, -len(p.preserved_priorities))
        )
    elif pref_upper == "BALANCED":
        plans_within_budget.sort(
            key=lambda p: (
                p.category != RecoveryPlanCategory.PRIORITY_PRESERVING,
                -(len(p.preserved_priorities) * 100 - p.total_changes_count * 20 - (p.estimated_additional_cost or 0.0) / 100)
            )
        )

    if len(plans_within_budget) > 0:
        for p in plans_within_budget:
            p.is_recommended = False
        plans_within_budget[0].is_recommended = True

    total_feasible = len(plans_within_budget)
    visible_plans = plans_within_budget[:MAX_VISIBLE_RECOVERY_OPTIONS]
    additional_plans = plans_within_budget[MAX_VISIBLE_RECOVERY_OPTIONS:]
    p_preserving_cnt = len([p for p in visible_plans if p.category == RecoveryPlanCategory.PRIORITY_PRESERVING])
    alt_cnt = len(visible_plans) - p_preserving_cnt

    return Part4RecoveryResult(
        trip_id=trip_id,
        impact_status="DISRUPTED",
        status=RecoveryAnalysisStatus.OPTIONS_AVAILABLE,
        total_feasible_plans=total_feasible,
        plans=visible_plans,
        additional_plans=additional_plans,
        default_visible_count=MAX_VISIBLE_RECOVERY_OPTIONS,
        priority_preserving_count=p_preserving_cnt,
        alternative_count=alt_cnt,
        message=(
            f"We found {total_feasible} feasible recovery option"
            f"{'s' if total_feasible != 1 else ''} to restore your journey. "
            "Availability is simulated (not live airline inventory)."
        )
    )
