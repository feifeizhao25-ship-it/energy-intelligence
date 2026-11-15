"""Weekly harvest writes candidates only and refuses an empty publish signature."""
import json
from datetime import date
from pathlib import Path

import pytest

from app.services import rag_refresh
from app.services.rag_refresh import REGISTRY_PATH

TODAY = date(2026, 11, 6)


def test_harvest_writes_candidates_and_leaves_production_untouched(tmp_path):
    registry_before = REGISTRY_PATH.read_bytes()
    skills = tmp_path / "skills" / "carbon.md"
    skills.parent.mkdir()
    skills.write_text("production skill\n", encoding="utf-8")
    out = tmp_path / "candidates"
    report = rag_refresh.harvest_weekly(
        candidates_dir=out,
        today=TODAY,
        production_paths=[skills],
    )
    assert report["state"] == "unpublished"
    assert report["production_written"] is False
    assert report["reviewer"] == ""
    assert report["review_status"] == "待审核"
    assert report["added"]
    assert report["conflicts"][0]["resolution"] is None
    assert report["conflicts"][0]["candidate_ids"] == ["EI-06", "EI-08", "EI-09"]
    en04 = json.loads((out / "EN-04.json").read_text(encoding="utf-8"))
    assert en04["reviewer"] == ""
    assert en04["review_status"] == "待审核"
    assert en04["state"] == "unpublished"
    assert "国能发新能规〔2025〕7号" in en04["excerpt"]
    assert en04["url"].endswith("content_7004206.htm")
    en01 = json.loads((out / "EN-01.json").read_text(encoding="utf-8"))
    assert "2023" in en01["excerpt"] and "不是 2025 年数据" in en01["excerpt"]
    assert en01["published_at"] == "2025-12-31"
    for field in ("url", "doi", "publisher", "excerpt", "published_at", "retrieved_at", "effective_at", "expires_at", "region", "content_hash", "license"):
        assert field in en01
    assert en01["content_hash"]
    blob = json.dumps(report)
    assert "energy.gov/eere/solar/homeowners-guide" not in blob
    assert "nsrdb.nrel.gov" not in blob and "atb.nrel.gov" not in blob
    assert (out / "diff-report.json").exists()
    assert REGISTRY_PATH.read_bytes() == registry_before
    assert skills.read_text(encoding="utf-8") == "production skill\n"


def test_second_harvest_is_a_diff_not_a_publish(tmp_path):
    out = tmp_path / "candidates"
    first = rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY)
    second = rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY)
    assert first["added"]
    assert second["added"] == []
    assert second["changed"] == []
    assert set(second["unchanged"]) == set(first["added"])


def test_changed_excerpt_shows_up_in_the_diff(tmp_path, monkeypatch):
    catalog = tmp_path / "catalog.json"
    catalog.write_text(Path(rag_refresh.WEEKLY_CATALOG_PATH).read_text(encoding="utf-8"), encoding="utf-8")
    out = tmp_path / "candidates"
    rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY, catalog_path=catalog)
    data = json.loads(catalog.read_text(encoding="utf-8"))
    data["sources"][0]["excerpt"] += " 复核备注仍为空。"
    catalog.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    report = rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY, catalog_path=catalog)
    assert report["changed"] == ["EN-01"]
    row = json.loads((out / "EN-01.json").read_text(encoding="utf-8"))
    assert row["reviewer"] == "" and row["state"] == "unpublished"


def test_blocked_404_url_is_not_written(tmp_path):
    catalog = json.loads(Path(rag_refresh.WEEKLY_CATALOG_PATH).read_text(encoding="utf-8"))
    blocked = catalog["blocked_urls"][6]
    catalog["sources"] = [{
        "id": "BLOCKED-1",
        "product": "energy-intl",
        "url": blocked,
        "doi": "",
        "publisher": "DOE",
        "excerpt": "must not land",
        "published_at": "",
        "effective_at": "",
        "expires_at": "",
        "region": "us",
        "license": "",
        "language": "en",
    }]
    path = tmp_path / "catalog.json"
    path.write_text(json.dumps(catalog), encoding="utf-8")
    out = tmp_path / "candidates"
    report = rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY, catalog_path=path)
    assert report["added"] == []
    assert report["skipped"][0]["status"] == "blocked_unverified_url"
    assert not (out / "BLOCKED-1.json").exists()


def test_publish_refuses_empty_signature_and_does_not_touch_production(tmp_path):
    out = tmp_path / "candidates"
    rag_refresh.harvest_weekly(candidates_dir=out, today=TODAY)
    registry_before = REGISTRY_PATH.read_bytes()
    with pytest.raises(ValueError, match="reviewer_signature is empty"):
        rag_refresh.publish_candidates("", candidates_dir=out)
    with pytest.raises(ValueError, match="reviewer_signature is empty"):
        rag_refresh.publish_candidates("   ", candidates_dir=out)
    receipt = rag_refresh.publish_candidates("reviewer-signed-in-the-call", candidates_dir=out)
    assert receipt["production_written"] is False
    assert receipt["reviewer_on_candidates"] == ""
    row = json.loads((out / "EN-03.json").read_text(encoding="utf-8"))
    assert row["reviewer"] == "" and row["state"] == "unpublished"
    assert "发改价格〔2025〕136号" in row["excerpt"]
    assert REGISTRY_PATH.read_bytes() == registry_before


def test_harvest_refuses_the_production_registry_directory(tmp_path):
    with pytest.raises(PermissionError):
        rag_refresh.harvest_weekly(candidates_dir=REGISTRY_PATH.parent, today=TODAY)
