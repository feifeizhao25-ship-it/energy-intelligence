# NOTE: This auth module is NOT currently mounted in app.main.py.
# The active auth endpoints are in app.routers.auth (mounted at /api/v1).
# This file is kept for future migration/reference.

from typing import Dict, List, Optional, Type, Union
"""Auth API — real implementation with SQLAlchemy."""
import uuid
import time
import json
import logging

logger = logging.getLogger(__name__)
import urllib.request
import urllib.parse
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# ── Brute-force protection (Redis-backed, works across workers) ───────────────
from app.redis_client import redis_client as _auth_redis
_MAX_ATTEMPTS = 5          # max failed logins
_WINDOW_SECONDS = 300      # within 5 minutes
_LOCKOUT_SECONDS = 900     # locked out for 15 minutes

def _brute_key(ip: str) -> str:
    return f"bf:{ip}"

async def _check_brute_force(ip: str) -> None:
    """Raise 429 if the IP has too many recent failed login attempts."""
    key = _brute_key(ip)
    try:
        count = await _auth_redis.get(key)
        if count and int(count) >= _MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="请求过于频繁，请稍后重试",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Redis unavailable during brute-force check: %s", e)  # degrade gracefully

async def _record_failed_attempt(ip: str) -> None:
    key = _brute_key(ip)
    try:
        pipe = _auth_redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _WINDOW_SECONDS)
        await pipe.execute()
    except Exception as e:
        logger.warning("Redis pipeline failed during failed-attempt recording: %s", e)

async def _clear_attempts(ip: str) -> None:
    try:
        await _auth_redis.delete(_brute_key(ip))
    except Exception as e:
        logger.warning("Redis delete failed during attempt cleanup: %s", e)

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user_id
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse, MagicLinkRequest
from app.schemas.common import SuccessResponse
from app.utils.response import success
from app.utils.error_codes import ErrorCode

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=SuccessResponse[TokenResponse], status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register new user account."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorCode.E4003.message,
        )

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user = User(
        id=user_id,
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        company=getattr(body, 'company', None),
        role=getattr(body, 'role', None),
        country=getattr(body, 'country', None),
        plan="free",
        created_at=now,
        updated_at=now,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    access_token = create_access_token(subject=user_id)
    refresh_token = create_refresh_token(subject=user_id)
    return success(data=TokenResponse(access_token=access_token, refresh_token=refresh_token))


@router.post("/login", response_model=SuccessResponse[TokenResponse])
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate user with email and password."""
    client_ip = request.client.host if request.client else "unknown"
    await _check_brute_force(client_ip)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        await _record_failed_attempt(client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorCode.E2004.message,
        )

    await _clear_attempts(client_ip)  # reset on successful login
    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)
    return success(data=TokenResponse(access_token=access_token, refresh_token=refresh_token))


@router.post("/magic-link", status_code=202)
async def magic_link(body: MagicLinkRequest, db: AsyncSession = Depends(get_db)):
    """Send passwordless magic link to email.
    
    Generates a short-lived signed token. In production, this token
    should be sent via email (SendGrid/AWS SES).
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        # Always return success to prevent email enumeration
        return success(data={"message": "If the email exists, a magic link has been sent"})
    
    # Generate short-lived magic token (15 minutes)
    magic_token = create_access_token(subject=str(user.id), expires_delta=timedelta(minutes=15))
    # Send email with magic link containing token
    try:
        from app.services.notification_service import notification_service
        await notification_service.send_email(
            to=user.email, template="password_reset",
            template_vars={"code": magic_token[:8], "expire": "15"}
        )
    except Exception as e:
        logger.warning("Email delivery failed for password reset: %s", e)  # non-blocking
    # Development fallback: log the token
    return success(data={
        "message": "If the email exists, a magic link has been sent",
        "_debug_token": magic_token,  # Remove in production
    })


@router.post("/google")
async def google_oauth(code: str, db: AsyncSession = Depends(get_db)):
    """OAuth2 login with Google.
    
    Exchanges authorization code for access token,
    fetches user profile, and creates or links existing user.
    """
    from app.config import settings
    
    # 1. Exchange code for access token
    try:
        token_data = urllib.parse.urlencode({
            'code': code,
            'client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
            'client_secret': getattr(settings, 'GOOGLE_CLIENT_SECRET', ''),
            'redirect_uri': getattr(settings, 'GOOGLE_REDIRECT_URI', 'http://localhost:3000/auth/google/callback'),
            'grant_type': 'authorization_code',
        })
        token_req = urllib.request.Request(
            'https://oauth2.googleapis.com/token',
            data=token_data.encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            method='POST'
        )
        with urllib.request.urlopen(token_req, timeout=10) as resp:
            token_response = json.loads(resp.read().decode('utf-8'))
        access_token = token_response.get('access_token')
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google token exchange failed: {str(e)}")
    
    # 2. Fetch user profile
    try:
        profile_req = urllib.request.Request(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        with urllib.request.urlopen(profile_req, timeout=10) as resp:
            profile = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch Google profile: {str(e)}")
    
    google_id = profile.get('id')
    email = profile.get('email')
    name = profile.get('name', email)
    
    if not google_id or not email:
        raise HTTPException(status_code=400, detail="Invalid Google profile")
    
    # 3. Find or create user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    
    if not user:
        # Try to link by email
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.google_id = google_id
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            user = User(
                id=user_id,
                name=name,
                email=email,
                google_id=google_id,
                plan="free",
                created_at=now,
                updated_at=now,
            )
            db.add(user)
    
    await db.flush()
    await db.refresh(user)
    
    access_token = create_access_token(subject=str(user.id))
    refresh_token = create_refresh_token(subject=str(user.id))
    return success(data=TokenResponse(access_token=access_token, refresh_token=refresh_token))


@router.post("/refresh", response_model=SuccessResponse[TokenResponse])
async def refresh_token(refresh_token: str, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    try:
        import jwt
        from app.config import settings
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail=ErrorCode.E2007.message)
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail=ErrorCode.E2003.message)
        # Verify user still exists
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail=ErrorCode.E2008.message)
    except Exception as e:
        logger.warning("Refresh token processing failed: %s", e)
        raise HTTPException(status_code=401, detail=ErrorCode.E2003.message)

    new_access = create_access_token(subject=user_id)
    return success(data=TokenResponse(access_token=new_access, refresh_token=refresh_token))


