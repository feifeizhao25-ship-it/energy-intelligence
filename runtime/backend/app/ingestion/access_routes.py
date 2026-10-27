"""2026-10-27 核对过的抓取地址。

规则来自当时返回 200 的 robots.txt，不在运行时临时放宽。
禁止项即使写进登记表也不会进入 sample_urls。
"""
from __future__ import annotations

from urllib.parse import urlsplit

CHECKED_AT = "2026-10-27"

# 与当天 robots.txt 一致的禁止规则。允许规则更长时优先（与 policy_crawl.path_allowed 相同）。
_RULES = {
    "power.larc.nasa.gov": [
        ("/api/pages/", True),
        ("/api/", False),
    ],
    "export.arxiv.org": [("/", False)],
    "arxiv.org": [
        ("/api", False),
        ("/oai2", False),
        ("/rss", True),
    ],
    "zenodo.org": [
        ("/api/records/*/files", True),
        ("/api", False),
        ("/oai2d", True),
    ],
    "overpass-api.de": [("/api/", False)],
    "download.geofabrik.de": [
        ("*.osm.pbf", False),
        ("*.osm.bz2", False),
        ("*.md5", False),
    ],
}

_PERMITTED = {
    "osm": ["https://download.geofabrik.de/asia/china.html"],
    "nasa": [],
    "arxiv": ["https://arxiv.org/rss/physics.app-ph"],
    "zenodo": [
        "https://zenodo.org/oai2d?verb=ListRecords&metadataPrefix=oai_dc&from={from}&until={until}"
    ],
}

_WHY = {
    "osm": "索引页允许。提取包 *.osm.pbf 被 robots 禁止，Overpass 的 /api/ 被禁止。",
    "nasa": "数据接口位于被禁止的 /api/。/api/pages/ 只是说明页。没有找到允许的整包地址。",
    "arxiv": "导出站与 /api、/oai2 被禁止。RSS 在允许范围内，使用条款要求至少间隔 3 秒，且不保存全文。",
    "zenodo": "检索接口 /api 被禁止。OAI-PMH /oai2d 未被禁止，按同一站点的 10 秒间隔抓取。",
}


def _pattern(pattern: str):
    import re
    anchored = pattern.endswith("$")
    body = pattern[:-1] if anchored else pattern
    parts = [re.escape(part) for part in body.split("*")]
    return re.compile("^" + ".*".join(parts) + ("$" if anchored else ""))


def blocked_reason(url: str) -> str:
    """空字符串表示按已核对规则可以抓取。占位符 {from} 先换成日期再判断。"""
    sample = url.replace("{from}", "2026-10-26").replace("{until}", "2026-10-27")
    parsed = urlsplit(sample)
    rules = _RULES.get(parsed.netloc)
    if not rules:
        return ""
    path = parsed.path or "/"
    if parsed.query:
        path = "%s?%s" % (path, parsed.query)
    best = None
    for pattern, allow in rules:
        if not _pattern(pattern).search(path):
            continue
        if best is None or len(pattern) > len(best[0]) or (len(pattern) == len(best[0]) and allow):
            best = (pattern, allow)
    if best is None or best[1]:
        return ""
    return "robots 不允许 %s" % best[0]


def permitted_urls(parser: str) -> list[str]:
    urls = []
    for url in _PERMITTED.get(parser, []):
        if blocked_reason(url):
            continue
        urls.append(url)
    return urls


def access_note(parser: str) -> str:
    return _WHY.get(parser, "")
