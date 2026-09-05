from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ImpactStatus(str, Enum):
    UNAFFECTED = "UNAFFECTED"
    AT_RISK = "AT_RISK"
    INVALID = "INVALID"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"
    AFFECTED = "AFFECTED"

class NodeImpact(BaseModel):
    item_id: int
    type: str
    title: str
    priority: str
    flexibility: str
    original_status: str
    impact_status: ImpactStatus
    reason: str
    details: Dict[str, Any] = Field(default_factory=dict)

class ImpactAssessment(BaseModel):
    trip_id: int
    event_type: str
    total_components: int
    components_affected: int
    affected_percentage: float
    critical_components: int
    critical_components_affected: int
    impact_score: float
    impact_level: str # LOW, MEDIUM, HIGH, CRITICAL
    affected_item_ids: List[int]
    node_impacts: Dict[int, NodeImpact]
