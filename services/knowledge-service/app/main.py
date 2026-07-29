"""Knowledge service — production FastAPI entrypoint for 新能源智库."""

from __future__ import annotations

import os

from fastapi import FastAPI

from app.skills.knowledge_management import get_skill

SERVICE_NAME = "knowledge-service"

app = FastAPI(title="Energy Intelligence — Knowledge Service", version="2.0.0")


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


@app.get("/knowledge/search")
async def search(query: str) -> dict[str, object]:
    """Search the curated energy knowledge base."""
    documents = get_skill().search(query)
    return {"query": query, "documents": [doc.__dict__ for doc in documents]}
