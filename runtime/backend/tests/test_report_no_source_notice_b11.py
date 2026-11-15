"""B11: a compliance/ESG report generated with no verifiable source used to carry the warning only in the appendix; and the
feasibility 422 gave the UI nothing machine-readable to offer an "add a data source" action."""
import io
import re

import pytest

SOURCE = {"title": "NREL Annual Technology Baseline", "url": "https://atb.nrel.gov/", "retrieved_at": "2026-10-30"}
MODEL = {"capacity_mw": 100, "capex_per_w": 1.1, "opex_per_kw_yr": 17, "electricity_price": 45, "capacity_factor": 0.25, "currency": "USD"}


async def _project(client, headers):
    r = await client.post("/api/v1/projects", headers=headers, json={
        "name": "P", "technology": "solar", "capacity_kw": 100000,
        "location": {"latitude": 33.4, "longitude": -112.0, "address": "Phoenix, Arizona"}})
    return r.json()["data"]["id"]


def _docx_text(body):
    from docx import Document
    d = Document(io.BytesIO(body))
    return [p.text for p in d.paragraphs]


async def _export(client, headers, pid, rtype, fmt, tmp_path, monkeypatch, extra=None):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    r = await client.post("/api/v1/reports/generate", headers={**headers, **(extra or {})},
                          json={"project_id": pid, "report_type": rtype, "format": fmt, **({"market": "global"} if extra else {})})
    assert r.status_code == 200, r.text
    rid = r.json()["data"]["report_id"]
    assert (await client.get(f"/api/v1/reports/{rid}", headers=headers)).json()["data"]["status"] == "completed"
    return (await client.get(f"/api/v1/reports/{rid}/file", headers=headers)).content


@pytest.mark.asyncio
@pytest.mark.parametrize("rtype", ["compliance", "esg"])
async def test_global_report_without_sources_says_so_before_the_appendix(client, auth_headers, tmp_path, monkeypatch, rtype):
    pid = await _project(client, auth_headers)
    paras = _docx_text(await _export(client, auth_headers, pid, rtype, "docx", tmp_path, monkeypatch, {"X-App-Market": "global"}))
    idx = [i for i, t in enumerate(paras) if t.startswith("IMPORTANT: no verifiable data source")]
    assert idx, "notice missing"
    appendix = max(i for i, t in enumerate(paras) if t.strip().startswith("Appendix"))
    assert idx[0] < appendix - 3, "notice must come before the body, not only sit in the appendix"


@pytest.mark.asyncio
async def test_domestic_compliance_report_without_sources_says_so_first(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers)
    paras = _docx_text(await _export(client, auth_headers, pid, "compliance", "docx", tmp_path, monkeypatch))
    hits = [i for i, t in enumerate(paras) if t.startswith("【重要】本项目未登记任何可核验的数据来源")]
    appendix = max(i for i, t in enumerate(paras) if t.strip().startswith("附录"))
    assert hits and hits[0] < appendix - 3, "notice must come before the body, not only sit in the appendix"


@pytest.mark.asyncio
async def test_report_with_a_source_has_no_warning(client, auth_headers, tmp_path, monkeypatch):
    pid = await _project(client, auth_headers)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json={**MODEL, "data_sources": [SOURCE]})).status_code == 200
    paras = _docx_text(await _export(client, auth_headers, pid, "compliance", "docx", tmp_path, monkeypatch, {"X-App-Market": "global"}))
    assert not any("no verifiable data source is attached" in t and t.startswith("IMPORTANT") for t in paras)


@pytest.mark.asyncio
async def test_feasibility_422_tells_the_client_what_to_offer(client, auth_headers):
    pid = await _project(client, auth_headers)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=MODEL)).status_code == 200
    r = await client.post("/api/v1/reports/generate", headers=auth_headers, json={"project_id": pid, "report_type": "feasibility", "format": "pdf", "market": "global"})
    assert r.status_code == 422 and "verifiable data source" in r.json()["detail"]
    assert r.headers["x-error-code"] == "MISSING_REPORT_INPUT" and r.headers["x-error-action"] == "add_data_source_or_save_model"
