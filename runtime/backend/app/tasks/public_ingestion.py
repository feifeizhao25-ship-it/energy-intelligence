"""公开数据定时抓取。总开关或联系邮箱为空时不访问网络。"""

from __future__ import annotations

import os
from pathlib import Path

from app.ingestion.alerts import notify_problem
from app.ingestion.registry import load_registry
from app.ingestion.runner import run_registry
from app.ingestion.store import IngestStore
from app.tasks.celery_app import celery_app


def _path(env_name: str, default: str) -> Path:
    raw = os.environ.get(env_name, "").strip() or default
    path = Path(raw)
    parent = path.parent if path.suffix else path
    try:
        parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        fallback = Path("/tmp") / path.name
        (fallback if path.suffix == "" else fallback.parent).mkdir(parents=True, exist_ok=True)
        return fallback
    return path


@celery_app.task(name="energy.domestic.public_ingest")
def public_ingest(bucket: str) -> dict:
    if os.environ.get("PUBLIC_INGESTION_ENABLED", "").strip() != "1":
        return {"status": "noop", "reason": "未开启", "bucket": bucket}
    contact = os.environ.get("CRAWLER_CONTACT_EMAIL", "").strip()
    if not contact:
        notify_problem(bucket, "公开数据未抓取", "定时抓取已打开，但未配置联系邮箱")
        return {"status": "skipped", "reason": "未配置联系邮箱", "bucket": bucket}
    snapshot_dir = _path("NENGJIAN_PUBLIC_SNAPSHOT_DIR", "/var/lib/nengjian/public-snapshots")
    if snapshot_dir.suffix:
        snapshot_dir = snapshot_dir.parent
    database = _path("NENGJIAN_PUBLIC_INGEST_DB", "/var/lib/nengjian/public-ingest.sqlite")
    store = IngestStore(database)
    policy_db = Path(os.environ["NENGJIAN_POLICY_DB"]) if os.environ.get("NENGJIAN_POLICY_DB", "").strip() else None
    try:
        report = run_registry(
            load_registry(),
            bucket=bucket,
            contact=contact,
            dry_run=False,
            store=store,
            snapshot_dir=snapshot_dir,
            policy_db=policy_db,
        )
    finally:
        store.close()
    return {
        "status": "done",
        "bucket": bucket,
        "fetched_ok": report["fetched_ok"],
        "count": report["count"],
        "pending": sum(item.get("pending") or 0 for item in report["reports"]),
    }
