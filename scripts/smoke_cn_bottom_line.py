#!/usr/bin/env python3
"""国内底线的可选实网冒烟。未设置 NENGJIAN_DEEPSEEK_API_KEY 时直接跳过。

只认这个变量，不读取 DEEPSEEK_API_KEY。任何输出都会先抹掉密钥。
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1] / "runtime" / "backend"


def _redact(message: str, secret: str) -> str:
    if secret and secret in message:
        return message.replace(secret, "[redacted]")
    return message


def main() -> int:
    secret = os.environ.get("NENGJIAN_DEEPSEEK_API_KEY", "").strip()
    if not secret:
        print("skipped: NENGJIAN_DEEPSEEK_API_KEY not set")
        return 0
    sys.path.insert(0, str(BACKEND))
    from app.services.bottom_line import NOTICE_ZH, enforce_bottom_line, find_violations

    if not find_violations("这个光伏项目值得投吗", market="cn"):
        print("local input filter missed a paraphrased advice request")
        return 1
    prompt = (
        "用三句话说明发改价格〔2025〕136号对新能源上网电价机制的调整，"
        "只复述已公布的机制事实。回答末尾写上：本回答不构成价格预测。"
    )
    body = {
        "model": os.environ.get("DEEPSEEK_MODEL", "deepseek-flash"),
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }
    base = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    request = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body, ensure_ascii=False).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.loads(response.read().decode() or "{}")
        content = ((payload.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    except Exception as exc:
        print("live call failed: " + _redact(str(exc), secret))
        return 1
    kept = enforce_bottom_line(content, market="cn")
    if kept == NOTICE_ZH or "136" not in kept:
        print("factual answer was replaced or did not keep the policy number")
        return 1
    print("ok")
    return 0


if __name__ == "__main__":
    secret = os.environ.get("NENGJIAN_DEEPSEEK_API_KEY", "").strip()
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print("live call failed: " + _redact(str(exc), secret))
        raise SystemExit(1)
