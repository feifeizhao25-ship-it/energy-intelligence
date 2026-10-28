"""本地向量。

优先级：LOCAL_EMBEDDING_MODEL，其次 EMBEDDING_MODEL / 配置里的 BAAI/bge-m3，
再其次 BAAI/bge-small-zh-v1.5。模型或依赖不在本机时，改用字符二元组、三元组的余弦，
不访问外网，也不把回退结果称作 bge。
"""
from __future__ import annotations

import math
import os
import re
from functools import lru_cache

DEFAULT_LOCAL_MODEL = "BAAI/bge-small-zh-v1.5"
BGE_M3 = "BAAI/bge-m3"


def _normalize_bge(name: str) -> str:
    key = (name or "").strip()
    if key.lower() in {"bge-m3", "baai/bge-m3"}:
        return BGE_M3
    return key


def local_model_name() -> str:
    explicit = (os.environ.get("LOCAL_EMBEDDING_MODEL") or "").strip()
    if explicit:
        return _normalize_bge(explicit)
    configured = (os.environ.get("EMBEDDING_MODEL") or "").strip()
    if not configured:
        try:
            from app.config import settings
            configured = (getattr(settings, "EMBEDDING_MODEL", "") or "").strip()
        except Exception:
            configured = ""
    if configured and "bge" in configured.lower():
        return _normalize_bge(configured)
    return DEFAULT_LOCAL_MODEL


def _l2(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vec)) or 1.0
    return [value / norm for value in vec]


def ngram_vector(text: str) -> dict[str, float]:
    chars = re.sub(r"\s+", "", text or "")
    counts: dict[str, float] = {}
    for size in (2, 3):
        if len(chars) < size:
            continue
        for index in range(len(chars) - size + 1):
            gram = chars[index:index + size]
            counts[gram] = counts.get(gram, 0.0) + 1.0
    norm = math.sqrt(sum(value * value for value in counts.values())) or 1.0
    return {key: value / norm for key, value in counts.items()}


def cosine_dense(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return float(sum(a * b for a, b in zip(left, right)))


def cosine_sparse(left: dict[str, float], right: dict[str, float]) -> float:
    if not left or not right:
        return 0.0
    if len(left) > len(right):
        left, right = right, left
    return float(sum(value * right.get(key, 0.0) for key, value in left.items()))


@lru_cache(maxsize=1)
def _load_fastembed(model_name: str):
    from fastembed import TextEmbedding
    return TextEmbedding(model_name=model_name)


def embed_local(texts: list[str]) -> dict:
    model_name = local_model_name()
    forced = (os.environ.get("EMBEDDING_LOCAL_ENGINE") or "auto").strip().lower()
    if forced != "ngram":
        try:
            model = _load_fastembed(model_name)
            rows = [ _l2([float(value) for value in vector]) for vector in model.embed(texts) ]
            return {"status": "ok", "model": model_name, "engine": "fastembed", "vectors": rows}
        except Exception as exc:
            if forced == "fastembed":
                return {"status": "error", "model": model_name, "engine": "fastembed", "reason": exc.__class__.__name__}
            fallback_reason = exc.__class__.__name__
    else:
        fallback_reason = "forced-ngram"
    vectors = [ngram_vector(text) for text in texts]
    return {
        "status": "ok",
        "model": "local-char-ngram",
        "engine": "char-ngram",
        "reason": fallback_reason,
        "vectors": vectors,
    }


def pairwise_query_scores(query_vector, doc_vectors) -> list[float]:
    if isinstance(query_vector, dict):
        return [cosine_sparse(query_vector, doc) for doc in doc_vectors]
    return [cosine_dense(query_vector, doc) for doc in doc_vectors]
