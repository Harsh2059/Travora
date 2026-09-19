from typing import Dict, Any, List, Optional, Union
from datetime import datetime, timedelta
import networkx as nx
from .models import ImpactStatus, ImpactSourceKind, ImpactSource, NodeImpact, ImpactSummary, ImpactResult, JourneyStatus

STATUS_RANK = {
    ImpactStatus.INTACT: 0,
    ImpactStatus.AT_RISK: 1,
    ImpactStatus.NEEDS_CHANGE: 2,
    ImpactStatus.BROKEN: 3
}

def parse_iso_time(val: Any) -> Optional[datetime]:
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.fromisoformat(str(val))
    except Exception:
        return None

def add_impact_source(node_imp: NodeImpact, source: ImpactSource):
    """
    Appends an impact source to a NodeImpact, retaining all historical sources and reasons,
    and recalculates the aggregated status via deterministic precedence:
    BROKEN > NEEDS_CHANGE > AT_RISK > INTACT
    """
    existing = False
    for s in node_imp.impact_sources:
        if s.disruption_id == source.disruption_id and s.kind == source.kind and s.reason == source.reason:
            existing = True
            break
    if not existing:
        node_imp.impact_sources.append(source)

    # Calculate status using deterministic rank precedence
    max_status = ImpactStatus.INTACT
    for s in node_imp.impact_sources:
        if STATUS_RANK[s.status] > STATUS_RANK[max_status]:
            max_status = s.status

    node_imp.status = max_status

    # Combine reasons from non-INTACT sources
    non_intact_reasons = [s.reason for s in node_imp.impact_sources if s.status != ImpactStatus.INTACT and s.reason]
    if non_intact_reasons:
        unique_reasons = []
        for r in non_intact_reasons:
            if r not in unique_reasons:
                unique_reasons.append(r)
        node_imp.reason = " | ".join(unique_reasons)
    else:
        node_imp.reason = "Booking remains feasible."

