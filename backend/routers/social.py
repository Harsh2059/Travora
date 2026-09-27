"""
Social Signals API Router

Exposes public environmental reports and social feedback streams for journey hubs.
"""

from fastapi import APIRouter, Query
from typing import Dict, Any, Optional

from services.events.social_service import SocialSignalService

router = APIRouter(tags=["Social Signals"])


@router.get("/api/social-signals")
def get_social_signals_default(location: str = Query(default="Mumbai")):
    """
    Fetch public social/environmental signals for a location.
    """
    return SocialSignalService.get_location_signals(location=location)


@router.get("/api/social-signals/{location}")
def get_social_signals_by_location(location: str):
    """
    Fetch public social/environmental signals for a specific city or airport hub.
    """
    return SocialSignalService.get_location_signals(location=location)
