"""由研究名单与许可证闸门生成可入库的来源登记。"""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import quote

from app.ingestion.license_gate import align
from app.ingestion.schedule import BUCKETS
from app.services.freshness_board import load_sla

ROOT = Path(__file__).resolve().parents[2]
SOURCES_PATH = ROOT / "data" / "public_sources" / "sources.json"
REGISTRY_PATH = ROOT / "data" / "public_sources" / "registry.json"
PORTALS_PATH = ROOT / "data" / "policy_portals_v1.json"
WEB_ATTRIBUTIONS = ROOT.parent / "web" / "src" / "data" / "public-source-attributions.json"

_HTTP = re.compile(r"https?://[^\s；;，,。）)】\]]+")
OVERPASS_QUERY = (
    "[out:json][timeout:25];"
    "(node[\"power\"=\"substation\"](39.90,116.30,39.95,116.40);"
    "way[\"power\"=\"line\"](39.90,116.30,39.95,116.40););"
    "out geom 3;"
)
OVERPASS_URL = "https://overpass-api.de/api/interpreter?data=" + quote(OVERPASS_QUERY)


def sla_interval(sla_type: str) -> int:
    data = load_sla()
    for item in data.get("types") or []:
        if item.get("id") != sla_type:
            continue
        if item.get("update_days"):
            return int(item["update_days"])
        if item.get("check_days"):
            return int(item["check_days"])
        hours = item.get("update_hours") or item.get("ingest_hours") or 24
        return max(1, int(hours) // 24)
    return 1


def http_urls(text: str) -> list[str]:
    found = []
    for match in _HTTP.findall(text or ""):
        url = match.rstrip("/")
        # 研究名单里的地址有的以斜杠结尾，保留站点根路径。
        raw = match
        if raw.endswith("/") and raw.count("/") == 3:
            url = raw
        else:
            url = raw.rstrip(".,)")
        if url not in found:
            found.append(url)
    return found


def tariff_urls(portals: dict | None) -> list[str]:
    urls = []
    for province in (portals or {}).get("provinces") or []:
        for column in province.get("columns") or []:
            if column.get("column") != "电网公司代理购电公告":
                continue
            url = str(column.get("url") or "").strip()
            if url.startswith("http://") or url.startswith("https://"):
                urls.append(url)
    return urls


def load_sources(path: Path | None = None) -> list[dict]:
    payload = json.loads((path or SOURCES_PATH).read_text(encoding="utf-8"))
    return list(payload["sources"])


def load_portals(path: Path | None = None) -> dict:
    portal_path = path or PORTALS_PATH
    if not portal_path.is_file():
        return {}
    return json.loads(portal_path.read_text(encoding="utf-8"))


def _sample_urls(item: dict, decision: dict, portals: dict) -> list[str]:
    if not decision["enabled"]:
        return []
    parser = decision["parser"]
    if parser == "tariff":
        return tariff_urls(portals)
    if parser == "figshare":
        match = re.search(r"figshare\.(\d+)", item.get("url") or "")
        return ["https://api.figshare.com/v2/articles/%s" % match.group(1)] if match else []
    if parser == "osm":
        return ["https://download.geofabrik.de/asia/china.html", OVERPASS_URL]
    if parser == "gppd":
        return [
            "https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv"
        ]
    if parser == "nasa":
        # 与 nasa_batch_import.planned_monthly_url(39.9042, 116.4074, 2023) 相同，避免登记表导入配置。
        return [
            "https://power.larc.nasa.gov/api/temporal/monthly/point"
            "?parameters=ALLSKY_SFC_SW_DWN,T2M,WS50M&community=RE&start=2023&end=2023"
            "&latitude=39.9042&longitude=116.4074&time-standard=UTC&format=JSON"
        ]
    if parser == "openalex":
        return [
            "https://api.openalex.org/works?per-page=5&search=photovoltaic"
            "&select=id,display_name,publication_year,doi,authorships,referenced_works"
        ]
    if parser == "arxiv":
        return ["https://export.arxiv.org/api/query?search_query=all:photovoltaic&start=0&max_results=5"]
    if parser == "crossref":
        return ["https://api.crossref.org/works?rows=5&query.bibliographic=photovoltaic"]
    if parser == "doaj":
        return ["https://doaj.org/api/search/articles/photovoltaic?pageSize=5"]
    if parser == "chinaxiv":
        return ["http://www.chinaxiv.org/oai?verb=ListRecords&metadataPrefix=oai_dc&from=2026-10-26&until=2026-10-27"]
    if parser == "zenodo":
        return ["https://zenodo.org/api/records?q=photovoltaic&size=5"]
    urls = http_urls(item.get("url") or "")
    if parser == "policy_html":
        return urls[:2]
    return urls[:1]


def _attribution(item: dict, decision: dict) -> str:
    if not decision["enabled"]:
        return ""
    suffix = decision.get("attribution_suffix") or ""
    urls = http_urls(item.get("url") or "")
    tail = (" 原文：%s。" % urls[0]) if urls else ""
    return "数据来自%s。%s%s" % (item.get("name") or "", suffix, tail)


def build_registry(sources: list[dict] | None = None, portals: dict | None = None) -> dict:
    items = sources if sources is not None else load_sources()
    portal_doc = portals if portals is not None else load_portals()
    decisions = align(items)
    rows = []
    for index, (item, decision) in enumerate(zip(items, decisions), start=1):
        interval = decision["interval_days"] or (sla_interval(decision["sla_type"]) if decision["sla_type"] in {
            "policy", "agency_tariff", "literature", "irradiance", "statistics", "standard",
        } else None)
        if decision["enabled"] and not interval:
            interval = 1
        bucket = decision["bucket"] if decision["enabled"] else ""
        schedule = None
        if bucket:
            spec = BUCKETS[bucket]
            schedule = {"bucket": bucket, "cron": spec["cron"], "label": spec["label"], "timezone": "Asia/Shanghai"}
        sample_urls = _sample_urls(item, decision, portal_doc)
        rows.append({
            "source_id": "pub-%02d" % index,
            "name": item.get("name") or "",
            "category": item.get("category") or "",
            "url": item.get("url") or "",
            "license_terms": item.get("license_terms") or "",
            "commercial_use": item.get("commercial_use") or "",
            "update_frequency": item.get("update_frequency") or "",
            "priority": item.get("priority") or "",
            "enabled": bool(decision["enabled"]),
            "reason": decision["reason"],
            "code": decision["code"],
            "parser": decision["parser"] if decision["enabled"] else "",
            "kind": decision["kind"] if decision["enabled"] else "",
            "sla_type": decision["sla_type"] if decision["enabled"] else "",
            "interval_days": interval if decision["enabled"] else None,
            "scope": decision["scope"] if decision["enabled"] else "",
            "source_tier": decision["source_tier"] if decision["enabled"] else "",
            "jurisdiction": decision["jurisdiction"] if decision["enabled"] else "",
            "fulltext_allowed": bool(decision["enabled"] and decision["fulltext_allowed"]),
            "attribution": _attribution(item, decision),
            "sample_urls": sample_urls,
            "max_bytes": decision["max_bytes"] or 1_500_000,
            "timeout": decision["timeout"] or 20,
            "needs_human": bool(decision["enabled"] and (decision["needs_human"] or not sample_urls)),
            "human_note": decision["human_note"] if decision["enabled"] else "",
            "schedule": schedule,
        })
    enabled = [row for row in rows if row["enabled"]]
    disabled = [row for row in rows if not row["enabled"]]
    schedules = []
    for bucket, spec in BUCKETS.items():
        members = [row["source_id"] for row in enabled if (row.get("schedule") or {}).get("bucket") == bucket]
        schedules.append({
            "bucket": bucket,
            "cron": spec["cron"],
            "label": spec["label"],
            "timezone": "Asia/Shanghai",
            "source_ids": members,
        })
    return {
        "title": "公开数据来源登记",
        "generated_from": "sources.json",
        "generator": "app.ingestion.registry",
        "timezone": "Asia/Shanghai",
        "contact_env": "CRAWLER_CONTACT_EMAIL",
        "enabled_env": "PUBLIC_INGESTION_ENABLED",
        "source_count": len(rows),
        "enabled_count": len(enabled),
        "disabled_count": len(disabled),
        "note": "未启用的来源不会发起抓取。启用项在联系邮箱为空或总开关未打开时也不会由定时任务访问网络。",
        "schedules": schedules,
        "sources": rows,
    }


def attribution_catalog(registry: dict) -> dict:
    return {
        "title": "公开来源署名",
        "sources": [
            {
                "id": row["source_id"],
                "name": row["name"],
                "enabled": row["enabled"],
                "attribution": row["attribution"],
                "reason": row["reason"],
            }
            for row in registry["sources"]
        ],
    }


def load_registry(path: Path | None = None) -> dict:
    return json.loads((path or REGISTRY_PATH).read_text(encoding="utf-8"))


def write_registry(registry: dict | None = None, registry_path: Path | None = None, web_path: Path | None = None) -> dict:
    document = registry or build_registry()
    target = registry_path or REGISTRY_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    catalog_path = web_path or WEB_ATTRIBUTIONS
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps(attribution_catalog(document), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return document
