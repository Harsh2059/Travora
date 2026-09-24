from enum import Enum


class WhatsAppAction(str, Enum):
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
}


def parse_message(text: str) -> WhatsAppAction:
    normalized = " ".join((text or "").strip().lower().split())
    return _KEYWORDS.get(normalized, WhatsAppAction.UNKNOWN)
