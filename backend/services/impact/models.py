from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ImpactStatus(str, Enum):
    INTACT = "INTACT"
    AT_RISK = "AT_RISK"
    NEEDS_CHANGE = "NEEDS_CHANGE"
    BROKEN = "BROKEN"

class JourneyStatus(str, Enum):
    """Journey-level feasibility status.

    NORMAL   — the original journey is executable as planned.
    DISRUPTED — an active disruption makes the original journey
                no longer executable as planned (at least one node
                has been assessed BROKEN or NEEDS_CHANGE).

    Part 4 may later introduce RECOVERING and RECOVERED.
    """
    NORMAL = "NORMAL"
    DISRUPTED = "DISRUPTED"

class ImpactSourceKind(str, Enum):
    DIRECT = "DIRECT"
    PROPAGATED = "PROPAGATED"

class ImpactSource(BaseModel):
    disruption_id: Optional[Any] = None
    kind: ImpactSourceKind = ImpactSourceKind.DIRECT
    reason: str
    status: ImpactStatus = ImpactStatus.INTACT
    cause: Optional[str] = None
    scope: Optional[str] = None

class NodeImpact(BaseModel):
    node_id: str
    item_id: Optional[int] = None
    type: str
    title: str
    priority: str = "MEDIUM"
    flexibility: str = "FLEXIBLE"
    original_status: str = "SCHEDULED"
    status: ImpactStatus = ImpactStatus.INTACT
    reason: str = "Booking remains feasible."
    impact_sources: List[ImpactSource] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)

class ImpactSummary(BaseModel):
    intact: int = 0
    at_risk: int = 0
    needs_change: int = 0
    broken: int = 0

class ImpactResult(BaseModel):
    trip_id: int
    disruption_ids: List[Any] = Field(default_factory=list)
    root_node_ids: List[str] = Field(default_factory=list)
    disruption_id: Optional[Any] = None
    root_node_id: Optional[str] = None
    summary: ImpactSummary = Field(default_factory=ImpactSummary)
    nodes: List[NodeImpact] = Field(default_factory=list)
    node_impacts: Dict[str, NodeImpact] = Field(default_factory=dict)
    # Journey-level feasibility — set by the engine, never derived client-side
    journey_status: JourneyStatus = JourneyStatus.NORMAL

# Backward-compatibility alias
ImpactAssessment = ImpactResult
