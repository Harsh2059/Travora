import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Any, Dict, Optional

from .config import WhatsAppConfigurationError, WhatsAppSettings

logger = logging.getLogger("travel_recovery.whatsapp")


class WhatsAppClientError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class MetaWhatsAppClient:
    def __init__(self, settings: Optional[WhatsAppSettings] = None):
        self.settings = settings or WhatsAppSettings.from_env()

    def send_text(self, recipient: str, text: str) -> Dict[str, Any]:
        self.settings.validate_for_send()
        endpoint = (
            f"https://graph.facebook.com/{self.settings.api_version}/"
            f"{self.settings.phone_number_id}/messages"
        )
        body = {
            "messaging_product": "whatsapp",
            "to": recipient,
            "type": "text",
            "text": {"body": text},
        }
        request = Request(
            endpoint,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.settings.access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.settings.timeout_seconds) as response:
                result = json.loads(response.read().decode("utf-8"))
                logger.info("WhatsApp message sent: status=%s", response.status)
                return result
        except HTTPError as exc:
            try:
                error_body = exc.read().decode("utf-8")
            except Exception:
                error_body = "<could not read response body>"
                
            error_json = None
            try:
                error_json = json.loads(error_body)
            except Exception:
                pass
                
            logger.warning(
                "WhatsApp API request failed: status=%s, url=%s, phone_number_id=%s, recipient=%s, body=%s, json=%s",
                exc.code,
                endpoint,
                self.settings.phone_number_id,
                recipient,
                error_body,
                error_json
            )
            
            # Extract Meta error message if available
            meta_error = "Meta WhatsApp API returned HTTP " + str(exc.code)
            if error_json and "error" in error_json and "message" in error_json["error"]:
                meta_error += f": {error_json['error']['message']}"
                
            raise WhatsAppClientError(
                meta_error, status_code=exc.code
            ) from exc
        except (URLError, TimeoutError, OSError) as exc:
            logger.warning("WhatsApp API network failure: %s", type(exc).__name__)
            raise WhatsAppClientError("Meta WhatsApp API is unavailable") from exc
        except ValueError as exc:
            logger.warning("WhatsApp API response could not be read: %s", type(exc).__name__)
            raise WhatsAppClientError("Invalid response from Meta WhatsApp API") from exc
