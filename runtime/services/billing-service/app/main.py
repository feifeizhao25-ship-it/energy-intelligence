"""Billing service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "billing-service"

app = FastAPI(title="Energy Intelligence — Billing Service", version="2.0.0")


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


@app.get("/billing/plans")
async def plans() -> dict[str, object]:
    """Subscription plans billed through the configured payment provider."""
    return {
        "currency": os.getenv("BILLING_CURRENCY", "CNY"),
        "provider": os.getenv("BILLING_PROVIDER", "stripe"),
        "plans": [],
    }
