from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import networkx as nx
from .models import ImpactStatus, NodeImpact, ImpactAssessment

PRIORITY_WEIGHTS = {
    "CRITICAL": 5.0,
    "HIGH": 3.0,
    "MEDIUM": 2.0,
    "LOW": 1.0
}

SEVERITY_WEIGHTS = {
    ImpactStatus.CANCELLED: 1.0,
    ImpactStatus.MISSED: 1.0,
    ImpactStatus.INVALID: 0.9,
    ImpactStatus.AT_RISK: 0.6,
    ImpactStatus.AFFECTED: 0.5,
    ImpactStatus.UNAFFECTED: 0.0
}

class ImpactEngine:
    @staticmethod
    def propagate_impact(graph: nx.DiGraph, event: Dict[str, Any]) -> ImpactAssessment:
        """
        Dynamically traverses downstream dependencies from the affected entity,
        evaluating timing, connection buffers, and operational viability.
        Produces a complete ImpactAssessment.
        """
        trip_id = event.get("trip_id", 0)
        event_type = event.get("event_type", "DELAY")
        entity_id = event.get("entity_id")
        event_meta = event.get("event_metadata", {})
        delay_minutes = event_meta.get("delay_minutes", 0)

        # Structure to track impact on each node
        node_impacts: Dict[int, NodeImpact] = {}
        # Timings tracking: node_id -> {start_time, end_time}
        simulated_times: Dict[int, Dict[str, datetime]] = {}

        for n_id, data in graph.nodes(data=True):
            st = data.get("start_time")
            et = data.get("end_time")
            if isinstance(st, str):
                st = datetime.fromisoformat(st)
            if isinstance(et, str):
                et = datetime.fromisoformat(et)
            simulated_times[n_id] = {"start_time": st, "end_time": et}
            
            node_impacts[n_id] = NodeImpact(
                item_id=n_id,
                type=data.get("type", "UNKNOWN"),
                title=f"{data.get('provider', '')} ({data.get('type', '')})",
                priority=data.get("priority", "MEDIUM"),
                flexibility=data.get("flexibility", "FLEXIBLE"),
                original_status=data.get("status", "CONFIRMED"),
                impact_status=ImpactStatus.UNAFFECTED,
                reason="Operating on schedule"
            )

        # 1. Evaluate Direct Impact on entity_id
        if entity_id and graph.has_node(entity_id):
            if event_type in ["DELAY", "TRAIN_DELAY", "TRANSFER_DELAY"]:
                curr_st = simulated_times[entity_id]["start_time"]
                curr_et = simulated_times[entity_id]["end_time"]
                new_st = curr_st + timedelta(minutes=delay_minutes)
                new_et = curr_et + timedelta(minutes=delay_minutes)
                simulated_times[entity_id] = {"start_time": new_st, "end_time": new_et}
                
                node_impacts[entity_id].impact_status = ImpactStatus.AFFECTED
                node_impacts[entity_id].reason = f"Delayed by {delay_minutes} minutes"
                node_impacts[entity_id].details["delay_minutes"] = delay_minutes

            elif event_type in [
                "CANCELLATION", "AIRPORT_CLOSURE", "TRAIN_CANCEL", 
                "HOTEL_UNAVAILABLE", "TRANSFER_FAILURE", "ACTIVITY_CANCELLED",
                "MISSED_TRAIN", "CHECKIN_MISSED", "ACTIVITY_MISSED"
            ]:
                node_impacts[entity_id].impact_status = ImpactStatus.CANCELLED
                node_impacts[entity_id].reason = f"Cancelled or unavailable due to {event_type.lower().replace('_', ' ')}"

            elif event_type == "USER_REQUESTED_CHANGE":
                node_impacts[entity_id].impact_status = ImpactStatus.AFFECTED
                node_impacts[entity_id].reason = "Subject to traveler requested modifications"

        # 2. Downstream Propagation via Topological Sort
        try:
            topo_nodes = list(nx.topological_sort(graph))
        except nx.NetworkXUnfeasible:
            # Fallback to sorted by start time
            topo_nodes = sorted(graph.nodes(), key=lambda n: simulated_times[n]["start_time"])

        for u in topo_nodes:
            u_impact = node_impacts[u]
            u_times = simulated_times[u]
            
            # If u is unaffected, it doesn't disrupt outgoing edges unless someone upstream disrupted it
            if u_impact.impact_status == ImpactStatus.UNAFFECTED:
                continue

            # Traverse outgoing edges (successors)
            for v in graph.successors(u):
                v_impact = node_impacts[v]
                v_times = simulated_times[v]
                edge_data = graph.get_edge_data(u, v) or {}
                dep_type = edge_data.get("dependency_type")
                
                # Rule A: If predecessor is CANCELLED or MISSED
                if u_impact.impact_status in [ImpactStatus.CANCELLED, ImpactStatus.MISSED, ImpactStatus.INVALID]:
                    if dep_type == "CONNECTION":
                        v_impact.impact_status = ImpactStatus.MISSED
                        v_impact.reason = f"Inbound connection {node_impacts[u].title} was {u_impact.impact_status.value.lower()}"
                    elif dep_type == "TRANSFER":
                        v_impact.impact_status = ImpactStatus.INVALID
                        v_impact.reason = f"Inbound flight/transport {node_impacts[u].title} was not available"
                    elif dep_type == "ACCOMMODATION":
                        v_impact.impact_status = ImpactStatus.AT_RISK
                        v_impact.reason = f"Traveler delayed/missing inbound connection to hotel"
                    elif dep_type in ["EVENT", "ACTIVITY"]:
                        v_impact.impact_status = ImpactStatus.AT_RISK
                        v_impact.reason = f"Traveler journey broken prior to {node_impacts[v].type.lower()}"
                    else:
                        v_impact.impact_status = ImpactStatus.AT_RISK
                        v_impact.reason = f"Preceding commitment {node_impacts[u].title} was disrupted"

                # Rule B: If predecessor is DELAYED / AFFECTED
                elif u_impact.impact_status == ImpactStatus.AFFECTED:
                    u_arrival = u_times["end_time"]
                    v_departure = v_times["start_time"]
                    gap_minutes = (v_departure - u_arrival).total_seconds() / 60.0

                    if dep_type == "CONNECTION":
                        min_conn = edge_data.get("minimum_connection_minutes", 60)
                        if gap_minutes < 0:
                            v_impact.impact_status = ImpactStatus.MISSED
                            v_impact.reason = f"Connection departure is {abs(gap_minutes):.0f}m before inbound flight arrives"
                            v_impact.details["negative_buffer_minutes"] = abs(gap_minutes)
                        elif gap_minutes < min_conn:
                            v_impact.impact_status = ImpactStatus.AT_RISK
                            v_impact.reason = f"Connection buffer ({gap_minutes:.0f}m) below minimum required ({min_conn}m)"
                            v_impact.details["available_buffer_minutes"] = gap_minutes
                        else:
                            # Connection still intact
                            pass

                    elif dep_type == "TRANSFER":
                        min_buf = edge_data.get("minimum_buffer_minutes", 30)
                        if gap_minutes < 0:
                            v_impact.impact_status = ImpactStatus.INVALID
                            v_impact.reason = f"Transfer scheduled before delayed flight arrives"
                        elif gap_minutes < min_buf:
                            v_impact.impact_status = ImpactStatus.AT_RISK
                            v_impact.reason = f"Tight transfer window ({gap_minutes:.0f}m)"

                    elif dep_type == "ACCOMMODATION":
                        if gap_minutes < 0:
                            v_impact.impact_status = ImpactStatus.AT_RISK
                            v_impact.reason = "Late hotel check-in due to transport delay"

                    elif dep_type in ["EVENT", "ACTIVITY"]:
                        req_buf = edge_data.get("required_arrival_buffer_minutes", 60)
                        if gap_minutes < req_buf:
                            v_impact.impact_status = ImpactStatus.AT_RISK
                            v_impact.reason = f"Insufficient arrival buffer before critical {node_impacts[v].type.lower()}"

                # Rule C: If predecessor is AT_RISK
                elif u_impact.impact_status == ImpactStatus.AT_RISK:
                    if v_impact.impact_status == ImpactStatus.UNAFFECTED:
                        v_impact.impact_status = ImpactStatus.AT_RISK
                        v_impact.reason = f"Upstream commitment {node_impacts[u].title} is at risk"


        # 3. Calculate Assessment Metrics
        total_components = len(graph.nodes)
        affected_nodes = [
            n for n in node_impacts.values()
            if n.impact_status != ImpactStatus.UNAFFECTED
        ]
        components_affected = len(affected_nodes)
        affected_pct = round((components_affected / total_components * 100.0), 1) if total_components > 0 else 0.0

        critical_nodes = [
            n for n in node_impacts.values()
            if n.priority == "CRITICAL"
        ]
        critical_components = len(critical_nodes)
        critical_affected = len([n for n in critical_nodes if n.impact_status != ImpactStatus.UNAFFECTED])

        # Impact Score calculation
        score = 0.0
        for n in affected_nodes:
            p_weight = PRIORITY_WEIGHTS.get(n.priority, 2.0)
            s_weight = SEVERITY_WEIGHTS.get(n.impact_status, 0.5)
            score += p_weight * s_weight
        impact_score = round(score, 1)

        if critical_affected > 0 or impact_score >= 10.0:
            impact_level = "CRITICAL"
        elif impact_score >= 5.0:
            impact_level = "HIGH"
        elif impact_score >= 2.0:
            impact_level = "MEDIUM"
        else:
            impact_level = "LOW"

        return ImpactAssessment(
            trip_id=trip_id,
            event_type=event_type,
            total_components=total_components,
            components_affected=components_affected,
            affected_percentage=affected_pct,
            critical_components=critical_components,
            critical_components_affected=critical_affected,
            impact_score=impact_score,
            impact_level=impact_level,
            affected_item_ids=[n.item_id for n in affected_nodes],
            node_impacts=node_impacts
        )
