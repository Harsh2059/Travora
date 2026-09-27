"""
Social Signals & Public Weather Alert Feed Integration

Provides public signals, crowd reports, traffic updates, and airport advisory feeds
structured for the Digital Twin ecosystem.
"""

import os
from typing import Dict, Any, List
from datetime import datetime, timezone


class SocialSignalService:
    """
    Ingests and formats real-world social media and public environmental signals.
    """

    @classmethod
    def get_location_signals(cls, location: str = "Mumbai") -> Dict[str, Any]:
        """
        Returns real-world / public report signals for a target city or airport hub.
        """
        loc_clean = str(location or "Mumbai").strip()
        loc_lower = loc_clean.lower()

        now_iso = datetime.now(timezone.utc).isoformat()

        signals: List[Dict[str, Any]] = []

        if "mumbai" in loc_lower or "bom" in loc_lower:
            signals = [
                {
                    "id": "sig_bom_01",
                    "source": "public_report",
                    "author": "@MumbaiTrafficAlerts",
                    "text": "Heavy waterlogging reported on Western Express Highway near Chhatrapati Shivaji Maharaj International Airport (BOM) T2.",
                    "sentiment": "NEGATIVE",
                    "timestamp": now_iso,
                    "confidence": 0.88,
                    "is_live": False,
                    "category": "TRAFFIC_ALERT"
                },
                {
                    "id": "sig_bom_02",
                    "source": "public_report",
                    "author": "@AviationNewsIN",
                    "text": "IndiGo & Air India issue travel advisory for Mumbai flights due to active rain & low visibility holding patterns.",
                    "sentiment": "WARNING",
                    "timestamp": now_iso,
                    "confidence": 0.92,
                    "is_live": False,
                    "category": "AIRPORT_ADVISORY"
                },
                {
                    "id": "sig_bom_03",
                    "source": "public_report",
                    "author": "@RailCommutersBOM",
                    "text": "Local train services running with 15-20 min delays on Harbor and Central lines due to rain track inspection.",
                    "sentiment": "NEGATIVE",
                    "timestamp": now_iso,
                    "confidence": 0.81,
                    "is_live": False,
                    "category": "TRANSIT_DELAY"
                }
            ]
        elif "delhi" in loc_lower or "del" in loc_lower:
            signals = [
                {
                    "id": "sig_del_01",
                    "source": "public_report",
                    "author": "@DelhiAirportNotice",
                    "text": "CAT III Low Visibility Procedures invoked at IGI Airport (DEL). Flight departures delayed by ~30-45 mins.",
                    "sentiment": "WARNING",
                    "timestamp": now_iso,
                    "confidence": 0.95,
                    "is_live": False,
                    "category": "FOG_ADVISORY"
                },
                {
                    "id": "sig_del_02",
                    "source": "public_report",
                    "author": "@DelhiTrafficPolice",
                    "text": "Heavy congestion on Mahipalpur bypass towards T3 terminal. Travelers advised to use Airport Express Metro.",
                    "sentiment": "NEGATIVE",
                    "timestamp": now_iso,
                    "confidence": 0.85,
                    "is_live": False,
                    "category": "TRAFFIC_ALERT"
                }
            ]
        elif "london" in loc_lower or "lhr" in loc_lower:
            signals = [
                {
                    "id": "sig_lhr_01",
                    "source": "public_report",
                    "author": "@HeathrowAirport",
                    "text": "High crosswinds active over London. Flight arrivals operating with extended radar spacing.",
                    "sentiment": "WARNING",
                    "timestamp": now_iso,
                    "confidence": 0.89,
                    "is_live": False,
                    "category": "WIND_ADVISORY"
                },
                {
                    "id": "sig_lhr_02",
                    "source": "public_report",
                    "author": "@TfLTravelAlerts",
                    "text": "Heathrow Express operating normal service; Elizabeth Line experiencing minor delays at Paddington.",
                    "sentiment": "NEUTRAL",
                    "timestamp": now_iso,
                    "confidence": 0.90,
                    "is_live": False,
                    "category": "TRANSIT_STATUS"
                }
            ]
        else:
            signals = [
                {
                    "id": "sig_gen_01",
                    "source": "public_report",
                    "author": "@TravelerCommunity",
                    "text": f"Weather advisory in effect for {loc_clean}. Moderate rain & wind affecting local transit timing.",
                    "sentiment": "WARNING",
                    "timestamp": now_iso,
                    "confidence": 0.75,
                    "is_live": False,
                    "category": "GENERAL_WEATHER"
                }
            ]

        return {
            "location": loc_clean,
            "signal_count": len(signals),
            "signals": signals,
            "disruption_sentiment_score": -0.65 if signals else 0.0,
            "is_live": False,
            "notice": "Public social signal fixture feed for HackCelestial 3.0"
        }
