"""Report generation must require ownership and never fall back to demo data."""

import inspect

import pytest
from fastapi import HTTPException

from app.routers import reports


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, values):
        self.values = iter(values)

    async def execute(self, _query):
        return ScalarResult(next(self.values))


@pytest.mark.asyncio
async def test_missing_or_foreign_project_is_rejected():
    with pytest.raises(HTTPException) as exc_info:
        await reports.fetch_project_data(FakeDb([None]), "project-1", "user-1")
    assert exc_info.value.status_code == 404
    assert "无权访问" in exc_info.value.detail


def test_generate_status_and_download_require_authenticated_user():
    for endpoint in (
        reports.generate_report,
        reports.get_report_status,
        reports.download_report_file,
    ):
        parameter = inspect.signature(endpoint).parameters["user_id"]
        assert parameter.default.dependency is reports.get_current_user_id


def test_report_request_requires_project_id():
    with pytest.raises(Exception):
        reports.GenerateReportRequest(report_type="feasibility", format="pdf")


def test_report_file_path_accepts_only_server_generated_uuid(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    report_id = "123e4567-e89b-12d3-a456-426614174000"
    assert reports._report_file(report_id, "pdf") == str(
        tmp_path / "generated_reports" / f"{report_id}.pdf"
    )

    with pytest.raises(HTTPException) as traversal:
        reports._report_file("../../etc/passwd", "pdf")
    assert traversal.value.status_code == 404


def test_production_report_source_has_no_demo_fallback():
    source = inspect.getsource(reports.fetch_project_data)
    assert "_demo_data" not in source
    assert "Project.user_id == user_id" in source


def test_financial_report_rejects_missing_assumptions_and_sources():
    with pytest.raises(HTTPException) as missing_inputs:
        reports.validate_financial_evidence({"financial": {}, "data_sources": []})
    assert missing_inputs.value.status_code == 422

    assumptions = {key: 1 for key in reports.REQUIRED_FINANCIAL_INPUTS}
    assumptions["yearly_cashflows"] = [100, 200]
    with pytest.raises(HTTPException) as missing_sources:
        reports.validate_financial_evidence({"financial": assumptions, "data_sources": []})
    assert "可核验" in missing_sources.value.detail


def test_financial_report_accepts_complete_evidence_contract():
    assumptions = {key: 1 for key in reports.REQUIRED_FINANCIAL_INPUTS}
    assumptions["yearly_cashflows"] = [100, 200]
    reports.validate_financial_evidence({
        "financial": assumptions,
        "data_sources": [{
            "title": "Official tariff schedule",
            "url": "https://example.gov/tariff",
            "retrieved_at": "2026-08-20",
        }],
    })
