"""Expired policies stay out of retrieval. Answers name the issue date."""
from datetime import date, timedelta

from app.services.citation_record import date_lines
from app.services.policy_term import is_expired_policy, issue_date
from app.services.rag_service import RAGService


def _policy(source_id: str, until: str, issued: str) -> dict:
    today = date.today().isoformat()
    return {
        "source_id": source_id,
        "type": "policy",
        "lang": "cn",
        "title": f"{source_id} 光伏补贴政策",
        "authors": "省发展改革委",
        "version": "测试",
        "published_at": issued,
        "publish_date": issued,
        "locator": "第一条",
        "content": "分布式 光伏 补贴 政策 文号",
        "year": 2024,
        "last_verified_at": today,
        "source_url": "https://example.gov/policy",
        "source_org": "省发展改革委",
        "license_note": "政府公开信息",
        "verify_interval_days": 90,
        "status": "现行",
        "valid_until": until,
        "expiry_date": None,
        "superseded_by": None,
    }


def test_expired_policy_is_not_retrieved_and_the_answer_shows_the_issue_date():
    today = date.today()
    expired = _policy("old-policy", (today - timedelta(days=1)).isoformat(), "2020-03-01")
    current = _policy("live-policy", (today + timedelta(days=400)).isoformat(), "2025-06-01")
    assert is_expired_policy(expired, today)
    assert not is_expired_policy(current, today)
    hits = RAGService(corpus=[expired, current]).search("光伏 补贴 政策", market="cn").hits
    assert [hit.source_id for hit in hits] == ["live-policy"]
    lines = date_lines(hits[0].metadata, "zh")
    assert "发文日期：2025-06-01。" in lines
    assert issue_date(hits[0].metadata) == "2025-06-01"
    assert all("发文日期" not in line for line in date_lines(hits[0].metadata, "en"))


def test_valid_until_alone_expires_a_current_status_policy():
    today = date.today()
    doc = _policy("dated", (today - timedelta(days=10)).isoformat(), "2019-01-01")
    doc.pop("expiry_date")
    assert is_expired_policy(doc, today)
    assert RAGService(corpus=[doc]).search("光伏 补贴", market="cn").hits == []
