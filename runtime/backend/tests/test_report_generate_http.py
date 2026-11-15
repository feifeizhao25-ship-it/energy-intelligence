"""HTTP checks for POST /api/v1/reports/generate.

Project reports use export.formats and report_exports_per_month from the
entitlement registry. They do not use the answer download's citation_export
flag. Quota is counted on the route, not only inside the quota helper.
"""
import asyncio
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core.security import create_access_token
from app.models.user import User
from app.routers import reports as reports_api
from app.utils.security import get_password_hash

SOLAR = {
    "capacity_mw": 100,
    "capex_per_w": 1.1,
    "opex_per_kw_yr": 17,
    "electricity_price": 45,
    "capacity_factor": 0.25,
    "currency": "CNY",
}
SOURCE = {"title": "公开电价通知", "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html", "retrieved_at": "2026-11-07"}


def _month() -> str:
    return f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"


async def _user(db_session, plan: str) -> tuple[User, dict]:
    user = User(
        id=str(uuid.uuid4()),
        email=f"{plan}-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=get_password_hash("Passw0rd!x"),
        name="报告测试",
        role="user",
        market="cn",
        subscription_plan=plan,
        usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    return user, {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


async def _used(db_session, user: User) -> int:
    await db_session.refresh(user)
    return int(((user.usage_quota or {}).get("report_exports") or {}).get(_month(), 0) or 0)


async def _project(client, headers) -> str:
    created = await client.post("/api/v1/projects", headers=headers, json={
        "name": "报告额度项目",
        "technology": "solar",
        "capacity_kw": 1000,
        "location": {"latitude": 23.1, "longitude": 113.3, "address": "广州"},
    })
    assert created.status_code == 201, created.text
    project_id = created.json()["data"]["id"]
    saved = await client.post(
        f"/api/v1/finance/models/{project_id}",
        headers=headers,
        json={**SOLAR, "data_sources": [SOURCE]},
    )
    assert saved.status_code == 200, saved.text
    return project_id


async def _generate(client, headers, project_id: str, fmt: str = "pdf", **extra):
    body = {"project_id": project_id, "report_type": "feasibility", "format": fmt, **extra}
    return await client.post("/api/v1/reports/generate", headers=headers, json=body)


@pytest.mark.asyncio
async def test_free_word_is_refused_and_pdf_uses_one_monthly_export(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    user, headers = await _user(db_session, "free")
    project_id = await _project(client, headers)

    word = await _generate(client, headers, project_id, "docx")
    assert word.status_code == 403
    assert word.json()["detail"]["error"] == "FORMAT_NOT_INCLUDED"
    assert word.json()["detail"]["message"] == "当前套餐不含 Word 导出，可导出 PDF，或升级到专业版及以上"
    assert await _used(db_session, user) == 0

    english = await _generate(client, headers, project_id, "docx", market="global")
    assert english.status_code == 403
    assert english.json()["detail"]["message"] == "Word export is not included in this plan."
    assert await _used(db_session, user) == 0

    pdf = await _generate(client, headers, project_id, "pdf")
    assert pdf.status_code == 200, pdf.text
    assert pdf.json()["data"]["format"] == "pdf"
    report_id = pdf.json()["data"]["report_id"]
    status = await client.get(f"/api/v1/reports/{report_id}", headers=headers)
    assert status.json()["data"]["status"] == "completed"
    assert await _used(db_session, user) == 1
    removed = await client.delete(f"/api/v1/reports/{report_id}", headers=headers)
    assert removed.status_code == 200
    assert await _used(db_session, user) == 1

    missing = await _generate(client, headers, str(uuid.uuid4()), "pdf")
    assert missing.status_code == 404
    assert await _used(db_session, user) == 1


@pytest.mark.asyncio
async def test_pro_word_succeeds_under_the_same_monthly_counter(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    user, headers = await _user(db_session, "pro")
    project_id = await _project(client, headers)
    word = await _generate(client, headers, project_id, "docx")
    assert word.status_code == 200, word.text
    assert word.json()["data"]["format"] == "docx"
    assert await _used(db_session, user) == 1


@pytest.mark.asyncio
async def test_validation_failure_and_exhausted_quota_do_not_add_another_charge(client, db_session):
    user, headers = await _user(db_session, "free")
    created = await client.post("/api/v1/projects", headers=headers, json={
        "name": "未保存模型",
        "technology": "solar",
        "capacity_kw": 1000,
        "location": {"latitude": 23.1, "longitude": 113.3, "address": "广州"},
    })
    project_id = created.json()["data"]["id"]
    refused = await _generate(client, headers, project_id, "pdf")
    assert refused.status_code == 422
    assert await _used(db_session, user) == 0

    user.usage_quota = {"ai_calls": {}, "report_exports": {_month(): 3}}
    await db_session.commit()
    saved = await client.post(
        f"/api/v1/finance/models/{project_id}",
        headers=headers,
        json={**SOLAR, "data_sources": [SOURCE]},
    )
    assert saved.status_code == 200, saved.text
    blocked = await _generate(client, headers, project_id, "pdf")
    assert blocked.status_code == 429
    assert blocked.json()["detail"]["error"] == "REPORT_QUOTA_EXCEEDED"
    assert blocked.json()["detail"]["message"] == "本月报告导出额度已用尽，请查看套餐或下月再试"
    assert blocked.json()["detail"]["limit"] == 3
    assert await _used(db_session, user) == 3


@pytest.mark.asyncio
async def test_other_user_cannot_generate_from_this_project(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    owner, owner_headers = await _user(db_session, "free")
    project_id = await _project(client, owner_headers)
    _other, other_headers = await _user(db_session, "pro")
    stolen = await _generate(client, other_headers, project_id, "docx")
    assert stolen.status_code == 404
    assert await _used(db_session, owner) == 0
    other = (await db_session.execute(select(User).where(User.email.like("pro-%")))).scalars().first()
    await db_session.refresh(other)
    assert int(((other.usage_quota or {}).get("report_exports") or {}).get(_month(), 0) or 0) == 0


@pytest.mark.asyncio
async def test_concurrent_accepts_do_not_pass_the_last_slot(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    user, headers = await _user(db_session, "free")
    user.usage_quota = {"ai_calls": {}, "report_exports": {_month(): 2}}
    await db_session.commit()
    project_id = await _project(client, headers)
    first, second = await asyncio.gather(
        _generate(client, headers, project_id, "pdf"),
        _generate(client, headers, project_id, "pdf"),
    )
    codes = sorted([first.status_code, second.status_code])
    assert codes == [200, 429], (first.text, second.text)
    assert await _used(db_session, user) == 3


@pytest.mark.asyncio
async def test_failed_render_is_refunded_and_retry_charges_once(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    user, headers = await _user(db_session, "free")
    project_id = await _project(client, headers)
    real = reports_api.generate_pdf
    calls = {"n": 0}

    def flaky(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("render failed")
        return real(*args, **kwargs)

    monkeypatch.setattr(reports_api, "generate_pdf", flaky)
    failed = await _generate(client, headers, project_id, "pdf")
    assert failed.status_code == 200, failed.text
    failed_id = failed.json()["data"]["report_id"]
    failed_status = await client.get(f"/api/v1/reports/{failed_id}", headers=headers)
    assert failed_status.json()["data"]["status"] == "failed"
    assert await _used(db_session, user) == 0

    again = await _generate(client, headers, project_id, "pdf")
    assert again.status_code == 200, again.text
    again_id = again.json()["data"]["report_id"]
    again_status = await client.get(f"/api/v1/reports/{again_id}", headers=headers)
    assert again_status.json()["data"]["status"] == "completed"
    assert await _used(db_session, user) == 1


@pytest.mark.asyncio
async def test_cancel_refunds_once_and_a_second_delete_does_not(client, db_session, monkeypatch):
    user, headers = await _user(db_session, "free")
    project_id = await _project(client, headers)

    async def leave_generating(**kwargs):
        return None

    monkeypatch.setattr(reports_api, "_generate_report_task", leave_generating)
    accepted = await _generate(client, headers, project_id, "pdf")
    assert accepted.status_code == 200, accepted.text
    report_id = accepted.json()["data"]["report_id"]
    assert await _used(db_session, user) == 1

    deleted = await client.delete(f"/api/v1/reports/{report_id}", headers=headers)
    assert deleted.status_code == 200
    assert await _used(db_session, user) == 0
    again = await client.delete(f"/api/v1/reports/{report_id}", headers=headers)
    assert again.status_code == 404
    assert await _used(db_session, user) == 0

    retry = await _generate(client, headers, project_id, "pdf")
    assert retry.status_code == 200, retry.text
    assert await _used(db_session, user) == 1
