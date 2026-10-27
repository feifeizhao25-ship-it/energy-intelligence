"""
RAG 时效自动化 — 来源刷新报告与可配置抓取。

数据源不写死在代码里: 每条语料的抓取地址来自来源注册表
(rag_sources.SourceRegistry, 每条 source 的 source_url), 注册表路径可用
环境变量 RAG_REGISTRY_PATH 覆盖; 抓取行为可用以下环境变量配置:
  RAG_REFRESH_SNAPSHOT_DIR   快照落盘目录 (默认 backend/data/rag_snapshots)
  RAG_REFRESH_TIMEOUT_SECONDS 单次抓取超时 (默认 15)
  RAG_REFRESH_MAX_BYTES      单次抓取最大字节 (默认 2_000_000)
  RAG_REFRESH_RESPECT_ROBOTS 设为 0 时跳过 robots.txt 检查 (默认遵守)
  RAG_REFRESH_SOURCE_IDS     逗号分隔, 只刷新指定 source_id (默认全部 stale)

抓到的快照只落盘 + sha256 留痕, 状态记为 fetched_pending_review:
**不自动覆盖注册表语料** — 内容是否采纳仍须人工核验 (三条底线/最少人力:
机器抓取, 人只审核)。fetch_snapshot 支持注入 fetcher 供测试离线运行。
"""

from __future__ import annotations

import hashlib, json, os, re, urllib.request, urllib.robotparser
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable, Dict, List, Optional

from app.services.rag_sources import REGISTRY_PATH, SourceRegistry

USER_AGENT = "EnergyIntelligenceRAGRefresh/1.0 (+source-freshness-check)"

def snapshot_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def _default_snapshot_dir() -> Path:
    env = os.environ.get("RAG_REFRESH_SNAPSHOT_DIR")
    return Path(env) if env else Path(__file__).resolve().parents[2] / "data" / "rag_snapshots"

def _robots_allowed(url: str, timeout: float) -> bool:
    if os.environ.get("RAG_REFRESH_RESPECT_ROBOTS", "1") == "0":
        return True
    try:
        from urllib.parse import urlsplit
        parts = urlsplit(url)
        robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(robots_url)
        parser.read()
        return parser.can_fetch(USER_AGENT, url)
    except Exception:
        return True  # robots 读取失败不阻断, 但会在结果中如实记录状态

def fetch_snapshot(source: Dict, *, fetcher: Optional[Callable[[str, float], tuple]] = None,
                   snapshot_dir: Optional[Path] = None, today: Optional[date] = None) -> Dict:
    """抓取一条来源快照并落盘; 返回状态字典, 永不抛 NotImplementedError。

    fetcher(url, timeout) -> (final_url, status_code, content_bytes), 供测试注入。
    """
    source_id = source.get("source_id", "<unknown>")
    url = source.get("source_url")
    result = {"source_id": source_id, "source_url": url, "fetched_at": (today or date.today()).isoformat(), "status": "skipped"}
    if not url:
        result["status"] = "no_source_url"
        return result
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", str(source_id)):
        raise ValueError("unsafe source_id")
    timeout = float(os.environ.get("RAG_REFRESH_TIMEOUT_SECONDS", "15"))
    max_bytes = int(os.environ.get("RAG_REFRESH_MAX_BYTES", "2000000"))
    if fetcher is None and not _robots_allowed(url, timeout):
        result["status"] = "blocked_by_robots"
        return result
    try:
        if fetcher is not None:
            final_url, status_code, content = fetcher(url, timeout)
        else:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                final_url, status_code = resp.geturl(), resp.status
                content = resp.read(max_bytes + 1)
    except Exception as exc:  # 网络失败如实记录, 不编造内容
        result.update(status="fetch_failed", error=str(exc)[:300])
        return result
    truncated = len(content) > max_bytes
    content = content[:max_bytes]
    target_dir = Path(snapshot_dir) if snapshot_dir else _default_snapshot_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    snap_path = target_dir / f"{source_id}.snapshot"
    snap_path.write_bytes(content)
    meta = {"source_id": source_id, "source_url": url, "final_url": final_url, "http_status": status_code,
            "sha256": snapshot_sha256(content), "bytes": len(content), "truncated": truncated,
            "fetched_at": datetime.now(timezone.utc).isoformat(), "license_note": source.get("license_note")}
    (target_dir / f"{source_id}.meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    result.update(status="fetched_pending_review", final_url=final_url, http_status=status_code,
                  sha256=meta["sha256"], snapshot_path=str(snap_path), bytes=len(content), truncated=truncated)
    return result

def refresh_sources(registry: Optional[SourceRegistry] = None, *, today: Optional[date] = None,
                    fetcher=None, snapshot_dir: Optional[Path] = None, only_stale: bool = True) -> Dict:
    """对注册表中 stale (或全部) 来源执行抓取, 返回报告; 不自动改写注册表语料。"""
    registry = registry or SourceRegistry.from_file(REGISTRY_PATH)
    today = today or date.today()
    wanted = None
    if os.environ.get("RAG_REFRESH_SOURCE_IDS"):
        wanted = {s.strip() for s in os.environ["RAG_REFRESH_SOURCE_IDS"].split(",") if s.strip()}
    results = []
    for source in registry.sources:
        if wanted and source["source_id"] not in wanted:
            continue
        if only_stale and registry.freshness_of(source, today=today) != "stale":
            continue
        results.append(fetch_snapshot(source, fetcher=fetcher, snapshot_dir=snapshot_dir, today=today))
    return {"generated_at": today.isoformat(), "total_attempted": len(results),
            "fetched_pending_review": [r["source_id"] for r in results if r["status"] == "fetched_pending_review"],
            "results": results, "note": "快照仅落盘待人工核验, 未自动覆盖注册表语料"}

def refresh_report(registry: Optional[SourceRegistry] = None, today: Optional[date] = None,
                   registry_path: Optional[Path] = None) -> Dict:
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
            age_days = interval + 1
        days_overdue = max(age_days - interval, 0)
        needs_refetch = status == "stale"
        if needs_refetch:
            refresh_needed.append(source["source_id"])
        entries.append({"source_id": source["source_id"], "title": source["title"], "lang": source["lang"],
            "type": source.get("type"), "freshness_status": status, "verify_interval_days": interval,
            "last_verified_at": source.get("last_verified_at"), "age_days": age_days,
            "days_overdue": days_overdue, "needs_refetch": needs_refetch, "source_url": source.get("source_url")})
    review_needed = [
        source["source_id"] for source in registry.sources
        if source.get("evidence_status") in {"pending", "quarantined", "invalid"}
    ]
    allowed = [
        source["source_id"] for source in registry.sources
        if source.get("evidence_status") not in {"pending", "quarantined", "invalid"}
    ]
    return {"generated_at": today.isoformat(), "registry_path": str(registry.path) if registry.path else None,
            "total": len(entries), "counts": counts, "entries": entries, "refresh_needed": refresh_needed,
            "evidence_review_needed": review_needed, "retrieval_allowed_by_review": allowed}
