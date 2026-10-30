"""新能源 SIL 接入：默认关闭、fail-closed、审批、beat 登记、114 号政策入库。"""
import json
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.self_improve import hooks as eh
from app.self_improve.approval import ApprovalPolicy
from app.services.rag_sources import SourceRegistry

TZ = timezone(timedelta(hours=8))
NOW = datetime(2026, 11, 1, 3, 0, tzinfo=TZ)
GOOD_EVAL = {"citation_accuracy": 1.0, "freshness_correctness": 1.0, "redteam_blocked": 1.0, "calculator_reference": 10.0, "calculator_actual": 10.0}


def write_eval(path: Path, metrics=GOOD_EVAL, at=None):
    at = at or datetime(2026, 10, 31, tzinfo=timezone.utc)
    path.write_text(json.dumps({"generated_at": at.isoformat(), "metrics": metrics}), encoding="utf-8")
    return path


def recall_file(tmp_path, v=0.96):
    p = tmp_path / "recall.json"
    p.write_text(json.dumps({"recall_at_8": v}), encoding="utf-8")
    return p


def stale_registry():
    return SourceRegistry([{
        "source_id": "policy-old", "type": "policy", "lang": "cn", "title": "旧政策", "authors": "x", "version": "v", "published_at": "2025-01-01", "locator": "l",
        "content": "c", "year": 2025, "last_verified_at": "2025-01-01", "source_url": "https://www.ndrc.gov.cn/x", "source_org": "o", "license_note": "n",
        "verify_interval_days": 90, "doc_number": "d", "issuer": "i", "publish_date": "2025-01-01", "effective_date": "2025-01-01", "status": "现行",
        "jurisdiction": "全国", "source_tier": "一手官方", "license": "l", "snapshot_sha256": "a" * 64, "expiry_date": None, "superseded_by": None,
    }])


ENV_ON = {"SIL_ENABLED": "1", "POLICY_REVIEWERS": "boss"}


def test_disabled_by_default(tmp_path):
    assert eh.run_weekly(NOW, env={}) == {"status": "disabled"}
    assert eh.run_monthly(date(2026, 11, 1), env={}) == {"status": "disabled"}


def test_thresholds_only_waive_faithfulness():
    assert eh.THRESHOLDS.not_applicable == frozenset({"faithfulness"})


def test_measured_metrics_fail_closed(tmp_path):
    assert eh.measured_metrics(tmp_path / "missing.json", NOW) == {}
    stale = write_eval(tmp_path / "old.json", at=datetime(2026, 10, 1, tzinfo=timezone.utc))
    assert eh.measured_metrics(stale, NOW) == {}
    ok = eh.measured_metrics(write_eval(tmp_path / "e.json"), NOW, recall_file(tmp_path))
    assert ok["redteam_pass_rate"] == 1.0 and ok["calc_error"] == 0.0 and ok["recall_at_8"] == 0.96


def make(tmp_path, eval_ok=True, reviewers="boss", gateway=None):
    ev = write_eval(tmp_path / "latest.json") if eval_ok else tmp_path / "none.json"
    env = {**ENV_ON, "POLICY_REVIEWERS": reviewers, "SIL_DATA_DIR": str(tmp_path / "sil")}
    cfg = eh.build_config(env)
    hooks = eh.EnergyHooks(cfg.data_dir, today=date(2026, 11, 1), registry=stale_registry(), eval_file=ev, now=NOW)
    hooks.evaluate_orig = hooks.evaluate
    rf = recall_file(tmp_path)
    orig = eh.measured_metrics
    eh.measured_metrics = lambda f=None, n=None, recall_file=rf: orig(f, n, recall_file)  # noqa: E731
    from app.self_improve.loop import SelfImprovementLoop

    loop = SelfImprovementLoop(cfg, hooks.hooks(), approval=ApprovalPolicy.from_env(env), gateway=gateway or __import__("app.self_improve.approval", fromlist=["NullGateway"]).NullGateway())
    return loop, hooks, orig


def test_stale_source_becomes_pending_user_visible_candidate_and_never_self_promotes(tmp_path):
    loop, hooks, orig = make(tmp_path)
    try:
        rep = loop.run_weekly(NOW)
    finally:
        eh.measured_metrics = orig
    assert rep.status == "ok" and len(rep.pending_approval) == 1 and rep.promoted == []
    c = loop.store.get(rep.pending_approval[0])
    assert c.user_visible is True and c.needs_expert is False and c.origin == "internal"
    assert not hooks.queue_path.exists()  # 批准前不动任何东西
    with pytest.raises(PermissionError):
        loop.record_decision(c.id, "mallory", True)