# ============================================
# Forgot Password
# ============================================

_VERIFICATION_CODE_TTL = 300  # 5 minutes

@router.post("/forgot-password/send-code", status_code=200)
async def forgot_password_send_code(body: dict, db: AsyncSession = Depends(get_db)):
    """Send verification code for password reset."""
    phone = body.get("phone", "").strip()
    if not phone:
        raise HTTPException(status_code=400, detail=ErrorCode.E1002.message)
    
    # Check user exists
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        # Don't reveal whether user exists
        return success(data={"message": "If the phone is registered, a code will be sent"})
    
    # Generate 6-digit code
    import secrets
    code = f"{secrets.randbelow(900000) + 100000}"
    try:
        await _auth_redis.setex(f"vc:{phone}", _VERIFICATION_CODE_TTL, code)
    except Exception as e:
        logger.warning("Redis unavailable during verification code storage: %s", e)  # still return success to avoid enumeration
    
    # Send SMS via notification service
    try:
        from app.services.notification_service import notification_service
        await notification_service.send_sms(
            phone=phone, template="password_reset",
            template_vars={"code": code, "expire": "5"}
        )
    except Exception as e:
        logger.warning("SMS delivery failed for verification code: %s", e)  # non-blocking

    # 仅在开发环境记录验证码（安全：不返回给客户端）
    from app.config import settings
    if settings.is_development:
        import logging
        logging.getLogger(__name__).info("[DEV] Verification code generated; inspect the configured SMS sandbox")

    return success(data={"message": "Verification code sent"})


@router.post("/forgot-password/reset", status_code=200)
async def forgot_password_reset(body: dict, db: AsyncSession = Depends(get_db)):
    """Reset password using verification code."""
    phone = body.get("phone", "").strip()
    code = body.get("code", "").strip()
    new_password = body.get("new_password", "")
    
    if not phone or not code or not new_password:
        raise HTTPException(status_code=400, detail=ErrorCode.E1002.message)
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Verify code
    stored_code = None
    try:
        stored_code = await _auth_redis.get(f"vc:{phone}")
    except Exception as e:
        logger.warning("Redis unavailable during verification code retrieval: %s", e)
    if not stored_code or stored_code != code:
        raise HTTPException(status_code=400, detail=ErrorCode.E2005.message)
    
    # Find user and update password
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail=ErrorCode.E4001.message)
    
    from passlib.context import CryptContext
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    user.password_hash = pwd_ctx.hash(new_password)
    user.updated_at = datetime.now(timezone.utc)
    
    # Clean up used code
    try:
        await _auth_redis.delete(f"vc:{phone}")
    except Exception as e:
        logger.warning("Redis delete failed during verification code cleanup: %s", e)
    
    await db.flush()
    return success(data={"message": "Password reset successfully"})
