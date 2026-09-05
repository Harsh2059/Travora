from typing import Dict, Any, List

class DownstreamRiskModel:
    @staticmethod
    def predict_downstream_risks(
        item_delay_minutes: int,
        downstream_items: List[Dict[str, Any]],
        connection_buffers: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Advisory Model 2: Predicts probabilistic downstream cascading risks.
        """
        # Connection risk
        min_buffer = connection_buffers.get("min_buffer_minutes", 120.0)
        buffer_ratio = item_delay_minutes / max(min_buffer, 1.0)
        missed_conn_prob = min(1.0, max(0.0, round(buffer_ratio * 0.85, 2)))

        # Hotel late arrival risk
        late_hotel_prob = min(1.0, max(0.0, round(item_delay_minutes / 300.0, 2)))

        # Critical event risk
        event_buffer = connection_buffers.get("event_buffer_minutes", 720.0)
        event_risk_ratio = item_delay_minutes / max(event_buffer, 1.0)
        missed_event_prob = min(1.0, max(0.0, round(event_risk_ratio * 0.9, 2)))

        return {
            "missed_connection_probability": missed_conn_prob,
            "late_hotel_arrival_probability": late_hotel_prob,
            "missed_critical_event_probability": missed_event_prob,
            "risk_summary": (
                "Critical Event At Risk" if missed_event_prob > 0.5
                else ("High Connection Risk" if missed_conn_prob > 0.5 else "Moderate Risk")
            ),
            "is_synthetic": True
        }
