import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from database import get_db
from models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "travora_super_secret_key_123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    role: str

class TokenData(BaseModel):
    id: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    otp: Optional[str] = None
    provider: Optional[str] = "local" # local, google, facebook
    provider_token: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None

def verify_password(plain_password, hashed_password):
    if not hashed_password: return False
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(id=user_id, role=payload.get("role"))
    except JWTError:
        raise credentials_exception
    user = db.query(User).filter(User.id == int(token_data.id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/register", response_model=Token)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(request.password)
    new_user = User(
        name=request.name,
        email=request.email,
        whatsapp_phone=request.phone,
        hashed_password=hashed_password,
        role="traveler",
        auth_provider="local"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token = create_access_token(
        data={"sub": str(new_user.id), "role": new_user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": new_user.id, "role": new_user.role}

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    if request.provider == "local":
        if request.email and request.password:
            user = db.query(User).filter(User.email == request.email).first()
            if not user or not verify_password(request.password, user.hashed_password):
                raise HTTPException(status_code=401, detail="Incorrect email or password")
        elif request.phone and request.otp:
            # Simple mock OTP for demo
            if request.otp != "123456":
                raise HTTPException(status_code=401, detail="Invalid OTP")
            user = db.query(User).filter(User.whatsapp_phone == request.phone).first()
            if not user:
                user = User(
                    name="Traveler", 
                    whatsapp_phone=request.phone,
                    role="traveler",
                    auth_provider="phone"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
        else:
            raise HTTPException(status_code=400, detail="Invalid login criteria")
    elif request.provider in ["google", "facebook"]:
        email = request.email or f"mock_{request.provider}@example.com"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                name=f"OAuth {request.provider.capitalize()} User",
                email=email,
                role="traveler",
                auth_provider=request.provider
            )
            db.add(user)
            db.commit()
            db.refresh(user)
    else:
        raise HTTPException(status_code=400, detail="Unsupported provider")

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id, "role": user.role}

@router.get("/me")
def read_users_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.whatsapp_phone,
        "role": current_user.role
    }
