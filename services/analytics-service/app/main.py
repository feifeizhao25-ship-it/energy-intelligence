"""Analytics service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "analytics-service"

app = FastAPI(title="Energy Intelligence — Analytics Service", version="2.0.0")


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


@app.get("/analytics/overview")
async def overview(project_id: str | None = None) -> dict[str, object]:
    """Aggregated analytics overview for the platform or one project."""
    return {"project_id": project_id, "metrics": {}}
