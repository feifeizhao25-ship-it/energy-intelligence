"""生产反馈样本。写入前去掉手机号、邮箱和身份证号。

默认文件在 /tmp，不入库。周任务从 NENGJIAN_FEEDBACK_PATH 读取。
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from app.services.skill_improvement import strip_pii

KINDS = {"thumbs_down", "low_rating", "failed_citation", "blocked_output"}


def sample_path() -> Path:
    raw = os.environ.get("NENGJIAN_FEEDBACK_PATH", "/tmp/nengjian-feedback.jsonl")
    return Path(raw)


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
    return {"stored": True, "id": row["id"]}


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
