"""Several OS processes hit POST /api/v1/reports/generate on one PostgreSQL.

This does not run under the default sqlite fixture. Set REPORT_MP_DATABASE_URL
to an empty database named energy_report_mp_112. The workers refuse energy_cn.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
WORKER = BACKEND / "scripts" / "report_mp_worker.py"
URL = os.environ.get("REPORT_MP_DATABASE_URL", "")
# Evidence log. Set REPORT_MP_LOG to keep it somewhere specific; default is the temp dir
# so the test also runs outside the cloud-agent VM (no /opt/cursor there).
LOG = Path(os.environ.get("REPORT_MP_LOG") or Path(tempfile.gettempdir()) / "report_mp_112.log")

pytestmark = pytest.mark.skipif(
    not URL.startswith("postgresql") or "energy_cn" in URL or not URL.endswith("energy_report_mp_112"),
    reason="needs an isolated PostgreSQL database named energy_report_mp_112",
)


def _run(action: str, payload: dict | None = None, reports_dir: str = "/tmp/report-mp-112-files") -> dict:
    env = os.environ.copy()
    env["REPORT_MP_DATABASE_URL"] = URL
    env["REPORTS_DIR"] = reports_dir
    env["PYTHONPATH"] = str(BACKEND)
    env.pop("DATABASE_URL", None)
    completed = subprocess.run(
        [sys.executable, str(WORKER), action, json.dumps(payload or {})],
        cwd=str(BACKEND), env=env, capture_output=True, text=True, timeout=180, check=False,
    )
    if completed.returncode != 0:
        raise AssertionError(completed.stderr[-4000:] or completed.stdout[-1000:])
    return json.loads(completed.stdout)


def _parallel(action: str, payloads: list[dict], reports_dir: str) -> list[dict]:
    env = os.environ.copy()
    env["REPORT_MP_DATABASE_URL"] = URL
    env["REPORTS_DIR"] = reports_dir
    env["PYTHONPATH"] = str(BACKEND)
    env.pop("DATABASE_URL", None)
    processes = [
        subprocess.Popen(
            [sys.executable, str(WORKER), action, json.dumps(payload)],
            cwd=str(BACKEND), env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        )
        for payload in payloads
    ]
    results = []
    for process in processes:
        stdout, stderr = process.communicate(timeout=180)
        if process.returncode != 0:
            raise AssertionError(stderr[-4000:] or stdout[-1000:])
        results.append(json.loads(stdout))
    return results


def _statuses(rows: list[dict]) -> dict:
    counts: dict[int, int] = {}
    for row in rows:
        counts[row["status"]] = counts.get(row["status"], 0) + 1
    return counts


def test_postgres_processes_share_one_monthly_slot(tmp_path):
    reports_dir = str(tmp_path / "reports")
    os.makedirs(reports_dir, exist_ok=True)
    lines = []
    boot = _run("bootstrap", reports_dir=reports_dir)
    lines.append(f"database={boot['database']} owner={boot['owner_id']} other={boot['other_id']}")
    owner = boot["owner_id"]
    other = boot["other_id"]
    project_id = boot["project_id"]

    _run("set-usage", {"user_id": owner, "used": 2}, reports_dir)
    assert _run("usage", {"user_id": owner}, reports_dir)["used"] == 2
    raced = _parallel("post", [
        {"token": boot["owner_token"], "project_id": project_id, "mode": "normal"} for _ in range(6)
    ], reports_dir)
    race_counts = _statuses(raced)
    race_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"last_slot processes={len({row['pid'] for row in raced})} statuses={race_counts} usage_after={race_used}")
    assert race_counts == {200: 1, 429: 5}
    assert race_used == 3
    assert len({row["pid"] for row in raced}) == 6

    stolen = _run("post", {"token": boot["other_token"], "project_id": project_id, "mode": "normal"}, reports_dir)
    other_used = _run("usage", {"user_id": other}, reports_dir)["used"]
    owner_after_steal = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"cross_user status={stolen['status']} owner_usage={owner_after_steal} other_usage={other_used}")
    assert stolen["status"] == 404
    assert owner_after_steal == 3
    assert other_used == 0

    _run("set-usage", {"user_id": owner, "used": 0}, reports_dir)
    held = _run("post", {"token": boot["owner_token"], "project_id": project_id, "mode": "hold"}, reports_dir)
    assert held["status"] == 200, held
    assert _run("usage", {"user_id": owner}, reports_dir)["used"] == 1
    cancelled = _parallel("delete", [
        {"token": boot["owner_token"], "report_id": held["report_id"]} for _ in range(2)
    ], reports_dir)
    cancel_counts = _statuses(cancelled)
    cancel_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"cancel processes={len({row['pid'] for row in cancelled})} statuses={cancel_counts} usage_after={cancel_used}")
    assert cancel_counts == {200: 1, 404: 1}
    assert cancel_used == 0

    retried = _run("post", {"token": boot["owner_token"], "project_id": project_id, "mode": "normal"}, reports_dir)
    retry_state = _run("status", {"token": boot["owner_token"], "report_id": retried["report_id"]}, reports_dir)
    retry_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"retry_after_cancel http={retried['status']} report={retry_state['report_status']} usage={retry_used}")
    assert retried["status"] == 200
    assert retry_state["report_status"] == "completed"
    assert retry_used == 1

    _run("set-usage", {"user_id": owner, "used": 0}, reports_dir)
    failed = _run("post", {"token": boot["owner_token"], "project_id": project_id, "mode": "fail"}, reports_dir)
    failed_state = _run("status", {"token": boot["owner_token"], "report_id": failed["report_id"]}, reports_dir)
    failed_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"render_fail http={failed['status']} report={failed_state['report_status']} usage_after={failed_used}")
    assert failed["status"] == 200
    assert failed_state["report_status"] == "failed"
    assert failed_used == 0
    removed = _parallel("delete", [
        {"token": boot["owner_token"], "report_id": failed["report_id"]} for _ in range(2)
    ], reports_dir)
    remove_counts = _statuses(removed)
    remove_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"delete_failed statuses={remove_counts} usage_after={remove_used}")
    assert remove_counts == {200: 1, 404: 1}
    assert remove_used == 0

    again = _run("post", {"token": boot["owner_token"], "project_id": project_id, "mode": "normal"}, reports_dir)
    again_state = _run("status", {"token": boot["owner_token"], "report_id": again["report_id"]}, reports_dir)
    again_used = _run("usage", {"user_id": owner}, reports_dir)["used"]
    lines.append(f"retry_after_fail http={again['status']} report={again_state['report_status']} usage={again_used}")
    assert again["status"] == 200
    assert again_state["report_status"] == "completed"
    assert again_used == 1

    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
