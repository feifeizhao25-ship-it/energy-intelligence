"""词面与向量混合召回，再重排。

没有百炼密钥时不调用 qwen3-rerank，改用本地词面重排。
不在这里抓取或入库。
"""
from __future__ import annotations

import math
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
    locator = str(doc.get("locator") or "").strip()
    published = str(doc.get("publish_date") or doc.get("published_at") or "").strip()[:10]
    effective = str(doc.get("effective_date") or "").strip()[:10]
    body = contextual_header(doc)
    if locator:
        body += f"；定位：{locator}"
    if published:
        body += f"；发布日期：{published}"
    if effective and effective != published:
        body += f"；生效日期：{effective}"
    return body + "\n" + str(doc.get("content") or "")


def rewrite_query(query: str) -> str:
    """去掉评测题干里的套话，避免冲淡公式和标准号。"""
    text = re.sub(r"（第\s*\d+\s*题[^）]*）", " ", query or "")
    text = re.sub(r"只复述已收录(?:公式或版本|原文)?", " ", text)
    text = re.sub(r"不要补充未收录内容[。]?", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or (query or "").strip()


def _formula_query(query: str) -> bool:
    return bool(re.search(r"公式|标准|性能比|发电量|效率系数|6\.6|IEC|GB", query or ""))


def _tokens(text: str) -> list[str]:
    """英文词加中文双字。整句当成一个词时，公式问句几乎对不上正文。"""
    text = text or ""
    latin = re.findall(r"[A-Za-z0-9][A-Za-z0-9.\-]{0,}", text)
    grams: list[str] = []
    for run in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(run) == 1:
            grams.append(run)
        else:
            grams.extend(run[index:index + 2] for index in range(len(run) - 1))
    return latin + grams


def _bm25(query: str, docs: list[dict]) -> list[float]:
    """Okapi BM25，再按本批最高分归一到 0–1，便于和向量分相加。"""
    tokenized = [_tokens(contextual_chunk(doc)) for doc in docs]
    counts: list[dict[str, int]] = []
    df: dict[str, int] = {}
    for tokens in tokenized:
        freq: dict[str, int] = {}
        for token in tokens:
            freq[token] = freq.get(token, 0) + 1
        counts.append(freq)
        for token in freq:
            df[token] = df.get(token, 0) + 1
    total = len(tokenized) or 1
    avgdl = sum(len(tokens) for tokens in tokenized) / total
    if avgdl <= 0:
        avgdl = 1.0
    query_freq: dict[str, int] = {}
    for token in _tokens(query):
        query_freq[token] = query_freq.get(token, 0) + 1
    k1, b = 1.2, 0.75
    raw = []
    for tokens, freq in zip(tokenized, counts):
        length = len(tokens) or 1
        score = 0.0
        for token, weight in query_freq.items():
            seen = freq.get(token, 0)
            if not seen:
                continue
            idf = math.log(1 + (total - df[token] + 0.5) / (df[token] + 0.5))
            score += idf * (seen * (k1 + 1)) / (seen + k1 * (1 - b + b * length / avgdl)) * weight
        raw.append(score)
    peak = max(raw) if raw else 0.0
    if peak <= 0:
        return [0.0 for _ in raw]
    return [item / peak for item in raw]


def hybrid_scores(query: str, docs: list[dict], vector_scores: dict[str, float] | None = None) -> list[dict]:
    vector_scores = vector_scores or {}
    query = rewrite_query(query)
    lexical_weight, vector_weight = (0.82, 0.18) if _formula_query(query) else (0.55, 0.45)
    lexical_scores = _bm25(query, docs)
    rows = []
    for doc, lexical in zip(docs, lexical_scores):
        vector = float(vector_scores.get(doc.get("source_id"), 0.0))
        rows.append({
            "source_id": doc.get("source_id"),
            "lexical": lexical,
            "vector": vector,
            "score": lexical_weight * lexical + vector_weight * vector,
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
