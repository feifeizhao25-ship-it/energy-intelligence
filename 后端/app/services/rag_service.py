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
from typing import Dict, List, Optional

from app.services.rag_sources import SourceRegistry, verification_status, evidence_usable, evidence_status


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


def _detect_countries(query: str, market: str) -> set:
    """Only explicit country names constrain evidence; market controls language."""
    lowered = query.lower()
    return {code for token, code in _COUNTRY_MAP.items()
            if (token in lowered if re.search(r"[\u4e00-\u9fff]", token)
                else re.search(r"(?<![a-z])" + re.escape(token) + r"(?![a-z])", lowered))}


def _source_countries(doc: Dict) -> set:
    # Missing/malformed scope is unknown, never inferred from language or title.
    scope = doc.get("applicability")
    if not isinstance(scope, dict) or scope.get("status") != "reviewed":
        return set()
    countries = scope.get("countries")
    if not isinstance(countries, list) or not countries or not all(
        isinstance(code, str) and re.fullmatch(r"[a-z]{2}", code)
        for code in countries
    ):
        return set()
    return set(countries)


def _retrieval_terms(text: str) -> set:
    """English whole terms and Chinese bigrams; no external tokenizer dependency."""
    terms = set(re.findall(r"[a-z0-9]+", text.lower()))
    for span in re.findall(r"[\u4e00-\u9fff]+", text):
        # Single Chinese characters are too broad to establish relevance.
        terms.update(span[i:i + 2] for i in range(len(span) - 1))
    return terms


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

    def search(
        self,
        query: str,
        top_k: int = 5,
        market: str = "cn",
        include_stale: bool = False,
    ) -> RAGResult:
        if top_k <= 0:
            return RAGResult(hits=[])
        lang = "cn" if market == "cn" else "en"
        countries = _detect_countries(query, market)
        query_tokens = _retrieval_terms(query)
        if not query_tokens:
            return RAGResult(hits=[])

        scored: List[RAGHit] = []
        for doc in self._corpus:
            if not evidence_usable(doc):
                continue  # Quarantine cannot be bypassed by include_stale.
            if doc["lang"] != lang:
                continue  # 语言隔离：global 不返回未翻译中文
            source_countries = _source_countries(doc)
            if countries and not countries.intersection(source_countries):
                continue  # Explicit jurisdiction: unknown and unrelated evidence excluded.
            freshness = self._freshness_of(doc)
            if freshness == "stale" and not include_stale:
                continue  # 生产默认 fail closed：过期资料不能进入模型上下文
            doc_tokens = _retrieval_terms(doc["title"] + " " + doc["content"])
            overlap = len(query_tokens & doc_tokens)
            if not overlap:
                continue
            score = overlap / len(query_tokens)
            hit = RAGHit(
                source_id=doc["source_id"],
                title=doc["title"],
                content=doc["content"],
                score=score,
                metadata={
                    "year": int(doc["year"]),
                    "last_verified_at": doc["last_verified_at"],
                    "freshness_status": freshness,
                    "verification": verification_status(doc, self._registry),
                    "evidence_status": evidence_status(doc),
                    "market": market,
                    "countries": sorted(source_countries),
                    "query_countries": sorted(countries),
                    "applicability_status": "reviewed" if source_countries else "unknown",
                    "source_url": doc.get("source_url"),
                    "source_org": doc.get("source_org"),
                    "license_note": doc.get("license_note"),
                },
            )
            scored.append(hit)

        scored.sort(key=lambda h: h.score, reverse=True)
        return RAGResult(hits=scored[:top_k])

    def _freshness_of(self, doc: Dict) -> str:
        if self._registry is not None:
            return self._registry.freshness_of(doc)
        # 注入 corpus 且未给注册表时，按条目自带周期（缺省 365 天）计算
        from app.services.rag_sources import freshness_status
        return freshness_status(
            doc.get("last_verified_at", ""),
            int(doc.get("verify_interval_days", 365)),
        )
