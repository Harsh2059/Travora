"""
Base Provider Abstraction for Recovery Candidate Generation
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class BaseAvailabilityProvider(ABC):
    """
    Abstract base class for candidate availability search.
    Enables pluggable mock or real API providers (Airlines, IRCTC, Hotels, Uber/Ola).
    """

    @abstractmethod
    def search_candidates(
        self,
        node: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for candidate replacement or modification options for a node.
        
        Args:
            node: The affected itinerary node dictionary
            context: Additional journey context (surrounding dates, layovers, etc.)
            
        Returns:
            List of candidate dictionaries
        """
        pass


class BaseBookingProvider(ABC):
    """
    Abstract base class for Part 5 Booking & Execution Engine.
    Provides revalidate and book methods for replacement candidate execution.
    """

    @abstractmethod
    def revalidate(
        self,
        change: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Revalidate real-time availability and current price for a proposed replacement.
        
        Returns dict:
            {
                "available": bool,
                "current_price": float,
                "currency": str,
                "provider": str,
                "checked_at": str,
                "booking_conditions": str
            }
        """
        pass

    @abstractmethod
    def book(
        self,
        change: Dict[str, Any],
        traveler_details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute deterministic booking for a proposed replacement candidate.
        
        Returns dict:
            {
                "success": bool,
                "status": "BOOKED" | "FAILED",
                "booking": {
                    "booking_reference": str,
                    "ticket_number": str (optional),
                    "confirmation_number": str (optional),
                    "final_price": float,
                    "currency": str,
                    "booked_at": str,
                    ...
                },
                "error_message": Optional[str]
            }
        """
        pass

