"""百度普通收录。开关 baidu_push 默认关闭，且必须有 token 才发请求。

POST http://data.zz.baidu.com/urls?site=&token=  Content-Type: text/plain，一行一个 URL。
"""
from __future__ import annotations

import os
from urllib.parse import urlencode

from ops.switches import SWITCHES

BAIDU_PUSH_HOST = "data.zz.baidu.com"


def push_urls(urls: list[str], poster=None) -> dict:
    if not SWITCHES.get("baidu_push"):
        return {"status": "disabled", "reason": "switch off", "pushed": 0}
    token = os.environ.get("NENGJIAN_BAIDU_PUSH_TOKEN", "")
    site = os.environ.get("NENGJIAN_BAIDU_SITE", "")
    if not token or not site:
        return {"status": "disabled", "reason": "missing token or site", "pushed": 0}
    lines = [url.strip() for url in urls if url and url.strip()]
    if not lines:
        return {"status": "empty", "pushed": 0}
    query = urlencode({"site": site, "token": token})
    endpoint = f"http://{BAIDU_PUSH_HOST}/urls?{query}"
    body = "\n".join(lines)

    def _post(url: str, payload: str) -> dict:
        import urllib.request
        req = urllib.request.Request(url, data=payload.encode("utf-8"), headers={"Content-Type": "text/plain"}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as resp:
            import json
            return json.loads(resp.read().decode() or "{}")

    try:
        result = (poster or _post)(endpoint, body)
    except Exception as exc:
        return {"status": "error", "reason": exc.__class__.__name__, "pushed": 0}
    return {"status": "ok", "pushed": len(lines), "result": result}
