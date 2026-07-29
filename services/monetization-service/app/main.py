"""Monetization service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "monetization-service"

app = FastAPI(title="Energy Intelligence — Monetization Service", version="2.0.0")


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


@app.get("/monetization/pricing")
async def pricing() -> dict[str, object]:
    """Public pricing catalogue for the intelligence platform."""
    return {
        "currency": os.getenv("BILLING_CURRENCY", "CNY"),
        "tiers": ["free", "pro", "enterprise"],
    }
