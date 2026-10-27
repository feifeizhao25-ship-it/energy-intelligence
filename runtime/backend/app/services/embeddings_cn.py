"""百炼 text-embedding-v4 与 qwen3-rerank。

没有密钥或未填写重排 URL 时返回 disabled，不访问 OpenAI embeddings。
"""
from __future__ import annotations

from app.config import settings


def embedding_target() -> dict:
    if (settings.APP_EDITION or "").lower() != "cn":
        return {"enabled": False, "reason": "not-cn"}
    if not (settings.NENGJIAN_DASHSCOPE_API_KEY or settings.DASHSCOPE_API_KEY):
        return {"enabled": False, "reason": "missing-dashscope-key", "model": settings.NENGJIAN_EMBEDDING_MODEL}
    return {
        "enabled": True,
        "model": settings.NENGJIAN_EMBEDDING_MODEL,
        "base": settings.DASHSCOPE_BASE_URL,
        "rerank_model": settings.NENGJIAN_RERANK_MODEL,
        "rerank_url": settings.NENGJIAN_RERANK_URL or None,
        "rerank_enabled": bool(settings.NENGJIAN_RERANK_URL),
    }


def embed_texts(texts: list[str]) -> dict:
    target = embedding_target()
    if not target.get("enabled"):
        return {"status": "disabled", **target}
    # TODO: POST {base}/embeddings with model text-embedding-v4. Not called until a caller opts in.
    return {"status": "stub", "model": target["model"], "count": len(texts)}
