"""Project service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "project-service"

app = FastAPI(title="Energy Intelligence — Project Service", version="2.0.0")


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


@app.get("/projects")
async def list_projects(owner_id: str | None = None) -> dict[str, object]:
    """List energy projects visible to the caller."""
    return {"owner_id": owner_id, "projects": []}
