"""Drive a resident multi-worker uvicorn process over real TCP.

This is not an in-process ASGI client. Each request is an HTTP call to
127.0.0.1. Workers are separate OS processes started by uvicorn.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

BACKEND = Path(__file__).resolve().parents[1]
WORKER = BACKEND / "scripts" / "report_mp_worker.py"
URL = os.environ.get("REPORT_MP_DATABASE_URL", "")
HOST = "127.0.0.1"
PORT = int(os.environ.get("REPORT_RESIDENT_PORT", "8097"))
WORKERS = int(os.environ.get("REPORT_RESIDENT_WORKERS", "4"))
BASE = f"http://{HOST}:{PORT}"
LOG = Path(os.environ.get("REPORT_RESIDENT_LOG") or Path(tempfile.gettempdir()) / "report_resident_http.log")
UVICORN_LOG = Path("/tmp/report-resident-uvicorn.log")


def _refuse() -> None:
    if not URL.startswith("postgresql") or "energy_cn" in URL or not URL.endswith("energy_report_mp_112"):
        raise SystemExit("REPORT_MP_DATABASE_URL must be the isolated energy_report_mp_112 database")


def _worker(action: str, payload: dict | None = None, reports_dir: str = "/tmp/report-resident-files") -> dict:
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
        raise SystemExit(completed.stderr[-4000:] or completed.stdout[-1000:])
    return json.loads(completed.stdout)


def _start_server(reports_dir: str, delay: str) -> subprocess.Popen:
    UVICORN_LOG.parent.mkdir(parents=True, exist_ok=True)
    log = open(UVICORN_LOG, "w", encoding="utf-8", buffering=1)
    env = os.environ.copy()
    env["DATABASE_URL"] = URL
    env["ENVIRONMENT"] = "test"
    env["APP_ENV"] = "test"
    env["PYTHONUNBUFFERED"] = "1"
    env["REPORTS_DIR"] = reports_dir
    env["PYTHONPATH"] = str(BACKEND)
    env.pop("ENERGY_TEST_MODE", None)
    if delay:
        env["REPORT_TASK_DELAY_SECONDS"] = delay
    else:
        env.pop("REPORT_TASK_DELAY_SECONDS", None)
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(PORT), "--workers", str(WORKERS)],
        cwd=str(BACKEND), env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True,
    )
    deadline = time.time() + 40
    while time.time() < deadline:
        if process.poll() is not None:
            raise SystemExit(UVICORN_LOG.read_text(encoding="utf-8")[-4000:])
        try:
            response = httpx.get(f"{BASE}/api/v1/reports/templates", timeout=2)
            ready = response.status_code == 200
        except httpx.HTTPError:
            ready = False
        # The first worker can answer before the others have logged startup.
        # Count workers after they have all started, not on the first 200.
        if ready and _worker_count() >= WORKERS:
            return process
        time.sleep(0.3)
    raise SystemExit(UVICORN_LOG.read_text(encoding="utf-8")[-4000:])


def _stop_server(process: subprocess.Popen) -> None:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=15)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid, signal.SIGKILL)
        process.wait(timeout=10)


def _worker_count() -> int:
    text = UVICORN_LOG.read_text(encoding="utf-8", errors="replace") if UVICORN_LOG.exists() else ""
    return text.count("Started server process")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _project(client: httpx.Client, token: str) -> str:
    created = client.post("/api/v1/projects", headers=_auth(token), json={
        "name": "常驻服务项目", "technology": "solar", "capacity_kw": 1000,
        "location": {"latitude": 23.1, "longitude": 113.3, "address": "广州"},
    })
    if created.status_code != 201:
        raise SystemExit(created.text)
    project_id = created.json()["data"]["id"]
    saved = client.post(f"/api/v1/finance/models/{project_id}", headers=_auth(token), json={
        "capacity_mw": 100, "capex_per_w": 1.1, "opex_per_kw_yr": 17,
        "electricity_price": 45, "capacity_factor": 0.25, "currency": "CNY",
        "data_sources": [{
            "title": "公开电价通知",
            "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html",
            "retrieved_at": "2026-11-07",
        }],
    })
    if saved.status_code != 200:
        raise SystemExit(saved.text)
    return project_id


def _post(client: httpx.Client, token: str, project_id: str, fmt: str) -> httpx.Response:
    return client.post("/api/v1/reports/generate", headers=_auth(token), json={
        "project_id": project_id, "report_type": "feasibility", "format": fmt,
    })


def _counts(responses: list[httpx.Response]) -> str:
    counts: dict[int, int] = {}
    for response in responses:
        counts[response.status_code] = counts.get(response.status_code, 0) + 1
    return ",".join(f"{code}:{counts[code]}" for code in sorted(counts))


def main() -> None:
    _refuse()
    reports_dir = "/tmp/report-resident-files"
    os.makedirs(reports_dir, mode=0o755, exist_ok=True)
    os.chmod(reports_dir, 0o755)
    lines: list[str] = []
    boot = _worker("bootstrap", reports_dir=reports_dir)
    lines.append(f"database={boot['database']} workers_requested={WORKERS} base={BASE}")
    owner = boot["owner_id"]
    project_id = boot["project_id"]
    server = _start_server(reports_dir, delay="")
    try:
        started = _worker_count()
        lines.append(f"uvicorn_started_server_process={started}")
        if started != WORKERS:
            raise SystemExit(f"expected {WORKERS} workers, log shows {started}")
        with httpx.Client(base_url=BASE, timeout=60) as client:
            _worker("set-usage", {"user_id": owner, "used": 2}, reports_dir)

            def _race(_: int) -> httpx.Response:
                with httpx.Client(base_url=BASE, timeout=60) as local:
                    return _post(local, boot["owner_token"], project_id, "pdf")

            with ThreadPoolExecutor(max_workers=8) as pool:
                raced = list(pool.map(_race, range(8)))
            race_counts = _counts(raced)
            race_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
            lines.append(f"last_slot statuses={race_counts} usage_after={race_used}")
            if race_counts != "200:1,429:7" or race_used != 3:
                raise SystemExit("last slot mismatch\n" + "\n".join(lines))

            stolen = _post(client, boot["other_token"], project_id, "docx")
            other_used = _worker("usage", {"user_id": boot["other_id"]}, reports_dir)["used"]
            owner_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
            lines.append(f"cross_user status={stolen.status_code} owner_usage={owner_used} other_usage={other_used}")
            if stolen.status_code != 404 or owner_used != 3 or other_used != 0:
                raise SystemExit("cross user mismatch\n" + "\n".join(lines))

            pro = _worker("insert-user", {"plan": "pro"}, reports_dir)
            pro_project = _project(client, pro["token"])
            word = _post(client, pro["token"], pro_project, "docx")
            if word.status_code != 200:
                raise SystemExit(word.text)
            report_id = word.json()["data"]["report_id"]
            downloaded = client.get(f"/api/v1/reports/{report_id}/file", headers=_auth(pro["token"]))
            pro_used = _worker("usage", {"user_id": pro["user_id"]}, reports_dir)["used"]
            lines.append(
                f"pro_word http={word.status_code} download={downloaded.status_code} "
                f"bytes={len(downloaded.content)} zip={downloaded.content[:2] == b'PK'} "
                f"docx_name={'word/document.xml' in downloaded.content.decode('latin1')} usage={pro_used}"
            )
            if downloaded.status_code != 200 or downloaded.content[:2] != b"PK" or b"word/document.xml" not in downloaded.content or pro_used != 1:
                raise SystemExit("pro word mismatch\n" + "\n".join(lines))

            for plan in ("full", "team", "enterprise"):
                account = _worker("insert-user", {"plan": plan}, reports_dir)
                _worker("set-usage", {"user_id": account["user_id"], "used": 5}, reports_dir)
                plan_project = _project(client, account["token"])
                unlimited = [_post(client, account["token"], plan_project, "pdf") for _ in range(4)]
                plan_used = _worker("usage", {"user_id": account["user_id"]}, reports_dir)["used"]
                lines.append(f"unlimited_{plan} statuses={_counts(unlimited)} usage_before=5 usage_after={plan_used}")
                if _counts(unlimited) != "200:4" or plan_used != 5:
                    raise SystemExit(f"unlimited {plan} mismatch\n" + "\n".join(lines))

            _worker("set-usage", {"user_id": owner, "used": 0}, reports_dir)
            os.chmod(reports_dir, 0o555)
            failed = _post(client, boot["owner_token"], project_id, "pdf")
            failed_id = failed.json()["data"]["report_id"]
            failed_state = client.get(f"/api/v1/reports/{failed_id}", headers=_auth(boot["owner_token"]))
            failed_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
            lines.append(
                f"render_fail http={failed.status_code} report={failed_state.json().get('data', {}).get('status')} "
                f"usage_after={failed_used}"
            )
            os.chmod(reports_dir, 0o755)
            if failed.status_code != 200 or failed_state.json().get("data", {}).get("status") != "failed" or failed_used != 0:
                raise SystemExit("render fail mismatch\n" + "\n".join(lines))
            retried = _post(client, boot["owner_token"], project_id, "pdf")
            retried_id = retried.json()["data"]["report_id"]
            retried_state = client.get(f"/api/v1/reports/{retried_id}", headers=_auth(boot["owner_token"]))
            retried_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
            lines.append(
                f"retry_after_fail http={retried.status_code} report={retried_state.json().get('data', {}).get('status')} "
                f"usage={retried_used}"
            )
            if retried.status_code != 200 or retried_state.json().get("data", {}).get("status") != "completed" or retried_used != 1:
                raise SystemExit("retry mismatch\n" + "\n".join(lines))
    finally:
        _stop_server(server)

    os.chmod(reports_dir, 0o755)
    delayed = _start_server(reports_dir, delay="3")
    try:
        started = _worker_count()
        lines.append(f"delay_server uvicorn_started_server_process={started} delay_seconds=3")
        if started != WORKERS:
            raise SystemExit(f"delay server workers {started}")
        _worker("set-usage", {"user_id": owner, "used": 0}, reports_dir)
        box: dict = {}

        def _fire() -> None:
            with httpx.Client(base_url=BASE, timeout=30) as client:
                box["response"] = _post(client, boot["owner_token"], project_id, "pdf")

        thread = threading.Thread(target=_fire)
        thread.start()
        report_id = None
        for _ in range(40):
            found = _worker("generating", {"user_id": owner}, reports_dir)["ids"]
            if found:
                report_id = found[0]
                break
            time.sleep(0.1)
        if report_id is None:
            thread.join(timeout=20)
            raise SystemExit("generating report was not visible before the response finished\n" + "\n".join(lines))
        with httpx.Client(base_url=BASE, timeout=30) as client:
            deleted = client.delete(f"/api/v1/reports/{report_id}", headers=_auth(boot["owner_token"]))
        thread.join(timeout=20)
        time.sleep(3.5)
        cancel_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
        lines.append(f"cancel_while_generating delete={deleted.status_code} usage_after={cancel_used} report_id={report_id}")
        if deleted.status_code != 200 or cancel_used != 0:
            raise SystemExit("cancel mismatch\n" + "\n".join(lines))
        with httpx.Client(base_url=BASE, timeout=30) as client:
            again = _post(client, boot["owner_token"], project_id, "pdf")
            again_id = again.json()["data"]["report_id"]
            again_status = "generating"
            for _ in range(20):
                again_state = client.get(f"/api/v1/reports/{again_id}", headers=_auth(boot["owner_token"]))
                again_status = again_state.json().get("data", {}).get("status")
                if again_status == "completed":
                    break
                time.sleep(0.5)
        again_used = _worker("usage", {"user_id": owner}, reports_dir)["used"]
        lines.append(f"retry_after_cancel http={again.status_code} report={again_status} usage={again_used}")
        if again.status_code != 200 or again_status != "completed" or again_used != 1:
            raise SystemExit("cancel retry mismatch\n" + "\n".join(lines))
    finally:
        _stop_server(delayed)

    LOG.parent.mkdir(parents=True, exist_ok=True)
    LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
