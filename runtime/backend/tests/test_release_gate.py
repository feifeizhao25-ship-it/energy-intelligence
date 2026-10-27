"""1-8：失败的 latest.json 让部署脚本退出码非 0。"""
import json
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SPEC = importlib.util.spec_from_file_location("require_eval_gate", ROOT / "deploy" / "require_eval_gate.py")
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)

NOW = datetime(2026, 10, 27, tzinfo=timezone.utc)


def test_failed_gate_exits_nonzero(tmp_path):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps({
        "generated_at": NOW.isoformat(),
        "passed": False,
        "gates": {"redteam_blocked": False},
    }), encoding="utf-8")
    assert gate.evaluate(path, now=NOW) != 0


def test_passing_fresh_gate_exits_zero(tmp_path):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps({
        "generated_at": NOW.isoformat(),
        "passed": True,
        "gates": {"redteam_blocked": True, "calculator": True},
    }), encoding="utf-8")
    assert gate.evaluate(path, now=NOW) == 0


def test_stale_gate_exits_nonzero(tmp_path):
    path = tmp_path / "latest.json"
    path.write_text(json.dumps({
        "generated_at": (NOW - timedelta(days=9)).isoformat(),
        "passed": True,
        "gates": {"redteam_blocked": True},
    }), encoding="utf-8")
    assert gate.evaluate(path, now=NOW) != 0
