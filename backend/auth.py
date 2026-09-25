import os
import re
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Set

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from sqlalchemy.orm import Session

import models
from database import get_db

logger = logging.getLogger("travel_recovery.auth")

# ── Security Configuration ──────────────────────────────────────────────────
# Pull secret from environment variable; default only with warning in development
JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SECRET_KEY")
if not JWT_SECRET:
    JWT_SECRET = "travora-insecure-dev-secret-key-replace-in-production-env-32bytes"
    logger.warning("JWT_SECRET is not set in environment. Using fallback development key.")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)


# ── Password Hashing ────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash plaintext password using bcrypt."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: Optional[str]) -> bool:
    """Verify plaintext password against bcrypt hash."""
    if not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)


# ── Phone Normalization ─────────────────────────────────────────────────────
def normalize_phone(phone: Optional[str]) -> Optional[str]:
    """
    Normalizes phone numbers to standard E.164-style '+<country_code><number>'
    such that +917710989533 and 917710989533 produce the exact same representation.
    
    Examples:
      '+917710989533'   -> '+917710989533'
      '917710989533'    -> '+917710989533'
      '7710989533'      -> '+917710989533'  (10-digit Indian standard default)
      '+91 77109 89533' -> '+917710989533'
      '07710989533'     -> '+917710989533'
    """
    if not phone:
        return None
    raw = str(phone).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return None
    
    # 10 digits -> assume India (+91)
    if len(digits) == 10:
        return f"+91{digits}"
    # 11 digits starting with 0 -> assume India (+91)
    if len(digits) == 11 and digits.startswith("0"):
        return f"+91{digits[1:]}"
    # 12 digits starting with 91 -> (+91)
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    # Otherwise standard with leading +
    return f"+{digits}"


def get_phone_lookup_candidates(phone: str) -> Set[str]:
    """
    Generate all possible stored/received representations of a phone number
    so that incoming webhooks (e.g. from Meta) match database records regardless
    of leading '+', country codes, or legacy formatting.
    """
    if not phone:
        return set()
    raw = str(phone).strip()
    digits = "".join(ch for ch in raw if ch.isdigit())
    if not digits:
        return {raw}

    candidates = {raw, digits, f"+{digits}"}
    normalized = normalize_phone(raw)
    if normalized:
        candidates.add(normalized)
        candidates.add(normalized.lstrip("+"))

    # If 12 digits starting with 91, also include 10-digit mobile
    if len(digits) == 12 and digits.startswith("91"):
        last_10 = digits[2:]
        candidates.add(last_10)
        candidates.add(f"+91{last_10}")
        candidates.add(f"0{last_10}")
    elif len(digits) == 10:
        candidates.add(f"91{digits}")
        candidates.add(f"+91{digits}")
        candidates.add(f"0{digits}")

    return candidates


def find_user_by_phone(db: Session, phone: str) -> Optional[models.User]:
    """
    Resolve a user by phone or WhatsApp number using normalized candidate matching.
    """
    candidates = get_phone_lookup_candidates(phone)
    if not candidates:
        return None

    # 1. Direct indexed match against candidate variants
    user = db.query(models.User).filter(
        (models.User.whatsapp_phone.in_(candidates)) |
        (models.User.phone_number.in_(candidates))
    ).first()
    if user:
        return user

    # 2. Resilient fallback: compare digits directly on users who have a phone set
    clean_target = "".join(ch for ch in str(phone) if ch.isdigit())
    if not clean_target:
        return None

    candidates_users = db.query(models.User).filter(
        (models.User.whatsapp_phone.isnot(None)) |
        (models.User.phone_number.isnot(None))
    ).all()

    for u in candidates_users:
        for field_val in (u.whatsapp_phone, u.phone_number):
            if field_val:
                u_digits = "".join(ch for ch in str(field_val) if ch.isdigit())
                if u_digits == clean_target:
                    return u
                # Match last 10 digits for Indian mobiles
                if len(u_digits) >= 10 and len(clean_target) >= 10 and u_digits[-10:] == clean_target[-10:]:
                    return u

    return None


# ── JWT Operations ──────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception) as e:
        logger.debug(f"JWT decode error: {e}")
        return None


# ── FastAPI Dependencies ────────────────────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Enforces authentication. Raises 401 Unauthorized if token is missing or invalid.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials or not credentials.credentials:
        raise credentials_exception

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise credentials_exception

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise credentials_exception

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """
    Optional authentication dependency.
    - If no Authorization header is provided: returns None (allowing unauthenticated / demo access).
    - If Authorization header is provided: decodes and returns User, or raises 401 if invalid.
    """
    if not credentials or not credentials.credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
