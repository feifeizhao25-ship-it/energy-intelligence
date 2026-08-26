"""Auth service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "auth-service"

app = FastAPI(title="Energy Intelligence — Auth Service", version="2.0.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "environment": os.getenv("ENVIRONMENT", "production"),
    }


@app.get("/ready")
async def ready() -> dict[str, str]:
    return {"status": "ready", "service": SERVICE_NAME}


@app.get("/auth/providers")
async def providers() -> dict[str, list[str]]:
    """SSO providers configured for this deployment."""
    configured = os.getenv("SSO_PROVIDERS", "")
    return {"providers": [p for p in configured.split(",") if p]}
