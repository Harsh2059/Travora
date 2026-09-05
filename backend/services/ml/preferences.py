from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, field_validator

class TravelerPreferences(BaseModel):
    time_weight: float = Field(default=0.5, ge=0.0, description="Weight for minimizing delay")
    cost_weight: float = Field(default=0.2, ge=0.0, description="Weight for minimizing additional cost")
    comfort_weight: float = Field(default=0.2, ge=0.0, description="Weight for hotel/comfort preservation")
    directness_weight: float = Field(default=0.1, ge=0.0, description="Weight for direct flights/fewer transfers")
    flexibility_weight: float = Field(default=0.0, ge=0.0, description="Weight for schedule flexibility")

    # Optional explicit preferences
    airline_preference: Optional[str] = None
    hotel_preference: Optional[str] = None
    airport_preference: Optional[str] = None
    max_wait_minutes: Optional[int] = Field(default=None, ge=0)
    max_additional_cost: Optional[float] = Field(default=None, ge=0.0)
    max_extra_travel_minutes: Optional[int] = Field(default=None, ge=0)

    @field_validator("time_weight", "cost_weight", "comfort_weight", "directness_weight", "flexibility_weight")
    @classmethod
    def validate_non_negative(cls, v: float) -> float:
        if v < 0.0:
            raise ValueError("Preference weights must be non-negative")
        return v

    def normalize(self):
        total = (
            self.time_weight
            + self.cost_weight
            + self.comfort_weight
            + self.directness_weight
            + self.flexibility_weight
        )
        if total > 0:
            self.time_weight /= total
            self.cost_weight /= total
            self.comfort_weight /= total
            self.directness_weight /= total
            self.flexibility_weight /= total

    def score_plan(self, plan_features: Dict[str, Any]) -> float:
        """
        Calculates a deterministic 0.0 to 100.0 personalized match score based on traveler weights and constraints.
        Preferences influence ranking, NOT feasibility.
        """
        self.normalize()

        # Time score: 0 delay is 100, 10h+ delay is 0
        delay_minutes = plan_features.get("additional_delay_minutes", 0)
        time_score = max(0.0, 100.0 - (delay_minutes / 6.0)) # 600m delay -> 0

        # Cost score: 0 extra cost is 100, 50,000 extra cost is 0
        extra_cost = max(0.0, plan_features.get("net_cost", 0.0))
        cost_score = max(0.0, 100.0 - (extra_cost / 500.0))

        # Comfort score: original hotel preserved = 100, downgraded/changed = 60
        hotel_preserved = plan_features.get("hotel_preserved", True)
        comfort_score = 100.0 if hotel_preserved else 60.0

        # Directness score: direct flight = 100, layover = 70
        is_direct = plan_features.get("is_direct", False)
        directness_score = 100.0 if is_direct else 70.0

        # Flexibility score: fewer modifications = higher flexibility preserved
        flexibility_score = 100.0 if plan_features.get("is_flexible", True) else 65.0

        # Base weighted score
        total_score = (
            self.time_weight * time_score
            + self.cost_weight * cost_score
            + self.comfort_weight * comfort_score
            + self.directness_weight * directness_score
            + self.flexibility_weight * flexibility_score
        )

        # Apply specific preference boosts/penalties
        providers = plan_features.get("providers", [])
        if self.airline_preference and any(self.airline_preference.lower() in p.lower() for p in providers):
            total_score = min(100.0, total_score + 10.0)

        # Soft cap penalty if exceeding soft traveler limits
        if self.max_additional_cost is not None and extra_cost > self.max_additional_cost:
            penalty = min(30.0, (extra_cost - self.max_additional_cost) / 200.0)
            total_score = max(0.0, total_score - penalty)

        if self.max_wait_minutes is not None and delay_minutes > self.max_wait_minutes:
            penalty = min(30.0, (delay_minutes - self.max_wait_minutes) / 10.0)
            total_score = max(0.0, total_score - penalty)

        return round(min(100.0, max(0.0, total_score)), 1)
