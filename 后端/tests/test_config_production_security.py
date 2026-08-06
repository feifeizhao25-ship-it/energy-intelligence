import pytest

from app.config import Settings


@pytest.mark.parametrize(
    "secret",
    [
        "dev-secret-key-must-be-at-least-32-chars-long-for-security",
        "change-me-in-production-must-be-32-chars",
        "<generate-a-strong-random-secret-key>",
        "a" * 64,
    ],
)
def test_production_rejects_default_placeholder_and_low_diversity_secrets(secret: str):
    with pytest.raises(ValueError, match="SECURITY ERROR"):
        Settings(ENVIRONMENT="production", SECRET_KEY=secret)


def test_production_accepts_explicit_high_diversity_secret():
    settings = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="G7k!tR2p#9Vz_L4n@8Qa-X5m$3Ws+6Ju",
        DATABASE_URL="postgresql+asyncpg://app:secret@postgres.internal/energy",
        REDIS_URL="redis://redis.internal:6379/0",
        CORS_ORIGINS=["https://global.energy.example"],
        VECTOR_STORE_BACKEND="milvus",
        MARKET_REGION="global",
    )
    assert settings.ENVIRONMENT == "production"


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("DATABASE_URL", "sqlite+aiosqlite:///./prod.db", "managed database"),
        ("REDIS_URL", "redis://localhost:6379/0", "deployed Redis"),
        ("CORS_ORIGINS", ["*"], "explicit HTTPS"),
        ("VECTOR_STORE_BACKEND", "memory", "durable vector store"),
    ],
)
def test_production_rejects_non_durable_or_unsafe_infrastructure(field, value, message):
    config = {
        "ENVIRONMENT": "production",
        "SECRET_KEY": "G7k!tR2p#9Vz_L4n@8Qa-X5m$3Ws+6Ju",
        "DATABASE_URL": "postgresql+asyncpg://app:secret@postgres.internal/energy",
        "REDIS_URL": "redis://redis.internal:6379/0",
        "CORS_ORIGINS": ["https://global.energy.example"],
        "VECTOR_STORE_BACKEND": "milvus",
        "MARKET_REGION": "global",
    }
    config[field] = value
    with pytest.raises(ValueError, match=message):
        Settings(**config)


def test_production_requires_explicit_market_region():
    with pytest.raises(ValueError, match="explicit MARKET_REGION"):
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="G7k!tR2p#9Vz_L4n@8Qa-X5m$3Ws+6Ju",
            DATABASE_URL="postgresql+asyncpg://app:secret@postgres.internal/energy",
            REDIS_URL="redis://redis.internal:6379/0",
            CORS_ORIGINS=["https://global.energy.example"],
            VECTOR_STORE_BACKEND="milvus",
        )
