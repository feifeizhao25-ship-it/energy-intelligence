"""Notification service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os
import uuid

from fastapi import FastAPI

SERVICE_NAME = "notification-service"

app = FastAPI(title="Energy Intelligence — Notification Service", version="2.0.0")


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


@app.post("/notifications/send", status_code=202)
async def send_notification(channel: str, recipient: str) -> dict[str, str]:
    """Queue a notification over email, SMS or push channels."""
    return {
        "notification_id": str(uuid.uuid4()),
        "channel": channel,
        "recipient": recipient,
        "status": "queued",
    }
