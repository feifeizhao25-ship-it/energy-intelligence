"""政策发布后的提醒记录。

用户订阅存在 Web 库。这里只在审批发布成功后追加一条不含正文的事件，
供运维核对。没有配置路径时写到 /tmp，失败不影响发布。
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path


def note_published(source_id: str, content_sha256: str, body: str = "") -> dict:
    path = Path(os.environ.get("NENGJIAN_POLICY_ALERT_LOG", "/tmp/nengjian-policy-alerts.jsonl"))
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "source_id": source_id,
        "content_sha256": content_sha256,
        "at": datetime.now(timezone.utc).isoformat(),
        "body_stored": False,
    }
    del body
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + "\n")
    return {"recorded": True}
