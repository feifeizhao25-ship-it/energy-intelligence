"""Report status/download/list must survive a process restart (in-memory store cleared)."""
import uuid

import pytest
from fastapi import HTTPException

from app.models.project import Project
from app.models.report import Report
from app.models.user import User
from app.routers import reports


async def _seed(db, owner="owner-1", status="completed", title="光伏可研报告"):
    for uid in (owner, "other-1"):
        if not await db.get(User, uid):
            db.add(User(id=uid, email=f"{uid}@t.cn", password_hash="x", name=uid))
    pid = str(uuid.uuid4())
    db.add(Project(id=pid, user_id=owner, name="p"))
    rid = str(uuid.uuid4())
    db.add(Report(id=rid, project_id=pid, user_id=owner, report_type="feasibility",
                  title=title, status=status))
    await db.commit()
    return rid


@pytest.fixture
def restarted(tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    monkeypatch.setattr(reports, "_report_store", {})
    return tmp_path


async def _body(resp):
    chunks = [c async for c in resp.body_iterator]
    return b"".join(c if isinstance(c, bytes) else c.encode() for c in chunks)


@pytest.mark.asyncio
async def test_download_and_status_after_restart(db_session, restarted):
    rid = await _seed(db_session)
    (restarted / f"{rid}.pdf").write_bytes(b"%PDF-1.4 test")

    resp = await reports.download_report_file(rid, user_id="owner-1", db=db_session)
    assert await _body(resp) == b"%PDF-1.4 test"
    cd = resp.headers["content-disposition"]
    assert cd.startswith(f'attachment; filename="report-{rid}.pdf"')
    assert "filename*=UTF-8''" in cd  # Chinese title encoded, header stays latin-1 safe

    status = await reports.get_report_status(rid, user_id="owner-1", db=db_session)
    assert status["data"]["status"] == "completed"
    assert status["data"]["title"] == "光伏可研报告"
    assert "file_path" not in status["data"]

    listed = await reports.list_reports_compat(page=1, page_size=20, user_id="owner-1", db=db_session)
    item = next(i for i in listed["data"]["items"] if i["report_id"] == rid)
    assert item["status"] == "completed" and item["format"] == "pdf"


@pytest.mark.asyncio
async def test_other_users_report_is_denied(db_session, restarted):
    rid = await _seed(db_session)
    (restarted / f"{rid}.pdf").write_bytes(b"secret")
    for endpoint in (reports.download_report_file, reports.get_report_status):
        with pytest.raises(HTTPException) as exc:
            await endpoint(rid, user_id="other-1", db=db_session)
        assert exc.value.status_code == 404
        assert "无权访问" in exc.value.detail


@pytest.mark.asyncio
async def test_missing_file_is_clean_404(db_session, restarted):
    rid = await _seed(db_session)
    for endpoint in (reports.download_report_file, reports.get_report_status):
        with pytest.raises(HTTPException) as exc:
            await endpoint(rid, user_id="owner-1", db=db_session)
        assert exc.value.status_code == 404
        assert "重新生成" in exc.value.detail


@pytest.mark.asyncio
async def test_generation_interrupted_by_restart_reports_failed(db_session, restarted):
    rid = await _seed(db_session, status="generating")
    status = await reports.get_report_status(rid, user_id="owner-1", db=db_session)
    assert status["data"]["status"] == "failed"
    assert "重启" in status["data"]["error"]


@pytest.mark.asyncio
async def test_non_uuid_id_rejected_before_disk_access(db_session, restarted):
    with pytest.raises(HTTPException) as exc:
        reports._existing_report_file("../../etc/passwd")
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_after_restart_removes_file_and_row(db_session, restarted):
    rid = await _seed(db_session)
    f = restarted / f"{rid}.docx"
    f.write_bytes(b"docx")
    await reports.delete_report(rid, user_id="owner-1", db=db_session)
    assert not f.exists()
    with pytest.raises(HTTPException):
        await reports.get_report_status(rid, user_id="owner-1", db=db_session)
