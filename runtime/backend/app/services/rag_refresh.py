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
    superseded = [src["source_id"] for src in registry.sources if src.get("superseded_by") or src.get("status") in {"被替代", "废止"}]
    # 每月复核清单：逾期未核验的政策来源。复核本身要人对照官方原文做，这里只列出清单。
    monthly_review = [e["source_id"] for e in entries if e["type"] == "policy" and e["freshness_status"] != "current"]
    return {"generated_at": today.isoformat(), "registry_path": str(registry.path) if registry.path else None,
            "total": len(entries), "counts": counts, "entries": entries, "refresh_needed": refresh_needed,
            "superseded": superseded, "monthly_review_due": monthly_review,
            "evidence_review_needed": review_needed, "retrieval_allowed_by_review": allowed}


WEEKLY_CATALOG_PATH = Path(__file__).resolve().parent / "energy_weekly_sources.json"
_CANDIDATE_FIELDS = (
    "url", "doi", "publisher", "excerpt", "published_at", "retrieved_at",
    "effective_at", "expires_at", "region", "content_hash", "license",
)


def _load_weekly_catalog(path: Optional[Path] = None) -> Dict:
    catalog_path = Path(path) if path else WEEKLY_CATALOG_PATH
    return json.loads(catalog_path.read_text(encoding="utf-8"))


def _production_roots() -> List[Path]:
    roots = [REGISTRY_PATH.resolve().parent]
    skills = Path(__file__).resolve().parents[2] / "skills"
    if skills.exists():
        roots.append(skills.resolve())
    return roots


def _refuse_production_dir(target: Path) -> Path:
    """Candidates may not be written into the production registry or skills tree."""
    root = Path(target).resolve()
    for banned in _production_roots():
        if root == banned or banned in root.parents:
            raise PermissionError("refusing to write candidates into production RAG or skills: %s" % root)
    return root


def _snapshot_bytes(paths: List[Path]) -> Dict[str, Optional[bytes]]:
    out: Dict[str, Optional[bytes]] = {}
    for path in paths:
        key = str(Path(path).resolve()) if Path(path).exists() else str(path)
        out[key] = Path(path).read_bytes() if Path(path).exists() else None
    return out


def _assert_unchanged(before: Dict[str, Optional[bytes]]) -> None:
    for key, content in before.items():
        path = Path(key)
        current = path.read_bytes() if path.exists() else None
        if current != content:
            raise RuntimeError("production path changed during candidate harvest: %s" % key)


