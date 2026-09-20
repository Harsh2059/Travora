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
