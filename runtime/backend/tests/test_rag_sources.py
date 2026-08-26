"""RAG 来源注册表、时效分档与刷新报告测试。"""

import re
from datetime import date, timedelta

import pytest

from app.services.rag_refresh import fetch_snapshot, refresh_report, snapshot_sha256
from app.services.rag_service import RAGService
from app.services.rag_sources import (
    REQUIRED_FIELDS,
    REGISTRY_PATH,
    SourceRegistry,
    freshness_status,
    verification_status,
)

TODAY = date(2026, 7, 27)


def _iso(days_ago):
    return (TODAY - timedelta(days=days_ago)).isoformat()


# ── 注册表完整性 ──────────────────────────────────────────────────────────────


def test_registry_file_exists_and_loads():
    registry = SourceRegistry.from_file()
    assert REGISTRY_PATH.is_file()
    assert len(registry.sources) >= 7  # 原 _CORPUS 全部条目已迁移


def test_registry_validate_has_no_problems():
    registry = SourceRegistry.from_file()
    assert registry.validate() == []


def test_registry_validate_flags_bad_published_at():
    registry = SourceRegistry.from_file()
    broken = dict(registry.sources[0])
    broken["published_at"] = "not-a-date"
    problems = SourceRegistry(registry.sources[:-1] + [broken]).validate()
    assert any("published_at must be ISO date" in p for p in problems)


def test_registry_validate_flags_missing_provenance_fields():
    registry = SourceRegistry.from_file()
    stripped = {k: v for k, v in registry.sources[0].items()
                if k not in ("authors", "version", "published_at", "locator")}
    problems = SourceRegistry(registry.sources[:-1] + [stripped]).validate()
    for field in ("authors", "version", "published_at", "locator"):
        assert any(f"missing required field {field}" in p for p in problems)


def test_search_metadata_surfaces_literature_provenance():
    hits = RAGService().search("光伏并网", top_k=10, market="cn").hits
    assert hits
    for hit in hits:
        assert hit.metadata["authors"]
        assert hit.metadata["version"]
        date.fromisoformat(hit.metadata["published_at"])
        assert hit.metadata["locator"]


def test_registry_required_fields_present():
    registry = SourceRegistry.from_file()
    for source in registry.sources:
        for field in REQUIRED_FIELDS:
            assert field in source and source[field] not in (None, ""), (
                source.get("source_id"), field,
            )


def test_registry_source_urls_are_http():
    registry = SourceRegistry.from_file()
    for source in registry.sources:
        assert re.match(r"^https?://", source["source_url"]), source["source_id"]


def test_registry_covers_cn_and_global_languages():
    registry = SourceRegistry.from_file()
    langs = {s["lang"] for s in registry.sources}
    assert "cn" in langs
    assert "en" in langs


def test_registry_verify_interval_tiers():
    registry = SourceRegistry.from_file()
    by_type = {}
    for source in registry.sources:
        by_type.setdefault(source["type"], set()).add(source["verify_interval_days"])
    assert by_type["policy"] == {90}
    assert by_type["standard"] == {365}
    assert by_type["price"] == {7}


# ── 时效分档逻辑（伪造新旧 last_verified_at）───────────────────────────────────


def test_freshness_current_when_within_80_percent_of_interval():
    assert freshness_status(_iso(70), verify_interval_days=90, today=TODAY) == "current"


def test_freshness_review_recommended_near_deadline():
    # 90 天周期的 80% = 72 天；73 天已接近截止但尚未逾期
    assert freshness_status(
        _iso(73), verify_interval_days=90, today=TODAY,
    ) == "review_recommended"


def test_freshness_stale_when_overdue():
    assert freshness_status(_iso(91), verify_interval_days=90, today=TODAY) == "stale"


def test_freshness_price_tier_goes_stale_fast():
    # 价格数据 7 天周期：8 天未核验即 stale
    assert freshness_status(_iso(8), verify_interval_days=7, today=TODAY) == "stale"
    assert freshness_status(_iso(1), verify_interval_days=7, today=TODAY) == "current"


def test_freshness_invalid_date_is_stale():
    assert freshness_status("not-a-date", today=TODAY) == "stale"


def test_search_metadata_uses_per_entry_interval():
    registry = SourceRegistry.from_file()
    hits = RAGService(registry=registry).search(
        "光伏", top_k=10, market="cn",
    ).hits
    assert hits
    for hit in hits:
        assert hit.metadata["freshness_status"] in {
            "current", "review_recommended", "stale",
        }


# ── 多方验证标记 ──────────────────────────────────────────────────────────────


def test_verification_flag_verified_when_corroborated():
    assert verification_status({"corroborated_by": ["other"]}) == "verified"


def test_verification_flag_single_source_without_corroboration():
    assert verification_status({}) == "single_source"
    assert verification_status({"corroborated_by": []}) == "single_source"


def test_search_metadata_exposes_verification():
    hits = RAGService().search("光伏并网", top_k=10, market="cn").hits
    assert hits
    for hit in hits:
        assert hit.metadata["verification"] in {"verified", "single_source"}


def test_registry_corroborated_by_references_known_sources():
    registry = SourceRegistry.from_file()
    for source in registry.sources:
        for ref in source.get("corroborated_by") or []:
            assert registry.get(ref) is not None
            assert ref != source["source_id"]


# ── refresh_report 输出结构 ───────────────────────────────────────────────────


def test_refresh_report_structure():
    report = refresh_report(today=TODAY)
    assert report["generated_at"] == TODAY.isoformat()
    assert report["total"] == len(report["entries"])
    assert set(report["counts"]) == {"current", "review_recommended", "stale"}
    assert sum(report["counts"].values()) == report["total"]
    for entry in report["entries"]:
        assert entry["freshness_status"] in {"current", "review_recommended", "stale"}
        assert isinstance(entry["days_overdue"], int)
        assert isinstance(entry["age_days"], int)
        assert entry["needs_refetch"] is (entry["freshness_status"] == "stale")
        assert entry["source_url"].startswith("http")


def test_refresh_needed_matches_stale_entries():
    report = refresh_report(today=TODAY)
    stale_ids = {
        e["source_id"] for e in report["entries"] if e["freshness_status"] == "stale"
    }
    assert set(report["refresh_needed"]) == stale_ids


def test_refresh_report_overdue_days():
    far_future = TODAY + timedelta(days=1000)
    report = refresh_report(today=far_future)
    assert report["refresh_needed"], "全部条目逾期后必须有待抓取清单"
    for entry in report["entries"]:
        assert entry["days_overdue"] > 0
        assert entry["needs_refetch"]


def test_fetch_snapshot_is_a_stub():
    with pytest.raises(NotImplementedError):
        fetch_snapshot({"source_id": "std-gb50797"})


def test_snapshot_sha256_stable():
    digest = snapshot_sha256(b"snapshot-bytes")
    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert digest == snapshot_sha256(b"snapshot-bytes")


# ── 语言隔离不破 ──────────────────────────────────────────────────────────────


def test_language_isolation_via_registry_backed_service():
    hits = RAGService().search(
        "solar interconnection standard", top_k=10, market="global",
    ).hits
    assert hits
    for hit in hits:
        assert not re.search(r"[一-鿿]", hit.title + hit.content)


def test_rag_service_defaults_to_registry_corpus():
    registry = SourceRegistry.from_file()
    service = RAGService()
    assert len(service._corpus) == len(registry.sources)
    assert all("source_url" in doc for doc in service._corpus)
