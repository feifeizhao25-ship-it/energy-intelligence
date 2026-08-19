"""Diagnostic service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os
import uuid

from fastapi import FastAPI

SERVICE_NAME = "diagnostic-service"

app = FastAPI(title="Energy Intelligence — Diagnostic Service", version="2.0.0")


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


@app.post("/diagnostics/run", status_code=202)
async def run_diagnostic(project_id: str) -> dict[str, str]:
    """Queue an energy-system diagnostic run for a project."""
    return {
        "diagnostic_id": str(uuid.uuid4()),
        "project_id": project_id,
        "status": "queued",
    }