class ImpactEngine:
    @staticmethod
    def propagate_impact(
        graph: nx.DiGraph, 
        events: Union[List[Dict[str, Any]], Dict[str, Any]]
    ) -> ImpactResult:
        """
        Calculates downstream impact for one or multiple simultaneous disruptions across all journey node types.
        Generates ONE combined ImpactResult with direct vs propagated impact sources for every node.
        Does NOT mutate database records or attempt recovery.
        """
        if isinstance(events, dict):
            event_list = [events] if events else []
        elif isinstance(events, list):
            event_list = events
        else:
            event_list = []

        trip_id = 0
        if event_list:
            trip_id = int(event_list[0].get("trip_id", 0))

        # Build initial node impact states (default INTACT)
        node_impacts: Dict[str, NodeImpact] = {}
        simulated_times: Dict[str, Dict[str, Optional[datetime]]] = {}

        for n_id, data in graph.nodes(data=True):
            st = parse_iso_time(data.get("start_time") or data.get("startTime"))
            et = parse_iso_time(data.get("end_time") or data.get("endTime"))
            simulated_times[str(n_id)] = {"start_time": st, "end_time": et}

            raw_item_id = data.get("backendId") or data.get("id")
            try:
                item_id_val = int(raw_item_id) if raw_item_id is not None and str(raw_item_id).isdigit() else None
            except Exception:
                item_id_val = None

            node_impacts[str(n_id)] = NodeImpact(
                node_id=str(n_id),
                item_id=item_id_val,
                type=str(data.get("type", "UNKNOWN")).upper(),
                title=str(data.get("title") or data.get("provider") or f"Item {n_id}"),
                priority=str(data.get("priority", "MEDIUM")).upper(),
                flexibility=str(data.get("flexibility", "FLEXIBLE")).upper(),
                original_status=str(data.get("status", "SCHEDULED")).upper(),
                status=ImpactStatus.INTACT,
                reason="Booking remains feasible.",
                impact_sources=[]
            )

        disruption_ids: List[Any] = []
        root_node_ids: List[str] = []

        # 1. Evaluate Direct Impacts for ALL Disruption Events
        for ev in event_list:
            d_id = ev.get("disruption_id") or ev.get("id")
            if d_id and d_id not in disruption_ids:
                disruption_ids.append(d_id)

            event_type = str(ev.get("event_type") or ev.get("type") or "").upper()
            entity_id_raw = ev.get("entity_id") or ev.get("affected_node_id")
            entity_id = str(entity_id_raw) if entity_id_raw is not None else None
            event_meta = dict(ev.get("event_metadata") or {})
            delay_minutes = int(event_meta.get("delay_minutes") or ev.get("delay_minutes") or 0)
            reason_meta = event_meta.get("reason") or ev.get("reason") or ""
            cause_meta = str(event_meta.get("cause") or ev.get("cause") or "").upper()
            scope_meta = str(event_meta.get("scope") or ev.get("scope") or "").upper()
            aff_loc = str(event_meta.get("affected_location") or ev.get("affected_location") or "")

            target_key = None
            if entity_id:
                if graph.has_node(entity_id):
                    target_key = entity_id
                else:
                    for n_id, d in graph.nodes(data=True):
                        if str(d.get("backendId")) == entity_id or str(d.get("id")) == entity_id:
                            target_key = str(n_id)
                            break

            if target_key:
                if target_key not in root_node_ids:
                    root_node_ids.append(target_key)
                root_imp = node_impacts[target_key]
                root_title = root_imp.title

                if any(w in event_type for w in ["CANCELLED", "UNAVAILABLE", "CLOSURE"]):
                    direct_reason = reason_meta or f"{root_title} was cancelled."
                    add_impact_source(root_imp, ImpactSource(
                        disruption_id=d_id,
                        kind=ImpactSourceKind.DIRECT,
                        status=ImpactStatus.BROKEN,
                        reason=direct_reason,
                        cause=cause_meta,
                        scope=scope_meta
                    ))
                elif "DELAYED" in event_type or "DELAY" in event_type:
                    direct_reason = reason_meta or f"{root_title} delayed by {delay_minutes} minutes."
                    add_impact_source(root_imp, ImpactSource(
                        disruption_id=d_id,
                        kind=ImpactSourceKind.DIRECT,
                        status=ImpactStatus.NEEDS_CHANGE,
                        reason=direct_reason,
                        cause=cause_meta,
                        scope=scope_meta
                    ))

                    st = simulated_times[target_key]["start_time"]
                    et = simulated_times[target_key]["end_time"]
                    if st:
                        simulated_times[target_key]["start_time"] = st + timedelta(minutes=delay_minutes)
                    if et:
                        simulated_times[target_key]["end_time"] = et + timedelta(minutes=delay_minutes)
                else:
                    direct_reason = reason_meta or f"{root_title} disrupted ({event_type})."
                    add_impact_source(root_imp, ImpactSource(
                        disruption_id=d_id,
                        kind=ImpactSourceKind.DIRECT,
                        status=ImpactStatus.BROKEN,
                        reason=direct_reason,
                        cause=cause_meta,
                        scope=scope_meta
                    ))

            # 2. Structured Weather / Shared Cause & Scope for this event
            is_weather = cause_meta in ["WEATHER", "TECHNICAL", "SECURITY", "OPERATIONAL", "NETWORK"] or "weather" in reason_meta.lower()
            if is_weather and target_key:
                root_data = graph.nodes[target_key]
                root_loc = aff_loc or root_data.get("origin") or root_data.get("location") or root_data.get("destination")
                
                for n_id, data in graph.nodes(data=True):
                    n_str = str(n_id)
                    if n_str == target_key:
                        continue
                    node_type = str(data.get("type", "")).upper()
                    if node_type in ["FLIGHT", "TRAIN", "METRO", "CAB"]:
                        node_loc = data.get("origin") or data.get("location") or data.get("destination")
                        if root_loc and node_loc and root_loc.lower() in node_loc.lower():
                            add_impact_source(node_impacts[n_str], ImpactSource(
                                disruption_id=d_id,
                                kind=ImpactSourceKind.PROPAGATED,
                                status=ImpactStatus.AT_RISK,
                                reason=f"Co-located transport at {root_loc} affected by {cause_meta or 'weather'} disruption.",
                                cause=cause_meta,
                                scope=scope_meta
                            ))

        # 3. Downstream Dependency Graph Propagation
        try:
            sorted_nodes = list(nx.topological_sort(graph))
        except Exception:
            sorted_nodes = list(graph.nodes())

        for u_id_raw in sorted_nodes:
            u = str(u_id_raw)
            u_imp = node_impacts[u]
            u_times = simulated_times[u]
            
            if not u_imp.impact_sources or u_imp.status == ImpactStatus.INTACT:
                continue

            for v_id_raw in graph.successors(u_id_raw):
                v = str(v_id_raw)
                v_imp = node_impacts[v]
                v_times = simulated_times[v]
                edge_data = graph.get_edge_data(u_id_raw, v_id_raw) or {}
                dep_type = str(edge_data.get("dependency_type", "")).upper()

                for u_source in u_imp.impact_sources:
                    if u_source.status == ImpactStatus.INTACT:
                        continue
                    
                    d_id = u_source.disruption_id
                    u_status = u_source.status

                    prop_status = ImpactStatus.INTACT
                    prop_reason = ""

                    # Rule A: Transport Connections & Transfers
                    if dep_type in ["CONNECTION", "TRANSFER"]:
                        min_buf = int(edge_data.get("minimum_connection_minutes") or edge_data.get("minimum_buffer_minutes") or 30)

                        if u_status == ImpactStatus.BROKEN:
                            prop_status = ImpactStatus.BROKEN
                            prop_reason = f"The scheduled departure occurs before the earliest feasible arrival from {u_imp.title}."
                        elif u_status == ImpactStatus.NEEDS_CHANGE:
                            u_arr = u_times["end_time"]
                            v_dep = v_times["start_time"]
                            if u_arr and v_dep:
                                gap = (v_dep - u_arr).total_seconds() / 60.0
                                if gap < 0:
                                    prop_status = ImpactStatus.BROKEN
                                    prop_reason = f"Departure occurs before inbound arrival ({abs(gap):.0f}m overlap)."
                                elif gap < min_buf:
                                    prop_status = ImpactStatus.BROKEN
                                    prop_reason = f"Required connection buffer ({min_buf}m) is no longer achievable (only {int(gap)}m available)."
                                else:
                                    prop_status = ImpactStatus.INTACT
                                    prop_reason = "Connection buffer remains valid."
                            else:
                                prop_status = ImpactStatus.AT_RISK
                                prop_reason = "Inbound arrival timing is unknown, connection cannot be verified."
                        elif u_status == ImpactStatus.AT_RISK:
                            prop_status = ImpactStatus.AT_RISK
                            prop_reason = f"Inbound transport timing from {u_imp.title} is uncertain."

                    # Rule B: Accommodation / Hotel Stay
                    elif dep_type == "ACCOMMODATION":
                        # Hotel stay is location relationship ("reachable from location")
                        if u_status == ImpactStatus.BROKEN:
                            prop_status = ImpactStatus.INTACT
                            prop_reason = "Hotel stay remains feasible."
                        elif u_status in [ImpactStatus.NEEDS_CHANGE, ImpactStatus.AT_RISK]:
                            prop_status = ImpactStatus.INTACT
                            prop_reason = "Hotel check-in window remains valid."

                    # Rule C: Activity / Event
                    elif dep_type in ["EVENT", "ACTIVITY"]:
                        v_data = graph.nodes[v_id_raw]
                        time_status = str(v_data.get("timeStatus") or v_data.get("time_status") or "").upper()
                        v_start = v_times["start_time"]

                        if time_status == "UNKNOWN" or not v_start:
                            prop_status = ImpactStatus.AT_RISK
                            prop_reason = "Event timing is not yet defined, so arrival feasibility cannot be confirmed."
                        elif u_status == ImpactStatus.BROKEN:
                            prop_status = ImpactStatus.AT_RISK
                            prop_reason = f"Traveler journey disrupted prior to {v_imp.title}."
                        elif u_status == ImpactStatus.NEEDS_CHANGE:
                            u_arr = u_times["end_time"]
                            if u_arr and v_start:
                                if u_arr > v_start:
                                    prop_status = ImpactStatus.BROKEN
                                    prop_reason = f"Scheduled arrival ({u_arr.strftime('%H:%M')}) is after event start time ({v_start.strftime('%H:%M')})."
                                else:
                                    prop_status = ImpactStatus.INTACT
                                    prop_reason = "Event timing remains feasible."
                            else:
                                prop_status = ImpactStatus.AT_RISK
                                prop_reason = "Inbound arrival timing is currently unknown, so activity feasibility cannot be confirmed."
                        elif u_status == ImpactStatus.AT_RISK:
                            prop_status = ImpactStatus.AT_RISK
                            prop_reason = f"Arrival feasibility for {v_imp.title} is uncertain due to inbound disruption."

                    if prop_status != ImpactStatus.INTACT:
                        add_impact_source(v_imp, ImpactSource(
                            disruption_id=d_id,
                            kind=ImpactSourceKind.PROPAGATED,
                            status=prop_status,
                            reason=prop_reason,
                            cause=u_source.cause,
                            scope=u_source.scope
                        ))

        # 4. Construct Aggregate ImpactSummary and Node Impact List
        summary = ImpactSummary()
        nodes_list: List[NodeImpact] = []
        node_impacts_map: Dict[str, NodeImpact] = {}

        for n_id_str, imp in node_impacts.items():
            if imp.status == ImpactStatus.INTACT:
                summary.intact += 1
            elif imp.status == ImpactStatus.AT_RISK:
                summary.at_risk += 1
            elif imp.status == ImpactStatus.NEEDS_CHANGE:
                summary.needs_change += 1
            elif imp.status == ImpactStatus.BROKEN:
                summary.broken += 1

            nodes_list.append(imp)
            node_impacts_map[n_id_str] = imp

        first_disruption_id = disruption_ids[0] if disruption_ids else None
        first_root_node_id = root_node_ids[0] if root_node_ids else None

        # Determine journey-level feasibility.
        # DISRUPTED = at least one node that was evaluated as part of this active
        # disruption run is BROKEN or NEEDS_CHANGE, meaning the original journey
        # can no longer be completed as planned.
        # AT_RISK alone keeps the journey NORMAL (feasible, but at risk).
        journey_status = JourneyStatus.NORMAL
        if disruption_ids:  # Only compute when there is an active disruption
            for imp in nodes_list:
                if imp.status in (ImpactStatus.BROKEN, ImpactStatus.NEEDS_CHANGE):
                    journey_status = JourneyStatus.DISRUPTED
                    break

        return ImpactResult(
            trip_id=trip_id,
            disruption_ids=disruption_ids,
            root_node_ids=root_node_ids,
            disruption_id=first_disruption_id,
            root_node_id=first_root_node_id,
            summary=summary,
            nodes=nodes_list,
            node_impacts=node_impacts_map,
            journey_status=journey_status,
        )
