"""RAG 时效自动化 — 来源刷新报告与受控快照抓取。

``refresh_report()`` 扫描来源注册表，给出每条语料的时效档位、逾期天数
与需要重新抓取的清单，供定时任务（cron / CI）驱动语料再核验。

抓取仅允许注册表中明确标记可抓取的来源；先检查 robots.txt，再限制响应类型
与体积。新快照只能进入隔离区，不会自动覆盖生产知识库。
"""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.services.rag_sources import REGISTRY_PATH, SourceRegistry


def snapshot_sha256(content: bytes) -> str:
    """快照内容指纹：供变更检测与审计留痕。"""
    return hashlib.sha256(content).hexdigest()


def fetch_snapshot(
    source: Dict,
    quarantine_dir: Optional[Path] = None,
    client: Optional[httpx.Client] = None,
    max_bytes: int = 5_000_000,
) -> Dict:
    """受控抓取并写入隔离区；返回可审计元数据。

    来源必须显式设置 ``ingestion_policy`` 为 ``snapshot_allowed``，且
    ``license_note`` 非空。robots.txt 不允许或无法确认时一律拒绝抓取。
    """
    source_id = str(source.get("source_id", "")).strip()
    url = str(source.get("source_url", "")).strip()
    if not source_id or not url.startswith(("https://", "http://")):
        raise ValueError("source_id 与合法 http(s) source_url 为必填项")
    if source.get("ingestion_policy") != "snapshot_allowed":
        raise PermissionError("%s 未获授权进行原文快照抓取" % source_id)
    if not str(source.get("license_note", "")).strip():
        raise PermissionError("%s 缺少版权/license 说明" % source_id)

    parsed = urlparse(url)
    robots_url = "%s://%s/robots.txt" % (parsed.scheme, parsed.netloc)
    user_agent = "EnergyIntelligence-RAG-Auditor/1.0"
    owns_client = client is None
    http = client or httpx.Client(
        timeout=20.0,
        follow_redirects=True,
        headers={"User-Agent": user_agent},
    )
    try:
        robots_response = http.get(robots_url)
        if robots_response.status_code != 200:
            raise PermissionError("无法确认 robots.txt，按默认拒绝策略停止抓取")
        parser = RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(robots_response.text.splitlines())
        if not parser.can_fetch(user_agent, url):
            raise PermissionError("robots.txt 禁止抓取 %s" % url)

        response = http.get(url)
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").lower()
        allowed_types = ("text/", "application/json", "application/pdf")
        if not content_type.startswith(allowed_types):
            raise ValueError("不支持的响应类型: %s" % content_type)
        content = response.content
        if len(content) > max_bytes:
            raise ValueError("响应超过最大允许体积 %s bytes" % max_bytes)

        fetched_at = datetime.now(timezone.utc)
        digest = snapshot_sha256(content)
        root = Path(quarantine_dir or Path("data/rag_quarantine"))
        target_dir = root / source_id / fetched_at.strftime("%Y%m%dT%H%M%SZ")
        target_dir.mkdir(parents=True, exist_ok=False)
        extension = ".pdf" if "application/pdf" in content_type else ".bin"
        snapshot_path = target_dir / ("snapshot" + extension)
        snapshot_path.write_bytes(content)
        metadata = {
            "source_id": source_id,
            "state": "quarantined",
            "fetched_at": fetched_at.isoformat(),
            "http_status": response.status_code,
            "final_url": str(response.url),
            "content_type": content_type,
            "bytes": len(content),
            "sha256": digest,
            "snapshot_path": str(snapshot_path),
            "promotion_allowed": False,
        }
        (target_dir / "metadata.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return metadata
    finally:
        if owns_client:
            http.close()


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