def test_approved_candidate_only_queues_reverification_and_can_roll_back(tmp_path):
    loop, hooks, orig = make(tmp_path)
    try:
        cid = loop.run_weekly(NOW).pending_approval[0]
        loop.record_decision(cid, "boss", True, now=NOW + timedelta(days=1))
        rep = loop.run_weekly(NOW + timedelta(days=7))
    finally:
        eh.measured_metrics = orig
    assert rep.promoted == [cid]
    assert json.loads(hooks.queue_path.read_text(encoding="utf-8"))[0]["source_id"] == "policy-old"
    loop.rollback(cid)
    assert json.loads(hooks.queue_path.read_text(encoding="utf-8")) == []
    assert loop.store.ledger.verify()


def test_missing_eval_means_no_proposal_passes(tmp_path):
    loop, hooks, orig = make(tmp_path, eval_ok=False)
    try:
        rep = loop.run_weekly(NOW)
    finally:
        eh.measured_metrics = orig
    assert rep.pending_approval == [] and rep.rejected and any("missing_metric" in r for r in rep.rejected[0][1])


def test_empty_reviewers_means_nobody_can_approve(tmp_path):
    loop, hooks, orig = make(tmp_path, reviewers="")
    try:
        rep = loop.run_weekly(NOW)
    finally:
        eh.measured_metrics = orig
    assert any(w.startswith("no_reviewers_configured") for w in rep.warnings)
    with pytest.raises(PermissionError):
        loop.record_decision(rep.pending_approval[0], "boss", True)


def test_oa_gateway_refuses_when_wecom_not_configured():
    gw = eh.OAGateway(submit=lambda template, sha: {"submitted": False, "reason": "wecom_down"})
    with pytest.raises(RuntimeError, match="wecom_oa_not_submitted:wecom_down"):
        gw.send({"x": 1}, ["boss"])
    ok = eh.OAGateway(submit=lambda template, sha: {"submitted": True, "sp_no": "SP9"})
    assert ok.send({"x": 1}, ["boss"]) == "SP9"


def test_beat_registers_sil_only_when_enabled(monkeypatch):
    from app.tasks import celery_app as mod

    monkeypatch.delenv("SIL_ENABLED", raising=False)
    assert mod._sil_beat() == {}
    monkeypatch.setenv("SIL_ENABLED", "1")
    beat = mod._sil_beat()
    assert set(beat) == {"self-improvement-weekly", "self-improvement-monthly"}
    assert beat["self-improvement-weekly"]["task"] == "energy.domestic.self_improvement"
    assert str(beat["self-improvement-weekly"]["schedule"]).startswith("<crontab: 0 3 * * 0")
    assert mod.celery_app.conf.timezone == "Asia/Shanghai"


def test_tasks_registered():
    from app.tasks import domestic_loops  # noqa: F401  worker 启动时由 include 导入
    from app.tasks.celery_app import celery_app

    assert "energy.domestic.self_improvement" in celery_app.tasks
    assert "energy.domestic.self_improvement_monthly" in celery_app.tasks


def test_policy_114_is_registered_with_review_flag_and_links_to_136():
    reg = SourceRegistry.from_file()
    assert reg.validate() == []
    s = reg.get("policy-cn-114")
    assert s["doc_number"] == "发改价格〔2026〕114号" and s["effective_date"] == "2026-01-27"
    assert s["source_url"] == "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202601/t20260130_1403524.html"
    assert s["needs_human_verification"] and s["evidence_status"] == "legacy_unreviewed"
    assert "不低于50%" in s["content"] and "政府定价" in s["content"] and "不超过1" in s["content"]
    assert reg.get("policy-cn-136")["superseded_by"] is None  # 136 号保留，不被替代
    assert reg.get("policy-cn-136")["related_sources"][0]["source_id"] == "policy-cn-114"
    import hashlib

    assert s["snapshot_sha256"] == hashlib.sha256(s["content"].encode()).hexdigest()


def test_golden_cases_for_114_resolve_against_registry():
    from app.services.eval_runner import _load_jsonl, GOLDEN, ROOT

    rows = _load_jsonl(ROOT / "data" / "eval" / "golden_p114_v1.jsonl")
    assert len(rows) >= 8
    reg = SourceRegistry.from_file()
    for r in rows:
        blob = " ".join(str(reg.get(ref["source_id"])[k]) for ref in r["required_sources"] for k in ("content", "title"))
        assert all(x in blob for x in r["must_include"]), r["id"]
        assert r["expert_signed"] is False and r["draft"] is True
