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
    """Extract normalized tokens from location string like 'London (LHR)' -> ['london', 'lhr']"""
    if not location:
        return []
    cleaned = location.lower()
    # extract code in parens if any
    parens = re.findall(r'\(([a-z0-9]+)\)', cleaned)
    # extract main words
    words = re.findall(r'\b[a-z]{3,}\b', cleaned)
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
    Items can be ItineraryItem SQLAlchemy models, Pydantic schemas, or dicts.
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
        
        # Remove SQLAlchemy instance state if present
        d.pop("_sa_instance_state", None)
        item_nodes.append(d)

    # Sort items chronologically by start_time
    item_nodes.sort(key=lambda x: x["start_time"] if isinstance(x["start_time"], datetime) else datetime.fromisoformat(str(x["start_time"])))

    # Add nodes to graph
    for d in item_nodes:
        node_id = d["id"]
        G.add_node(node_id, **d)

    # If explicit dependencies are provided, apply them
    explicit_edge_pairs = set()
    if explicit_dependencies:
        for dep in explicit_dependencies:
            src = dep.source_id if hasattr(dep, "source_id") else dep.get("source_id")
            tgt = dep.target_id if hasattr(dep, "target_id") else dep.get("target_id")
            dep_type = dep.dependency_type if hasattr(dep, "dependency_type") else dep.get("dependency_type", DependencyType.CUSTOM)
            meta = dep.item_metadata if hasattr(dep, "item_metadata") else dep.get("item_metadata", {})
            if G.has_node(src) and G.has_node(tgt):
                G.add_edge(src, tgt, dependency_type=dep_type, **meta)
                explicit_edge_pairs.add((src, tgt))

    # Dynamic Inference of Dependencies
    n = len(item_nodes)
    for i in range(n):
        curr = item_nodes[i]
        curr_id = curr["id"]
        curr_type = curr.get("type")
        curr_dest = curr.get("destination") or curr.get("location")
        curr_end = curr.get("end_time")
        if isinstance(curr_end, str):
            curr_end = datetime.fromisoformat(curr_end)

        # Look forward to find candidates
        for j in range(i + 1, n):
            nxt = item_nodes[j]
            nxt_id = nxt["id"]
            if (curr_id, nxt_id) in explicit_edge_pairs:
                continue

            nxt_type = nxt.get("type")
            nxt_orig = nxt.get("origin") or nxt.get("location")
            nxt_start = nxt.get("start_time")
            if isinstance(nxt_start, str):
                nxt_start = datetime.fromisoformat(nxt_start)

            # Rule 1: Transport Connection (FLIGHT -> FLIGHT / TRAIN)
            if curr_type in ["FLIGHT", "TRAIN"] and nxt_type in ["FLIGHT", "TRAIN"]:
                if locations_match(curr.get("destination"), nxt.get("origin")):
                    # Direct connection
                    wait_minutes = (nxt_start - curr_end).total_seconds() / 60.0
                    if 0 <= wait_minutes <= 720: # connection within 12 hours
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.CONNECTION,
                            minimum_connection_minutes=60,
                            maximum_wait_minutes=720,
                            buffer_minutes=int(wait_minutes)
                        )
                        break # Only connect to the immediate next connecting leg

            # Rule 2: Transport -> Transfer
            elif curr_type in ["FLIGHT", "TRAIN"] and nxt_type == "TRANSFER":
                if locations_match(curr.get("destination"), nxt.get("origin")):
                    wait_minutes = (nxt_start - curr_end).total_seconds() / 60.0
                    if 0 <= wait_minutes <= 360:
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.TRANSFER,
                            minimum_buffer_minutes=30,
                            buffer_minutes=int(wait_minutes)
                        )
                        break

            # Rule 3: Transport / Transfer -> Accommodation (Hotel)
            elif curr_type in ["FLIGHT", "TRAIN", "TRANSFER"] and nxt_type == "HOTEL":
                dest = curr.get("destination") or curr.get("location")
                if locations_match(dest, nxt.get("location")):
                    wait_minutes = (nxt_start - curr_end).total_seconds() / 60.0
                    if wait_minutes >= 0:
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.ACCOMMODATION,
                            minimum_buffer_minutes=30,
                            buffer_minutes=int(wait_minutes)
                        )
                        break

            # Rule 4: Hotel or Arrival Transport -> Event / Activity
            elif curr_type in ["HOTEL", "TRANSFER", "FLIGHT", "TRAIN"] and nxt_type in ["EVENT", "ACTIVITY"]:
                loc_match = locations_match(curr.get("destination") or curr.get("location"), nxt.get("location"))
                if loc_match:
                    wait_minutes = (nxt_start - curr_end).total_seconds() / 60.0
                    # For Hotel, the event might happen during the stay
                    if curr_type == "HOTEL":
                        # Event during hotel stay
                        curr_start = curr.get("start_time")
                        if isinstance(curr_start, str):
                            curr_start = datetime.fromisoformat(curr_start)
                        if curr_start <= nxt_start <= curr_end:
                            G.add_edge(
                                curr_id, nxt_id,
                                dependency_type=DependencyType.EVENT if nxt_type == "EVENT" else DependencyType.ACTIVITY,
                                required_arrival_buffer_minutes=60
                            )
                    elif 0 <= wait_minutes <= 1440: # within 24h of arrival
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.EVENT if nxt_type == "EVENT" else DependencyType.ACTIVITY,
                            required_arrival_buffer_minutes=60,
                            buffer_minutes=int(wait_minutes)
                        )

            # Rule 5: Event / Hotel -> Return Transport
            elif curr_type in ["EVENT", "HOTEL"] and nxt_type in ["FLIGHT", "TRAIN"]:
                orig = nxt.get("origin") or nxt.get("location")
                if locations_match(curr.get("location"), orig):
                    wait_minutes = (nxt_start - curr_end).total_seconds() / 60.0
                    if wait_minutes >= 0:
                        G.add_edge(
                            curr_id, nxt_id,
                            dependency_type=DependencyType.TEMPORAL,
                            required_buffer_minutes=120,
                            buffer_minutes=int(wait_minutes)
                        )
                        break

    # Sequential Fallback: Ensure no disconnected components in a single sequential trip
    # If any node (except the first) has in_degree == 0, link from predecessor chronologically
    for i in range(1, n):
        prev_id = item_nodes[i-1]["id"]
        curr_id = item_nodes[i]["id"]
        if G.in_degree(curr_id) == 0:
            # Add general temporal dependency
            G.add_edge(
                prev_id, curr_id,
                dependency_type=DependencyType.TEMPORAL,
                inferred=True
            )

    return G
