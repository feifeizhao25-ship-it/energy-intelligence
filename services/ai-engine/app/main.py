"""AI engine — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

from app.skills.v31_new_skills import SKILLS

SERVICE_NAME = "ai-engine"

app = FastAPI(title="Energy Intelligence — AI Engine", version="3.1.0")


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


@app.get("/skills")
async def list_skills() -> dict[str, list[str]]:
    """Skills registered in this AI-engine build."""
    return {"skills": [skill.skill_id for skill in SKILLS]}
