"""pvlib and PySAM on the same synthetic year, plus the CMA bulletin candidate."""
import json
from datetime import date

import pytest

from app.services.citation_license import license_allows_citation
from app.services.pv_crosscheck import LIMIT, compare
from app.services.rag_refresh import REGISTRY_PATH, WEEKLY_CATALOG_PATH, harvest_weekly, publish_candidates
from app.services.rag_sources import SourceRegistry

pvlib = pytest.importorskip("pvlib")
pytest.importorskip("PySAM")


def test_same_inputs_stay_within_5_percent():
    report = compare()
    assert report["compared"] is True
    assert report["network"] is False
    assert report["observed_weather"] is False
    assert report["relative_abs_diff"] <= LIMIT
    assert report["within_5_percent"] is True
    assert "年景公报里的数字" in report["note"]


def test_cma_bulletin_is_a_candidate_and_is_not_published(tmp_path):
    assert license_allows_citation("政府公开（引用）")
    assert license_allows_citation("BSD-3-Clause")
    assert not license_allows_citation("AGPL-3.0")
    assert not license_allows_citation("CC-BY-NC-4.0")
    assert not license_allows_citation("")
    catalog = json.loads(WEEKLY_CATALOG_PATH.read_text(encoding="utf-8"))
    row = next(item for item in catalog["sources"] if item["id"] == "EN-CMA-2025")
    assert row["product"] == "energy-cn"
    assert license_allows_citation(row["license"])
    assert "2026-01-29" in row["excerpt"]
    assert "不摘录具体辐照" in row["excerpt"]
    assert not any(ch.isdigit() and "kWh" in row["excerpt"] for ch in row["excerpt"])
    before = REGISTRY_PATH.read_bytes()
    out = tmp_path / "candidates"
    report = harvest_weekly(candidates_dir=out, today=date(2026, 11, 13))
    assert "EN-CMA-2025" in report["added"]
    saved = json.loads((out / "EN-CMA-2025.json").read_text(encoding="utf-8"))
    assert saved["reviewer"] == ""
    assert saved["state"] == "unpublished"
    assert saved["review_status"] == "待审核"
    with pytest.raises(ValueError, match="reviewer_signature is empty"):
        publish_candidates("", candidates_dir=out)
    assert REGISTRY_PATH.read_bytes() == before
    assert SourceRegistry.from_file().get("EN-CMA-2025") is None
