from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from enum import Enum


class ActionType(str, Enum):
    KEEP = "KEEP"
    REPLACE = "REPLACE"
    MODIFY = "MODIFY"
    CANCEL = "CANCEL"


class RecoveryFeasibility(str, Enum):
    FEASIBLE = "FEASIBLE"
    INFEASIBLE = "INFEASIBLE"
    UNKNOWN = "UNKNOWN"


class RecoveryAnalysisStatus(str, Enum):
    OPTIONS_AVAILABLE = "OPTIONS_AVAILABLE"
    NO_FEASIBLE_RECOVERY = "NO_FEASIBLE_RECOVERY"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"
    ANALYSIS_FAILED = "ANALYSIS_FAILED"


class CostEstimate(BaseModel):
    replacement_cost: Optional[float] = None
    modification_fees: Optional[float] = None
    cancellation_penalties: Optional[float] = None
    estimated_refunds: Optional[float] = None
    estimated_additional_cost: Optional[float] = None
    currency: str = "INR"
    is_partial: bool = False


class RecoveryPlanCategory(str, Enum):
    PRIORITY_PRESERVING = "PRIORITY_PRESERVING"
    ALTERNATIVE = "ALTERNATIVE"


class RecoveryChange(BaseModel):
    node_id: str
    action: ActionType = ActionType.KEEP
    original_title: str = ""
    original_details: Dict[str, Any] = Field(default_factory=dict)
    new_title: Optional[str] = None
    new_details: Optional[Dict[str, Any]] = None
    # Explicit replacement airline/provider — must not be inferred from titles
    provider: Optional[str] = None
    type: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    estimated_cost: Optional[float] = 0.0
    estimated_refund: Optional[float] = 0.0
    explanation: str = ""


class Part4RecoveryPlan(BaseModel):
    id: str
    trip_id: int
    category: RecoveryPlanCategory = RecoveryPlanCategory.PRIORITY_PRESERVING
    title: str
    feasibility: RecoveryFeasibility = RecoveryFeasibility.FEASIBLE
    
    changes: List[RecoveryChange] = Field(default_factory=list)
    
    preserved_node_ids: List[str] = Field(default_factory=list)
    changed_node_ids: List[str] = Field(default_factory=list)
    dropped_node_ids: List[str] = Field(default_factory=list)
    
    preserved_priorities: List[str] = Field(default_factory=list)
    sacrificed_priorities: List[str] = Field(default_factory=list)
    
    cost_estimate: Optional[CostEstimate] = None
    estimated_additional_cost: Optional[float] = 0.0
    estimated_refund: Optional[float] = 0.0
    
    explanation: str = ""
    is_recommended: bool = False

    # Factual measurable metrics for ranking
    total_transfers: int = 0
    total_duration_minutes: int = 0
    total_changes_count: int = 0
    is_direct: bool = True


class Part4RecoveryResult(BaseModel):
    trip_id: int
    impact_status: str = "NORMAL"  # "NORMAL" or "DISRUPTED"
    status: RecoveryAnalysisStatus = RecoveryAnalysisStatus.OPTIONS_AVAILABLE
    total_feasible_plans: int = 0
    plans: List[Part4RecoveryPlan] = Field(default_factory=list)
    priority_preserving_count: int = 0
    alternative_count: int = 0
    message: str = ""
    # Versioning: IDs of active disruptions used to generate this result.
    # The frontend uses these to detect stale selected plans.
    disruption_ids: List[int] = Field(default_factory=list)
    disruption_fingerprint: str = ""  # sorted "_"-joined disruption IDs


# Legacy Phase 2 model kept for backwards compatibility with execution engine
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
