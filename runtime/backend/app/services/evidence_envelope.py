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


# ---------------------------------------------------------------------------
# 审计 7-5：多源验证规则（规则驱动的 verification 字段）
# ---------------------------------------------------------------------------
VERIFIED = "verified"
REVIEW_RECOMMENDED = "review_recommended"
CONFLICT = "conflict"
UNVERIFIED = "unverified"

VERIFICATION_LABELS = {
    VERIFIED: "已核验",
    REVIEW_RECOMMENDED: "待核验",
    UNVERIFIED: "待核验",
    CONFLICT: "冲突",
}

#: 数值类来源“一致”的相对误差阈值
NUMERIC_AGREEMENT_TOLERANCE = 0.01

_OFFICIAL_TYPES = {"official", "policy_original", "government", "regulator", "standard"}
_OFFICIAL_MARKERS = ("国务院", "发改委", "发展改革委", "能源局", "生态环境部", "统计局", "工信部", "财政部", "人民政府", "电网")
_OFFICIAL_DOMAINS = (".gov.cn", ".gov", "gov.cn/")


def is_official_source(src: Dict[str, Any]) -> bool:
    if str(src.get("type") or "").lower() in _OFFICIAL_TYPES:
        return True
    url = str(src.get("url") or "").lower()
    if any(d in url.split("?")[0] for d in _OFFICIAL_DOMAINS):
        return True
    publisher = str(src.get("publisher") or "")
    return any(m in publisher for m in _OFFICIAL_MARKERS)


def _independent_key(src: Dict[str, Any]) -> str:
    """独立性按发布机构判定；无机构时退回到域名。"""
    pub = str(src.get("publisher") or "").strip()
    if pub:
        return pub
    url = str(src.get("url") or "")
    return url.split("//")[-1].split("/")[0].lower() or str(src.get("source_id") or id(src))


def verify_policy_claim(sources: Sequence[Dict[str, Any]]) -> Tuple[str, str]:
    """政策类：官方原文 + 至少 1 个独立来源 → verified；只有转载 → review_recommended。"""
    if not sources:
        return UNVERIFIED, "无来源"
    officials = [s for s in sources if is_official_source(s)]
    if not officials:
        return REVIEW_RECOMMENDED, "只有转载来源，未找到官方原文"
    official_keys = {_independent_key(s) for s in officials}
    others = {_independent_key(s) for s in sources} - {_independent_key(officials[0])}
    if others:
        return VERIFIED, f"官方原文 + {len(others)} 个独立来源"
    if len(official_keys) > 1:
        return VERIFIED, "官方原文 + 另一官方转载"
    return REVIEW_RECOMMENDED, "仅有官方原文，缺少独立来源交叉核对"


def verify_numeric_claim(values: Sequence[Dict[str, Any]], tolerance: float = NUMERIC_AGREEMENT_TOLERANCE) -> Tuple[str, str]:
    """数值类（电价、排放因子、组件价格）：≥2 个独立来源一致（相对差 < 1%）→ verified；冲突 → conflict。

    ``values`` 形如 ``[{"value": 0.5827, "publisher": "生态环境部"}, ...]``。
    """
    pts = [(v, _independent_key(v)) for v in values if isinstance(v.get("value"), (int, float))]
    if not pts:
        return UNVERIFIED, "无数值来源"
    by_pub: Dict[str, float] = {}
    for v, key in pts:
        by_pub.setdefault(key, float(v["value"]))
    if len(by_pub) < 2:
        only = next(iter(pts))[0]
        snapshot = str(only.get("snapshot_sha256") or "")
        if is_official_source(only) and len(snapshot) == 64:
            return VERIFIED, "一手官方原文并附快照"
        return REVIEW_RECOMMENDED, "只有 1 个独立来源"
    nums = list(by_pub.values())
    lo, hi = min(nums), max(nums)
    base = max(abs(lo), abs(hi)) or 1.0
    if (hi - lo) / base < tolerance:
        return VERIFIED, f"{len(nums)} 个独立来源一致（相对差 < {tolerance:.0%}）"
    return CONFLICT, f"{len(nums)} 个来源数值冲突（{lo:g}–{hi:g}），已全部展示，待人工核验"


def present_claim(values: Sequence[Dict[str, Any]], *, claim_type: str = "numeric") -> Dict[str, Any]:
    """冲突时并列来源，不替用户择一。政策类二手来源只标延伸阅读。"""
    if claim_type == "policy":
        status, reason = verify_policy_claim(values)
        rows = []
        for src in values:
            rows.append({
                **src,
                "role": "官方原文" if is_official_source(src) else "延伸阅读",
            })
        return {"label": VERIFICATION_LABELS[status], "status": status, "reason": reason, "sources": rows, "picked": None}
    status, reason = verify_numeric_claim(values)
    return {
        "label": VERIFICATION_LABELS.get(status, "待核验"),
        "status": status,
        "reason": reason,
        "sources": list(values),
        "picked": None,
    }


def compute_verification(
    sources: Sequence[Dict[str, Any]],
    *,
    claim_type: str = "policy",
    values: Optional[Sequence[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    if claim_type == "numeric":
        status, reason = verify_numeric_claim(values or [])
    else:
        status, reason = verify_policy_claim(sources)
    return {
        "status": status,
        "label": VERIFICATION_LABELS[status],
        "reason": reason,
        "claim_type": claim_type,
        "usable_as_conclusion": status == VERIFIED,
    }


def build_envelope(
    answer: str,
    sources: Sequence[Dict[str, Any]],
    *,
    assumptions: Optional[List[str]] = None,
    calculation_trace: Optional[List[Dict[str, Any]]] = None,
    limitations: Optional[List[str]] = None,
    skill_version: Optional[str] = None,
    as_of: Optional[str] = None,
    claim_type: str = "policy",
    numeric_values: Optional[Sequence[Dict[str, Any]]] = None,
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
    verification = compute_verification(sources, claim_type=claim_type, values=numeric_values)
    envelope["verification"] = verification
    envelope["sources"] = [
        {**src, "verification_label": "官方原文" if is_official_source(src) else "转载/第三方"}
        for src in envelope["sources"]
    ]
    if not verification["usable_as_conclusion"]:
        envelope["limitations"].append(
            f"核验状态：{verification['label']}（{verification['reason']}），不得作为结论依据"
        )
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
