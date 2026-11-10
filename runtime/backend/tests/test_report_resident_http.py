"""Resident uvicorn workers over TCP. Skipped unless the isolated Postgres URL is set."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
URL = os.environ.get("REPORT_MP_DATABASE_URL", "")

pytestmark = pytest.mark.skipif(
    not URL.startswith("postgresql") or "energy_cn" in URL or not URL.endswith("energy_report_mp_112"),
    reason="needs the isolated energy_report_mp_112 database",
)


def test_resident_workers_over_tcp():
    env = os.environ.copy()
    env["REPORT_MP_DATABASE_URL"] = URL
    env["PYTHONPATH"] = str(BACKEND)
    env.pop("DATABASE_URL", None)
    completed = subprocess.run(
        [sys.executable, str(BACKEND / "scripts" / "report_resident_http.py")],
        cwd=str(BACKEND), env=env, text=True, timeout=240, check=False,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
    )
    print(completed.stdout or "")
    if completed.returncode != 0:
        raise AssertionError((completed.stdout or "")[-4000:])
    assert "uvicorn_started_server_process=4" in (completed.stdout or "")
    assert "last_slot statuses=200:1,429:7" in (completed.stdout or "")
    for plan in ("full", "team", "enterprise"):
        assert f"unlimited_{plan} statuses=200:4 usage_before=5 usage_after=5" in (completed.stdout or "")
