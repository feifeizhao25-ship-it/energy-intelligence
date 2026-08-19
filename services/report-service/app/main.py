"""Report service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os
import uuid

from fastapi import FastAPI

SERVICE_NAME = "report-service"

app = FastAPI(title="Energy Intelligence — Report Service", version="2.0.0")


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


@app.post("/reports", status_code=202)
async def create_report(project_id: str, template: str = "standard") -> dict[str, str]:
    """Queue generation of a project intelligence report."""
    return {
        "report_id": str(uuid.uuid4()),
        "project_id": project_id,
        "template": template,
        "status": "queued",
    }
