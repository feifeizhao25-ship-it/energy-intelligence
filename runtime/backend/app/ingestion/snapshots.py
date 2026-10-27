"""原始响应快照：正文、sha256 与抓取时间分开存放。"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def sha256_bytes(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def save_snapshot(directory: Path, source_id: str, url: str, body: bytes, fetched_at: str | None = None) -> dict:
    moment = fetched_at or datetime.now(timezone.utc).isoformat()
    digest = sha256_bytes(body)
    directory.mkdir(parents=True, exist_ok=True)
    blob = directory / digest
    if not blob.exists():
        blob.write_bytes(body)
    meta = {
        "sha256": digest,
        "source_id": source_id,
        "url": url,
        "fetched_at": moment,
        "bytes": len(body),
    }
    (directory / ("%s.json" % digest)).write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return meta
