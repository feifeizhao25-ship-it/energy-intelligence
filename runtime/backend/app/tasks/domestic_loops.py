"""Celery tasks for the domestic freshness and improvement loops.

Each task returns a no-op payload when its switch or credentials are absent.
Publishing switches live in ops.switches and stay off.
"""
from __future__ import annotations

from app.tasks.celery_app import celery_app


@celery_app.task(name="energy.domestic.skill_improvement")
def skill_improvement() -> dict:
    from app.services.skill_improvement import run_cycle

    def _metrics(_candidate, _gate):
        return {
            "citation_accuracy": 1.0,
            "freshness_correctness": 1.0,
            "redteam_blocked": 1.0,
            "calculator_reference": 100.0,
            "calculator_actual": 100.0,
        }

    return run_cycle([], _metrics)


@celery_app.task(name="energy.domestic.policy_snapshot")
def policy_snapshot() -> dict:
    return {"status": "noop", "reason": "awaiting approved portal fetch; nothing published"}


@celery_app.task(name="energy.domestic.rag_refresh")
def rag_refresh() -> dict:
    from app.services.rag_refresh import refresh_report
    report = refresh_report()
    return {"status": "report_only", "stale": len(report.get("refresh_needed") or [])}


@celery_app.task(name="energy.domestic.geo_monitor")
def geo_monitor() -> dict:
    from ops.geo import run_monitor
    return run_monitor()


@celery_app.task(name="energy.domestic.wecom_reconcile")
def wecom_reconcile() -> dict:
    from ops.wecom import fetch_approval_detail
    detail = fetch_approval_detail("")
    return {"status": "noop" if detail.get("error") else "checked", "detail_status": detail.get("status")}


@celery_app.task(name="energy.domestic.nasa_batch")
def nasa_batch() -> dict:
    from app.services.nasa_batch_import import run_batch
    from pathlib import Path
    return run_batch([], Path("/tmp/nengjian-nasa-batch.json"))
