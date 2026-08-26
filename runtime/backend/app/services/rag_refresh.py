"""
RAG 时效自动化 — 来源刷新报告与抓取存根。

``refresh_report()`` 扫描来源注册表，给出每条语料的时效档位、逾期天数
与需要重新抓取的清单，供定时任务（cron / CI）驱动语料再核验。

真实抓取未实现：``fetch_snapshot`` 仅为接口存根。实现时必须遵守目标站
robots.txt 与版权/license 条款，快照落盘并计算 sha256 以便变更检测与审计。
"""

from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

from app.services.rag_sources import REGISTRY_PATH, SourceRegistry


def snapshot_sha256(content: bytes) -> str:
    """快照内容指纹：供变更检测与审计留痕。"""
    return hashlib.sha256(content).hexdigest()


def fetch_snapshot(source: Dict) -> Dict:
    """抓取来源快照（接口存根，未实现）。

    实现要求：
    - 遵守目标站 robots.txt 与 ``source["license_note"]`` 的版权条款；
    - 限速抓取，携带可识别的 User-Agent；
    - 快照原文落盘（按 source_id 归档），并用 :func:`snapshot_sha256`
      计算 sha256 写入元数据，用于变更检测与审计；
    - 记录抓取时间、HTTP 状态与最终 URL（跟随重定向后）。
    """
    raise NotImplementedError(
        "fetch_snapshot 未实现：抓取须遵守 robots.txt 与版权条款，"
        "并保存快照 + sha256（见 docstring 实现要求）。source=%s"
        % source.get("source_id", "<unknown>")
    )


def refresh_report(
    registry: Optional[SourceRegistry] = None,
    today: Optional[date] = None,
    registry_path: Optional[Path] = None,
) -> Dict:
    """扫描注册表，输出时效报告与需重新抓取的清单。"""
    today = today or date.today()
    registry = registry or SourceRegistry.from_file(registry_path or REGISTRY_PATH)

    entries: List[Dict] = []
    refresh_needed: List[str] = []
    counts = {"current": 0, "review_recommended": 0, "stale": 0}

    for source in registry.sources:
        status = registry.freshness_of(source, today=today)
        counts[status] += 1
        interval = int(source.get("verify_interval_days", 365))
        try:
            verified = date.fromisoformat(str(source.get("last_verified_at", "")))
            age_days = max((today - verified).days, 0)
        except ValueError:
            age_days = interval + 1  # 日期非法按逾期处理
        days_overdue = max(age_days - interval, 0)
        needs_refetch = status == "stale"
        if needs_refetch:
            refresh_needed.append(source["source_id"])
        entries.append({
            "source_id": source["source_id"],
            "title": source["title"],
            "lang": source["lang"],
            "type": source.get("type"),
            "freshness_status": status,
            "verify_interval_days": interval,
            "last_verified_at": source.get("last_verified_at"),
            "age_days": age_days,
            "days_overdue": days_overdue,
            "needs_refetch": needs_refetch,
            "source_url": source.get("source_url"),
        })

    return {
        "generated_at": today.isoformat(),
        "registry_path": str(registry.path) if registry.path else None,
        "total": len(entries),
        "counts": counts,
        "entries": entries,
        "refresh_needed": refresh_needed,
    }
