"""RAG 文献元数据完整性与过期政策 fail-closed 保护测试。"""

from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from app.routers import reports
from app.services.rag_service import (
    RAGService,
    StalePolicyError,
    assert_no_stale_policy,
)

TODAY = date.today()


def _iso(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def _doc(source_id: str, doc_type: str, days_ago: int, interval: int = 90) -> dict:
    return {
        "source_id": source_id,
        "type": doc_type,
        "lang": "cn",
        "title": f"{source_id} 标题",
        "content": "分布式 光伏 并网 政策 电价 补贴",
        "year": 2025,
        "last_verified_at": _iso(days_ago),
        "source_url": "https://example.gov/policy",
        "source_org": "example.gov",
        "license_note": "政府公开信息",
        "verify_interval_days": interval,
    }


# ── 元数据完整性：ID/标题/版本/发布日期/检索时间/许可 ──────────────────────────


def test_rag_hits_carry_full_provenance_metadata():
    service = RAGService(corpus=[_doc("p1", "policy", days_ago=10)])
    hits = service.search("分布式 光伏 并网", market="cn").hits
    assert hits
    hit = hits[0]
    assert hit.source_id == "p1"
    assert hit.title
    metadata = hit.metadata
    assert metadata["type"] == "policy"
    assert isinstance(metadata["year"], int)          # 版本/发布年份
    assert metadata["last_verified_at"]               # 最近核验日期
    assert metadata["retrieved_at"] == TODAY.isoformat()  # 检索时间
    assert metadata["license_note"]                   # 许可
    assert metadata["source_url"].startswith("https://")
    assert metadata["source_org"]
    assert metadata["freshness_status"] == "current"


# ── 过期政策：失效标记 / 排除 / fail-closed ────────────────────────────────────


def test_stale_policy_is_flagged_in_metadata():
    service = RAGService(corpus=[_doc("old-policy", "policy", days_ago=200)])
    hits = service.search("光伏 政策", market="cn").hits
    assert hits[0].metadata["freshness_status"] == "stale"


def test_exclude_stale_removes_expired_sources():
    corpus = [
        _doc("stale-one", "policy", days_ago=200),
        _doc("fresh-one", "policy", days_ago=5),
    ]
    service = RAGService(corpus=corpus)
    hits = service.search("光伏 政策", market="cn", exclude_stale=True).hits
    assert {h.source_id for h in hits} == {"fresh-one"}


def test_assert_no_stale_policy_blocks_expired_policy():
    service = RAGService(corpus=[_doc("stale-one", "policy", days_ago=200)])
    hits = service.search("光伏 政策", market="cn").hits
    with pytest.raises(StalePolicyError) as exc:
        assert_no_stale_policy(hits)
    assert exc.value.source_ids == ["stale-one"]


def test_assert_no_stale_policy_allows_current_policy_and_stale_non_policy():
    corpus = [
        _doc("fresh-policy", "policy", days_ago=5),
        _doc("old-standard", "standard", days_ago=500, interval=365),
    ]
    service = RAGService(corpus=corpus)
    hits = service.search("光伏 政策", market="cn").hits
    # 现行政策 + 过期非政策（标准类仅作警告，由 freshness_status 标记）不阻断
    assert_no_stale_policy(hits)


# ── 报告生成链路：过期政策来源不得生成投资结论 ─────────────────────────────────


def _evidence(sources):
    assumptions = {key: 1 for key in reports.REQUIRED_FINANCIAL_INPUTS}
    assumptions["yearly_cashflows"] = [100, 200]
    return {"financial": assumptions, "data_sources": sources}


def test_report_generation_rejects_stale_policy_source():
    with pytest.raises(HTTPException) as exc:
        reports.validate_financial_evidence(_evidence([{
            "title": "2020 年光伏补贴政策",
            "url": "https://example.gov/policy-2020",
            "retrieved_at": "2026-08-20",
            "type": "policy",
            "freshness_status": "stale",
        }]))
    assert exc.value.status_code == 422
    assert "过期" in exc.value.detail


def test_report_generation_accepts_current_policy_source():
    reports.validate_financial_evidence(_evidence([{
        "title": "2026 年分布式光伏管理办法",
        "url": "https://example.gov/policy-2026",
        "retrieved_at": "2026-08-20",
        "type": "policy",
        "freshness_status": "current",
    }]))
