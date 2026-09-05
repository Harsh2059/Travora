from typing import Dict, Any
import numpy as np
from sklearn.ensemble import RandomForestClassifier

class DisruptionRiskModel:
    def __init__(self):
        # Synthetic model trained on mock aviation disruption dataset
        self.model = RandomForestClassifier(n_estimators=10, random_state=42)
        self._train_synthetic_model()

    def _train_synthetic_model(self):
        # Features: [departure_hour, day_of_week, duration_hours, is_international, congestion_level]
        # Label: 0 (On Time / Low Risk), 1 (Disrupted / High Risk)
        np.random.seed(42)
        X_mock = np.array([
            [6, 1, 2.0, 0, 1],
            [8, 2, 2.0, 0, 3],
            [14, 4, 9.0, 1, 2],
            [18, 5, 2.5, 0, 4],
            [22, 0, 4.0, 1, 3],
            [7, 3, 1.5, 0, 1],
            [16, 4, 8.0, 1, 4],
            [19, 5, 3.0, 0, 4],
            [11, 2, 9.0, 1, 2],
            [9, 1, 2.0, 0, 1]
        ])
        y_mock = np.array([0, 1, 0, 1, 0, 0, 1, 1, 0, 0])
        self.model.fit(X_mock, y_mock)

    def predict_item_risk(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """
        Advisory risk prediction for an individual itinerary item.
        ML is advisory and does NOT replace deterministic feasibility.
        """
        hour = 10
        st = item.get("start_time")
        if hasattr(st, "hour"):
            hour = st.hour

        is_intl = 1 if "london" in str(item.get("destination", "")).lower() or "delhi" in str(item.get("origin", "")).lower() else 0
        duration = 3.0
        congestion = 3 if hour in [8, 9, 17, 18, 19] else 1

        features = np.array([[hour, 2, duration, is_intl, congestion]])
        prob = float(self.model.predict_proba(features)[0][1])

        # Adjust for provider & weather mock
        risk_level = "HIGH" if prob > 0.6 else ("MEDIUM" if prob > 0.35 else "LOW")

        return {
            "item_id": item.get("id"),
            "delay_probability": round(prob, 2),
            "risk_level": risk_level,
            "advisory_notes": "Advisory prediction based on synthetic departure hour & route congestion model",
            "is_synthetic": True
        }
