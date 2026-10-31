"""Celery tasks for the domestic freshness and improvement loops.

Each task returns a no-op payload when its switch or credentials are absent.
Publishing switches live in ops.switches and stay off.
"""
from __future__ import annotations

from app.tasks.celery_app import celery_app


@celery_app.task(name="energy.domestic.skill_improvement")
def skill_improvement() -> dict:
    """Read the latest measured eval file. Never invent a passing score."""
    from app.services.feedback_samples import load_samples
    from app.services.skill_improvement import eval_latest_path, run_cycle

    return run_cycle(load_samples(), lambda *_args: {}, eval_file=eval_latest_path())


@celery_app.task(name="energy.domestic.policy_snapshot")
def policy_snapshot() -> dict:
    from app.services.policy_pipeline import run_scheduled_cycle
    return run_scheduled_cycle()


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
    """十五分钟回查。没有待审批单号时不访问企业微信。"""
    import os
    from pathlib import Path

    from app.services.policy_pipeline import connect, publish_matching_approval
    from app.services.wecom_callback import fetch_detail

    path = Path(os.environ.get("NENGJIAN_POLICY_DB", "/var/lib/nengjian/policy.sqlite"))
    if not path.is_file():
        return {"status": "noop", "checked": 0, "published": 0}
    conn = connect(path)
    try:
        rows = conn.execute(
            """SELECT DISTINCT approval_id FROM policy_snapshots
               WHERE status = 'pending_approval' AND approval_id IS NOT NULL AND approval_id != ''"""
        ).fetchall()
        published = 0
        for row in rows:
            detail = fetch_detail(row["approval_id"])
            result = publish_matching_approval(conn, detail, row["approval_id"])
            published += 1 if result.get("published") else 0
        return {"status": "checked", "checked": len(rows), "published": published}
    finally:
        conn.close()


@celery_app.task(name="energy.domestic.nasa_batch")
def nasa_batch() -> dict:
    from app.services.nasa_batch_import import cache_path, default_points, run_batch
    return run_batch(default_points(), cache_path())


@celery_app.task(name="energy.domestic.self_improvement")
def self_improvement() -> dict:
    """每周自改进（默认关闭，SIL_ENABLED=1 才运行）。用户可见改动必须经企业微信审批，超时作废。"""
    from app.self_improve.hooks import run_weekly
    return run_weekly()


@celery_app.task(name="energy.domestic.self_improvement_monthly")
def self_improvement_monthly() -> dict:
    from app.self_improve.hooks import run_monthly
    return run_monthly()


@celery_app.task(name="energy.domestic.library_check")
def library_check() -> dict:
    """资料库每日来源核对（挂在 SIL 的 daily_scan 槽，每日 02:00）。LIBRARY_FRESHNESS_ENABLED=1 才运行；只写状态文件，不改条目。"""
    from app.self_improve.library_job import run_check
    return run_check()


@celery_app.task(name="energy.domestic.library_discover")
def library_discover() -> dict:
    """资料库每周发现新文件（挂在 SIL 的 weekly_cycle 槽，周日 03:00）。只暂存标题/链接为「待核实 + 待审核」候选。"""
    from app.self_improve.library_job import run_discover
    return run_discover()


@celery_app.task(name="energy.domestic.golden_eval")
def golden_eval() -> dict:
    """每周金标准评测（周日 03:30）。SIL_ENABLED=1 才运行；只写评测结果和工作清单，不改任何内容、不当发布门禁。"""
    from app.self_improve.continuous import run_golden
    return run_golden()


@celery_app.task(name="energy.domestic.stale_scan")
def stale_scan() -> dict:
    """每日陈旧扫描（02:30）：资料库 + 暂存区 + RAG 来源。只读，只写报告。"""
    from app.self_improve.continuous import run_stale
    return run_stale()


@celery_app.task(name="energy.domestic.radar_stage")
def radar_stage() -> dict:
    """每周三 06:00：把雷达线索暂存成“待审核”线索（不是条目，不可见，不自动通过）。"""
    from app.self_improve.continuous import run_radar_stage
    return run_radar_stage()


@celery_app.task(name="energy.domestic.monthly_report")
def monthly_report() -> dict:
    """每月 1 日 05:00：上月改进报告（md + json + pdf；国内版中文、国际版英文各一份）。"""
    from app.self_improve.continuous import run_monthly_report
    return run_monthly_report()


@celery_app.task(name="energy.domestic.radar")
def radar() -> dict:
    """每周三 05:00：研究雷达（只访问 arXiv / GitHub / Hugging Face 白名单，只写摘要和结构化线索，不入库、不发消息）。"""
    from app.self_improve.continuous import run_radar
    return run_radar()
