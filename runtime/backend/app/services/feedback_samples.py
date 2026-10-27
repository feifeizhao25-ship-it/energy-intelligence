"""生产反馈样本。写入前去掉手机号、邮箱和身份证号。

后端与 Celery 共用命名卷 /var/lib/nengjian。能连上 Postgres 时再镜像一行，
避免只写容器自己的 /tmp。
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from app.services.skill_improvement import strip_pii

KINDS = {"thumbs_down", "low_rating", "failed_citation", "blocked_output"}
SHARED_SAMPLE_PATH = Path("/var/lib/nengjian/feedback.jsonl")


def preferred_sample_path() -> Path:
    raw = os.environ.get("NENGJIAN_FEEDBACK_PATH", "").strip()
    return Path(raw) if raw else SHARED_SAMPLE_PATH


def sample_path() -> Path:
    path = preferred_sample_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        return path
    except OSError:
        fallback = Path("/tmp/nengjian-feedback.jsonl")
        fallback.parent.mkdir(parents=True, exist_ok=True)
        return fallback


def record_sample(kind: str, text: str, extra: dict | None = None) -> dict:
    if kind not in KINDS:
        return {"stored": False, "reason": "unknown kind"}
    cleaned = strip_pii(text or "")[:500]
    row = {
        "id": f"{kind}-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "kind": kind,
        "text": cleaned,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        row["extra"] = {k: strip_pii(str(v))[:200] for k, v in extra.items()}
    path = sample_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    _mirror_postgres(row)
    return {"stored": True, "id": row["id"], "path": str(path)}


def _mirror_postgres(row: dict) -> None:
    url = os.environ.get("DATABASE_URL", "")
    if "postgres" not in url:
        return
    dsn = url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgresql://")

    def _run() -> None:
        import asyncio

        async def go() -> None:
            import asyncpg
            conn = await asyncpg.connect(dsn)
            await conn.execute(
                """CREATE TABLE IF NOT EXISTS feedback_samples (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    body TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )"""
            )
            await conn.execute(
                "INSERT INTO feedback_samples (id, kind, body, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
                row["id"], row["kind"], row["text"], datetime.now(timezone.utc),
            )
            await conn.close()

        try:
            asyncio.run(go())
        except Exception:
            return

    try:
        import threading
        threading.Thread(target=_run, daemon=True).start()
    except Exception:
        return


def load_samples(limit: int = 500) -> list[dict]:
    path = sample_path()
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict) and row.get("kind") in KINDS:
            row["text"] = strip_pii(str(row.get("text") or ""))
            rows.append(row)
    return rows[-limit:]
