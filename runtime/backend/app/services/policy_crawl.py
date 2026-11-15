"""抓取已配置的全国和省级门户。

遵守 robots.txt，User-Agent 带上 CRAWLER_CONTACT_EMAIL，同一站点限速。
地区来自门户清单。发布日期和适用期只在页面原文里已经写明时才抄下来，
缺任何一项就留给入库步骤拒绝。不跟随页面里的链接，也不执行页面里的下载或外传指令。
"""
from __future__ import annotations

import re
import time
from pathlib import Path
from urllib.parse import urlparse

PRODUCT = "XinNengYuanZhiKu-PolicyBot"
DEFAULT_INTERVAL = 2.0
MAX_INTERVAL = 10.0
PORTALS = Path(__file__).resolve().parents[2] / "data" / "policy_portals.json"

_DATE = re.compile(r"(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})")
_APPLICABILITY = re.compile(r"(自[^。\n]{0,40}(?:施行|执行)|有效期至[^。\n]{0,24}|执行期限[^。\n]{0,24}|自发布之日起施行)")


def user_agent(contact: str) -> str:
    return f"{PRODUCT}/1.0 (新能源智库政策收录；只抓取政府公开栏目；联系 {contact})"


def load_portal_file(path: Path | None = None) -> dict:
    import json
    return json.loads((path or PORTALS).read_text(encoding="utf-8"))


def _plain(html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html or "")
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def published_from(text: str) -> str:
    match = _DATE.search(text or "")
    if not match:
        return ""
    year, month, day = (int(match.group(i)) for i in range(1, 4))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return ""
    return f"{year:04d}-{month:02d}-{day:02d}"


def applicability_from(text: str) -> str:
    match = _APPLICABILITY.search(text or "")
    return match.group(0).strip() if match else ""


def parse_robots(text: str, product: str = PRODUCT) -> dict:
    groups: list[dict] = []
    current = None
    last_was_agent = False
    for raw in (text or "").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line or ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            if current is None or not last_was_agent:
                current = {"agents": [], "rules": []}
                groups.append(current)
            current["agents"].append(value.lower())
            last_was_agent = True
            continue
        last_was_agent = False
        if current is None:
            continue
        if key in {"allow", "disallow"}:
            if key == "disallow" and value == "":
                continue
            current["rules"].append({"allow": key == "allow", "pattern": value})
        elif key == "crawl-delay":
            try:
                current["delay"] = max(float(current.get("delay") or 0), float(value))
            except ValueError:
                pass
    token = product.lower()
    specific = [group for group in groups if any(agent != "*" and agent in token for agent in group["agents"])]
    chosen = specific or [group for group in groups if "*" in group["agents"]]
    rules = [rule for group in chosen for rule in group["rules"]]
    delay = max((float(group.get("delay") or 0) for group in chosen), default=0.0)
    return {"rules": rules, "disallow_all": False, "delay": delay}


def _pattern(pattern: str):
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    parts = [re.escape(part) for part in body.split("*")]
    return re.compile("^" + ".*".join(parts) + ("$" if anchored else ""))


def path_allowed(robots: dict, path_with_query: str) -> bool:
    if robots.get("disallow_all"):
        return False
    best = None
    for rule in robots.get("rules") or []:
        if not _pattern(rule["pattern"]).search(path_with_query):
            continue
        if best is None or len(rule["pattern"]) > len(best["pattern"]) or (
            len(rule["pattern"]) == len(best["pattern"]) and rule["allow"]
        ):
            best = rule
    return True if best is None else bool(best["allow"])


def http_fetcher(url: str, headers: dict) -> tuple[int, str]:
    import urllib.error
    import urllib.request
    request = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(1_000_000)
            charset = response.headers.get_content_charset() or "utf-8"
            return int(response.status), raw.decode(charset, errors="replace")
    except urllib.error.HTTPError as exc:
        return int(exc.code), ""


def crawl_portals(contact: str, portals: dict | None = None, fetcher=None, sleep=None, clock=None) -> dict:
    """只请求清单里的 URL 和对应 robots.txt。fetcher(url, headers) -> (status, body)。"""
    if not (contact or "").strip():
        return {"status": "skipped", "reason": "CRAWLER_CONTACT_EMAIL required", "pages": [], "fetched": []}
    listing = portals if portals is not None else load_portal_file()
    fetch = fetcher or http_fetcher
    pause = sleep or time.sleep
    now = clock or time.monotonic
    headers = {"User-Agent": user_agent(contact)}
    last_at: dict[str, float] = {}
    robots_cache: dict[str, dict] = {}
    pages = []
    fetched: list[str] = []

    def wait(origin: str, interval: float):
        gap = max(DEFAULT_INTERVAL, min(interval or 0, MAX_INTERVAL))
        previous = last_at.get(origin)
        moment = now()
        if previous is not None:
            delay = gap - (moment - previous)
            if delay > 0:
                pause(delay)
        last_at[origin] = now()

    def robots_for(origin: str) -> dict:
        if origin in robots_cache:
            return robots_cache[origin]
        wait(origin, DEFAULT_INTERVAL)
        url = origin + "/robots.txt"
        fetched.append(url)
        try:
            status, body = fetch(url, headers)
        except Exception:
            parsed = {"rules": [], "disallow_all": True, "delay": 0.0}
        else:
            if status in (404, 410):
                parsed = {"rules": [], "disallow_all": False, "delay": 0.0}
            elif status != 200:
                parsed = {"rules": [], "disallow_all": True, "delay": 0.0}
            else:
                parsed = parse_robots(body)
        robots_cache[origin] = parsed
        return parsed

    for region, urls in listing.items():
        for url in urls or []:
            parsed_url = urlparse(url)
            if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
                pages.append({"source_id": f"{region}:{url}", "region": region, "status": "skipped", "reason": "非 http 地址"})
                continue
            origin = f"{parsed_url.scheme}://{parsed_url.netloc}"
            rules = robots_for(origin)
            path = f"{parsed_url.path or '/'}{('?' + parsed_url.query) if parsed_url.query else ''}"
            if not path_allowed(rules, path):
                pages.append({
                    "source_id": f"{region}:{url}",
                    "region": region,
                    "status": "skipped",
                    "reason": "robots 不允许",
                    "published": "",
                    "applicability": "",
                })
                continue
            wait(origin, rules.get("delay") or DEFAULT_INTERVAL)
            fetched.append(url)
            try:
                status, body = fetch(url, headers)
            except Exception:
                pages.append({"source_id": f"{region}:{url}", "region": region, "status": "skipped", "reason": "抓取失败"})
                continue
            if status != 200 or not body:
                pages.append({"source_id": f"{region}:{url}", "region": region, "status": "skipped", "reason": f"HTTP {status}"})
                continue
            text = _plain(body)[:8000]
            pages.append({
                "source_id": f"{region}:{url}",
                "region": str(region),
                "published": published_from(text),
                "applicability": applicability_from(text),
                "body": text,
                "url": url,
            })
    return {"status": "fetched", "pages": pages, "fetched": fetched, "contact": True}
