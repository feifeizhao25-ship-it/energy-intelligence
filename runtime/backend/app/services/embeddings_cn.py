"""国内向量。

有百炼密钥且版本为 cn 时用 text-embedding-v4。
配置了方舟密钥和 NENGJIAN_ARK_EMBEDDING_MODEL 时用方舟。
否则用本地模型；模型加载失败时用字符 n-gram。不调用 OpenAI embeddings。
qwen3-rerank 只有 NENGJIAN_RERANK_URL 非空才 POST。
"""
from __future__ import annotations

import json
import os

from app.config import settings
from app.services.local_embeddings import embed_local


def _provider() -> str:
    return (os.environ.get("EMBEDDING_PROVIDER") or settings.EMBEDDING_PROVIDER or "auto").strip().lower()


def _cn() -> bool:
    return (settings.APP_EDITION or "").lower() == "cn"


def _dashscope_key() -> str:
    return settings.NENGJIAN_DASHSCOPE_API_KEY or settings.DASHSCOPE_API_KEY or ""


def embedding_target() -> dict:
    provider = _provider()
    if provider in {"openai", "openrouter"}:
        return {"enabled": False, "reason": "overseas-embedding-blocked", "provider": provider}
    rerank = {
        "rerank_model": settings.NENGJIAN_RERANK_MODEL,
        "rerank_url": settings.NENGJIAN_RERANK_URL or None,
        "rerank_enabled": bool(settings.NENGJIAN_RERANK_URL),
    }
    if provider in {"auto", "dashscope"} and _cn() and _dashscope_key():
        return {
            "enabled": True,
            "provider": "dashscope",
            "model": settings.NENGJIAN_EMBEDDING_MODEL,
            "base": settings.DASHSCOPE_BASE_URL,
            **rerank,
        }
    ark_model = (os.environ.get("NENGJIAN_ARK_EMBEDDING_MODEL") or "").strip()
    if provider in {"auto", "ark"} and _cn() and settings.NENGJIAN_ARK_API_KEY and ark_model:
        return {
            "enabled": True,
            "provider": "ark",
            "model": ark_model,
            "base": settings.NENGJIAN_ARK_BASE_URL,
            **rerank,
        }
    if provider == "dashscope":
        return {"enabled": False, "reason": "missing-dashscope-key", "provider": "dashscope", "model": settings.NENGJIAN_EMBEDDING_MODEL, **rerank}
    if provider == "ark":
        return {"enabled": False, "reason": "missing-ark-embedding", "provider": "ark", **rerank}
    from app.services.local_embeddings import local_model_name
    return {"enabled": True, "provider": "local", "model": local_model_name(), **rerank}


def _key(target: dict) -> str:
    if target.get("provider") == "ark":
        return settings.NENGJIAN_ARK_API_KEY or ""
    return _dashscope_key()


def _post(url: str, payload: dict, key: str) -> dict:
    import urllib.request
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode() or "{}")


def embed_texts(texts: list[str], poster=None) -> dict:
    target = embedding_target()
    if target.get("provider") == "local" or not target.get("enabled"):
        if target.get("provider") == "local" or _provider() in {"auto", "local"}:
            local = embed_local(texts)
            local["provider"] = "local"
            return local
        return {"status": "disabled", **target}
    url = str(target["base"]).rstrip("/") + "/embeddings"
    body = {"model": target["model"], "input": texts}
    try:
        data = (poster or _post)(url, body, _key(target))
    except Exception as exc:
        if _provider() == "auto":
            local = embed_local(texts)
            local["provider"] = "local"
            local["remote_error"] = exc.__class__.__name__
            return local
        return {"status": "error", "model": target["model"], "reason": exc.__class__.__name__}
    vectors = []
    for item in data.get("data") or []:
        if isinstance(item, dict) and isinstance(item.get("embedding"), list):
            vectors.append(item["embedding"])
    if len(vectors) != len(texts):
        return {"status": "error", "model": target["model"], "reason": "incomplete-vectors"}
    return {"status": "ok", "provider": target.get("provider"), "model": target["model"], "count": len(vectors), "vectors": vectors}


def rerank(query: str, documents: list[str], poster=None) -> dict:
    target = embedding_target()
    if not target.get("rerank_enabled"):
        return {"status": "disabled", "reason": "rerank url empty"}
    body = {
        "model": target["rerank_model"],
        "input": {"query": query, "documents": documents},
        "parameters": {"top_n": len(documents), "return_documents": False},
    }
    try:
        data = (poster or _post)(target["rerank_url"], body, _dashscope_key())
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__}
    return {"status": "ok", "model": target["rerank_model"], "result": data}
