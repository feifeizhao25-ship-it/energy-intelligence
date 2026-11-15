"""急停：口令、环境变量、或密钥目录里的 kill 文件。任一成立即停止发布。"""
from __future__ import annotations

import os
from pathlib import Path

STOP_WORDS = ("停止所有操作", "急停", "PAUSE")
SECRETS_DIR = Path("/etc/airui-nengjian")


def kill_file() -> Path:
    override = os.environ.get("NENGJIAN_KILL_FILE")
    if override:
        return Path(override)
    return SECRETS_DIR / "KILL"


def is_killed(text: str = "") -> bool:
    if os.environ.get("NENGJIAN_KILL_SWITCH") == "1":
        return True
    path = kill_file()
    if path.is_file():
        return True
    blob = text or ""
    return any(word in blob for word in STOP_WORDS)
