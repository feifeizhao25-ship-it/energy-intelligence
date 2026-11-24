"""问答检索的本地向量补召回（默认关闭，RAG_VECTOR_RESCUE=1 打开）。

做法（2026-11-23 离线评测定的，见 PR 说明）：
- 挂不挂来源仍由词面检索决定，向量不单独决定。离线评测里向量相似度区分不了「近领域但库里没有」的问题
  （bge-small-zh 库内/库外 top1 的 AUROC 只有 0.68），单靠向量会让库外题普遍挂上来源。
- 词面已过门时：在前 2 条之后插入向量第 1 名（它必须也在不设下限的词面候选里），最多 3 条。
- 词面没过门时：取不设覆盖率下限的词面候选（最多 10 条），其中向量最高分 ≥ RAG_VECTOR_MIN_SCORE
  （默认 0.72，按 BAAI/bge-small-zh-v1.5 标定；换模型必须重新标定）才按向量分排序返回前 3 条。
- 只用本地 fastembed 稠密向量；模型没装、加载失败或退回字符 n-gram 时整段跳过，结果与关闭时完全一样。
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import threading
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_MIN_SCORE = 0.72
CHUNK_SIZE = 320
CHUNK_STEP = 240
MAX_CHUNKS_PER_DOC = 12
_lock = threading.Lock()
_INDEX: Dict[str, "VectorIndex"] = {}
_warned: set = set()


def enabled() -> bool:
    return (os.environ.get("RAG_VECTOR_RESCUE") or "").strip() == "1"


def min_score() -> float:
    raw = (os.environ.get("RAG_VECTOR_MIN_SCORE") or "").strip()
    try:
        value = float(raw) if raw else DEFAULT_MIN_SCORE
    except ValueError:
        return DEFAULT_MIN_SCORE
    return value if 0 < value <= 1 else DEFAULT_MIN_SCORE


def _warn_once(key: str, message: str) -> None:
    if key not in _warned:
        _warned.add(key)
        logger.warning(message)


def doc_chunks(doc: Dict, text: str) -> List[str]:
    body = re.sub(r"\s+", " ", text or "")
    title = doc.get("title") or ""
    parts = [body[i:i + CHUNK_SIZE] for i in range(0, max(1, len(body)), CHUNK_STEP)][:MAX_CHUNKS_PER_DOC]
    return [(title + "\n" + part) if index else part for index, part in enumerate(parts)]


def _embed(texts: List[str]):
    """只接受本地 fastembed 的稠密向量；其他情况返回 None。"""
    from app.services.local_embeddings import embed_local

    result = embed_local(texts)
    if result.get("status") != "ok" or result.get("engine") != "fastembed":
        _warn_once("engine", "向量补召回已跳过：本地向量模型不可用（engine=%s，reason=%s）" % (result.get("engine"), result.get("reason")))
        return None
    return result


class VectorIndex:
    def __init__(self, model: str, owners: List[str], matrix) -> None:
        self.model = model
        self.owners = owners
        self.matrix = matrix  # 行已 L2 归一化

    def doc_scores(self, query_vector) -> Dict[str, float]:
        import numpy as np

        sims = self.matrix @ np.asarray(query_vector, dtype=np.float32)
        best: Dict[str, float] = {}
        for owner, score in zip(self.owners, sims.tolist()):
            if score > best.get(owner, -9.0):
                best[owner] = float(score)
        return best


def _corpus_key(model: str, corpus: List[Dict], text_of: Callable[[Dict], str]) -> str:
    # 只给向量缓存文件起名，不用于口令或签名。
    digest = hashlib.sha1(model.encode("utf-8"), usedforsecurity=False)
    for doc in corpus:
        digest.update(str(doc.get("source_id")).encode("utf-8"))
        digest.update(text_of(doc).encode("utf-8"))
    return digest.hexdigest()[:16]


def get_index(corpus: List[Dict], text_of: Callable[[Dict], str]) -> Optional[VectorIndex]:
    """同一语料和模型只建一次；设置 RAG_VECTOR_CACHE_DIR 时向量落盘，进程重启后直接读。"""
    import numpy as np
    from app.services.local_embeddings import local_model_name

    model = local_model_name()
    key = _corpus_key(model, corpus, text_of)
    with _lock:
        cached = _INDEX.get(key)
        if cached is not None:
            return cached
        owners: List[str] = []
        texts: List[str] = []
        for doc in corpus:
            for chunk in doc_chunks(doc, text_of(doc)):
                owners.append(doc["source_id"])
                texts.append(chunk)
        cache_dir = (os.environ.get("RAG_VECTOR_CACHE_DIR") or "").strip()
        path = os.path.join(cache_dir, "rag_vectors_%s.npy" % key) if cache_dir else ""
        matrix = None
        if path and os.path.isfile(path):
            try:
                loaded = np.load(path, allow_pickle=False)
                if loaded.shape[0] == len(texts):
                    matrix = loaded
            except (OSError, ValueError):
                # 缓存损坏或行数对不上就丢掉，下面按原文重新算向量。
                logger.warning("向量缓存读取失败，将重新计算：%s", path)
        if matrix is None:
            result = _embed(texts)
            if result is None:
                return None
            matrix = np.asarray(result["vectors"], dtype=np.float32)
            if path:
                try:
                    os.makedirs(cache_dir, exist_ok=True)
                    np.save(path, matrix)
                except OSError:
                    # 缓存目录不可写时这次检索仍用内存里的向量，下次再尝试落盘。
                    logger.warning("向量缓存写入失败，本次仍使用内存索引：%s", path)
        index = VectorIndex(model, owners, matrix)
        _INDEX.clear()
        _INDEX[key] = index
        return index


def rescue(query: str, live_hits: list, candidates: Callable[[], list], corpus: List[Dict],
           text_of: Callable[[Dict], str]) -> list:
    """live_hits：线上词面结果（已过下限）。candidates：返回不设覆盖率下限的词面候选（最多 10 条）。"""
    index = get_index(corpus, text_of)
    if index is None:
        return live_hits
    embedded = _embed([query])
    if embedded is None:
        return live_hits
    scores = index.doc_scores(embedded["vectors"][0])
    pool = candidates()
    pool_ids = {hit.source_id for hit in pool}
    if live_hits:
        if not scores:
            return live_hits
        top_id = max(scores, key=scores.get)
        if top_id not in pool_ids or any(hit.source_id == top_id for hit in live_hits):
            return live_hits
        extra = next(hit for hit in pool if hit.source_id == top_id)
        merged = list(live_hits[:2]) + [extra] + list(live_hits[2:])
        return merged[:3]
    if not pool:
        return []
    ranked = sorted(pool, key=lambda hit: -scores.get(hit.source_id, -1.0))
    if scores.get(ranked[0].source_id, -1.0) < min_score():
        return []
    return ranked[:3]
