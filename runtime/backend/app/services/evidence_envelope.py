"""
统一证据封装（evidence_envelope）— 四项目 19 项要求第 1 项。

所有 AI 问答与报告生成端点的响应都附带一个 ``evidence`` 字段，结构::

    {
      "answer": "给用户看的结论",
      "confidence": "high | medium | low",
      "confidence_reason": "可解释的置信度判定理由",
      "as_of": "2026-08-23",
      "engine_version": "2.0.0",
      "sources": [{"url", "publisher", "published_at", "retrieved_at", ...}],
      "sources_status": "ok | 无来源",
      "assumptions": [...],
      "calculation_trace": [{"formula", "inputs", "result"}],
      "limitations": [...]
    }

置信度规则（明确写明，不拍脑袋）——按来源数量与新鲜度判定：

- ``low``    : 无任何来源（sources_status = "无来源"），或任一来源已过期
               （freshness_status == "stale"）。过期来源支撑投资结论本应在
               上游被 fail-closed 拦截，这里兜底降级。
- ``high``   : 来源数 >= 3，且全部处于 ``current``（在各自核验周期内）。
- ``medium`` : 其余情况——有 1–2 条未过期来源，或 >= 3 条来源但至少一条
               处于 ``review_recommended``（核验周期已用掉 80% 以上）或
               新鲜度未知（项目自报来源未标注核验周期）。

无来源时 ``sources_status`` 明确标注「无来源」，绝不伪造引用。
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional, Sequence, Tuple

from app.config import settings
from app.services.rag_service import RAGHit

#: 置信度取值
CONFIDENCE_LEVELS = ("high", "medium", "low")

#: 无来源时的显式标注（禁止伪造来源）
SOURCES_STATUS_NONE = "无来源"
SOURCES_STATUS_OK = "ok"

#: 高置信度要求的最少来源数
HIGH_MIN_SOURCES = 3


def source_from_rag_hit(hit: RAGHit) -> Dict[str, Any]:
    """把 RAGHit 的 8 字段元数据映射为 envelope 来源条目。"""
    meta = hit.metadata or {}
    return {
        "source_id": hit.source_id,
        "title": hit.title,
        "url": meta.get("source_url"),
        "publisher": meta.get("source_org"),
        "published_at": meta.get("published_at"),
        "retrieved_at": meta.get("retrieved_at"),
        "authors": meta.get("authors"),
        "version": meta.get("version"),
        "locator": meta.get("locator"),
        "license": meta.get("license_note"),
        "type": meta.get("type"),
        "freshness_status": meta.get("freshness_status", "unknown"),
        "relevance_score": round(hit.score, 4),
    }


def source_from_dict(src: Dict[str, Any]) -> Dict[str, Any]:
    """把项目/财务模型自报的来源字典（报告链路已有格式）映射为 envelope 条目。"""
    return {
        "source_id": src.get("source_id") or src.get("id"),
        "title": src.get("title"),
        "url": src.get("url") or src.get("source_url"),
        "publisher": src.get("publisher") or src.get("source_org"),
        "published_at": src.get("published_at"),
        "retrieved_at": src.get("retrieved_at"),
        "authors": src.get("authors"),
        "version": src.get("version"),
        "locator": src.get("locator"),
        "license": src.get("license_note") or src.get("license"),
        "type": src.get("type"),
        "freshness_status": src.get("freshness_status", "unknown"),
    }


def compute_confidence(sources: Sequence[Dict[str, Any]]) -> Tuple[str, str]:
    """按来源新鲜度/数量给出可解释置信度（规则见模块 docstring）。"""
    if not sources:
        return "low", "无任何来源支撑，按规则置信度为 low（sources_status=无来源）"

    stale = [s for s in sources if s.get("freshness_status") == "stale"]
    if stale:
        return (
            "low",
            f"{len(stale)} 条来源已过期（stale），按规则置信度降为 low，需重新核验",
        )

    current = [s for s in sources if s.get("freshness_status") == "current"]
    if len(sources) >= HIGH_MIN_SOURCES and len(current) == len(sources):
        return (
            "high",
            f"{len(sources)} 条来源全部在核验周期内（current），按规则置信度为 high",
        )

    unknown = [s for s in sources if s.get("freshness_status") not in
               ("current", "review_recommended")]
    review = [s for s in sources if s.get("freshness_status") == "review_recommended"]
    reasons = [f"{len(sources)} 条来源未过期"]
    if len(sources) < HIGH_MIN_SOURCES:
        reasons.append(f"数量不足 {HIGH_MIN_SOURCES} 条")
    if review:
        reasons.append(f"{len(review)} 条临近复核期（review_recommended）")
    if unknown:
        reasons.append(f"{len(unknown)} 条新鲜度未知")
    return "medium", "，".join(reasons) + "，按规则置信度为 medium"


def build_envelope(
    answer: str,
    sources: Sequence[Dict[str, Any]],
    *,
    assumptions: Optional[List[str]] = None,
    calculation_trace: Optional[List[Dict[str, Any]]] = None,
    limitations: Optional[List[str]] = None,
    skill_version: Optional[str] = None,
    as_of: Optional[str] = None,
) -> Dict[str, Any]:
    """组装统一证据封装。``sources`` 必须先经 source_from_* 归一化。"""
    confidence, reason = compute_confidence(sources)
    envelope: Dict[str, Any] = {
        "answer": answer,
        "confidence": confidence,
        "confidence_reason": reason,
        "as_of": as_of or date.today().isoformat(),
        "engine_version": settings.VERSION,
        "sources": list(sources),
        "sources_status": SOURCES_STATUS_OK if sources else SOURCES_STATUS_NONE,
        "assumptions": list(assumptions or []),
        "calculation_trace": list(calculation_trace or []),
        "limitations": list(limitations or []),
    }
    if skill_version:
        envelope["skill_version"] = skill_version
    return envelope


def envelope_from_rag(
    answer: str,
    hits: Sequence[RAGHit],
    **kwargs: Any,
) -> Dict[str, Any]:
    """便捷入口：直接从 RAG 命中构建 envelope。"""
    return build_envelope(answer, [source_from_rag_hit(h) for h in hits], **kwargs)
