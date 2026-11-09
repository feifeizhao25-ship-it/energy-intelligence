"""Excel and PowerPoint exports carry the Word report, and only the promised tiers can ask for them."""
import io
import uuid

import pytest
from docx import Document
from openpyxl import load_workbook
from pptx import Presentation

from app.core.security import create_access_token
from app.models.user import User
from app.routers import reports as R
from app.utils.security import get_password_hash


def _pieces(docx_bytes: bytes) -> list[str]:
    document = Document(io.BytesIO(docx_bytes))
    pieces = [p.text.strip() for p in document.paragraphs if p.text.strip()]
    pieces += [cell.text.strip() for table in document.tables for row in table.rows for cell in row.cells if cell.text.strip()]
    return pieces


def _xlsx_text(payload: bytes) -> str:
    book = load_workbook(io.BytesIO(payload))
    values = []
    for sheet in book.worksheets:
        for row in sheet.iter_rows(values_only=True):
            values.extend(str(cell) for cell in row if cell is not None and str(cell).strip())
    return "\n".join(values)


def _pptx_text(payload: bytes) -> str:
    deck = Presentation(io.BytesIO(payload))
    lines = []
    for slide in deck.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                lines.extend(p.text for p in shape.text_frame.paragraphs if p.text.strip())
    return "\n".join(lines)


def test_xlsx_and_pptx_repeat_the_word_report():
    data = R._demo_data()
    data["data_sources"] = [{"title": "示例来源", "url": "https://example.cn/law", "retrieved_at": "2026-10-01"}]
    metrics = R.calc_financial_metrics(data["financial"])
    args = (data, "compliance", R.TEMPLATES["compliance"], metrics, "合规报告对照", "confidential", "cn")
    word = R.generate_docx(*args)
    sheet = _xlsx_text(R.generate_xlsx(*args))
    slides = _pptx_text(R.generate_pptx(*args))
    missing_sheet = [piece for piece in _pieces(word) if piece not in sheet]
    missing_slides = [piece for piece in _pieces(word) if piece not in slides]
    assert missing_sheet == []
    assert missing_slides == []
    assert data["name"] in sheet and "未登记来源，待核对" in sheet
    assert data["name"] in slides and "第一章  法规清单" in slides
    assert sheet and slides


async def _user(db, plan: str) -> dict:
    user = User(
        id=str(uuid.uuid4()),
        phone=f"139{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"),
        name=f"{plan}用户",
        role="user",
        market="cn",
        subscription_plan=plan,
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db.add(user)
    await db.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


async def _project(client, headers, name: str) -> str:
    response = await client.post("/api/v1/projects", headers=headers, json={
        "name": name, "technology": "solar", "capacity_kw": 100000,
        "location": {"latitude": 40.1, "longitude": 94.6, "address": "甘肃省酒泉市"},
    })
    assert response.status_code == 201, response.text
    return response.json()["data"]["id"]


@pytest.mark.asyncio
@pytest.mark.parametrize("plan", ["free", "pro"])
async def test_lower_tiers_are_refused_excel_and_powerpoint(client, db_session, plan):
    headers = await _user(db_session, plan)
    project_id = await _project(client, headers, "免费档项目")
    for fmt, label in (("xlsx", "Excel"), ("pptx", "PPT")):
        response = await client.post("/api/v1/reports/generate", headers=headers, json={
            "project_id": project_id, "report_type": "compliance", "format": fmt,
        })
        assert response.status_code == 403, response.text
        detail = response.json()["detail"]
        assert detail["error"] == "FORMAT_NOT_INCLUDED"
        assert detail["message"] == f"当前套餐不含 {label} 导出，可导出 PDF，或升级到专业版及以上"


@pytest.mark.asyncio
@pytest.mark.parametrize("plan,fmt", [("full", "xlsx"), ("team", "pptx"), ("enterprise", "xlsx")])
async def test_promised_tiers_download_office_files(client, db_session, tmp_path, monkeypatch, plan, fmt):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    headers = await _user(db_session, plan)
    name = f"{plan}光伏项目"
    project_id = await _project(client, headers, name)
    created = await client.post("/api/v1/reports/generate", headers=headers, json={
        "project_id": project_id, "report_type": "compliance", "format": fmt,
    })
    assert created.status_code == 200, created.text
    report_id = created.json()["data"]["report_id"]
    status = (await client.get(f"/api/v1/reports/{report_id}", headers=headers)).json()["data"]
    assert status["status"] == "completed", status
    body = (await client.get(f"/api/v1/reports/{report_id}/file", headers=headers)).content
    text = _xlsx_text(body) if fmt == "xlsx" else _pptx_text(body)
    assert name in text
    assert "未登记来源，待核对" in text
    other = await _user(db_session, "enterprise")
    denied = await client.get(f"/api/v1/reports/{report_id}/file", headers=other)
    assert denied.status_code == 404
    foreign = await client.post("/api/v1/reports/generate", headers=other, json={
        "project_id": project_id, "report_type": "compliance", "format": fmt,
    })
    assert foreign.status_code == 404
