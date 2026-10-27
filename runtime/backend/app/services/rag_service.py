"""
RAG retrieval service — registry-driven provenance & freshness metadata.

恢复说明：原文件只剩国家/地区识别片段。这里重建为一个小型语料检索服务：
语料由 ``rag_sources.SourceRegistry``（``后端/data/rag_sources.json``）驱动，
每条命中带 year / last_verified_at / freshness_status / verification 元数据，
global 市场只返回英文文档（禁止未翻译中文泄漏到国际版）。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date
from typing import Dict, List, Optional

from app.services.rag_sources import SourceRegistry, verification_status


class StalePolicyError(Exception):
    """过期政策语料被用于结论生成时抛出（fail-closed）。"""

    def __init__(self, source_ids: List[str]) -> None:
        self.source_ids = list(source_ids)
        super().__init__(
            "政策类语料已过期（stale），不得进入测算引用: "
            + ", ".join(self.source_ids)
        )


_OVERSEAS_QUERY_MARKERS = ("美国", "海外", "境外", "IEC", "IEEE", "NREL", "EIA", "ITC", "PR")


def query_allows_overseas(query: str) -> bool:
    """国内问答默认不检索海外条目。点名海外地区或已登记的国际标准指标时例外。"""
    text = query or ""
    upper = text.upper()
    if any(marker in text for marker in ("美国", "海外", "境外")):
        return True
    return any(marker in upper for marker in ("IEC", "IEEE", "NREL", "EIA", "ITC", "PR"))


def assert_no_stale_policy(hits: List["RAGHit"]) -> None:
    """Fail-closed 守卫：命中中存在 stale 政策类语料时抛出 StalePolicyError。

    生成测算引用前必须调用；过期政策只能触发重新核验，
    不能静默进入结果。
    """
    stale = [
        hit.source_id
        for hit in hits
        if hit.metadata.get("type") == "policy"
        and hit.metadata.get("freshness_status") == "stale"
    ]
    if stale:
        raise StalePolicyError(stale)


@dataclass
class RAGHit:
    source_id: str
    title: str
    content: str
    score: float
    metadata: Dict = field(default_factory=dict)


@dataclass
class RAGResult:
    hits: List[RAGHit]


_COUNTRY_MAP = {
    "china": "cn", "中国": "cn", "prc": "cn",
    "united states": "us", "usa": "us", "america": "us", "美国": "us",
    "germany": "de", "德国": "de",
    "japan": "jp", "日本": "jp",
}


def _detect_countries(query: str, market: str = "") -> set:
    """只从查询词识别国家。市场参数不再自动补国家，避免把未写适用范围的文档收进来。"""
    text = (query or "").lower()
    countries = set()
    for token, code in _COUNTRY_MAP.items():
        if re.search(r"[\u4e00-\u9fff]", token):
            if token in text:
                countries.add(code)
        elif re.search(rf"\b{re.escape(token)}\b", text):
            countries.add(code)
    if re.search(r"\bunited states\b", text):
        countries.add("us")
    return countries


def _currently_effective(doc: Dict, today: date) -> bool:
    if doc.get("superseded_by"):
        return False
    expiry = doc.get("expiry") or doc.get("expiry_date")
    if not expiry:
        return True
    try:
        return date.fromisoformat(str(expiry)) >= today
    except ValueError:
        return False


_LATIN_RE = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")
_CJK_RUN_RE = re.compile(r"[\u4e00-\u9fff]+")


def tokenize(text: str) -> set:
    """中英混合分词：英文/数字按词，中文按字 unigram + bigram。

    旧实现用 ``[\u4e00-\u9fff]+`` 把整句中文当一个 token，中文查询几乎永远零重合。
    这里不引入 jieba 依赖，用字 n-gram，对短政策标题足够稳健。
    """
    lowered = (text or "").lower()
    tokens = set(_LATIN_RE.findall(lowered))
    for run in _CJK_RUN_RE.findall(lowered):
        tokens.update(run)  # unigram
        tokens.update(run[i:i + 2] for i in range(len(run) - 1))  # bigram
    return tokens


class RAGService:
    """小型语料检索：按市场语言过滤 + 词面重合度排序。

    不传 ``corpus`` 时从来源注册表（后端/data/rag_sources.json）加载；
    传入 ``corpus`` 时保持旧的构造兼容（测试可注入伪造条目）。
    """

    def __init__(self, corpus: Optional[List[Dict]] = None,
                 registry: Optional[SourceRegistry] = None) -> None:
        if corpus is not None:
            self._corpus = list(corpus)
            self._registry = registry
        else:
            self._registry = registry or SourceRegistry.from_file()
            self._corpus = self._registry.sources

    def search(self, query: str, top_k: int = 5, market: str = "cn",
               exclude_stale: bool = True, effective_only: bool = True,
               include_stale: bool = False) -> RAGResult:
        if include_stale:
            exclude_stale = False
        if top_k <= 0:
            return RAGResult(hits=[])
        lang = "cn" if market == "cn" else "en"
        allow_overseas = market != "cn" or query_allows_overseas(query)
        countries = _detect_countries(query, market)
        query_tokens = tokenize(query)
        if not query_tokens:
            return RAGResult(hits=[])
        today = date.today()
        retrieved_at = today.isoformat()

        scored: List[RAGHit] = []
        for doc in self._corpus:
            overseas = doc.get("jurisdiction") == "海外"
            if overseas and not allow_overseas:
                continue
            if doc["lang"] != lang and not (overseas and allow_overseas):
                continue
            if doc.get("quote_policy") == "withdrawn":
                continue
            if doc.get("status") == "待核实" and doc.get("evidence_status") == "pending":
                continue
            if doc.get("type") == "price":
                continue  # 电价走结构化查询，不进向量/词面检索
            review = doc.get("evidence_status")
            if review in {"pending", "quarantined", "invalid"}:
                continue
            if effective_only and not _currently_effective(doc, today):
                continue
            source_countries = set(doc.get("countries") or [])
            if countries and source_countries and not (countries & source_countries):
                continue
            if countries and not source_countries and doc.get("applicability_status") != "reviewed":
                continue
            freshness = self._freshness_of(doc)
            if exclude_stale and freshness == "stale":
                continue
            doc_tokens = tokenize(
                " ".join(str(doc.get(k) or "") for k in ("title", "content", "version", "locator"))
            )
            overlap = len(query_tokens & doc_tokens)
            score = overlap / max(len(query_tokens), 1)
            if score <= 0:
                continue
            hit = RAGHit(
                source_id=doc["source_id"],
                title=doc["title"],
                content=doc["content"],
                score=score,
                metadata={
                    "type": doc.get("type"),
                    "year": int(doc["year"]),
                    "authors": doc.get("authors"),
                    "version": doc.get("version"),
                    "published_at": doc.get("published_at"),
                    "locator": doc.get("locator"),
                    "last_verified_at": doc["last_verified_at"],
                    "retrieved_at": retrieved_at,
                    "freshness_status": freshness,
                    "verification": verification_status(doc, self._registry),
                    "source_url": doc.get("source_url"),
                    "source_org": doc.get("source_org"),
                    "license_note": doc.get("license_note"),
                    "market": market,
                    "countries": list(doc.get("countries") or []),
                    "query_countries": sorted(countries),
                    "evidence_status": review or "legacy_unreviewed",
                    "effective_date": doc.get("effective_date"),
                    "expiry": doc.get("expiry") or doc.get("expiry_date"),
                    "expiry_date": doc.get("expiry_date"),
                    "superseded_by": doc.get("superseded_by"),
                    "jurisdiction": doc.get("jurisdiction"),
                    "status": doc.get("status"),
                    "doc_number": doc.get("doc_number"),
                },
            )
            scored.append(hit)

        scored.sort(key=lambda h: h.score, reverse=True)
        return RAGResult(hits=scored[: max(top_k, 0)])

    def _freshness_of(self, doc: Dict) -> str:
        if self._registry is not None:
            return self._registry.freshness_of(doc)
        # 注入 corpus 且未给注册表时，按条目自带周期（缺省 365 天）计算
        from app.services.rag_sources import freshness_status
        return freshness_status(
            doc.get("last_verified_at", ""),
            int(doc.get("verify_interval_days", 365)),
        )
