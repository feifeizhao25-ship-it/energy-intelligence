"""
Tests for authentication endpoints and security utilities.
Run with: pytest tests/test_auth.py -v
"""
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


# ── Password hashing ───────────────────────────────────────────────────────────
class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        pw = "MySecurePassword123!"
        hashed = hash_password(pw)
        assert hashed != pw

    def test_verify_correct_password(self):
        pw = "MySecurePassword123!"
        hashed = hash_password(pw)
        assert verify_password(pw, hashed) is True

    def test_reject_wrong_password(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_different_hashes_same_password(self):
        """bcrypt salts — same password should produce different hashes."""
        pw = "TestPassword"
        hash1 = hash_password(pw)
        hash2 = hash_password(pw)
        assert hash1 != hash2
        assert verify_password(pw, hash1)
        assert verify_password(pw, hash2)


# ── JWT tokens ────────────────────────────────────────────────────────────────
class TestJWTTokens:
    def test_create_and_decode_access_token(self):
        token = create_access_token(subject="user_123")
        user_id = decode_token(token)
        assert user_id == "user_123"

    def test_create_refresh_token(self):
        token = create_refresh_token(subject="user_456")
        assert token is not None
        assert len(token) > 10

    def test_decode_invalid_token_returns_none(self):
        result = decode_token("not.a.valid.jwt.token")
        assert result is None

    def test_decode_empty_token_returns_none(self):
        result = decode_token("")
        assert result is None

    def test_decode_tampered_token_returns_none(self):
        token = create_access_token(subject="user_789")
        # Tamper with payload
        parts = token.split(".")
        tampered = parts[0] + ".TAMPERED" + parts[1] + "." + parts[2]
        result = decode_token(tampered)
        assert result is None


# ── Register endpoint ─────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_missing_fields():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Missing required 'name' and 'password'
        resp = await client.post("/api/v1/auth/register", json={"email": "test@example.com"})
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/auth/register", json={
            "email": "not-an-email",
            "password": "SecurePass123!",
            "name": "Test User",
        })
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_missing_credentials():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/auth/login", json={"email": "user@test.com"})
        assert resp.status_code == 422


# ── Magic link ────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_magic_link_returns_202():
    """Magic link always returns 202 to prevent email enumeration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/magic-link",
            json={"email": "anyone@example.com"},
        )
        # Should return 202 even for non-existent email
        assert resp.status_code in (200, 202)


# ── Protected route without token ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_protected_route_without_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/users/me")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_with_invalid_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/users/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401
