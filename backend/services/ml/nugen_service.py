"""
Nugen Intelligence Domain AI Alignment & Reasoning Interface

Domain: Weather-Driven Travel Disruption and Recovery
Provides an interface abstraction for Nugen domain reasoning.
Currently marked waitlist-pending until an active Nugen API key and aligned model are deployed.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger("travel_recovery.nugen")

NUGEN_API_KEY = os.getenv("NUGEN_API_KEY", "")
NUGEN_MODEL_ID = os.getenv("NUGEN_MODEL_ID", "")
NUGEN_BASE_URL = os.getenv("NUGEN_BASE_URL", "https://api.nugen.in/v1")


class NugenReasoningService:
    """
    Nugen-Aligned Domain AI Model Interface.
    Produces domain-specific explanations, entity impacts, and cascading reasoning
    for weather-driven travel disruptions.
    """

    def __init__(self, api_key: Optional[str] = None, model_id: Optional[str] = None):
        self.api_key = api_key or NUGEN_API_KEY
        self.model_id = model_id or NUGEN_MODEL_ID
        self.base_url = NUGEN_BASE_URL

    def generate_domain_reasoning(
        self,
        journey_title: str,
        weather: Dict[str, Any],
        disruption_pred: Dict[str, Any],
        affected_nodes: List[Dict[str, Any]],
        scenario_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates domain-specific reasoning and cascading impact explanation.
        Queries Nugen API if an active key is present; otherwise returns a structured
        waitlist-pending interface response with nugen_aligned=False.
        """
        rainfall = float(weather.get("rainfall", 0.0))
        wind = float(weather.get("wind", 0.0))
        visibility = float(weather.get("visibility", 10.0))
        temp = float(weather.get("temperature", 25.0))
        condition = str(weather.get("condition", "Normal")).lower()

        prob = float(disruption_pred.get("disruption_probability", 0.0))
        est_delay = int(disruption_pred.get("estimated_delay_minutes", 0))

        # Real Nugen API call if an actual key is provided
        if self.api_key and self.api_key.strip() and self.api_key != "demo_nugen_key":
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key.strip()}",
                    "Content-Type": "application/json"
                }
                prompt = (
                    f"Domain: Travel Disruption & Recovery. "
                    f"Journey: '{journey_title}'. "
                    f"Weather: {rainfall}mm rain, {wind}km/h wind, {visibility}km visibility, {temp}°C. "
                    f"Predicted Disruption Prob: {prob}, Est Delay: {est_delay}m."
                )
                payload = {
                    "model": self.model_id or "nugen-travel-recovery-v1",
                    "prompt": prompt,
                    "max_tokens": 300,
                    "temperature": 0.2
                }
                with httpx.Client(timeout=4.0) as client:
                    resp = client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        content = resp.json()
                        text_res = content.get("choices", [{}])[0].get("message", {}).get("content", "")
                        if text_res:
                            parsed = json.loads(text_res)
                            parsed["nugen_aligned"] = True
                            parsed["model_id"] = self.model_id or "nugen-travel-recovery-v1"
                            return parsed
            except Exception as exc:
                logger.warning(f"Nugen API call failed: {exc}")

        # Waitlist / Unaligned fallback structure
        return self._build_unaligned_reasoning_interface(
            journey_title=journey_title,
            rainfall=rainfall,
            wind=wind,
            visibility=visibility,
            temp=temp,
            condition=condition,
            prob=prob,
            est_delay=est_delay,
            affected_nodes=affected_nodes
        )

    def _build_unaligned_reasoning_interface(
        self,
        journey_title: str,
        rainfall: float,
        wind: float,
        visibility: float,
        temp: float,
        condition: str,
        prob: float,
        est_delay: int,
        affected_nodes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:

        entities = []
        cascading = []

        if rainfall > 100 or wind > 50 or visibility < 1.0:
            severity_desc = "Severe extreme weather event"
            entities.extend(["airport", "flight", "ground_transport", "hotel"])
            cascading.extend([
                "Flight schedule delay propagation",
                "Ground transport pickup timing conflict",
                "Late hotel check-in arrival risk"
            ])
            explanation = (
                f"Domain Analysis: Extreme weather conditions ({rainfall} mm/h rain, {wind} km/h wind, {visibility} km visibility) "
                f"result in an estimated {est_delay}-minute flight disruption, causing cascading arrival conflicts for downstream transit and lodging."
            )
        elif rainfall > 20 or wind > 30 or visibility < 3.0:
            severity_desc = "Moderate weather impact"
            entities.extend(["flight", "ground_transport"])
            cascading.extend([
                "Flight gate hold & minor delay",
                "Ground transport buffer compression"
            ])
            explanation = (
                f"Domain Analysis: Moderate weather conditions ({rainfall} mm/h rain, {wind} km/h wind) "
                f"create an estimated {est_delay}-minute flight delay."
            )
        else:
            severity_desc = "Normal atmospheric conditions"
            entities.append("flight")
            explanation = (
                f"Domain Analysis: Weather parameters (rain: {rainfall} mm/h, wind: {wind} km/h) "
                f"are within normal operating envelopes."
            )

        return {
            "explanation": explanation,
            "severity_assessment": severity_desc,
            "affected_entities": list(dict.fromkeys(entities)),
            "cascading_effects": list(dict.fromkeys(cascading)),
            "reasoning": (
                f"Domain reasoning rules evaluated against environmental features (rain: {rainfall}mm, wind: {wind}km/h). "
                f"Disruption risk propagates from primary flight node to connected ground transport and accommodation."
            ),
            "confidence": min(0.95, round(0.70 + (prob * 0.20), 2)),
            "nugen_aligned": False,
            "model_id": "nugen-waitlist-pending"
        }
