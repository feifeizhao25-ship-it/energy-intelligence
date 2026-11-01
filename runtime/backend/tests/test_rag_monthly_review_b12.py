"""复测 B12：山东来源时效缺口。来源库要有至少每月一次的复核、superseded_by 的一致性检查，
并收录山东 871 号差价结算细则和新版山东电力市场规则。"""
import json
from datetime import date, timedelta
from pathlib import Path

from app.services import rag_refresh
from app.services.rag_sources import POLICY_MAX_VERIFY_INTERVAL_DAYS, SourceRegistry, freshness_status


def _registry(extra=None):
    reg = SourceRegistry.from_file()
    return reg


def test_every_policy_source_is_reviewed_at_least_monthly():
    reg = SourceRegistry.from_file()
    policy = [s for s in reg.sources if s["type"] == "policy"]
    assert policy and all(s["verify_interval_days"] <= POLICY_MAX_VERIFY_INTERVAL_DAYS == 30 for s in policy)
    assert reg.validate() == []


def test_a_policy_source_checked_45_days_ago_is_now_stale():
    # under the old 90-day cadence this was still 'review_recommended' at best
    today = date(2026, 11, 1)
    checked = (today - timedelta(days=45)).isoformat()
    assert freshness_status(checked, 30, today=today) == "stale"


def test_registry_rejects_a_dangling_or_inconsistent_superseded_by(tmp_path):
    data = json.loads(Path(SourceRegistry.from_file().path).read_text(encoding="utf-8"))
    bad = dict(data["sources"][0], source_id="x-old", superseded_by="does-not-exist", status="现行")
    data["sources"].append(bad)
    p = tmp_path / "r.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    problems = SourceRegistry.from_file(p).validate()
    assert any("x-old: superseded_by points to unknown source" in x for x in problems)
    assert any("x-old: has superseded_by but status" in x for x in problems)


def test_a_policy_interval_over_a_month_is_rejected(tmp_path):
    data = json.loads(Path(SourceRegistry.from_file().path).read_text(encoding="utf-8"))
    pol = next(s for s in data["sources"] if s["type"] == "policy")
    pol["verify_interval_days"] = 90
    p = tmp_path / "r.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    assert any("reviewed at least every 30 days" in x for x in SourceRegistry.from_file(p).validate())


def test_shandong_sources_in_the_library_match_the_official_pages():
    reg = SourceRegistry.from_file()
    s871 = reg.get("policy-cn-sd-lfgjg-2025-871")
    assert s871["effective_date"] == "2026-01-01" and s871["status"] == "现行"
    assert "gb.shandong.gov.cn" in s871["source_url"]
    rules = reg.get("policy-cn-sd-nea-2025-57")
    assert rules["doc_number"] == "鲁监能市场规〔2025〕57号"
    assert rules["effective_date"] == "2026-01-01" and rules["status"] == "现行"
    assert "sdb.nea.gov.cn" in rules["source_url"]
    assert "2026年1月1日起执行" in rules["content"]
    # 871 implements 576; neither replaces the other
    assert reg.get("policy-cn-sd-lfgjg-2025-576")["implemented_by"] == ["policy-cn-sd-lfgjg-2025-871"]
    assert reg.get("policy-cn-sd-lfgjg-2025-576")["superseded_by"] is None


def test_refresh_report_lists_what_needs_the_monthly_review():
    far = date(2027, 6, 1)
    rep = rag_refresh.refresh_report(today=far)
    assert "monthly_review_due" in rep and "superseded" in rep
    assert "policy-cn-sd-lfgjg-2025-871" in rep["monthly_review_due"]
    ok = rag_refresh.refresh_report(today=date(2026, 11, 2))
    assert "policy-cn-sd-lfgjg-2025-871" not in ok["monthly_review_due"]


def test_celery_runs_the_monthly_review_on_the_first_of_the_month():
    from app.tasks.celery_app import celery_app
    entry = celery_app.conf.beat_schedule["rag-monthly-review"]
    assert entry["task"] == "energy.domestic.rag_monthly_review"
    assert entry["schedule"].day_of_month == {1}
