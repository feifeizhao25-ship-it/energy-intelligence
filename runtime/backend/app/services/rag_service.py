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
            "政策类语料已过期（stale），不得用于生成投资结论: "
            + ", ".join(self.source_ids)
        )


def assert_no_stale_policy(hits: List["RAGHit"]) -> None:
    """Fail-closed 守卫：命中中存在 stale 政策类语料时抛出 StalePolicyError。

    生成「可投资」类结论前必须调用；过期政策只能触发重新核验，
    不能静默进入结论。
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


def _detect_countries(query: str, market: str) -> set:
    """地区识别（保留恢复片段的语义）：从查询词中识别目标国家。"""
    tokens = set(re.findall(r"[a-zA-Z\u4e00-\u9fff]+", query.lower()))
    countries = set()
    for token, code in _COUNTRY_MAP.items():
        if token in query.lower() or token in tokens:
            countries.add(code)
    joined = tokens
    if {"united", "states"} <= joined:
        countries.add("us")
    if market == "cn":
        countries.add("cn")
    elif not countries:
        countries.add(market)
    return countries


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
               exclude_stale: bool = False) -> RAGResult:
        lang = "cn" if market == "cn" else "en"
        countries = _detect_countries(query, market)
        query_tokens = set(re.findall(r"[a-z0-9\u4e00-\u9fff]+", query.lower()))
        retrieved_at = date.today().isoformat()

        scored: List[RAGHit] = []
        for doc in self._corpus:
            if doc["lang"] != lang:
                continue  # 语言隔离：global 不返回未翻译中文
            freshness = self._freshness_of(doc)
            if exclude_stale and freshness == "stale":
                continue  # 时效保护：过期语料不进入检索结果
            doc_tokens = set(
                re.findall(r"[a-z0-9\u4e00-\u9fff]+", (doc["title"] + " " + doc["content"]).lower())
            )
            overlap = len(query_tokens & doc_tokens)
            score = overlap / max(len(query_tokens), 1)
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
                    "verification": verification_status(doc),
                    "source_url": doc.get("source_url"),
                    "source_org": doc.get("source_org"),
                    "license_note": doc.get("license_note"),
                    "market": market,
                    "countries": sorted(countries),
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
