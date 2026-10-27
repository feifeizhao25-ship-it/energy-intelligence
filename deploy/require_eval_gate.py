#!/usr/bin/env python3
"""部署前读取 latest.json。任一门禁未过、文件缺失或超过 8 天，退出码非 0。"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


def evaluate(path: Path, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if not path.is_file():
        print("eval gate: latest.json 不存在", file=sys.stderr)
        return 2
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print("eval gate: latest.json 无法解析", file=sys.stderr)
        return 2
    stamp = str(payload.get("generated_at") or "").replace("Z", "+00:00")
    try:
        generated = datetime.fromisoformat(stamp)
    except ValueError:
        print("eval gate: 缺少 generated_at", file=sys.stderr)
        return 2
    if generated.tzinfo is None:
        generated = generated.replace(tzinfo=timezone.utc)
    if now - generated > timedelta(days=8):
        print("eval gate: 结果已超过 8 天", file=sys.stderr)
        return 3
    if payload.get("passed") is not True:
        print("eval gate: passed 不为 true", file=sys.stderr)
        return 1
    gates = payload.get("gates") or {}
    if any(value is not True for value in gates.values()):
        print("eval gate: 有门禁未通过", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    raw = os.environ.get("NENGJIAN_EVAL_LATEST", "/var/lib/nengjian/eval/latest.json")
    return evaluate(Path(raw))


if __name__ == "__main__":
    raise SystemExit(main())
