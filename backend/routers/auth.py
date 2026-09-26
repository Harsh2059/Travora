import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from jose import JWTError, jwt
from database import get_db
from models import User
import schemas
import crypto as phone_crypto

# ── Password helpers ──────────────────────────────────────────────────────────
try:
    import bcrypt
    _BCRYPT_AVAILABLE = True
except ImportError:
    _BCRYPT_AVAILABLE = False

try:
    from passlib.context import CryptContext
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    _PASSLIB_AVAILABLE = True
except Exception:
    _pwd_context = None
    _PASSLIB_AVAILABLE = False


def hash_password(plain: str) -> str:
    """Hash a plaintext password using bcrypt."""
    pw_bytes = plain.encode('utf-8')[:72]
    if _BCRYPT_AVAILABLE:
        return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode('utf-8')
    if _PASSLIB_AVAILABLE and _pwd_context is not None:
        return _pwd_context.hash(plain[:72])
    raise RuntimeError("bcrypt or passlib[bcrypt] is not installed — cannot hash passwords.")


def verify_password(plain: str, hashed: Optional[str]) -> bool:
    """Return True if *plain* matches the stored *hashed* password."""
    if not hashed:
        return False
    pw_bytes = plain.encode('utf-8')[:72]
    if _BCRYPT_AVAILABLE:
        try:
            return bcrypt.checkpw(pw_bytes, hashed.encode('utf-8'))
        except Exception:
            pass
    if _PASSLIB_AVAILABLE and _pwd_context is not None:
        try:
            return _pwd_context.verify(plain[:72], hashed)
        except Exception:
            return False
    return False


# ── JWT helpers ───────────────────────────────────────────────────────────────
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ── UUID helper for local user creation ───────────────────────────────────────
def new_user_id() -> str:
    """Generate a new UUID string for a locally-registered user."""
    return str(uuid.uuid4())

SECRET_KEY = os.getenv("JWT_SECRET_KEY") or os.getenv("JWT_SECRET", "travora_super_secret_key_123")
ALGORITHM = "HS256"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class TokenData(BaseModel):
    id: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None


def _phone_variants(phone: Optional[str]) -> set[str]:
    """Return equivalent representations for matching legacy phone data."""
    if not phone:
        return set()

    digits = "".join(char for char in str(phone) if char.isdigit())
    if not digits:
        return set()

    variants = {str(phone).strip(), digits, f"+{digits}"}
    if len(digits) == 10:
        variants.update({f"+91{digits}", f"91{digits}"})
    elif len(digits) == 12 and digits.startswith("91"):
        variants.update({digits[2:], f"+{digits}"})
    return variants


def provision_supabase_user(db: Session, token_data: TokenData, payload: dict) -> User:
    """Create a local record for a Supabase identity, rejecting account conflicts cleanly."""
    user_meta = payload.get("user_metadata") or {}
    email = (token_data.email or payload.get("email") or "").strip().lower()
    raw_whatsapp_phone = user_meta.get("whatsapp_phone")
    normalized_whatsapp_phone = normalize_phone(raw_whatsapp_phone)

    # Older rows may contain a raw local number (for example, 8668429664), so
    # compare equivalent forms while new records are always normalized.
    phone_values = _phone_variants(raw_whatsapp_phone)
    query = db.query(User).filter(User.email == email) if email else db.query(User)
    if phone_values:
        query = db.query(User).filter(
            (User.email == email) | (User.whatsapp_phone.in_(phone_values))
            if email else User.whatsapp_phone.in_(phone_values)
        )
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this email or WhatsApp number.",
        )

    user = User(
        id=token_data.id,
        email=email,
        name=user_meta.get("name", "Traveler"),
        phone_number=phone_crypto.encrypt_phone(normalize_phone(user_meta.get("phone_number"))),
        whatsapp_phone=normalized_whatsapp_phone,
        role=token_data.role or "traveler",
        auth_provider="supabase",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request can pass the lookup above; the database remains
        # the source of truth, and callers still receive a useful API error.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists with this email or WhatsApp number.",
        )
    db.refresh(user)
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Check if we have the real Supabase JWT Secret configured
        has_secret = os.getenv("JWT_SECRET_KEY") is not None
        
        # Supabase JWT signature validation
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM], 
            options={
                "verify_aud": False,
                "verify_signature": has_secret  # Only verify signature if secret is provided in env
            }
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(id=user_id, role=payload.get("role"), email=payload.get("email"))
    except JWTError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == token_data.id).first()
    if user is None:
        user = provision_supabase_user(db, token_data, payload)
    return user

async def get_optional_user(token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)), db: Session = Depends(get_db)):
    if not token:
        return None
    try:
        has_secret = os.getenv("JWT_SECRET_KEY") is not None
        payload = jwt.decode(
            token, 
            SECRET_KEY, 
            algorithms=[ALGORITHM], 
            options={
                "verify_aud": False,
                "verify_signature": has_secret
            }
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        token_data = TokenData(id=user_id, role=payload.get("role"), email=payload.get("email"))
    except JWTError:
        return None
        
    user = db.query(User).filter(User.id == token_data.id).first()
    if user is None:
        user = provision_supabase_user(db, token_data, payload)
    return user

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    # Decrypt phone_number for the API response — caller always sees plaintext
    current_user.phone_number = phone_crypto.decrypt_phone(current_user.phone_number)
    return current_user

def normalize_phone(phone: str) -> str:
    """Normalize phone number by stripping spaces, dashes, and ensuring + prefix."""
    if not phone:
        return phone
    cleaned = ''.join(c for c in phone if c.isdigit() or c == '+')
    if cleaned and not cleaned.startswith('+'):
        if len(cleaned) == 10:
            cleaned = '+91' + cleaned
        else:
            cleaned = '+' + cleaned
    return cleaned
