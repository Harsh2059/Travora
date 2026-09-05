from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

class PolicyResult(BaseModel):
    item_id: int
    allowed: bool
    action: str # CHANGE, CANCEL
    fee: float = 0.0
    refund_amount: float = 0.0
    lost_amount: float = 0.0
    reason: str = "Allowed by provider policy"

class FinancialBreakdown(BaseModel):
    new_booking_cost: float = 0.0
    change_fees: float = 0.0
    cancellation_fees: float = 0.0
    refund_received: float = 0.0
    lost_non_refundable_amount: float = 0.0
    net_cost: float = 0.0
    currency: str = "INR"
    item_policies: Dict[int, PolicyResult] = Field(default_factory=dict)
