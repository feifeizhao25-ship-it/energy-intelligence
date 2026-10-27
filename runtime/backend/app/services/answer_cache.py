"""同问缓存 24 小时。政策类按版本号失效。进程内缓存，不写出密钥。"""
from __future__ import annotations

import hashlib
import json
import time

TTL_SECONDS = 24 * 60 * 60


def question_key(messages: list, policy_version: str = "") -> str:
    blob = json.dumps({"messages": messages, "policy_version": policy_version}, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()


class AnswerCache:
    def __init__(self, now=None) -> None:
        self._rows: dict[str, tuple[float, dict, str]] = {}
        self._now = now or time.time

    def get(self, messages: list, policy_version: str = "") -> dict | None:
        key = question_key(messages, policy_version)
        row = self._rows.get(key)
        if not row:
            return None
        stored_at, payload, version = row
        if version != policy_version or self._now() - stored_at > TTL_SECONDS:
            self._rows.pop(key, None)
            return None
        return dict(payload)

    def put(self, messages: list, payload: dict, policy_version: str = "") -> None:
        key = question_key(messages, policy_version)
        self._rows[key] = (self._now(), dict(payload), policy_version)

    def invalidate_policy(self, policy_version: str) -> int:
        doomed = [key for key, row in self._rows.items() if row[2] == policy_version]
        for key in doomed:
            self._rows.pop(key, None)
        return len(doomed)
