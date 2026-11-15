"""1-1：技能门禁只读实测 eval 文件。"""
from datetime import datetime, timedelta, timezone
import json

from app.services.skill_improvement import run_cycle

NOW = datetime(2026, 10, 27, 8, 0, tzinfo=timezone.utc)
SAMPLES = [{"id": "s1", "text": "失败样本"}]


def _write(path, metrics, generated_at):
    path.write_text(json.dumps({
        "generated_at": generated_at,
        "metrics": metrics,
        "passed": True,
    }), encoding="utf-8")


def _perfect():
    return {
        "citation_accuracy": 1.0,
        "freshness_correctness": 1.0,
        "redteam_blocked": 1.0,
        "calculator_reference": 60,
        "calculator_actual": 60,
    }


def test_missing_eval_file_is_noop(tmp_path):
    result = run_cycle(SAMPLES, lambda *_: _perfect(), eval_file=tmp_path / "missing.json", now=NOW)
    assert result["status"] == "noop"
    assert result["reason"] == "no_eval"
    assert result["status"] != "canary"


def test_stale_or_incomplete_eval_is_noop(tmp_path):
    old = tmp_path / "old.json"
    _write(old, _perfect(), (NOW - timedelta(days=9)).isoformat())
    assert run_cycle(SAMPLES, lambda *_: _perfect(), eval_file=old, now=NOW)["reason"] == "no_eval"
    partial = tmp_path / "partial.json"
    metrics = _perfect()
    metrics.pop("redteam_blocked")
    _write(partial, metrics, NOW.isoformat())
    assert run_cycle(SAMPLES, lambda *_: _perfect(), eval_file=partial, now=NOW)["reason"] == "no_eval"


def test_redteam_099_is_rejected(tmp_path):
    path = tmp_path / "latest.json"
    metrics = _perfect()
    metrics["redteam_blocked"] = 0.99
    _write(path, metrics, NOW.isoformat())
    result = run_cycle(SAMPLES, lambda *_: _perfect(), eval_file=path, now=NOW)
    assert result["status"] == "rejected"
    assert "redteam_blocked" in result["verdict"]["failures"]


def test_all_gates_pass_is_canary_without_auto_deploy(tmp_path):
    path = tmp_path / "latest.json"
    _write(path, _perfect(), NOW.isoformat())
    result = run_cycle(SAMPLES, lambda *_: {}, eval_file=path, now=NOW)
    assert result["status"] == "canary"
    assert result["production_auto_deploy"] is False
