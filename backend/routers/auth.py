import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from database import get_db
from models import User
import schemas

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
        # Auto-create user in Postgres if they authenticated successfully via Supabase
        user_meta = payload.get("user_metadata", {})
        user = User(
            id=token_data.id,
            email=token_data.email or payload.get("email", ""),
            name=user_meta.get("name", "Traveler"),
            phone_number=user_meta.get("phone_number"),
            whatsapp_phone=user_meta.get("whatsapp_phone"),
            role=token_data.role or "traveler",
            auth_provider="supabase"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
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
        user_meta = payload.get("user_metadata", {})
        user = User(
            id=token_data.id,
            email=token_data.email or payload.get("email", ""),
            name=user_meta.get("name", "Traveler"),
            phone_number=user_meta.get("phone_number"),
            whatsapp_phone=user_meta.get("whatsapp_phone"),
            role=token_data.role or "traveler",
            auth_provider="supabase"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("/me", response_model=schemas.UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
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