def harvest_weekly(
    *,
    candidates_dir: Path,
    today: Optional[date] = None,
    fetcher: Optional[Callable[[str], bytes]] = None,
    catalog_path: Optional[Path] = None,
    production_paths: Optional[List[Path]] = None,
) -> Dict:
    """Write the energy weekly sources into ``candidates_dir`` only.

    Records stay unpublished. The reviewer field is empty and the status is
    待审核. A fetcher, when injected, supplies bytes for the content hash and
    is not required. This function does not update the RAG registry or skills.
    """
    today = today or date.today()
    root = _refuse_production_dir(candidates_dir)
    catalog = _load_weekly_catalog(catalog_path)
    blocked = {u.rstrip("/") for u in catalog.get("blocked_urls", [])}
    watched = list(production_paths or [])
    if REGISTRY_PATH.exists():
        watched.append(REGISTRY_PATH)
    before = _snapshot_bytes(watched)
    previous: Dict[str, str] = {}
    manifest_path = root / "manifest.json"
    if manifest_path.exists():
        previous = {row["id"]: row["content_hash"] for row in json.loads(manifest_path.read_text(encoding="utf-8")).get("candidates", [])}

    written: List[Dict] = []
    skipped: List[Dict] = []
    root.mkdir(parents=True, exist_ok=True)
    for source in catalog["sources"]:
        url = str(source.get("url", "")).strip()
        if url.rstrip("/") in blocked or url in blocked:
            skipped.append({"id": source.get("id"), "url": url, "status": "blocked_unverified_url"})
            continue
        body = None
        fetch_status = "not_fetched"
        if fetcher is not None:
            try:
                body = fetcher(url)
                fetch_status = "fetched"
            except Exception as exc:
                fetch_status = "fetch_failed"
                body = None
                source = {**source, "fetch_error": str(exc)[:300]}
        raw = body if body is not None else str(source.get("excerpt", "")).encode("utf-8")
        record = {
            "id": source["id"],
            "product": source.get("product", catalog.get("product", "energy")),
            "url": url,
            "doi": source.get("doi") or "",
            "publisher": source.get("publisher", ""),
            "excerpt": source.get("excerpt", ""),
            "published_at": source.get("published_at") or "",
            "retrieved_at": today.isoformat(),
            "effective_at": source.get("effective_at") or "",
            "expires_at": source.get("expires_at") or "",
            "region": source.get("region", ""),
            "content_hash": snapshot_sha256(raw),
            "license": source.get("license", ""),
            "language": source.get("language", ""),
            "reviewer": "",
            "review_status": "待审核",
            "state": "unpublished",
            "fetch_status": fetch_status,
        }
        if source.get("fetch_error"):
            record["fetch_error"] = source["fetch_error"]
        for field in _CANDIDATE_FIELDS:
            if field not in record:
                raise RuntimeError("candidate missing %s" % field)
        path = root / ("%s.json" % record["id"])
        path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(record)

    added = [row["id"] for row in written if row["id"] not in previous]
    changed = [row["id"] for row in written if row["id"] in previous and previous[row["id"]] != row["content_hash"]]
    unchanged = [row["id"] for row in written if row["id"] in previous and previous[row["id"]] == row["content_hash"]]
    removed = [cid for cid in previous if cid not in {row["id"] for row in written}]
    report = {
        "generated_at": today.isoformat(),
        "state": "unpublished",
        "reviewer": "",
        "review_status": "待审核",
        "added": added,
        "changed": changed,
        "unchanged": unchanged,
        "removed": removed,
        "skipped": skipped,
        "conflicts": catalog.get("conflicts", []),
        "note": "候选未发布，未写入生产 RAG 或 skills。复核人留空。",
        "production_written": False,
    }
    (root / "diff-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = {"generated_at": today.isoformat(), "state": "unpublished", "candidates": [{"id": row["id"], "content_hash": row["content_hash"]} for row in written]}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    _assert_unchanged(before)
    return report


def publish_candidates(
    reviewer_signature: str,
    *,
    candidates_dir: Path,
    production_paths: Optional[List[Path]] = None,
) -> Dict:
    """Queue a publish request. An empty signature is refused.

    Even with a signature, this does not copy candidates into the production
    RAG registry or skills. Candidate reviewer fields stay empty / 待审核.
    """
    if reviewer_signature is None or not str(reviewer_signature).strip():
        raise ValueError("refusing publish: reviewer_signature is empty")
    root = _refuse_production_dir(candidates_dir)
    watched = list(production_paths or [])
    if REGISTRY_PATH.exists():
        watched.append(REGISTRY_PATH)
    before = _snapshot_bytes(watched)
    receipt = {
        "state": "queued_unpublished",
        "production_written": False,
        "signature_accepted": True,
        "reviewer_on_candidates": "",
        "review_status": "待审核",
        "note": "签名只放行队列记录，不覆盖生产 RAG 或 skills，也不填写复核人姓名。",
    }
    (root / "publish-receipt.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for path in root.glob("*.json"):
        if path.name in {"diff-report.json", "manifest.json", "publish-receipt.json"}:
            continue
        row = json.loads(path.read_text(encoding="utf-8"))
        if row.get("reviewer") or row.get("review_status") != "待审核" or row.get("state") != "unpublished":
            raise RuntimeError("publish must leave candidates unpublished and reviewer empty")
    _assert_unchanged(before)
    return receipt
