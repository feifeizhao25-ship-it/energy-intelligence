"""Seedream / Seedance are marketing-pipeline only and default off."""
from __future__ import annotations

from app.config import settings

_ENABLED = False  # 营销图和视频开关默认关闭，不随其它任务打开。


def media_status() -> dict:
    return {
        "enabled": _ENABLED,
        "image_model": settings.NENGJIAN_SEEDREAM_MODEL,
        "video_model": settings.NENGJIAN_SEEDANCE_MODEL,
        "base": settings.NENGJIAN_ARK_BASE_URL,
        "key_present": bool(settings.NENGJIAN_ARK_API_KEY),
        "note": "TODO: 方舟 images/generations 与视频任务的请求体以火山当前文档为准。未打开开关时不请求。",
    }


def generate_image(prompt: str) -> dict:
    if not _ENABLED:
        return {"status": "disabled"}
    return {"status": "stub", "prompt_chars": len(prompt)}
