import os
from typing import Optional
from dataclasses import dataclass


class WhatsAppConfigurationError(RuntimeError):
    pass


@dataclass(frozen=True)
class WhatsAppSettings:
    mode: str = "real"
    access_token: str = ""
    phone_number_id: str = ""
    business_account_id: str = ""
    api_version: str = "v21.0"
    verify_token: str = ""
    app_secret: Optional[str] = None
    timeout_seconds: float = 10.0

    @classmethod
    def from_env(cls) -> "WhatsAppSettings":
        return cls(
            mode=os.getenv("WHATSAPP_MODE", "real").lower(),
            access_token=os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
            business_account_id=os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID", ""),
            api_version=os.getenv("WHATSAPP_API_VERSION", "v21.0"),
            verify_token=os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
            app_secret=os.getenv("WHATSAPP_APP_SECRET") or None,
            timeout_seconds=float(os.getenv("WHATSAPP_TIMEOUT_SECONDS", "10")),
        )

    def validate_for_send(self) -> None:
        if self.mode != "real":
            raise WhatsAppConfigurationError(
                "WHATSAPP_MODE must be 'real'; configure Meta WhatsApp Cloud API credentials."
            )
        missing = [
            name for name, value in (
                ("WHATSAPP_ACCESS_TOKEN", self.access_token),
                ("WHATSAPP_PHONE_NUMBER_ID", self.phone_number_id),
                ("WHATSAPP_API_VERSION", self.api_version),
            ) if not value
        ]
        if missing:
            raise WhatsAppConfigurationError(
                "Missing WhatsApp configuration: " + ", ".join(missing)
            )

    def validate_for_webhook(self) -> None:
        if not self.verify_token:
            raise WhatsAppConfigurationError("WHATSAPP_VERIFY_TOKEN is not configured.")
