"""EN-A3: literature metadata, external scoring off, and an honest rating route."""
from fastapi.testclient import TestClient

from app.api.v1.asset_rating import asset_rating_payload
from app.main import app
from app.services.external_golden import external_golden_score
from app.skills.literature import literature_metadata


def test_literature_metadata_copies_only_real_sources():
    empty = literature_metadata({"lcoe": 0.15})
    assert empty == {"items": [], "status": "none_attached"}
    attached = literature_metadata({
        "lcoe": 0.15,
        "sources": [{"title": "  NREL ATB  ", "url": "https://atb.nrel.gov/", "retrieved_at": "2026-10-01"}],
    })
    assert attached["status"] == "attached"
    assert attached["items"] == [{
        "title": "NREL ATB",
        "url": "https://atb.nrel.gov/",
        "retrieved_at": "2026-10-01",
    }]


def test_external_golden_scoring_stays_off():
    off = external_golden_score("pv", {})
    assert off["available"] is False
    assert off["score"] is None
    assert off["providers"] == ["PVWatts", "PVGIS"]
    on = external_golden_score("pv", {"EXTERNAL_GOLDEN_SCORING": "1"})
    assert on["available"] is False
    assert on["score"] is None
    assert "does not call" in on["reason"]


def test_asset_rating_route_has_no_score_until_login():
    body = asset_rating_payload("plant-1")
    assert body["status"] == "not_available"
    assert body["score"] is None
    response = TestClient(app).get("/api/v1/assets/plant-1/rating")
    assert response.status_code == 401
