"""/auth/refresh must verify via decode_token(expected_type='refresh')."""
import pytest
from fastapi import HTTPException
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.api.v1 import auth as auth_api
from app.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token


class _Result:
    def __init__(self, user):
        self._user = user

    def scalar_one_or_none(self):
        return self._user


class _FakeDb:
    def __init__(self, user):
        self.user = user

    async def execute(self, _stmt):
        return _Result(self.user)


class _User:
    id = "user_r"


@pytest.fixture
def rs256(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    priv = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                             serialization.NoEncryption()).decode()
    pub = key.public_key().public_bytes(serialization.Encoding.PEM,
                                        serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    monkeypatch.setattr(settings, "JWT_PRIVATE_KEY", priv)
    monkeypatch.setattr(settings, "JWT_PUBLIC_KEY", pub)
    monkeypatch.setattr(settings, "JWT_ALGORITHM", "RS256")


@pytest.mark.asyncio
async def test_refresh_issues_new_access_token():
    resp = await auth_api.refresh_token(create_refresh_token("user_r"), db=_FakeDb(_User()))
    assert resp is not None


@pytest.mark.asyncio
async def test_refresh_works_with_rs256(rs256):
    token = create_refresh_token("user_r")
    assert decode_token(token, expected_type="refresh") == "user_r"
    resp = await auth_api.refresh_token(token, db=_FakeDb(_User()))
    assert resp is not None


@pytest.mark.asyncio
async def test_refresh_rejects_access_token():
    with pytest.raises(HTTPException) as exc:
        await auth_api.refresh_token(create_access_token("user_r"), db=_FakeDb(_User()))
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejects_unknown_user():
    with pytest.raises(HTTPException) as exc:
        await auth_api.refresh_token(create_refresh_token("ghost"), db=_FakeDb(None))
    assert exc.value.status_code == 401
