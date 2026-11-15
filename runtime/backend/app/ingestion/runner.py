"""按登记表抓取一个样本并解析。试运行不写入已接受记录。"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urljoin, urlsplit, urlunsplit, parse_qsl, urlencode

from app.ingestion.alerts import notify_problem
from app.ingestion.http_client import PoliteClient
from app.ingestion.parsers import SchemaDrift, parse
from app.ingestion.snapshots import save_snapshot
from app.ingestion.store import IngestStore, classify_single
from app.services.freshness_board import badge

def _fetched_date(moment: str) -> str:
    return moment[:10]


def expand_dated_url(url: str, moment: str) -> str:
    """把 {from}/{until} 换成抓取日的前一天和当天。没有占位符时原样返回。"""
    if "{from}" not in url and "{until}" not in url:
        return url
    try:
        day = datetime.fromisoformat(moment).date()
    except ValueError:
        day = datetime.now(timezone.utc).date()
    return url.replace("{from}", (day - timedelta(days=1)).isoformat()).replace("{until}", day.isoformat())


def emission_attachment(page_url: str, body: bytes) -> str:
    """公告页本身没有因子时，只跟同一站点上唯一的 PDF 附件。"""
    if body.lstrip().startswith(b"%PDF") or not body.lstrip().startswith(b"<"):
        return ""
    html = body.decode("utf-8", errors="replace")
    host = urlsplit(page_url).netloc
    found = []
    for href in re.findall(r"href=[\"']([^\"']+\.pdf)[\"']", html, flags=re.I):
        absolute = urljoin(page_url, href)
        target = urlsplit(absolute)
        if target.scheme in {"http", "https"} and target.netloc == host and absolute not in found:
            found.append(absolute)
    return found[0] if len(found) == 1 else ""


def _with_mailto(url: str, contact: str) -> str:
    parts = urlsplit(url)
    if parts.netloc != "api.openalex.org":
        return url
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["mailto"] = contact
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def redact(text: str, contact: str) -> str:
    if contact and text:
        return text.replace(contact, "***").replace(quote(contact), "***")
    return text


def stamp(source: dict, raw: dict, snapshot: dict) -> dict:
    fetched_at = snapshot["fetched_at"]
    record = dict(raw)
    record["source_id"] = source["source_id"]
    record["kind"] = source["kind"]
    record["attribution"] = source.get("attribution") or ""
    record["license"] = source.get("license_terms") or ""
    record["source_tier"] = source.get("source_tier") or ""
    record["jurisdiction"] = source.get("jurisdiction") or ""
    record["fulltext_allowed"] = bool(source.get("fulltext_allowed"))
    record["snapshot_sha256"] = snapshot["sha256"]
    record["fetched_at"] = fetched_at
    record.setdefault("expiry_date", None)
    if not record.get("as_of"):
        record["as_of"] = _fetched_date(fetched_at)
    if record.get("literature") and not record["fulltext_allowed"]:
        record["literature"].pop("pdfUrl", None)
    code, label, reason = classify_single(record)
    record["verification_code"] = code
    record["verification_label"] = label
    record["verification_reason"] = reason
    # 新鲜度按本次抓取日，不按文件里的历史生效日。
    record["freshness"] = badge(_fetched_date(fetched_at), int(source.get("interval_days") or 1))
    return record


def _stage_policy(records: list[dict], moment: str, policy_db: Path | None) -> None:
    """字段齐全的政策页只进入待审批，不在这里发布。"""
    if policy_db is None:
        return
    pages = []
    for record in records:
        if record.get("kind") not in {"policy", "statistics"}:
            continue
        if not (record.get("region") and record.get("published") and record.get("applicability")):
            continue
        pages.append({
            "source_id": record["source_id"],
            "region": record["region"],
            "published": record["published"],
            "applicability": record["applicability"],
            "body": record.get("title") or "",
        })
    if not pages:
        return
    from app.services.policy_pipeline import connect, ingest_pages
    conn = connect(policy_db)
    try:
        ingest_pages(conn, pages, moment[:10], submit=None)
    finally:
        conn.close()


def run_source(source: dict, *, contact: str = "", client: PoliteClient | None = None, store: IngestStore | None = None,
               snapshot_dir: Path | None = None, dry_run: bool = True, limit_urls: int = 1, alert=None,
               fetched_at: str | None = None, policy_db: Path | None = None) -> dict:
    report = {
        "source_id": source["source_id"],
        "name": source["name"],
        "enabled": source["enabled"],
        "status": "disabled" if not source["enabled"] else "skipped",
        "reason": source.get("reason") or "",
        "records": 0,
        "pending": 0,
        "fetched": [],
        "human_note": source.get("human_note") or "",
    }
    if not source["enabled"]:
        report["status"] = "disabled"
        return report
    urls = list(source.get("sample_urls") or [])
    if not urls:
        report["status"] = "needs_human"
        report["reason"] = source.get("human_note") or "没有可抓取的公开地址"
        return report
    if not (contact or "").strip():
        report["status"] = "skipped"
        report["reason"] = "未配置联系邮箱"
        return report
    polite = client or PoliteClient(contact)
    moment = fetched_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    parsed_ok = False
    drifted = False
    failed = False
    records = []
    for url in urls[: max(limit_urls, 0)]:
        target = expand_dated_url(_with_mailto(url, contact), moment)
        result = polite.get(target, max_bytes=int(source.get("max_bytes") or 1_500_000), timeout=int(source.get("timeout") or 20))
        safe_url = redact(result.get("url") or target, contact)
        if result["status"] == "skipped":
            report["fetched"].append({"url": safe_url, "status": "skipped", "reason": result.get("reason")})
            continue
        if result["status"] != "ok":
            failed = True
            report["fetched"].append({"url": safe_url, "status": "failed", "reason": result.get("reason")})
            if alert:
                alert(source["source_id"], "公开数据抓取失败", "%s %s" % (source["name"], result.get("reason")))
            continue
        body = result["body"]
        snapshot = save_snapshot(snapshot_dir, source["source_id"], safe_url, body, moment) if snapshot_dir else {
            "sha256": __import__("hashlib").sha256(body).hexdigest(),
            "fetched_at": moment,
            "url": safe_url,
            "bytes": len(body),
        }
        try:
            parsed = parse(source["parser"], body, safe_url)
        except SchemaDrift as exc:
            attachment = emission_attachment(safe_url, body) if source.get("parser") == "emission" else ""
            if attachment:
                follow = polite.get(attachment, max_bytes=int(source.get("max_bytes") or 1_500_000), timeout=int(source.get("timeout") or 20))
                safe_follow = redact(follow.get("url") or attachment, contact)
                if follow["status"] == "ok":
                    follow_body = follow["body"]
                    follow_snapshot = save_snapshot(snapshot_dir, source["source_id"], safe_follow, follow_body, moment) if snapshot_dir else {
                        "sha256": __import__("hashlib").sha256(follow_body).hexdigest(),
                        "fetched_at": moment,
                        "url": safe_follow,
                        "bytes": len(follow_body),
                    }
                    try:
                        parsed = parse(source["parser"], follow_body, safe_follow)
                    except SchemaDrift as follow_exc:
                        exc = follow_exc
                        body = follow_body
                        snapshot = follow_snapshot
                        safe_url = safe_follow
                    else:
                        parsed_ok = True
                        stamped = [stamp(source, item, follow_snapshot) for item in parsed]
                        records.extend(stamped)
                        report["fetched"].append({"url": safe_follow, "status": "ok", "sha256": follow_snapshot["sha256"], "records": len(stamped)})
                        continue
                else:
                    failed = True
                    report["fetched"].append({"url": safe_follow, "status": "failed", "reason": follow.get("reason")})
                    if alert:
                        alert(source["source_id"], "公开数据抓取失败", "%s %s" % (source["name"], follow.get("reason")))
                    continue
            truncated = len(body) >= int(source.get("max_bytes") or 0)
            if truncated:
                failed = True
                report["fetched"].append({"url": safe_url, "status": "failed", "reason": "响应超过长度上限", "sha256": snapshot["sha256"]})
                if alert:
                    alert(source["source_id"], "公开数据抓取失败", "%s 响应超过长度上限" % source["name"])
            else:
                drifted = True
                report["fetched"].append({"url": safe_url, "status": "schema_drift", "reason": str(exc), "sha256": snapshot["sha256"]})
                if alert:
                    alert(source["source_id"], "公开数据结构偏离", "%s %s" % (source["name"], exc))
            continue
        parsed_ok = True
        stamped = [stamp(source, item, snapshot) for item in parsed]
        records.extend(stamped)
        report["fetched"].append({"url": safe_url, "status": "ok", "sha256": snapshot["sha256"], "records": len(stamped)})
    report["records"] = len(records)
    if parsed_ok:
        report["status"] = "fetched"
    elif drifted:
        report["status"] = "schema_drift"
        report["reason"] = "解析结构与预期不一致"
    elif failed:
        report["status"] = "failed"
        report["reason"] = "抓取失败"
    elif report["fetched"]:
        report["status"] = "skipped"
        report["reason"] = report["fetched"][-1].get("reason") or "未抓取"
    else:
        report["status"] = "skipped"
    if store is not None and not dry_run:
        for record in records:
            outcome = store.upsert(record, moment)
            if outcome["action"] == "pending":
                report["pending"] += 1
        _stage_policy(records, moment, policy_db)
    report["preview"] = [
        {"record_key": item["record_key"], "title": item.get("title"), "verification_label": item.get("verification_label")}
        for item in records[:3]
    ]
    return report


def run_registry(registry: dict, *, bucket: str = "", contact: str = "", dry_run: bool = True, limit_urls: int | None = None,
                 store: IngestStore | None = None, snapshot_dir: Path | None = None, client: PoliteClient | None = None,
                 alert=None, source_id: str = "", policy_db: Path | None = None) -> dict:
    if limit_urls is None:
        limit_urls = 1 if dry_run else 8
    selected = []
    for source in registry.get("sources") or []:
        if source_id and source["source_id"] != source_id:
            continue
        if bucket and source["enabled"] and (source.get("schedule") or {}).get("bucket") != bucket:
            continue
        selected.append(source)
    if client is None and contact.strip() and any(source.get("enabled") and source.get("sample_urls") for source in selected):
        client = PoliteClient(contact)
    reports = [
        run_source(
            source, contact=contact, client=client, store=store, snapshot_dir=snapshot_dir,
            dry_run=dry_run, limit_urls=limit_urls, alert=alert, policy_db=policy_db,
        )
        for source in selected
    ]
    return {
        "dry_run": dry_run,
        "bucket": bucket,
        "count": len(reports),
        "fetched_ok": [item["source_id"] for item in reports if item["status"] == "fetched"],
        "reports": reports,
    }


def default_alert(source_id: str, title: str, detail: str) -> dict:
    return notify_problem(source_id, title, detail)
