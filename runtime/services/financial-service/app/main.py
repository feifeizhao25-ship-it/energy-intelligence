"""Financial service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "financial-service"

app = FastAPI(title="Energy Intelligence — Financial Service", version="2.0.0")


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


@app.get("/financial/models/{project_id}")
async def financial_model(project_id: str) -> dict[str, object]:
    """Financial model summary for a project (IRR, NPV, payback)."""
    return {
        "project_id": project_id,
        "currency": os.getenv("BILLING_CURRENCY", "CNY"),
        "metrics": {},
    }
