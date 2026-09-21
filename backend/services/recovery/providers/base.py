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


def is_candidate_unavailable(candidate: Dict[str, Any], known_unavailable: Optional[List[Any]] = None) -> bool:
    """
    Check whether a specific candidate option matches any entry in known_unavailable.
    known_unavailable contains specifically excluded resource IDs, booking IDs, flight numbers, or candidate IDs.
    Does NOT blacklist entire provider brands unless explicitly scoped with scope='provider'.
    """
    if not known_unavailable:
        return False

    cand_id = str(candidate.get("candidate_id") or "").strip().lower()
    booking_id = str(candidate.get("booking_id") or "").strip().lower()
    flight_num = str(candidate.get("flight_number") or "").strip().lower()
    res_id = str(candidate.get("resource_id") or "").strip().lower()
    node_id = str(candidate.get("id") or "").strip().lower()

    for item in known_unavailable:
        if not item:
            continue

        if isinstance(item, str):
            target = item.strip().lower()
            if not target:
                continue
            # Match exact resource / booking identifiers
            if target in (cand_id, booking_id, flight_num, res_id, node_id) and target != "":
                return True
        elif isinstance(item, dict):
            # Dict with specific resource fields
            t_booking = str(item.get("booking_id") or "").strip().lower()
            t_flight = str(item.get("flight_number") or "").strip().lower()
            t_res = str(item.get("resource_id") or "").strip().lower()
            t_cand = str(item.get("candidate_id") or "").strip().lower()
            t_node = str(item.get("node_id") or "").strip().lower()
            t_scope = str(item.get("scope") or "").strip().lower()
            t_provider = str(item.get("provider") or "").strip().lower()

            if t_booking and t_booking == booking_id:
                return True
            if t_flight and t_flight == flight_num:
                return True
            if t_res and t_res == res_id:
                return True
            if t_cand and t_cand == cand_id:
                return True
            if t_node and t_node == node_id:
                return True
            if t_scope == "provider" and t_provider and t_provider == str(candidate.get("provider", "")).strip().lower():
                return True

    return False


