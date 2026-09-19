from typing import List, Optional, Dict, Any
import networkx as nx
import re
from datetime import datetime

class DependencyType:
    TEMPORAL = "TEMPORAL"
    CONNECTION = "CONNECTION"
    LOCATION = "LOCATION"
    TRANSFER = "TRANSFER"
    ACCOMMODATION = "ACCOMMODATION"
    ACTIVITY = "ACTIVITY"
    EVENT = "EVENT"
    CUSTOM = "CUSTOM"

def normalize_loc(location: Optional[str]) -> List[str]:
    """Extract normalized tokens from location string like 'Mumbai (BOM)' -> ['mumbai', 'bom']"""
    if not location:
        return []
    cleaned = location.lower()
    parens = re.findall(r'\(([a-z0-9]+)\)', cleaned)
    words = re.findall(r'\b[a-z0-9]+\b', cleaned)
    tokens = list(set(parens + words))
    return tokens

def locations_match(loc1: Optional[str], loc2: Optional[str]) -> bool:
    if not loc1 or not loc2:
        return False
    tokens1 = set(normalize_loc(loc1))
    tokens2 = set(normalize_loc(loc2))
    return bool(tokens1.intersection(tokens2))

def build_dependency_graph(
    items: List[Any], 
    explicit_dependencies: Optional[List[Any]] = None,
    validate: bool = True
) -> nx.DiGraph:
    """
    Dynamically builds a NetworkX DiGraph representing the digital twin itinerary and its dependencies.
    DOES NOT use array order as a dependency — edges are constructed based strictly on location continuity,
    transport connections, stay attachments, and explicit dependency metadata.
    """
    G = nx.DiGraph()

    if not items:
        return G

    # Normalize items to dict
    item_nodes = []
    for item in items:
        if isinstance(item, dict):
            d = dict(item)
        elif hasattr(item, "__dict__"):
            d = {c.name: getattr(item, c.name) for c in item.__table__.columns} if hasattr(item, "__table__") else item.__dict__.copy()
        else:
            d = dict(item)
        
        d.pop("_sa_instance_state", None)
        item_nodes.append(d)

    # Retain original index for structural ordering
    for idx, d in enumerate(item_nodes):
        d["_orig_idx"] = idx

    def parse_time(val):
        if not val:
            return datetime.max
        if isinstance(val, datetime):
            return val
        try:
            return datetime.fromisoformat(str(val))
        except Exception:
            return datetime.max

    item_nodes.sort(key=lambda x: x["_orig_idx"])

    # Add nodes to graph
    for d in item_nodes:
        node_id = str(d.get("id"))
        G.add_node(node_id, **d)

    # If explicit dependencies are provided, apply them
    explicit_edge_pairs = set()
    if explicit_dependencies:
        for dep in explicit_dependencies:
            src = str(dep.source_id if hasattr(dep, "source_id") else dep.get("source_id"))
            tgt = str(dep.target_id if hasattr(dep, "target_id") else dep.get("target_id"))
            dep_type = dep.dependency_type if hasattr(dep, "dependency_type") else dep.get("dependency_type", DependencyType.CUSTOM)
            meta = dep.item_metadata if hasattr(dep, "item_metadata") else dep.get("item_metadata", {})
            if G.has_node(src) and G.has_node(tgt):
                G.add_edge(src, tgt, dependency_type=dep_type, **meta)
                explicit_edge_pairs.add((src, tgt))

    # Dynamic Inference of Explicit Dependencies
    n = len(item_nodes)
    for i in range(n):
        curr = item_nodes[i]
        curr_id = str(curr["id"])
        curr_type = str(curr.get("type", "")).upper()
        curr_dest = curr.get("destination") or curr.get("location")
        curr_end_dt = parse_time(curr.get("end_time") or curr.get("endTime"))

        for j in range(i + 1, n):
            nxt = item_nodes[j]
            nxt_id = str(nxt["id"])
            if (curr_id, nxt_id) in explicit_edge_pairs:
                continue

            nxt_type = str(nxt.get("type", "")).upper()
            nxt_orig = nxt.get("origin") or nxt.get("location")
            nxt_start_dt = parse_time(nxt.get("start_time") or nxt.get("startTime"))

            # Rule 1: Transport Connection (FLIGHT / TRAIN / METRO -> FLIGHT / TRAIN / METRO)
            if curr_type in ["FLIGHT", "TRAIN", "METRO"] and nxt_type in ["FLIGHT", "TRAIN", "METRO"]:
                if locations_match(curr.get("destination"), nxt.get("origin")):
                    if curr_end_dt != datetime.max and nxt_start_dt != datetime.max:
                        wait_minutes = (nxt_start_dt - curr_end_dt).total_seconds() / 60.0
                        if 0 <= wait_minutes <= 1440: # connection within 24h
                            G.add_edge(
                                curr_id, nxt_id,
                                dependency_type=DependencyType.CONNECTION,
                                minimum_connection_minutes=60,
                                buffer_minutes=int(wait_minutes)
                            )
                            break

            # Rule 2: Transport -> Cab / Transfer
            elif curr_type in ["FLIGHT", "TRAIN", "METRO"] and nxt_type in ["CAB", "TAXI", "TRANSFER"]:
                if locations_match(curr.get("destination"), nxt.get("origin") or nxt.get("location")):
                    if curr_end_dt != datetime.max and nxt_start_dt != datetime.max:
                        wait_minutes = (nxt_start_dt - curr_end_dt).total_seconds() / 60.0
                        if 0 <= wait_minutes <= 360:
                            G.add_edge(
                                curr_id, nxt_id,
                                dependency_type=DependencyType.TRANSFER,
                                minimum_buffer_minutes=30,
                                buffer_minutes=int(wait_minutes)
                            )
                            break
                    else:
                        # Unknown timing but location matches -> add TRANSFER edge for feasibility checking
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.TRANSFER,
                            minimum_buffer_minutes=30
                        )
                        break

            # Rule 3: Transport / Transfer -> Accommodation (Hotel)
            elif curr_type in ["FLIGHT", "TRAIN", "METRO", "CAB", "TAXI", "TRANSFER"] and nxt_type in ["HOTEL", "STAY"]:
                dest = curr.get("destination") or curr.get("location")
                if locations_match(dest, nxt.get("location")):
                    G.add_edge(
                        curr_id, nxt_id,
                        dependency_type=DependencyType.ACCOMMODATION
                    )
                    break

            # Rule 4: Hotel or Transport -> Event / Activity
            elif curr_type in ["HOTEL", "STAY", "CAB", "TAXI", "TRANSFER", "FLIGHT", "TRAIN", "METRO"] and nxt_type in ["EVENT", "ACTIVITY", "TICKET"]:
                loc_match = locations_match(curr.get("destination") or curr.get("location"), nxt.get("location"))
                if loc_match:
                    G.add_edge(
                        curr_id, nxt_id,
                        dependency_type=DependencyType.EVENT if nxt_type == "EVENT" else DependencyType.ACTIVITY,
                        required_arrival_buffer_minutes=30
                    )

    # NOTE: Array-order fallback loop intentionally omitted to preserve core rule:
    # "Chronological adjacency is NOT automatically a dependency."

    return G
