from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import re

class UserRequestParser:
    """
    Translates natural language traveler requests into deterministic structured intents.
    Supports:
    - Earlier / later arrival requests ("Reach London one day earlier")
    - Schedule adjustments ("Move hotel to tomorrow")
    - Activity cancellations ("Cancel sightseeing activity")
    - Critical commitment prioritization ("Keep the conference at all costs")
    - Cost minimization ("Minimize additional cost")
    """

    @classmethod
    def parse_request(cls, text: str, trip_context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        lower = text.strip().lower()

        # 1. Critical Commitment Intent
        if "at all costs" in lower or "keep conference" in lower or "preserve conference" in lower or "don't miss" in lower:
            return {
                "intent_type": "CRITICAL_COMMITMENT",
                "target": "Tech Conference 2026",
                "priority": "CRITICAL",
                "preferences_override": {
                    "time_weight": 0.7,
                    "comfort_weight": 0.1,
                    "cost_weight": 0.1,
                    "directness_weight": 0.1
                },
                "event_type": "USER_REQUESTED_CHANGE",
                "description": "Traveler instructed system to protect critical commitments above cost."
            }

        # 2. Minimize Cost Intent
        if ("minimize" in lower and "cost" in lower) or "cheapest" in lower or "lowest cost" in lower:
            return {
                "intent_type": "MINIMIZE_COST",
                "priority": "HIGH",
                "preferences_override": {
                    "cost_weight": 0.8,
                    "time_weight": 0.1,
                    "comfort_weight": 0.05,
                    "directness_weight": 0.05
                },
                "event_type": "USER_REQUESTED_CHANGE",
                "description": "Traveler instructed system to prioritize cost reduction."
            }

        # 3. Advance Departure / Arrival
        if "earlier" in lower or "advance" in lower or "one day earlier" in lower:
            hours = 24 if ("one day" in lower or "1 day" in lower or "day earlier" in lower) else 12
            return {
                "intent_type": "CHANGE_ARRIVAL",
                "target": "London",
                "advance_hours": hours,
                "priority": "HIGH",
                "event_type": "USER_REQUESTED_CHANGE",
                "event_metadata": {
                    "advance_hours": hours,
                    "reason": f"Traveler requested arriving {hours}h earlier"
                },
                "description": f"Request to advance arrival schedule by {hours} hours."
            }

        # 4. Move Hotel
        if "hotel" in lower and ("tomorrow" in lower or "shift" in lower or "move" in lower):
            return {
                "intent_type": "RESCHEDULE_ACCOMMODATION",
                "target": "HOTEL",
                "shift_days": 1,
                "event_type": "USER_REQUESTED_CHANGE",
                "event_metadata": {
                    "shift_days": 1,
                    "reason": "Traveler requested shifting hotel reservation date"
                },
                "description": "Request to shift hotel check-in date."
            }

        # 5. Cancellation
        if "cancel" in lower:
            target = "ACTIVITY" if "activity" in lower or "sightseeing" in lower else "ITEM"
            return {
                "intent_type": "CANCEL_COMPONENT",
                "target": target,
                "event_type": "CANCELLATION",
                "event_metadata": {
                    "reason": f"Traveler voluntarily requested cancellation of {target}"
                },
                "description": f"Voluntary cancellation of {target} requested by traveler."
            }

        # Default structured intent
        return {
            "intent_type": "GENERAL_SCHEDULE_CHANGE",
            "target": "ITINERARY",
            "event_type": "USER_REQUESTED_CHANGE",
            "event_metadata": {"raw_request": text},
            "description": f"Traveler requested itinerary change: '{text}'"
        }
