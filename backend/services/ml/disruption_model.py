"""
Extended Disruption Risk Prediction Model (RandomForest ML)

Extends the base RandomForestClassifier with weather parameters (rainfall, wind, visibility)
to provide probabilistic disruption and delay predictions across journey nodes.
"""

from typing import Dict, Any, Optional
import numpy as np
from sklearn.ensemble import RandomForestClassifier


class DisruptionRiskModel:
    """
    RandomForest-based disruption prediction model extended with live/simulated weather features.
    Features vector:
    [departure_hour, day_of_week, duration_hours, is_international, congestion_level, rainfall_mm, wind_kmh, visibility_km]
    """

    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=25, random_state=42)
        self._train_extended_synthetic_model()

    def _train_extended_synthetic_model(self):
        """
        Trains RandomForestClassifier on multi-dimensional aviation & weather disruption dataset.
        Clearly marked as synthetic training data.
        """
        np.random.seed(42)

        # 40 synthetic dataset rows representing normal, moderate, and extreme weather scenarios
        # [hour, day_of_week, duration_hrs, is_intl, congestion_1to5, rainfall_mm, wind_kmh, visibility_km]
        X_synth = np.array([
            # Clear / Normal
            [6, 1, 2.0, 0, 1, 0.0, 10.0, 10.0],
            [8, 2, 2.0, 0, 2, 2.0, 12.0, 10.0],
            [10, 3, 1.5, 0, 1, 0.0, 8.0, 10.0],
            [14, 4, 9.0, 1, 2, 0.0, 15.0, 10.0],
            [22, 0, 4.0, 1, 2, 0.0, 14.0, 10.0],
            [7, 3, 1.5, 0, 1, 1.0, 9.0, 9.5],
            [9, 1, 2.0, 0, 1, 0.0, 11.0, 10.0],
            [11, 2, 9.0, 1, 2, 0.0, 13.0, 10.0],
            # Moderate Rain / Wind
            [18, 5, 2.5, 0, 4, 25.0, 28.0, 4.5],
            [16, 4, 8.0, 1, 4, 35.0, 32.0, 3.0],
            [19, 5, 3.0, 0, 4, 40.0, 30.0, 3.5],
            [15, 2, 2.5, 0, 3, 18.0, 22.0, 5.0],
            [12, 1, 4.0, 1, 3, 22.0, 25.0, 4.0],
            [17, 3, 2.0, 0, 4, 30.0, 35.0, 3.0],
            # Extreme Weather (Storm, Torrential Rain, Fog)
            [6, 1, 2.5, 0, 3, 120.0, 65.0, 0.5],
            [8, 2, 3.0, 0, 5, 140.0, 75.0, 0.8],
            [13, 3, 2.0, 0, 4, 110.0, 55.0, 1.2],
            [20, 5, 9.0, 1, 5, 160.0, 80.0, 0.4],
            [21, 6, 2.0, 0, 4, 95.0, 60.0, 1.0],
            [7, 4, 2.0, 0, 3, 85.0, 50.0, 1.5],
            [11, 1, 5.0, 1, 4, 130.0, 70.0, 0.6],
            # Additional mixed conditions
            [10, 2, 2.0, 0, 2, 5.0, 15.0, 8.0],
            [13, 3, 3.0, 0, 2, 0.0, 12.0, 10.0],
            [16, 4, 2.0, 0, 3, 12.0, 20.0, 6.0],
            [19, 5, 2.5, 0, 4, 60.0, 45.0, 2.5],
            [22, 6, 9.0, 1, 3, 75.0, 48.0, 2.0],
            [5, 0, 2.0, 0, 1, 0.0, 8.0, 10.0],
            [12, 2, 1.5, 0, 2, 0.0, 10.0, 10.0],
            [15, 3, 2.0, 0, 3, 15.0, 18.0, 7.0],
            [18, 4, 8.0, 1, 4, 50.0, 40.0, 3.0],
        ])

        # Target: 0 (On-Time/Low), 1 (Disrupted/High)
        y_synth = np.array([
            0, 0, 0, 0, 0, 0, 0, 0,
            1, 1, 1, 1, 1, 1,
            1, 1, 1, 1, 1, 1, 1,
            0, 0, 0, 1, 1, 0, 0, 0, 1
        ])

        self.model.fit(X_synth, y_synth)

    def predict_item_risk(
        self,
        item: Dict[str, Any],
        weather: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Calculates numerical disruption probability, estimated delay minutes,
        and downstream transport/hotel impact risk metrics using weather features.
        """
        w = weather or {}
        rainfall = float(w.get("rainfall", 0.0))
        wind = float(w.get("wind", 10.0))
        visibility = float(w.get("visibility", 10.0))

        # Extract item feature attributes
        hour = 10
        st = item.get("start_time") or item.get("startTime")
        if hasattr(st, "hour"):
            hour = st.hour
        elif isinstance(st, str) and "T" in st:
            try:
                hour = int(st.split("T")[1].split(":")[0])
            except Exception:
                hour = 10

        dest_str = str(item.get("destination", "")).lower()
        orig_str = str(item.get("origin", "")).lower()
        is_intl = 1 if "london" in dest_str or "lhr" in dest_str or "delhi" in orig_str else 0
        duration = 3.0

        congestion = 3 if hour in [8, 9, 17, 18, 19] else 1

        features = np.array([[hour, 2, duration, is_intl, congestion, rainfall, wind, visibility]])
        raw_prob = float(self.model.predict_proba(features)[0][1])

        # Weather multiplier adjustment
        weather_factor = 0.0
        if rainfall > 100 or wind > 60 or visibility < 1.0:
            weather_factor = 0.45
        elif rainfall > 30 or wind > 35 or visibility < 3.0:
            weather_factor = 0.25
        elif rainfall > 5 or wind > 20:
            weather_factor = 0.10

        disruption_prob = min(0.98, round(max(raw_prob, weather_factor), 2))

        # Calculate estimated delay minutes based on disruption probability and weather parameters
        base_delay = 0
        if disruption_prob > 0.70:
            base_delay = int(60 + (rainfall * 0.8) + (wind * 0.5) + ((10.0 - visibility) * 8))
        elif disruption_prob > 0.35:
            base_delay = int(25 + (rainfall * 0.4) + (wind * 0.3))
        else:
            base_delay = int(rainfall * 0.2)

        est_delay_minutes = min(480, max(0, base_delay))

        # Transport & Hotel downstream risk scores
        transport_impact = min(0.95, round(disruption_prob * 0.85, 2)) if est_delay_minutes > 30 else 0.10
        hotel_impact = min(0.90, round(disruption_prob * 0.75, 2)) if est_delay_minutes > 120 else 0.05

        confidence = round(0.75 + (0.15 * (1.0 if len(w) > 0 else 0.5)), 2)
        risk_level = "HIGH" if disruption_prob > 0.65 else ("MEDIUM" if disruption_prob > 0.35 else "LOW")

        return {
            "disruption_probability": disruption_prob,
            "estimated_delay_minutes": est_delay_minutes,
            "transport_impact": transport_impact,
            "hotel_impact": hotel_impact,
            "confidence": confidence,
            "risk_level": risk_level,
            "advisory_notes": f"Extended RF model prediction with weather features (rain: {rainfall}mm, wind: {wind}km/h)",
            "is_synthetic": True
        }
