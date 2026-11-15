"""B16 / B17: exported reports must carry the project's own location and currency.

B16: international exports said Location "CN" and currency CNY for projects in Texas and Rajasthan, and quoted the
US IEEE 1547 standard for an Indian project. B17: the domestic export cover said "项目地点：待确认" although the project
had an address. Root cause: Project has no country/city/currency columns, and the report code read them with
"CN" / "CNY" defaults instead of using Project.location and the saved finance model's currency.
"""
import io
import re
from types import SimpleNamespace

import pytest

from app.routers import reports as R
from app.services.geo_hint import infer_country

SOURCE = {"title": "NREL Annual Technology Baseline", "url": "https://atb.nrel.gov/", "retrieved_at": "2026-10-30"}


def _model(currency):
    return {"capacity_mw": 100, "capex_per_w": 1.1, "opex_per_kw_yr": 17, "electricity_price": 45,
            "capacity_factor": 0.25, "currency": currency, "data_sources": [SOURCE]}


async def _project(client, headers, name, address, lat=30.0, lon=-100.0):
    r = await client.post("/api/v1/projects", headers=headers, json={
        "name": name, "technology": "solar", "capacity_kw": 100000,
        "location": {"latitude": lat, "longitude": lon, "address": address}})
    assert r.status_code == 201, r.text
    return r.json()["data"]["id"]


def _text(body: bytes, fmt: str) -> str:
    if fmt == "pdf":
        from pypdf import PdfReader
        return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(body)).pages)
    from docx import Document
    d = Document(io.BytesIO(body))
    return "\n".join(p.text for p in d.paragraphs) + "\n" + "\n".join(c.text for t in d.tables for row in t.rows for c in row.cells)


async def _export(client, headers, pid, report_type, fmt, tmp_path, monkeypatch, extra_headers=None):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    r = await client.post("/api/v1/reports/generate", headers={**headers, **(extra_headers or {})},
                          json={"project_id": pid, "report_type": report_type, "format": fmt})
    assert r.status_code == 200, r.text
    rid = r.json()["data"]["report_id"]
    st = (await client.get(f"/api/v1/reports/{rid}", headers=headers)).json()["data"]
    assert st["status"] == "completed", st
    return _text((await client.get(f"/api/v1/reports/{rid}/file", headers=headers)).content, fmt)


def test_project_dict_uses_address_and_model_currency_not_cn_defaults():
    project = SimpleNamespace(name="P", technology="solar", capacity_mw=100, location="West Texas",
                              latitude=31.5, longitude=-102.0, description="", status="draft")
    cf = SimpleNamespace(yearly_cashflows={"assumptions": {"currency": "usd"}, "values": [1, 2], "sources": []},
                         irr=None, npv=None, lcoe=None, payback_years=None)
    data = R._build_project_dict(project, cf)
    assert data["address"] == "West Texas" and data["country_code"] == "US" and data["currency"] == "USD"
    assert data["project_type"] == "solar_pv"
    bare = R._build_project_dict(project, None)
    assert bare["currency"] == "" and bare["country_code"] == "US"


@pytest.mark.parametrize("address,code", [
    ("West Texas", "US"), ("Rajasthan", "IN"), ("Seville rooftop", "ES"), ("Seoul", "KR"), ("Cape Town", "ZA"),
    ("North Sea", None), ("", None), ("Punjab, Pakistan", None), ("Indiana, India", "IN"), ("甘肃武威", "CN"),
])
def test_country_is_inferred_from_the_address_never_defaulted(address, code):
    assert infer_country(address) == code


@pytest.mark.asyncio
@pytest.mark.parametrize("fmt", ["pdf", "docx"])
async def test_global_compliance_export_for_texas_has_us_location_and_standard(client, auth_headers, tmp_path, monkeypatch, fmt):
    pid = await _project(client, auth_headers, "Texas Solar", "West Texas", 31.5, -102.0)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=_model("USD"))).status_code == 200
    text = await _export(client, auth_headers, pid, "compliance", fmt, tmp_path, monkeypatch, {"X-App-Market": "global"})
    assert "West Texas" in text and "United States" in text and "IEEE 1547" in text
    assert "a project in West Texas, United States" in text
    assert "an international project in CN" not in text and not re.search(r"\bCN\b", text)
    assert "CNY" not in text


@pytest.mark.asyncio
async def test_global_compliance_export_for_rajasthan_cites_indian_bodies_not_ieee(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers, "Rajasthan Storage", "Rajasthan", 26.9, 75.8)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=_model("INR"))).status_code == 200
    text = await _export(client, auth_headers, pid, "compliance", "docx", tmp_path, monkeypatch, {"X-App-Market": "global"})
    assert "Rajasthan" in text and "India" in text
    assert "CEA" in text and "CERC" in text
    assert "IEEE 1547" not in text and not re.search(r"\bCN\b", text)


@pytest.mark.asyncio
async def test_global_feasibility_export_uses_the_modelled_currency(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers, "Texas Solar", "West Texas", 31.5, -102.0)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=_model("USD"))).status_code == 200
    text = await _export(client, auth_headers, pid, "feasibility", "docx", tmp_path, monkeypatch, {"X-App-Market": "global"})
    assert "USD" in text and "CNY" not in text and "West Texas" in text


@pytest.mark.asyncio
async def test_unknown_country_is_stated_not_guessed(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers, "Offshore", "North Sea", 56.0, 3.0)
    text = await _export(client, auth_headers, pid, "compliance", "docx", tmp_path, monkeypatch, {"X-App-Market": "global"})
    assert "North Sea" in text and "country is not recorded" in text
    assert "IEEE 1547" not in text and not re.search(r"\bCN\b", text)


@pytest.mark.asyncio
async def test_domestic_export_cover_shows_the_project_address(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers, "武威光伏", "甘肃武威", 37.9, 102.6)
    text = await _export(client, auth_headers, pid, "compliance", "docx", tmp_path, monkeypatch)
    assert "甘肃武威" in text
    assert "项目地点：待确认" not in text and "待确认" not in text.split("甘肃武威")[0][-20:]
