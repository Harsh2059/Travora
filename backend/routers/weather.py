"""
Weather API Router

Exposes live weather observation and forecast endpoints for journey hubs.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional

import database
import models
from services.weather.weather_service import LiveWeatherService

router = APIRouter(prefix="/api/weather", tags=["Weather"])


@router.get("/current")
def get_current_weather_endpoint(location: str = Query(default="Mumbai")):
    """
    Fetch real-time weather observation for a location/airport.
    """
    return LiveWeatherService.get_current_weather(location=location)


@router.get("/forecast")
def get_weather_forecast_endpoint(
    location: str = Query(default="Mumbai"),
    hours: int = Query(default=24, ge=1, le=72)
):
    """
    Fetch multi-hour forecast for a location/airport.
    """
    return LiveWeatherService.get_forecast(location=location, hours=hours)
