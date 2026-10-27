"""带联系邮箱、robots 与按主机限速的抓取。测试注入 fetcher，不访问网络。"""

from __future__ import annotations

import time
from urllib.parse import urlparse

from app.services.policy_crawl import parse_robots, path_allowed

PRODUCT = "XinNengYuanZhiKu-PublicData"
HOST_INTERVALS = {
    "export.arxiv.org": 3.0,
    "arxiv.org": 3.0,
    "overpass-api.de": 8.0,
    "download.geofabrik.de": 2.0,
}
DEFAULT_INTERVAL = 1.0


def user_agent(contact: str) -> str:
    # 头字段必须是 ASCII，否则部分站点对 robots.txt 直接返回 400，抓取会被当成禁止。
    return "%s/1.0 (contact: %s)" % (PRODUCT, contact.strip())


def latin1_headers(headers: dict) -> dict:
    """urllib 按 latin-1 写头。非 latin-1 的署名先按 UTF-8 字节放进 latin-1，线上仍是原文。"""
    encoded = {}
    for key, value in headers.items():
        text = str(value)
        try:
            text.encode("latin-1")
        except UnicodeEncodeError:
            text = text.encode("utf-8").decode("latin-1")
        encoded[key] = text
    return encoded


def urllib_fetcher(url: str, headers: dict, timeout: int, max_bytes: int) -> tuple[int, bytes]:
    import urllib.error
    import urllib.request

    request = urllib.request.Request(url, headers=latin1_headers(headers), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return int(response.status), response.read(max_bytes)
    except urllib.error.HTTPError as exc:
        payload = b""
        if exc.fp is not None:
            try:
                payload = exc.read(min(max_bytes, 10_000))
            except Exception:
                payload = b""
        return int(exc.code), payload


class PoliteClient:
    def __init__(self, contact: str, fetcher=None, sleep=None, clock=None, host_intervals=None):
        self.contact = (contact or "").strip()
        if not self.contact:
            raise ValueError("未配置联系邮箱")
        self.fetcher = fetcher or urllib_fetcher
        self.sleep = sleep or time.sleep
        self.clock = clock or time.monotonic
        self.host_intervals = dict(HOST_INTERVALS if host_intervals is None else host_intervals)
        self.headers = {"User-Agent": user_agent(self.contact), "Accept": "*/*"}
        self._last: dict[str, float] = {}
        self._robots: dict[str, dict] = {}

    def _interval(self, host: str) -> float:
        return float(self.host_intervals.get(host) or DEFAULT_INTERVAL)

    def _wait(self, host: str):
        gap = self._interval(host)
        previous = self._last.get(host)
        moment = self.clock()
        if previous is not None:
            delay = gap - (moment - previous)
            if delay > 0:
                self.sleep(delay)
        self._last[host] = self.clock()

    def _robots_for(self, origin: str, host: str) -> dict:
        if origin in self._robots:
            return self._robots[origin]
        self._wait(host)
        url = origin + "/robots.txt"
        try:
            status, body = self.fetcher(url, dict(self.headers), 15, 200_000)
        except Exception:
            parsed = {"rules": [], "disallow_all": True, "delay": 0.0}
        else:
            if status in (404, 410):
                parsed = {"rules": [], "disallow_all": False, "delay": 0.0}
            elif status != 200:
                parsed = {"rules": [], "disallow_all": True, "delay": 0.0}
            else:
                text = body.decode("utf-8", errors="replace") if isinstance(body, (bytes, bytearray)) else str(body)
                parsed = parse_robots(text, PRODUCT)
                if parsed.get("delay"):
                    self.host_intervals[host] = max(self._interval(host), float(parsed["delay"]))
        self._robots[origin] = parsed
        return parsed

    def get(self, url: str, max_bytes: int = 1_500_000, timeout: int = 20) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return {"status": "skipped", "reason": "非 http 地址", "url": url}
        origin = "%s://%s" % (parsed.scheme, parsed.netloc)
        rules = self._robots_for(origin, parsed.netloc)
        path = parsed.path or "/"
        if parsed.query:
            path = "%s?%s" % (path, parsed.query)
        if not path_allowed(rules, path):
            return {"status": "skipped", "reason": "robots 不允许", "url": url}
        self._wait(parsed.netloc)
        try:
            status, body = self.fetcher(url, dict(self.headers), timeout, max_bytes)
        except Exception as exc:
            return {"status": "failed", "reason": exc.__class__.__name__, "url": url}
        if not isinstance(body, (bytes, bytearray)):
            body = str(body).encode("utf-8")
        body = bytes(body)[:max_bytes]
        if status not in (200, 206):
            return {"status": "failed", "reason": "HTTP %s" % status, "http_status": status, "url": url, "body": body}
        return {"status": "ok", "url": url, "body": body, "http_status": status}
