import os
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from database import get_db
from models import User
import schemas

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
        # Supabase JWT signature validation
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
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
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
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
