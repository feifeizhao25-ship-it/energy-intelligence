"""Policy ingestion: snapshot, diff, WeCom approval, then database.

Nothing in this module publishes because a crawler returned bytes. A pending
row becomes published only after an approval record names the same
content_sha256 and says the request was approved.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS policy_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    content_sha256 TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT NOT NULL,
    approval_id TEXT,
    created_at TEXT NOT NULL
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def stage_snapshot(conn: sqlite3.Connection, source_id: str, body: str, created_at: str) -> dict:
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()
    previous = conn.execute(
        "SELECT content_sha256 FROM policy_snapshots WHERE source_id = ? ORDER BY id DESC LIMIT 1",
        (source_id,),
    ).fetchone()
    changed = previous is None or previous["content_sha256"] != digest
    conn.execute(
        """INSERT INTO policy_snapshots (source_id, content_sha256, body, status, created_at)
           VALUES (?, ?, ?, 'pending_approval', ?)""",
        (source_id, digest, body, created_at),
    )
    conn.commit()
    return {"source_id": source_id, "content_sha256": digest, "changed": changed, "status": "pending_approval"}


def publish_approved(conn: sqlite3.Connection, source_id: str, content_sha256: str, approval: dict) -> dict:
    if approval.get("status") != "approved":
        raise PermissionError("timeout or missing approval is not approval")
    if approval.get("content_sha256") != content_sha256:
        raise PermissionError("approval is bound to a different content_sha256")
    row = conn.execute(
        """SELECT id FROM policy_snapshots
           WHERE source_id = ? AND content_sha256 = ? AND status = 'pending_approval'
           ORDER BY id DESC LIMIT 1""",
        (source_id, content_sha256),
    ).fetchone()
    if row is None:
        raise PermissionError("no pending snapshot for this digest")
    conn.execute(
        "UPDATE policy_snapshots SET status = 'published', approval_id = ? WHERE id = ?",
        (approval.get("approval_id") or "", row["id"]),
    )
    conn.commit()
    alerts = []
    try:
        from app.services.policy_alerts import note_published, notify_published
        note_published(source_id, content_sha256, body="")
        alerts = notify_published(source_id, content_sha256)
    except Exception:
        alerts = []
    return {"status": "published", "content_sha256": content_sha256, "alerts": alerts}


def load_portals(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _plain(html: str) -> str:
    import re
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html or "")
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def diff_text(previous: str, current: str) -> dict:
    if previous == current:
        return {"changed": False, "added": 0, "removed": 0, "excerpt": current[:180]}
    return {
        "changed": True,
        "added": max(0, len(current) - len(previous)),
        "removed": max(0, len(previous) - len(current)),
        "excerpt": current[:180],
        "previous_excerpt": previous[:180],
    }


def _metadata_gap(page: dict) -> str:
    missing = [
        label
        for label, key in (("地区", "region"), ("发布日期", "published"), ("适用期", "applicability"))
        if not str(page.get(key) or "").strip()
    ]
    return "、".join(missing)


def publish_matching_approval(conn: sqlite3.Connection, detail: dict | None, approval_id: str) -> dict:
    """回调或轮询拿到 getapprovaldetail 之后才发布。摘要对不上就保持待审批。"""
    from ops.wecom import approval_allows

    sha = str((detail or {}).get("content_sha256") or "")
    if not approval_allows(detail, sha):
        return {"published": False, "reason": "审批结果不是通过或摘要不一致"}
    row = conn.execute(
        """SELECT source_id FROM policy_snapshots
           WHERE content_sha256 = ? AND status = 'pending_approval'
           ORDER BY id DESC LIMIT 1""",
        (sha,),
    ).fetchone()
    if row is None:
        return {"published": False, "reason": "没有匹配的待审批快照"}
    published = publish_approved(
        conn,
        row["source_id"],
        sha,
        {"status": "approved", "content_sha256": sha, "approval_id": approval_id},
    )
    return {"published": True, **published}


def ingest_pages(conn: sqlite3.Connection, pages: list[dict], created_at: str, submit=None) -> dict:
    """抓取结果只入库为待审批。提交企微审批，不因抓到正文而发布。"""
    items = []
    for page in pages:
        source_id = str(page.get("source_id") or "")
        gap = _metadata_gap(page)
        if gap:
            items.append({
                "source_id": source_id,
                "status": "rejected",
                "reason": f"缺少{gap}",
                "label": "未入库",
                "published": False,
            })
            continue
        body = page.get("body") if "body" in page else _plain(str(page.get("html") or ""))
        previous = conn.execute(
            "SELECT body FROM policy_snapshots WHERE source_id = ? ORDER BY id DESC LIMIT 1",
            (source_id,),
        ).fetchone()
        staged = stage_snapshot(conn, source_id, body, created_at)
        delta = diff_text(previous["body"] if previous else "", body)
        approval = {"submitted": False, "reason": "awaiting wecom approval"}
        if staged["changed"] and submit is not None:
            approval = submit("policy", staged["content_sha256"]) or {}
            sp_no = str(approval.get("sp_no") or "")
            if sp_no:
                conn.execute(
                    """UPDATE policy_snapshots SET approval_id = ?
                       WHERE content_sha256 = ? AND status = 'pending_approval'""",
                    (sp_no, staged["content_sha256"]),
                )
                conn.commit()
        items.append({**staged, "diff": delta, "approval": approval, "label": "待审批，尚未发布"})
    return {"status": "pending_approval", "published": 0, "items": items}


def run_scheduled_cycle(conn: sqlite3.Connection | None = None, created_at: str = "2026-10-27", fetcher=None, portals=None, sleep=None, clock=None) -> dict:
    """Celery 入口。没有联系邮箱且没有夹具时不访问外网。"""
    import os
    fixture = os.environ.get("NENGJIAN_POLICY_FIXTURE", "").strip()
    contact = os.environ.get("CRAWLER_CONTACT_EMAIL", "").strip()
    if not fixture and not contact:
        return {"status": "skipped", "reason": "CRAWLER_CONTACT_EMAIL required", "published": 0}
    pages = []
    crawl = None
    if fixture:
        payload = json.loads(Path(fixture).read_text(encoding="utf-8"))
        pages = payload if isinstance(payload, list) else payload.get("pages") or []
    else:
        from app.services.policy_crawl import crawl_portals
        crawl = crawl_portals(contact, portals=portals, fetcher=fetcher, sleep=sleep, clock=clock)
        pages = [page for page in crawl.get("pages") or [] if "body" in page]
    own_conn = conn is None
    if conn is None:
        path = Path(os.environ.get("NENGJIAN_POLICY_DB", "/var/lib/nengjian/policy.sqlite"))
        path.parent.mkdir(parents=True, exist_ok=True)
        conn = connect(path)
    try:
        from ops.wecom import submit_approval
        result = ingest_pages(conn, pages, created_at, submit=submit_approval)
    finally:
        if own_conn:
            conn.close()
    pending_path = os.environ.get("NENGJIAN_POLICY_PENDING", "").strip()
    if pending_path:
        Path(pending_path).write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    if crawl is not None:
        result = {**result, "crawl": {"fetched": len(crawl.get("fetched") or []), "status": crawl.get("status")}}
    return result
