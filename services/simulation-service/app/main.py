"""Simulation service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os
import uuid

from fastapi import FastAPI

SERVICE_NAME = "simulation-service"

app = FastAPI(title="Energy Intelligence — Simulation Service", version="2.0.0")


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


@app.post("/simulations", status_code=202)
async def create_simulation(project_id: str, scenario: str = "baseline") -> dict[str, str]:
    """Queue a production/yield simulation for a project scenario."""
    return {
        "simulation_id": str(uuid.uuid4()),
        "project_id": project_id,
        "scenario": scenario,
        "status": "queued",
    }
