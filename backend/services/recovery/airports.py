"""
Airport / IATA resolution for recovery candidate matching.

Recovery never treats a city/region name as a route by itself.
Candidates are matched on resolved airport codes (BOM, ATQ, IXC, ...).
"""

from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple


IATA_RE = re.compile(r"\(([A-Z]{3,4})\)", re.IGNORECASE)
BARE_IATA_RE = re.compile(r"^[A-Z]{3,4}$")

# Display labels used on recovery cards (never "Punjab" as an airport).
AIRPORT_LABELS = {
    "BOM": "Mumbai (BOM)",
    "DEL": "Delhi (DEL)",
    "NDLS": "New Delhi (NDLS)",
    "ATQ": "Amritsar (ATQ)",
    "IXC": "Chandigarh (IXC)",
    "LUH": "Ludhiana (LUH)",
    "IXP": "Pathankot (IXP)",
    "JAI": "Jaipur (JAI)",
    "JP": "Jaipur (JP)",
    "BLR": "Bengaluru (BLR)",
    "HYD": "Hyderabad (HYD)",
    "MAA": "Chennai (MAA)",
    "CCU": "Kolkata (CCU)",
    "PNQ": "Pune (PNQ)",
    "AMD": "Ahmedabad (AMD)",
    "GOI": "Goa (GOI)",
    "LHR": "London Heathrow (LHR)",
    "DOH": "Doha (DOH)",
}

# Station / metro codes that map onto an airport for flight recovery.
CODE_ALIASES = {
    "NDLS": "DEL",
    "JP": "JAI",
}

# City / venue phrases -> IATA. Longer keys first when matching.
CITY_TO_IATA = {
    "sri guru ram dass": "ATQ",
    "amritsar": "ATQ",
    "chandigarh": "IXC",
    "ludhiana": "LUH",
    "pathankot": "IXP",
    "mumbai": "BOM",
    "bombay": "BOM",
    "new delhi": "DEL",
    "delhi": "DEL",
    "jaipur": "JAI",
    "bengaluru": "BLR",
    "bangalore": "BLR",
    "hyderabad": "HYD",
    "chennai": "MAA",
    "kolkata": "CCU",
    "calcutta": "CCU",
    "pune": "PNQ",
    "ahmedabad": "AMD",
    "goa": "GOI",
    "london heathrow": "LHR",
    "heathrow": "LHR",
    "london": "LHR",
}

# Region names that are not airports. Resolved only via itinerary context
# or a documented default (Amritsar is the primary BOM↔Punjab airport).
REGION_AIRPORTS = {
    "punjab": ("ATQ", "IXC", "LUH", "IXP"),
}

DEFAULT_REGION_AIRPORT = {
    "punjab": "ATQ",
}


def normalize_iata(code: Optional[str]) -> Optional[str]:
    if not code:
        return None
    c = str(code).strip().upper()
    if not c:
        return None
    c = CODE_ALIASES.get(c, c)
    return c


def extract_iata(raw: Optional[str]) -> Optional[str]:
    """Extract an IATA/station code from 'Mumbai (BOM)', 'BOM', or similar."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    paren = IATA_RE.search(text)
    if paren:
        return normalize_iata(paren.group(1))
    token = text.replace(" ", "")
    if BARE_IATA_RE.match(token):
        return normalize_iata(token)
    return None


def _city_code(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    lowered = str(raw).lower()
    # Prefer longer city keys (new delhi before delhi).
    for name in sorted(CITY_TO_IATA.keys(), key=len, reverse=True):
        if name in lowered:
            return CITY_TO_IATA[name]
    return None


def _region_key(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    lowered = str(raw).lower()
    for region in REGION_AIRPORTS:
        if region in lowered:
            return region
    return None


def airport_label(code: Optional[str], fallback: Optional[str] = None) -> str:
    n = normalize_iata(code)
    if n and n in AIRPORT_LABELS:
        return AIRPORT_LABELS[n]
    if fallback:
        extracted = extract_iata(fallback) or _city_code(fallback)
        if extracted and extracted in AIRPORT_LABELS:
            return AIRPORT_LABELS[extracted]
        return str(fallback)
    return n or ""


def _scan_nodes_for_airports(nodes: Iterable[Dict[str, Any]], allowed: Optional[Tuple[str, ...]] = None) -> List[str]:
    found: List[str] = []
    fields = ("origin", "destination", "location", "title", "provider")
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        for field in fields:
            raw = node.get(field)
            code = extract_iata(raw) or _city_code(raw)
            if not code:
                continue
            if allowed and code not in allowed:
                continue
            if code not in found:
                found.append(code)
    return found


def resolve_airport_code(
    raw: Optional[str],
    journey_nodes: Optional[List[Dict[str, Any]]] = None,
    role: str = "any",
) -> Optional[str]:
    """
    Resolve a location string to a single airport code.

    Order:
      1. Explicit IATA in the string
      2. City alias (Amritsar → ATQ, Chandigarh → IXC, Mumbai → BOM)
      3. Region (Punjab) disambiguated from other itinerary nodes
      4. Documented region default (Punjab → ATQ) — never DEL
    """
    direct = extract_iata(raw)
    if direct:
        return direct

    city = _city_code(raw)
    if city:
        return city

    region = _region_key(raw)
    if region:
        allowed = REGION_AIRPORTS[region]
        hinted = _scan_nodes_for_airports(journey_nodes or [], allowed=allowed)
        # Prefer a hint that is not the other role's airport when possible.
        if len(hinted) == 1:
            return hinted[0]
        if hinted:
            return hinted[0]
        return DEFAULT_REGION_AIRPORT.get(region)

    # Last chance: scan itinerary if the raw field was empty/generic.
    if journey_nodes and role in ("destination", "origin"):
        scanned = _scan_nodes_for_airports(journey_nodes)
        if scanned:
            return scanned[-1] if role == "destination" else scanned[0]

    return None


def resolve_disrupted_route(
    node: Dict[str, Any],
    journey_nodes: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[Optional[str], Optional[str]]:
    meta = node.get("item_metadata") if isinstance(node.get("item_metadata"), dict) else {}
    raw_origin = node.get("origin_airport") or node.get("origin") or meta.get("origin_airport") or meta.get("origin")
    raw_dest = node.get("destination_airport") or node.get("destination") or node.get("location") or meta.get("destination_airport") or meta.get("destination")

    nodes = journey_nodes if journey_nodes is not None else [node]
    origin = resolve_airport_code(raw_origin, nodes, role="origin") or resolve_airport_code(node.get("title"), nodes, role="origin")
    dest = resolve_airport_code(raw_dest, nodes, role="destination") or resolve_airport_code(node.get("title"), nodes, role="destination")
    return origin, dest


def same_airport(a: Optional[str], b: Optional[str]) -> bool:
    na, nb = normalize_iata(a), normalize_iata(b)
    return bool(na and nb and na == nb)
