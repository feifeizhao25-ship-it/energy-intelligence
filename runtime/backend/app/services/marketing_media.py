"""方舟 Seedream / Seedance。营销图和视频默认关闭。

图像：POST {NENGJIAN_ARK_BASE_URL}/images/generations
视频：POST {NENGJIAN_ARK_BASE_URL}/contents/generations/tasks
content 为 [{"type":"text","text":...}]。
模型号可用环境变量覆盖。文档示例为 doubao-seedream-4-0-250828 与
doubao-seedance-1-0-pro-250528；控制台推理接入点常为 ep- 前缀。
只有 NENGJIAN_MEDIA_ENABLED=1 或开关 marketing_media，并且配置了方舟密钥时才请求。
"""
from __future__ import annotations

import json
import os

from app.config import settings


def media_enabled() -> bool:
    from ops.switches import SWITCHES
    flagged = os.environ.get("NENGJIAN_MEDIA_ENABLED", "0") == "1" or bool(SWITCHES.get("marketing_media"))
    return flagged and bool(settings.NENGJIAN_ARK_API_KEY)


def media_status() -> dict:
    return {
        "enabled": media_enabled(),
        "image_model": settings.NENGJIAN_SEEDREAM_MODEL,
        "video_model": settings.NENGJIAN_SEEDANCE_MODEL,
        "base": settings.NENGJIAN_ARK_BASE_URL,
        "key_present": bool(settings.NENGJIAN_ARK_API_KEY),
    }


def _post(url: str, payload: dict, key: str) -> dict:
    import urllib.request
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode() or "{}")


def generate_image(prompt: str, poster=None) -> dict:
    if not media_enabled():
        return {"status": "disabled"}
    url = settings.NENGJIAN_ARK_BASE_URL.rstrip("/") + "/images/generations"
    body = {"model": settings.NENGJIAN_SEEDREAM_MODEL, "prompt": prompt, "size": "1024x1024"}
    try:
        data = (poster or _post)(url, body, settings.NENGJIAN_ARK_API_KEY or "")
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__}
    return {"status": "ok", "model": settings.NENGJIAN_SEEDREAM_MODEL, "result": data}


def generate_video(prompt: str, poster=None) -> dict:
    if not media_enabled():
        return {"status": "disabled"}
    url = settings.NENGJIAN_ARK_BASE_URL.rstrip("/") + "/contents/generations/tasks"
    body = {"model": settings.NENGJIAN_SEEDANCE_MODEL, "content": [{"type": "text", "text": prompt}]}
    try:
        data = (poster or _post)(url, body, settings.NENGJIAN_ARK_API_KEY or "")
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__}
    return {"status": "ok", "model": settings.NENGJIAN_SEEDANCE_MODEL, "result": data}
