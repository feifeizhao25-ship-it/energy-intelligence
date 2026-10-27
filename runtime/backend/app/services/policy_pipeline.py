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
    try:
        from app.services.policy_alerts import note_published
        note_published(source_id, content_sha256, body="")
    except Exception:
        pass
    return {"status": "published", "content_sha256": content_sha256}


def load_portals(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))
