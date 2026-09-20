import sys
import os
sys.path.append(os.path.abspath("backend"))

from services.recovery.models import Part4RecoveryPlan, RecoveryChange

def test_successor_matching_basic():
    # Old plan: Indigo replaced by Air India Express
    old_plan = Part4RecoveryPlan(
        id="plan_old",
        trip_id=1,
        category="PRIORITY_PRESERVING",
        title="Priority-Preserving (Air India Express)",
        feasibility="FEASIBLE",
        changes=[
            RecoveryChange(
                node_id="flight_1",
                action="REPLACE",
                original_title="Indigo 6E-201",
                new_title="Air India Express AI-2091",
                estimated_cost=2500.0,
                estimated_refund=2000.0,
                explanation="Replaced flight with Air India Express"
            ),
            RecoveryChange(
                node_id="hotel_1",
                action="KEEP",
                original_title="Hotel Ram",
                explanation="Preserved"
            )
        ],
        preserved_node_ids=["hotel_1"],
        changed_node_ids=["flight_1"],
        dropped_node_ids=[],
        preserved_priorities=["MUST_PRESERVE"],
        sacrificed_priorities=[],
        estimated_additional_cost=2500.0,
        estimated_refund=2000.0,
        explanation="Old recovery plan"
    )

    # Candidate 1: Air India Express + Replacement Hotel ABC (Successor)
    candidate_1 = Part4RecoveryPlan(
        id="cand_1",
        trip_id=1,
        category="PRIORITY_PRESERVING",
        title="Priority-Preserving (Air India Express + Hotel ABC)",
        feasibility="FEASIBLE",
        changes=[
            RecoveryChange(
                node_id="flight_1",
                action="REPLACE",
                original_title="Indigo 6E-201",
                new_title="Air India Express AI-2091",
                estimated_cost=2500.0,
                estimated_refund=2000.0,
                explanation="Replaced flight with Air India Express"
            ),
            RecoveryChange(
                node_id="hotel_1",
                action="REPLACE",
                original_title="Hotel Ram",
                new_title="Hotel ABC London",
                estimated_cost=4000.0,
                estimated_refund=3500.0,
                explanation="Replaced hotel with Hotel ABC"
            )
        ],
        preserved_node_ids=[],
        changed_node_ids=["flight_1", "hotel_1"],
        dropped_node_ids=[],
        preserved_priorities=["MUST_PRESERVE"],
        sacrificed_priorities=[],
        estimated_additional_cost=6500.0,
        estimated_refund=5500.0,
        explanation="New recovery plan with both replacements"
    )

    # Candidate 2: Vistara + Replacement Hotel ABC (Different choice)
    candidate_2 = Part4RecoveryPlan(
        id="cand_2",
        trip_id=1,
        category="ALTERNATIVE",
        title="Alternative (Vistara + Hotel ABC)",
        feasibility="FEASIBLE",
        changes=[
            RecoveryChange(
                node_id="flight_1",
                action="REPLACE",
                original_title="Indigo 6E-201",
                new_title="Vistara UK-991",
                estimated_cost=3000.0,
                estimated_refund=2000.0,
                explanation="Replaced flight with Vistara"
            ),
            RecoveryChange(
                node_id="hotel_1",
                action="REPLACE",
                original_title="Hotel Ram",
                new_title="Hotel ABC London",
                estimated_cost=4000.0,
                estimated_refund=3500.0,
                explanation="Replaced hotel with Hotel ABC"
            )
        ],
        preserved_node_ids=[],
        changed_node_ids=["flight_1", "hotel_1"],
        dropped_node_ids=[],
        preserved_priorities=[],
        sacrificed_priorities=[],
        estimated_additional_cost=7000.0,
        estimated_refund=5500.0,
        explanation="Alternative recovery plan"
    )

    # Successor matching python verification
    old_replacements = {c.node_id: c.new_title for c in old_plan.changes if c.action in ["REPLACE", "MODIFY"] and c.new_title}
    
    matched = None
    for cand in [candidate_1, candidate_2]:
        cand_map = {c.node_id: c.new_title for c in cand.changes if c.action in ["REPLACE", "MODIFY"] and c.new_title}
        if all(cand_map.get(nid) == val for nid, val in old_replacements.items()):
            matched = cand
            break

    assert matched is not None, "Candidate 1 should be matched as successor"
    assert matched.id == "cand_1", "Candidate 1 ID must match"
    print("[PASS] TEST SUCCESSOR MATCHING: Candidate 1 matched correctly as successor to old plan")

if __name__ == "__main__":
    test_successor_matching_basic()
