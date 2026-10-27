"""百炼 text-embedding-v4 与 qwen3-rerank。

没有密钥或未填写重排 URL 时返回 disabled，不访问 OpenAI embeddings。
qwen3-rerank 的文档地址带工作空间号：
https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank
也有兼容路径 /compatible-api/v1/reranks。只有 NENGJIAN_RERANK_URL 非空才 POST。
请求体按原生文档：{"model","input":{"query","documents"},"parameters":{"top_n","return_documents"}}。
"""
from __future__ import annotations

import json

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


def _key() -> str:
    return settings.NENGJIAN_DASHSCOPE_API_KEY or settings.DASHSCOPE_API_KEY or ""


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
    if not target.get("enabled"):
        return {"status": "disabled", **target}
    url = str(target["base"]).rstrip("/") + "/embeddings"
    body = {"model": target["model"], "input": texts}
    try:
        data = (poster or _post)(url, body, _key())
    except Exception as exc:
        return {"status": "error", "model": target["model"], "reason": exc.__class__.__name__}
    vectors = []
    for item in data.get("data") or []:
        if isinstance(item, dict) and isinstance(item.get("embedding"), list):
            vectors.append(item["embedding"])
    return {"status": "ok", "model": target["model"], "count": len(vectors), "vectors": vectors}


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
        data = (poster or _post)(target["rerank_url"], body, _key())
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__}
    return {"status": "ok", "model": target["rerank_model"], "result": data}
