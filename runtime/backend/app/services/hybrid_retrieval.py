"""词面与向量混合召回，再重排。

没有百炼密钥时不调用 qwen3-rerank，改用本地词面重排。
不在这里抓取或入库。
"""
from __future__ import annotations

import os
import re


def contextual_header(doc: dict) -> str:
    number = doc.get("doc_number") or "无文号"
    issuer = doc.get("issuer") or doc.get("source_org") or "未标注机关"
    title = str(doc.get("title") or "").strip()
    head = f"文号：{number}；发文机关：{issuer}"
    if title:
        head += f"；标题：{title}"
    return head


def contextual_chunk(doc: dict) -> str:
    return contextual_header(doc) + "\n" + str(doc.get("content") or "")


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]{2,}", text or ""))


def hybrid_scores(query: str, docs: list[dict], vector_scores: dict[str, float] | None = None) -> list[dict]:
    vector_scores = vector_scores or {}
    query_tokens = _tokens(query)
    rows = []
    for doc in docs:
        lexical = 0.0
        if query_tokens:
            lexical = len(query_tokens & _tokens(contextual_chunk(doc))) / len(query_tokens)
        vector = float(vector_scores.get(doc.get("source_id"), 0.0))
        rows.append({
            "source_id": doc.get("source_id"),
            "lexical": lexical,
            "vector": vector,
            "score": 0.55 * lexical + 0.45 * vector,
            "chunk": contextual_chunk(doc),
        })
    rows.sort(key=lambda item: item["score"], reverse=True)
    return rows


def rerank_available() -> bool:
    return bool(os.environ.get("DASHSCOPE_API_KEY", "").strip())


def rerank(query: str, rows: list[dict], remote=None) -> dict:
    """remote 仅在显式注入且已配置密钥时调用。默认本地顺序。"""
    if remote is not None and rerank_available():
        ordered = remote(query, rows)
        return {"engine": "qwen3-rerank", "rows": ordered}
    return {"engine": "local-lexical", "rows": rows}


def recall_at_k(rows: list[dict], relevant_ids: set[str], k: int = 8) -> float:
    if not relevant_ids:
        return 1.0
    got = {row["source_id"] for row in rows[:k]}
    return len(got & relevant_ids) / len(relevant_ids)
