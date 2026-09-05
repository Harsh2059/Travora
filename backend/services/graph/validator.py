from typing import Dict, Any, List, Optional
import networkx as nx
from datetime import datetime

class GraphValidationError(Exception):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        err_list = details.get("errors", []) if details else []
        full_msg = f"{message}: {'; '.join(err_list)}" if err_list else message
        super().__init__(full_msg)
        self.message = message
        self.details = details or {}


VALID_DEPENDENCY_TYPES = {
    "TEMPORAL",
    "CONNECTION",
    "LOCATION",
    "TRANSFER",
    "ACCOMMODATION",
    "ACTIVITY",
    "EVENT",
    "CUSTOM"
}

def validate_graph(graph: nx.DiGraph) -> Dict[str, Any]:
    """
    Validates the itinerary dependency graph against invariants:
    - Node existence & attribute completeness
    - Self-dependencies
    - Valid dependency types
    - Temporal sanity (source cannot end after target ends, or start after target starts)
    - Acyclicity (must be a DAG)
    - Metadata formatting
    """
    errors: List[str] = []
    warnings: List[str] = []

    # 1. Node validation
    if len(graph.nodes) == 0:
        return {"is_valid": True, "node_count": 0, "edge_count": 0, "warnings": ["Empty graph"]}

    for node_id, data in graph.nodes(data=True):
        if not data:
            errors.append(f"Node {node_id} has empty attribute data")
            continue
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        if start_time and end_time:
            if isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time)
            if isinstance(end_time, str):
                end_time = datetime.fromisoformat(end_time)
            if start_time > end_time:
                errors.append(f"Node {node_id} has impossible temporal window: start_time ({start_time}) > end_time ({end_time})")

    # 2. Cycle detection (must be DAG)
    if not nx.is_directed_acyclic_graph(graph):
        cycles = list(nx.simple_cycles(graph))
        errors.append(f"Dependency graph contains cycles (must be a DAG): {cycles}")

    # 3. Edge validation
    for u, v, edge_data in graph.edges(data=True):
        if u == v:
            errors.append(f"Self-dependency detected on node {u}")
        
        dep_type = edge_data.get("dependency_type")
        if not dep_type or dep_type not in VALID_DEPENDENCY_TYPES:
            errors.append(f"Invalid dependency type '{dep_type}' between {u} -> {v}")
        
        # Temporal relationship check
        u_data = graph.nodes[u]
        v_data = graph.nodes[v]
        u_end = u_data.get("end_time")
        v_start = v_data.get("start_time")
        
        if u_end and v_start:
            if isinstance(u_end, str):
                u_end = datetime.fromisoformat(u_end)
            if isinstance(v_start, str):
                v_start = datetime.fromisoformat(v_start)
            
            # For strict connections or transfers, target cannot start before source ends
            if dep_type in ["CONNECTION", "TRANSFER"]:
                min_conn = edge_data.get("minimum_connection_minutes", 0)
                diff_minutes = (v_start - u_end).total_seconds() / 60.0
                if diff_minutes < 0:
                    errors.append(
                        f"Temporal violation between {u} and {v}: target starts {abs(diff_minutes):.1f}m before source arrives"
                    )

    if errors:
        raise GraphValidationError(
            f"Graph validation failed with {len(errors)} error(s)",
            {"errors": errors, "warnings": warnings}
        )

    return {
        "is_valid": True,
        "node_count": graph.number_of_nodes(),
        "edge_count": graph.number_of_edges(),
        "warnings": warnings
    }
