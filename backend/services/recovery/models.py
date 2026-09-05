from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class RecoveryPlanModel(BaseModel):
    plan_id: str
    title: str
    strategy_type: str
    
    # Itinerary items tracking
    modified_items: List[Dict[str, Any]] = Field(default_factory=list)
    removed_items: List[Dict[str, Any]] = Field(default_factory=list)
    added_items: List[Dict[str, Any]] = Field(default_factory=list)
    preserved_items: List[Dict[str, Any]] = Field(default_factory=list)
    full_recovered_items: List[Dict[str, Any]] = Field(default_factory=list)

    # Financial
    additional_cost: float = 0.0
    refund_received: float = 0.0
    change_fees: float = 0.0
    cancellation_fees: float = 0.0
    net_cost: float = 0.0
    currency: str = "INR"

    # Operational & Timing
    additional_delay_minutes: int = 0
    additional_delay_str: str = "0m"

    # Itinerary Impact metrics
    components_affected: int = 0
    total_components: int = 0
    affected_percentage: float = 0.0
    critical_components: int = 0
    critical_components_affected: int = 0
    impact_score: float = 0.0

    # Scores
    preference_score: float = 0.0
    overall_score: float = 0.0

    # Feasibility & Verification
    feasibility: bool = True
    infeasibility_reasons: List[str] = Field(default_factory=list)
    preserves_critical_commitment: bool = True
    is_recommended: bool = False

    # State & Audit Tracking
    source_itinerary_version: Optional[int] = None
    recovery_id: Optional[str] = None
    trip_id: Optional[int] = None

    # Confidence & Quality Metrics
    confidence: str = "HIGH"
    confidence_reasons: List[str] = Field(default_factory=list)
    quality_metrics: Dict[str, Any] = Field(default_factory=dict)
    traveler_summary: str = ""

    # Explanation
    explanation_summary: str = ""
    explanation_details: Dict[str, Any] = Field(default_factory=dict)
    trade_offs: Dict[str, str] = Field(default_factory=dict)
