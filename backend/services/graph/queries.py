from typing import Dict, Any, List, Optional
import networkx as nx
from .validator import validate_graph

class GraphQueries:
    def __init__(self, graph: nx.DiGraph):
        self.graph = graph

    def get_node(self, item_id: int) -> Optional[Dict[str, Any]]:
        """Returns attributes of a specific node."""
        if self.graph.has_node(item_id):
            return dict(self.graph.nodes[item_id])
        return None

    def get_dependencies(self, item_id: int) -> List[Dict[str, Any]]:
        """
        Returns immediate upstream dependencies (predecessors) for an item.
        Includes edge metadata.
        """
        if not self.graph.has_node(item_id):
            return []
        deps = []
        for pred in self.graph.predecessors(item_id):
            edge_data = dict(self.graph.get_edge_data(pred, item_id))
            node_data = dict(self.graph.nodes[pred])
            deps.append({
                "item_id": pred,
                "node": node_data,
                "edge": edge_data
            })
        return deps

    def get_dependents(self, item_id: int) -> List[Dict[str, Any]]:
        """
        Returns immediate downstream dependents (successors) for an item.
        Includes edge metadata.
        """
        if not self.graph.has_node(item_id):
            return []
        dependents = []
        for succ in self.graph.successors(item_id):
            edge_data = dict(self.graph.get_edge_data(item_id, succ))
            node_data = dict(self.graph.nodes[succ])
            dependents.append({
                "item_id": succ,
                "node": node_data,
                "edge": edge_data
            })
        return dependents

    def get_downstream_items(self, item_id: int) -> List[int]:
        """Returns all transitively reachable downstream node IDs (descendants)."""
        if not self.graph.has_node(item_id):
            return []
        return list(nx.descendants(self.graph, item_id))

    def get_upstream_items(self, item_id: int) -> List[int]:
        """Returns all upstream ancestor node IDs."""
        if not self.graph.has_node(item_id):
            return []
        return list(nx.ancestors(self.graph, item_id))

    def get_critical_items(self) -> List[Dict[str, Any]]:
        """Returns all items with priority == 'CRITICAL'."""
        return [
            dict(data)
            for node_id, data in self.graph.nodes(data=True)
            if data.get("priority") == "CRITICAL"
        ]

    def get_items_by_priority(self, priority: str) -> List[Dict[str, Any]]:
        """Returns all items matching specified priority."""
        return [
            dict(data)
            for node_id, data in self.graph.nodes(data=True)
            if data.get("priority", "").upper() == priority.upper()
        ]

    def get_items_by_type(self, item_type: str) -> List[Dict[str, Any]]:
        """Returns all items matching specified type (e.g. FLIGHT, HOTEL)."""
        return [
            dict(data)
            for node_id, data in self.graph.nodes(data=True)
            if data.get("type", "").upper() == item_type.upper()
        ]

    def get_path_between_items(self, source_id: int, target_id: int) -> Optional[List[int]]:
        """Returns the shortest path between source and target nodes if reachable."""
        if not self.graph.has_node(source_id) or not self.graph.has_node(target_id):
            return None
        try:
            return nx.shortest_path(self.graph, source=source_id, target=target_id)
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return None

    def validate_graph(self) -> Dict[str, Any]:
        """Runs integrity validation on the graph."""
        return validate_graph(self.graph)

    def to_dict(self) -> Dict[str, Any]:
        """Exports graph in serializable JSON-friendly format for API and frontend."""
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            n_copy = dict(data)
            # Ensure datetime is serialized
            if "start_time" in n_copy and hasattr(n_copy["start_time"], "isoformat"):
                n_copy["start_time"] = n_copy["start_time"].isoformat()
            if "end_time" in n_copy and hasattr(n_copy["end_time"], "isoformat"):
                n_copy["end_time"] = n_copy["end_time"].isoformat()
            nodes.append(n_copy)

        edges = []
        for u, v, data in self.graph.edges(data=True):
            e_dict = {
                "source": u,
                "target": v,
                **data
            }
            edges.append(e_dict)

        return {
            "nodes": nodes,
            "edges": edges,
            "node_count": len(nodes),
            "edge_count": len(edges)
        }
