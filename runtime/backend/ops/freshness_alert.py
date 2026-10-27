"""时效看板告警。违约项写入记录；连续两天未处理才升级。

企业微信密钥缺失时不外发。
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

from app.services.freshness_board import compliance_report

_RECORDS: list[dict] = []


def record_dir() -> Path:
    path = Path("/tmp/nengjian-freshness-alerts")
    path.mkdir(parents=True, exist_ok=True)
    return path


def collect(records: list[dict], today: date | None = None) -> dict:
    today = today or date.today()
    report = compliance_report(records, today)
    breaches = [row for row in report["types"] if row["status"] == "未达标"]
    entry = {"date": today.isoformat(), "breaches": [row["id"] for row in breaches], "escalated": []}
    prior = [item for item in _RECORDS if item["date"] == (today - timedelta(days=1)).isoformat()]
    if prior:
        still = set(prior[-1]["breaches"]) & set(entry["breaches"])
        entry["escalated"] = sorted(still)
    _RECORDS.append(entry)
    path = record_dir() / f"{today.isoformat()}.json"
    path.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    return {"report": report, "alert": entry, "sent": False, "reason": "wecom_pending_or_unconfigured"}


def reset_alerts() -> None:
    _RECORDS.clear()
