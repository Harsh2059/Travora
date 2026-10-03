"""
crypto.py — AES-256-GCM phone number encryption for Travora.

Only users.phone_number is encrypted. whatsapp_phone is NOT touched.

Envelope format (base64-encoded, stored as a string):
    ENC:<base64(nonce + ciphertext + tag)>

Backward compatibility:
    - None  → returned as None (no-op)
    - values that do NOT start with "ENC:" → treated as plaintext (legacy rows)

Environment variable:
    PHONE_ENCRYPTION_KEY — 32 raw bytes encoded as a 64-char hex string
    If absent, encryption is disabled (plaintext pass-through) so the app
    starts cleanly in environments that haven't set the key yet.
"""

import base64
import os
from typing import Optional

# ── Key loading ───────────────────────────────────────────────────────────────

_ENVELOPE_PREFIX = "ENC:"
_KEY_HEX = os.getenv("PHONE_ENCRYPTION_KEY", "")
_KEY: Optional[bytes] = None

if _KEY_HEX:
    raw = bytes.fromhex(_KEY_HEX)
    if len(raw) != 32:
        raise ValueError(
            "PHONE_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). "
            f"Got {len(raw)} bytes."
        )
    _KEY = raw


def _is_enabled() -> bool:
    """Return True if the encryption key is configured."""
    return _KEY is not None


# ── Public API ────────────────────────────────────────────────────────────────

def encrypt_phone(plaintext: Optional[str]) -> Optional[str]:
    """
    Encrypt a phone number string.

    - None  → None (no-op)
    - Already-encrypted values (ENC: prefix) → returned as-is (idempotent)
    - Plaintext → ENC:<base64(12-byte nonce + ciphertext + 16-byte tag)>
    - If PHONE_ENCRYPTION_KEY is not set → plaintext pass-through
    """
    if plaintext is None:
        return None
    if plaintext.startswith(_ENVELOPE_PREFIX):
        return plaintext  # already encrypted — idempotent
    if not _is_enabled():
        return plaintext  # key not configured — pass-through

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)  # 96-bit nonce recommended for GCM
    aesgcm = AESGCM(_KEY)
    ct_with_tag = aesgcm.encrypt(nonce, plaintext.encode(), None)  # no AAD
    blob = base64.b64encode(nonce + ct_with_tag).decode()
    return f"{_ENVELOPE_PREFIX}{blob}"


def decrypt_phone(value: Optional[str]) -> Optional[str]:
    """
    Decrypt a phone number value.

    - None  → None
    - Plaintext (no ENC: prefix) → returned as-is (backward compat)
    - ENC:<...> → decrypted string
    - If PHONE_ENCRYPTION_KEY is not set and value is ENC:-prefixed → returns
      the raw envelope (best-effort; key unavailability is a config error).
    """
    if value is None:
        return None
    if not value.startswith(_ENVELOPE_PREFIX):
        return value  # legacy plaintext row — pass-through
    if not _is_enabled():
        # Key missing but data is encrypted — surface the issue clearly.
        raise RuntimeError(
            "PHONE_ENCRYPTION_KEY is not set but an encrypted phone value was "
            "found in the database. Set the key to decrypt existing records."
        )

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    blob = base64.b64decode(value[len(_ENVELOPE_PREFIX):])
    nonce, ct_with_tag = blob[:12], blob[12:]
    aesgcm = AESGCM(_KEY)
    return aesgcm.decrypt(nonce, ct_with_tag, None).decode()


def is_encrypted(value: Optional[str]) -> bool:
    """Return True if *value* carries the ENC: envelope."""
    return value is not None and value.startswith(_ENVELOPE_PREFIX)
