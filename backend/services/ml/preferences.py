from typing import Dict, Any
from pydantic import BaseModel, Field

class TravelerPreferences(BaseModel):
    time_weight: float = Field(default=0.5, description="Weight for minimizing delay")
    cost_weight: float = Field(default=0.2, description="Weight for minimizing additional cost")
    comfort_weight: float = Field(default=0.2, description="Weight for hotel/comfort preservation")
    directness_weight: float = Field(default=0.1, description="Weight for direct flights/fewer transfers")

    def normalize(self):
        total = self.time_weight + self.cost_weight + self.comfort_weight + self.directness_weight
        if total > 0:
            self.time_weight /= total
            self.cost_weight /= total
            self.comfort_weight /= total
            self.directness_weight /= total

    def score_plan(self, plan_features: Dict[str, Any]) -> float:
        """
        Calculates a 0.0 to 100.0 personalized match score based on traveler weights.
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

        total_score = (
            self.time_weight * time_score
            + self.cost_weight * cost_score
            + self.comfort_weight * comfort_score
            + self.directness_weight * directness_score
        )

        return round(min(100.0, max(0.0, total_score)), 1)
