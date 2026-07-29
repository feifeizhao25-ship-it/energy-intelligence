"""User service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

SERVICE_NAME = "user-service"

app = FastAPI(title="Energy Intelligence — User Service", version="2.0.0")


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


@app.get("/users/{user_id}")
async def get_user(user_id: str) -> dict[str, object]:
    """Fetch a user profile by id."""
    return {"user_id": user_id, "profile": None}
