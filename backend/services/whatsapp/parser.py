import re
from enum import Enum
from typing import Optional, Tuple


class WhatsAppAction(str, Enum):
    SELECT_OPTION = "SELECT_OPTION"
    CANCEL_RECOVERY = "CANCEL_RECOVERY"
    VIEW_RECOVERY = "VIEW_RECOVERY"
    ACCEPT_RECOVERY = "ACCEPT_RECOVERY"
    REJECT_RECOVERY = "REJECT_RECOVERY"
    HELP = "HELP"
    UNKNOWN = "UNKNOWN"


_KEYWORDS = {
    "accept": WhatsAppAction.ACCEPT_RECOVERY,
    "yes": WhatsAppAction.ACCEPT_RECOVERY,
    "confirm": WhatsAppAction.ACCEPT_RECOVERY,
    "details": WhatsAppAction.VIEW_RECOVERY,
    "view": WhatsAppAction.VIEW_RECOVERY,
    "recovery": WhatsAppAction.VIEW_RECOVERY,
    "reject": WhatsAppAction.REJECT_RECOVERY,
    "no": WhatsAppAction.REJECT_RECOVERY,
    "decline": WhatsAppAction.REJECT_RECOVERY,
    "help": WhatsAppAction.HELP,
    "cancel": WhatsAppAction.CANCEL_RECOVERY,
}

_KEYCAP_DIGITS = {
    "0️⃣": "0", "0\ufe0f\u20e3": "0", "0\u20e3": "0",
    "1️⃣": "1", "1\ufe0f\u20e3": "1", "1\u20e3": "1",
    "2️⃣": "2", "2\ufe0f\u20e3": "2", "2\u20e3": "2",
    "3️⃣": "3", "3\ufe0f\u20e3": "3", "3\u20e3": "3",
    "4️⃣": "4", "4\ufe0f\u20e3": "4", "4\u20e3": "4",
    "5️⃣": "5", "5\ufe0f\u20e3": "5", "5\u20e3": "5",
    "6️⃣": "6", "6\ufe0f\u20e3": "6", "6\u20e3": "6",
    "7️⃣": "7", "7\ufe0f\u20e3": "7", "7\u20e3": "7",
    "8️⃣": "8", "8\ufe0f\u20e3": "8", "8\u20e3": "8",
    "9️⃣": "9", "9\ufe0f\u20e3": "9", "9\u20e3": "9",
    "🔟": "10",
}


def normalize_input_text(text: str) -> str:
    """Normalize text by converting keycap number emojis, trimming whitespace, and extracting option numbers."""
    cleaned = (text or "").strip()
    for emoji_key, digit in _KEYCAP_DIGITS.items():
        cleaned = cleaned.replace(emoji_key, digit)
    # Remove remaining keycap combining characters or variation selectors
    cleaned = cleaned.replace("\ufe0f", "").replace("\u20e3", "").strip()

    # Match patterns like "option 1", "select option 1", "choice 1"
    match = re.match(r"^(?:select\s+)?(?:option|choice)?\s*(\d+)$", cleaned, re.IGNORECASE)
    if match:
        return match.group(1)

    return cleaned


def parse_message(text: str) -> WhatsAppAction:
    action, _ = parse_message_with_option(text)
    return action


def parse_message_with_option(text: str) -> Tuple[WhatsAppAction, Optional[str]]:
    normalized = normalize_input_text(text)
    lower = " ".join(normalized.lower().split())

    if normalized == "0":
        return WhatsAppAction.CANCEL_RECOVERY, "0"
    if normalized.isdigit():
        return WhatsAppAction.SELECT_OPTION, normalized
    if lower in _KEYWORDS:
        action = _KEYWORDS[lower]
        return action, None
    return WhatsAppAction.UNKNOWN, None
