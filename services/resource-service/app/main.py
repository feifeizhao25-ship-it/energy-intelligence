"""Resource service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "resource-service"

app = FastAPI(title="Energy Intelligence — Resource Service", version="2.0.0")


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


@app.get("/resources")
async def list_resources(resource_type: str | None = None) -> dict[str, object]:
    """List energy resource datasets (sites, irradiance, grid tariffs)."""
    return {"resource_type": resource_type, "resources": []}
