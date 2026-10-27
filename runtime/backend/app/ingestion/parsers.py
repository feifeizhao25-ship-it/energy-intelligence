"""把各来源的样本解析成统一记录。结构对不上时抛出 SchemaDrift，不猜测数值。"""

from __future__ import annotations

import csv
import io
import json
import re
import xml.etree.ElementTree as ET
from hashlib import sha256

ATOM = "{http://www.w3.org/2005/Atom}"
OAI = "{http://www.openarchives.org/OAI/2.0/}"
DC = "{http://purl.org/dc/elements/1.1/}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"

PROVINCES = (
    "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏",
    "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西",
    "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏",
    "新疆", "冀北", "蒙东", "蒙西",
)
_DATE = re.compile(r"(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})")
_EFFECTIVE = re.compile(r"自\s*(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日")
_EXPIRY = re.compile(r"有效期至\s*(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日")
_DOC = re.compile(r"[\u4e00-\u9fffA-Za-z]{1,12}〔20\d{2}〕\d+号")
_PRICE = re.compile(r"(\d+\.\d+)\s*元\s*/\s*(?:千瓦时|kWh)")
_FACTOR = re.compile(r"(华北|东北|华东|华中|西北|南方|西南|全国)[^\d]{0,24}(\d+\.\d+)\s*(tCO2/MWh|tCO₂/MWh|kgCO2/kWh|kgCO₂/kWh)")
_FACTOR_ROW = re.compile(r"(华北|东北|华东|华中|西北|南方|西南)区域电网\s+(\d+\.\d+)\s+(\d+\.\d+)")
_FACTOR_HEADER = re.compile(r"OM\s*排放因子\s*\(tCO2/MWh\)\s*BM\s*排放因子\s*\(tCO2/MWh\)")
_FOOTPRINT_HEADER = re.compile(r"因子\s*[（(]kgCO2e/kWh[）)]")
_FOOTPRINT_ROW = re.compile(
    r"(全国|燃煤发电|燃气发电|水力发电|核能发电|风力发电|光伏发电|光热发电|生物质发电|输配电（不含线损）|输配电（含线损）)\s+(\d+\.\d+)"
)
_QUOTE = re.compile(r"(收盘价|成交均价|挂牌协议收盘价)\s*[:：]?\s*(\d+\.\d+)")
_CC_OK = ("cc-by", "cc-by-4.0", "cc-by-3.0", "cc-by-2.0", "cc0", "cc0-1.0", "cc-zero")


class SchemaDrift(ValueError):
    """响应不再符合该来源已登记的结构。"""


def parse(parser: str, body: bytes, page_url: str) -> list[dict]:
    handler = {
        "figshare": parse_figshare,
        "tariff": parse_tariff,
        "policy_html": parse_policy_html,
        "generic": parse_generic,
        "osm": parse_osm,
        "gem": parse_gem,
        "gppd": parse_gppd,
        "nasa": parse_nasa,
        "openalex": parse_openalex,
        "arxiv": parse_arxiv,
        "crossref": parse_crossref,
        "doaj": parse_doaj,
        "zenodo": parse_zenodo,
        "chinaxiv": parse_chinaxiv,
        "carbon": parse_carbon,
        "emission": parse_emission,
        "statistics": parse_statistics,
    }.get(parser)
    if handler is None:
        raise SchemaDrift("没有名为 %s 的解析器" % parser)
    return handler(body, page_url)


def _text(body: bytes) -> str:
    return body.decode("utf-8", errors="replace")


def _plain(html: str) -> str:
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", html or "")
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _iso(year, month, day) -> str:
    month_i, day_i = int(month), int(day)
    if not (1 <= month_i <= 12 and 1 <= day_i <= 31):
        return ""
    return "%04d-%02d-%02d" % (int(year), month_i, day_i)


def _title_from_html(html: str) -> str:
    match = re.search(r"(?is)<title[^>]*>(.*?)</title>", html or "")
    return _plain(match.group(1)) if match else ""


def _content_hash(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


def parse_figshare(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("Figshare 响应不是 JSON") from exc
    license_name = ""
    license_field = payload.get("license")
    if isinstance(license_field, dict):
        license_name = str(license_field.get("name") or "")
    elif isinstance(license_field, str):
        license_name = license_field
    lowered = license_name.lower()
    if not license_name or "by" not in lowered or "nc" in lowered:
        raise SchemaDrift("Figshare 许可不是 CC BY")
    title = str(payload.get("title") or "").strip()
    if not title:
        raise SchemaDrift("Figshare 记录缺少标题")
    published = str(payload.get("published_date") or payload.get("created_date") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", published):
        published = ""
    doi = str(payload.get("doi") or "")
    return [{
        "record_key": "figshare:%s" % (doi or payload.get("id") or title),
        "title": title,
        "doc_number": doi or "未标注",
        "issuer": "Figshare",
        "publish_date": published,
        "effective_date": published,
        "expiry_date": None,
        "status": "现行" if published else "待核实",
        "source_url": page_url,
        "as_of": published,
        "license_name": license_name,
        "content_sha256": _content_hash(title + license_name),
        "literature": {
            "external_id": doi or str(payload.get("id") or title),
            "title": title,
            "authors": "",
            "year": int(published[:4]) if published else None,
            "abstract": "",
            "doi": doi or None,
            "url": page_url,
            "source": "figshare",
            "citations": [],
        },
    }]


def parse_tariff(body: bytes, page_url: str) -> list[dict]:
    text = _plain(_text(body))
    if "电价" not in text and "购电" not in text:
        raise SchemaDrift("页面不像代理购电价格公告")
    price = _PRICE.search(text)
    if not price:
        raise SchemaDrift("公告里没有元/千瓦时价格")
    found = [name for name in PROVINCES if name in text]
    if len(found) != 1:
        raise SchemaDrift("公告里的省份无法唯一确定")
    effective = _EFFECTIVE.search(text)
    expiry = _EXPIRY.search(text)
    published = _DATE.search(text)
    effective_date = _iso(*effective.groups()) if effective else ""
    publish_date = _iso(*published.groups()) if published else effective_date
    month_source = effective_date or publish_date
    if not month_source:
        raise SchemaDrift("公告里没有可解析的日期")
    year, month = int(month_source[:4]), int(month_source[5:7])
    doc = _DOC.search(text)
    value = float(price.group(1))
    return [{
        "record_key": "tariff:%s:%04d-%02d" % (found[0], year, month),
        "title": "%s %04d-%02d 代理购电价格" % (found[0], year, month),
        "province": found[0],
        "year": year,
        "month": month,
        "value": value,
        "unit": "元/千瓦时",
        "doc_number": doc.group(0) if doc else "未标注",
        "issuer": "政府公开公告",
        "publish_date": publish_date,
        "effective_date": effective_date or publish_date,
        "expiry_date": _iso(*expiry.groups()) if expiry else None,
        "status": "现行",
        "source_url": page_url,
        "as_of": effective_date or publish_date,
        "content_sha256": _content_hash("%s:%s" % (found[0], value)),
    }]


def parse_policy_html(body: bytes, page_url: str) -> list[dict]:
    html = _text(body)
    title = _title_from_html(html) or _plain(html)[:80]
    if not title:
        raise SchemaDrift("政策页面没有标题")
    text = _plain(html)
    published = _DATE.search(text)
    effective = _EFFECTIVE.search(text)
    publish_date = _iso(*published.groups()) if published else ""
    effective_date = _iso(*effective.groups()) if effective else publish_date
    doc = _DOC.search(text)
    return [{
        "record_key": "policy:%s" % _content_hash(page_url)[:16],
        "title": title[:180],
        "doc_number": doc.group(0) if doc else "未标注",
        "issuer": "政府网站",
        "publish_date": publish_date,
        "effective_date": effective_date,
        "expiry_date": None,
        "status": "现行" if effective_date else "待核实",
        "source_url": page_url,
        "as_of": publish_date,
        "region": "全国",
        "published": publish_date,
        "applicability": effective.group(0) if effective else "",
        "content_sha256": _content_hash(title),
    }]


def parse_generic(body: bytes, page_url: str) -> list[dict]:
    html = _text(body)
    title = _title_from_html(html)
    if not title and html.strip().startswith("{"):
        try:
            payload = json.loads(html)
        except json.JSONDecodeError:
            payload = {}
        title = str(payload.get("title") or payload.get("name") or "")
    if not title:
        raise SchemaDrift("页面没有标题")
    return [{
        "record_key": "page:%s" % _content_hash(page_url)[:16],
        "title": title[:180],
        "doc_number": "未标注",
        "issuer": "",
        "publish_date": "",
        "effective_date": "",
        "expiry_date": None,
        "status": "待核实",
        "source_url": page_url,
        "as_of": "",
        "content_sha256": _content_hash(title),
    }]


def parse_osm(body: bytes, page_url: str) -> list[dict]:
    stripped = body.lstrip()
    if stripped.startswith(b"{") or stripped.startswith(b"["):
        return _overpass(body, page_url)
    if stripped.startswith(b"<") and b"<osm" in stripped[:200].lower():
        return _osm_xml(body, page_url)
    html = _text(body)
    links = re.findall(r"href=\"([^\"]+\.osm\.pbf)\"", html, flags=re.I)
    if not links:
        raise SchemaDrift("Geofabrik 索引页没有提取包链接")
    return [{
        "record_key": "osm:extract:china",
        "title": "开放街图中国提取包",
        "doc_number": "ODbL-1.0",
        "issuer": "Geofabrik",
        "publish_date": "",
        "effective_date": "",
        "expiry_date": None,
        "status": "现行",
        "source_url": page_url,
        "as_of": "",
        "bulk_href": links[0],
        "content_sha256": _content_hash(links[0]),
    }]


def _feature_record(record_key: str, title: str, geometry: dict, page_url: str, power: str) -> dict:
    return {
        "record_key": record_key,
        "title": title,
        "doc_number": "ODbL-1.0",
        "issuer": "OpenStreetMap",
        "publish_date": "",
        "effective_date": "",
        "expiry_date": None,
        "status": "现行",
        "source_url": page_url,
        "as_of": "",
        "feature": {"type": "Feature", "geometry": geometry, "properties": {"name": title, "power": power, "source_url": page_url}},
        "content_sha256": _content_hash(json.dumps(geometry, sort_keys=True)),
    }


def _overpass(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("Overpass 响应不是 JSON") from exc
    if "elements" not in payload:
        raise SchemaDrift("Overpass 响应缺少 elements")
    records = []
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        power = str(tags.get("power") or "")
        if power not in {"substation", "line"}:
            continue
        name = str(tags.get("name") or ("变电站" if power == "substation" else "线路"))
        if element.get("type") == "node" and "lat" in element and "lon" in element:
            geometry = {"type": "Point", "coordinates": [float(element["lon"]), float(element["lat"])]}
        else:
            points = element.get("geometry") or []
            if len(points) < 2:
                continue
            geometry = {"type": "LineString", "coordinates": [[float(point["lon"]), float(point["lat"])] for point in points]}
        records.append(_feature_record("osm:%s:%s" % (element.get("type"), element.get("id")), name, geometry, page_url, power))
    return records


def _osm_xml(body: bytes, page_url: str) -> list[dict]:
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise SchemaDrift("OSM XML 无法解析") from exc
    nodes = {}
    records = []
    for node in root.findall("node"):
        tags = {tag.get("k"): tag.get("v") for tag in node.findall("tag")}
        lat, lon = node.get("lat"), node.get("lon")
        if lat and lon:
            nodes[node.get("id")] = (float(lat), float(lon))
        if tags.get("power") == "substation" and lat and lon:
            records.append(_feature_record(
                "osm:node:%s" % node.get("id"),
                tags.get("name") or "变电站",
                {"type": "Point", "coordinates": [float(lon), float(lat)]},
                page_url,
                "substation",
            ))
    for way in root.findall("way"):
        tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
        if tags.get("power") != "line":
            continue
        coords = [nodes[ref.get("ref")] for ref in way.findall("nd") if ref.get("ref") in nodes]
        if len(coords) < 2:
            continue
        records.append(_feature_record(
            "osm:way:%s" % way.get("id"),
            tags.get("name") or "线路",
            {"type": "LineString", "coordinates": [[lon, lat] for lat, lon in coords]},
            page_url,
            "line",
        ))
    return records


def _csv_rows(body: bytes) -> list[dict]:
    text = _text(body)
    if "\x00" in text[:200] or text.lstrip().startswith("<"):
        raise SchemaDrift("电厂表不是 CSV")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise SchemaDrift("电厂表缺少表头")
    return list(reader)


def parse_gppd(body: bytes, page_url: str) -> list[dict]:
    rows = _csv_rows(body)
    header = set(rows[0].keys()) if rows else set()
    # DictReader fieldnames live on the reader; recover from first row keys or empty.
    if rows:
        header = set(rows[0].keys())
    else:
        header = set(csv.DictReader(io.StringIO(_text(body))).fieldnames or [])
    required = {"name", "capacity_mw", "latitude", "longitude"}
    if not required <= header or not ({"country", "country_long"} & header):
        raise SchemaDrift("全球电厂数据库表头不符合预期")
    records = []
    for row in rows:
        country = (row.get("country_long") or row.get("country") or "").strip()
        if country not in {"China", "CHN", "中国"}:
            continue
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
            capacity = float(row["capacity_mw"])
        except (TypeError, ValueError):
            continue
        plant_id = (row.get("gppd_idnr") or row.get("name") or "").strip()
        name = (row.get("name") or plant_id).strip()
        if not name:
            continue
        records.append(_plant("gppd:%s" % plant_id, name, lat, lon, capacity, row.get("primary_fuel") or "", page_url, "WRI"))
    return records


def parse_gem(body: bytes, page_url: str) -> list[dict]:
    stripped = body.lstrip()
    if not (stripped.startswith(b"Country") or stripped.startswith(b"Plant") or b"," in stripped[:200]):
        return parse_generic(body, page_url)
    rows = _csv_rows(body)
    if not rows:
        raise SchemaDrift("电厂表缺少数据行")
    header = set(rows[0].keys())
    name_key = "Plant name" if "Plant name" in header else "name" if "name" in header else ""
    country_key = "Country/Area" if "Country/Area" in header else "Country" if "Country" in header else ""
    capacity_key = "Capacity (MW)" if "Capacity (MW)" in header else "capacity_mw" if "capacity_mw" in header else ""
    if not (name_key and country_key and capacity_key and "Latitude" in header and "Longitude" in header):
        raise SchemaDrift("全球能源监测表头不符合预期")
    records = []
    for row in rows:
        country = (row.get(country_key) or "").strip()
        if country not in {"China", "中国"}:
            continue
        try:
            lat, lon = float(row["Latitude"]), float(row["Longitude"])
            capacity = float(row[capacity_key])
        except (TypeError, ValueError):
            continue
        name = (row.get(name_key) or "").strip()
        if not name:
            continue
        records.append(_plant("gem:%s:%s:%s" % (name, lat, lon), name, lat, lon, capacity, row.get("Status") or "", page_url, "GEM"))
    return records


def _plant(record_key, name, lat, lon, capacity, fuel, page_url, issuer) -> dict:
    geometry = {"type": "Point", "coordinates": [lon, lat]}
    return {
        "record_key": record_key,
        "title": name,
        "value": capacity,
        "unit": "MW",
        "doc_number": "未标注",
        "issuer": issuer,
        "publish_date": "",
        "effective_date": "",
        "expiry_date": None,
        "status": "现行",
        "source_url": page_url,
        "as_of": "",
        "feature": {"type": "Feature", "geometry": geometry, "properties": {"name": name, "capacity_mw": capacity, "fuel": fuel, "source_url": page_url}},
        "content_sha256": _content_hash("%s:%s" % (name, capacity)),
    }


def parse_nasa(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("NASA POWER 响应不是 JSON") from exc
    parameter = ((payload.get("properties") or {}).get("parameter") or {})
    series = parameter.get("ALLSKY_SFC_SW_DWN") or parameter.get("ALLSKY_SFC_SW_DWN_SUM")
    if not isinstance(series, dict):
        raise SchemaDrift("NASA POWER 缺少辐照参数")
    numbers = []
    year = ""
    for key, value in series.items():
        if not isinstance(value, (int, float)) or key in {"ANN", ""}:
            continue
        if re.fullmatch(r"20\d{2}", str(key)):
            year = str(key)
            numbers = [float(value)]
            break
        if re.fullmatch(r"20\d{4}", str(key)) and float(value) > -100:
            year = str(key)[:4]
            numbers.append(float(value))
    if not numbers or not year:
        raise SchemaDrift("NASA POWER 没有可用的年或月辐照")
    mean = sum(numbers) / len(numbers)
    geometry = (payload.get("geometry") or {}).get("coordinates") or [116.4074, 39.9042]
    lon, lat = float(geometry[0]), float(geometry[1])
    return [{
        "record_key": "nasa:%.4f:%.4f:%s" % (lat, lon, year),
        "title": "%s 年全天空地表短波辐照" % year,
        "value": round(mean, 4),
        "unit": "kWh/m2/day",
        "doc_number": "NASA-POWER",
        "issuer": "NASA POWER",
        "publish_date": "%s-01-01" % year,
        "effective_date": "%s-01-01" % year,
        "expiry_date": None,
        "status": "现行",
        "source_url": page_url,
        "as_of": "",
        "coverage_end": "%s-12-31" % year,
        "content_sha256": _content_hash("%s:%s" % (year, mean)),
    }]


def _authors(names: list[str]) -> str:
    return "; ".join(name for name in names if name)[:200]


def parse_openalex(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("OpenAlex 响应不是 JSON") from exc
    if "results" not in payload:
        raise SchemaDrift("OpenAlex 响应缺少 results")
    raw = []
    for work in payload.get("results") or []:
        title = str(work.get("display_name") or "").strip()
        work_id = str(work.get("id") or "")
        if not title or not work_id:
            continue
        names = []
        for authorship in work.get("authorships") or []:
            author = (authorship or {}).get("author") or {}
            names.append(str(author.get("display_name") or ""))
        doi = str(work.get("doi") or "")
        doi = doi.removeprefix("https://doi.org/")
        raw.append({
            "id": work_id,
            "title": title,
            "authors": names,
            "year": work.get("publication_year"),
            "doi": doi,
            "referenced": [str(item) for item in work.get("referenced_works") or []],
        })
    by_id = {item["id"]: item for item in raw}
    records = []
    for item in raw:
        citations = []
        for ref in item["referenced"]:
            other = by_id.get(ref)
            if other:
                citations.append({"doi": other["doi"], "title": other["title"]})
        records.append(_literature(
            "openalex", item["id"], item["title"], _authors(item["authors"]), item["year"], item["doi"], page_url, citations,
        ))
    return records


def _arxiv_rss(root: ET.Element, page_url: str) -> list[dict]:
    channel = root.find("channel")
    if channel is None:
        raise SchemaDrift("arXiv RSS 缺少频道")
    records = []
    for item in channel.findall("item"):
        title = " ".join((item.findtext("title") or "").split())
        work_id = (item.findtext("guid") or item.findtext("link") or "").strip()
        if not title or not work_id:
            continue
        published = item.findtext("pubDate") or ""
        year_match = re.search(r"(20\d{2})", published)
        year = int(year_match.group(1)) if year_match else None
        creator = item.findtext(DC + "creator") or ""
        authors = [part.strip() for part in creator.split(",") if part.strip()]
        # 摘要在 description 里。元数据任务不保存摘要和全文。
        records.append(_literature("arxiv", work_id, title, _authors(authors), year, "", page_url, []))
    return records


def parse_arxiv(body: bytes, page_url: str) -> list[dict]:
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise SchemaDrift("arXiv 响应不是可解析的元数据") from exc
    if root.tag == "rss" or root.find("channel") is not None:
        return _arxiv_rss(root, page_url)
    entries = root.findall(ATOM + "entry")
    if root.tag != ATOM + "feed" and not entries:
        raise SchemaDrift("arXiv 响应不是 Atom")
    records = []
    for entry in entries:
        title = " ".join((entry.findtext(ATOM + "title") or "").split())
        work_id = (entry.findtext(ATOM + "id") or "").strip()
        if not title or not work_id:
            continue
        published = (entry.findtext(ATOM + "published") or "")[:10]
        year = int(published[:4]) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", published) else None
        authors = [node.findtext(ATOM + "name") or "" for node in entry.findall(ATOM + "author")]
        doi = entry.findtext(ARXIV_NS + "doi") or ""
        records.append(_literature("arxiv", work_id, title, _authors(authors), year, doi, page_url, []))
    return records


def parse_crossref(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("Crossref 响应不是 JSON") from exc
    items = ((payload.get("message") or {}).get("items"))
    if items is None:
        raise SchemaDrift("Crossref 响应缺少 items")
    raw = []
    for item in items:
        titles = item.get("title") or []
        title = titles[0] if titles else ""
        doi = str(item.get("DOI") or "")
        if not title or not doi:
            continue
        names = []
        for author in item.get("author") or []:
            names.append(" ".join(part for part in (author.get("given"), author.get("family")) if part))
        parts = ((item.get("issued") or {}).get("date-parts") or [[]])[0]
        year = parts[0] if parts else None
        citations = []
        for ref in item.get("reference") or []:
            if ref.get("DOI") or ref.get("article-title"):
                citations.append({"doi": str(ref.get("DOI") or ""), "title": str(ref.get("article-title") or "")})
        raw.append((doi, title, names, year, citations))
    return [_literature("crossref", doi, title, _authors(names), year, doi, page_url, citations) for doi, title, names, year, citations in raw]


def parse_doaj(body: bytes, page_url: str) -> list[dict]:
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("DOAJ 响应不是 JSON") from exc
    if "results" not in payload:
        raise SchemaDrift("DOAJ 响应缺少 results")
    records = []
    for item in payload.get("results") or []:
        bib = item.get("bibjson") or {}
        title = str(bib.get("title") or "").strip()
        identifiers = bib.get("identifier") or []
        doi = ""
        for identifier in identifiers:
            if str(identifier.get("type") or "").lower() == "doi":
                doi = str(identifier.get("id") or "")
        external = doi or str(item.get("id") or title)
        if not title or not external:
            continue
        names = [str(author.get("name") or "") for author in bib.get("author") or []]
        year = bib.get("year")
        records.append(_literature("doaj", external, title, _authors(names), year, doi, page_url, []))
    return records


def _rights_commercial(text: str) -> bool:
    low = (text or "").lower()
    if not low.strip():
        return False
    if "nc" in low or "noncommercial" in low or "non-commercial" in low:
        return False
    if "publicdomain/zero" in low or "cc0" in low or "/zero/1.0" in low:
        return True
    return "/licenses/by" in low or "cc-by" in low or "cc by" in low


def _zenodo_oai(body: bytes, page_url: str) -> list[dict]:
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise SchemaDrift("Zenodo 响应不是 OAI") from exc
    if root.tag != OAI + "OAI-PMH":
        raise SchemaDrift("Zenodo 响应不是 OAI")
    error = root.find(OAI + "error")
    if error is not None and (error.get("code") or "") in {"noRecordsMatch"}:
        return []
    if root.find(OAI + "Identify") is not None and root.find(OAI + "ListRecords") is None:
        return []
    records = []
    for record in root.findall(".//" + OAI + "record"):
        header = record.find(OAI + "header")
        identifier = header.findtext(OAI + "identifier") if header is not None else ""
        metadata = record.find(OAI + "metadata")
        if metadata is None or not identifier:
            continue
        rights = " ".join(node.text or "" for node in metadata.iter(DC + "rights"))
        if not _rights_commercial(rights):
            continue
        titles = [node.text or "" for node in metadata.iter(DC + "title")]
        creators = [node.text or "" for node in metadata.iter(DC + "creator")]
        dates = [node.text or "" for node in metadata.iter(DC + "date")]
        identifiers = [node.text or "" for node in metadata.iter(DC + "identifier")]
        title = (titles[0] if titles else "").strip()
        doi = next((item for item in identifiers if str(item).lower().startswith("10.")), "")
        year = None
        for value in dates:
            if re.match(r"20\d{2}", value or ""):
                year = int((value or "")[:4])
                break
        if not title:
            continue
        records.append(_literature("zenodo", identifier, title, _authors(creators), year, doi, page_url, []))
    return records


def parse_zenodo(body: bytes, page_url: str) -> list[dict]:
    if body.lstrip().startswith(b"<"):
        return _zenodo_oai(body, page_url)
    try:
        payload = json.loads(_text(body))
    except json.JSONDecodeError as exc:
        raise SchemaDrift("Zenodo 响应不是 JSON") from exc
    hits = ((payload.get("hits") or {}).get("hits"))
    if hits is None:
        raise SchemaDrift("Zenodo 响应缺少 hits")
    records = []
    for hit in hits:
        meta = hit.get("metadata") or {}
        license_id = str((meta.get("license") or {}).get("id") or "").lower()
        if "nc" in license_id or license_id not in _CC_OK and not license_id.startswith("cc-by"):
            continue
        title = str(meta.get("title") or "").strip()
        external = str(hit.get("id") or "")
        if not title or not external:
            continue
        names = [str(creator.get("name") or "") for creator in meta.get("creators") or []]
        published = str(meta.get("publication_date") or "")[:4]
        year = int(published) if published.isdigit() else None
        doi = str(meta.get("doi") or "")
        records.append(_literature("zenodo", external, title, _authors(names), year, doi, page_url, []))
    return records


def parse_chinaxiv(body: bytes, page_url: str) -> list[dict]:
    try:
        root = ET.fromstring(body)
    except ET.ParseError as exc:
        raise SchemaDrift("ChinaXiv 响应不是 OAI") from exc
    if root.tag != OAI + "OAI-PMH":
        raise SchemaDrift("ChinaXiv 响应不是 OAI")
    error = root.find(OAI + "error")
    if error is not None and (error.get("code") or "") == "noRecordsMatch":
        return []
    records = []
    for record in root.findall(".//" + OAI + "record"):
        header = record.find(OAI + "header")
        identifier = header.findtext(OAI + "identifier") if header is not None else ""
        metadata = record.find(OAI + "metadata")
        if metadata is None or not identifier:
            continue
        dc = metadata.find(DC + "title")
        # 元数据节点可能不带同一前缀层级，退回遍历。
        titles = [node.text or "" for node in metadata.iter(DC + "title")]
        creators = [node.text or "" for node in metadata.iter(DC + "creator")]
        dates = [node.text or "" for node in metadata.iter(DC + "date")]
        identifiers = [node.text or "" for node in metadata.iter(DC + "identifier")]
        title = (titles[0] if titles else "").strip()
        doi = next((item for item in identifiers if item.lower().startswith("10.")), "")
        year = None
        for value in dates:
            if re.match(r"20\d{2}", value or ""):
                year = int(value[:4])
                break
        if not title:
            continue
        records.append(_literature("chinaxiv", identifier, title, _authors(creators), year, doi, page_url, []))
    if not records and root.find(OAI + "Identify") is not None:
        return [{
            "record_key": "chinaxiv:identify",
            "title": "ChinaXiv OAI 识别",
            "doc_number": "OAI-PMH",
            "issuer": "ChinaXiv",
            "publish_date": "",
            "effective_date": "",
            "expiry_date": None,
            "status": "待核实",
            "source_url": page_url,
            "as_of": "",
            "content_sha256": _content_hash("identify"),
        }]
    return records


def _literature(source, external_id, title, authors, year, doi, page_url, citations) -> dict:
    try:
        year_value = int(year) if year not in (None, "") else None
    except (TypeError, ValueError):
        year_value = None
    effective = "%04d-01-01" % year_value if year_value else ""
    return {
        "record_key": "lit:%s:%s" % (source, external_id),
        "title": title[:300],
        "doc_number": doi or "未标注",
        "issuer": source,
        "publish_date": effective,
        "effective_date": effective,
        "expiry_date": None,
        "status": "现行" if year_value else "待核实",
        "source_url": page_url,
        "as_of": effective,
        "content_sha256": _content_hash(title),
        "literature": {
            "external_id": str(external_id)[:180],
            "title": title[:300],
            "authors": authors,
            "year": year_value,
            "abstract": "",
            "doi": doi or None,
            "url": page_url,
            "source": source,
            "citations": citations,
        },
    }


def parse_carbon(body: bytes, page_url: str) -> list[dict]:
    text = _plain(_text(body))
    quote = _QUOTE.search(text)
    if not quote:
        raise SchemaDrift("页面没有可解析的公开行情")
    found_date = _DATE.search(text)
    as_of = _iso(*found_date.groups()) if found_date else ""
    if not as_of:
        raise SchemaDrift("行情页面没有日期")
    value = float(quote.group(2))
    return [{
        "record_key": "carbon:cea:%s" % as_of,
        "title": "%s 全国碳市场%s" % (as_of, quote.group(1)),
        "value": value,
        "unit": "元/吨",
        "doc_number": "CEA",
        "issuer": "上海环境能源交易所",
        "publish_date": as_of,
        "effective_date": as_of,
        "expiry_date": None,
        "status": "现行",
        "source_url": page_url,
        "as_of": as_of,
        "content_sha256": _content_hash("%s:%s" % (as_of, value)),
    }]


def _pdf_text(body: bytes) -> str:
    from io import BytesIO

    from pypdf import PdfReader

    reader = PdfReader(BytesIO(body))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def _factor_record(region: str, year: str, kind: str, number: float, unit: str, page_url: str) -> dict:
    label = ("%s " % kind) if kind else ""
    return {
        "record_key": "factor:%s:%s:%s:%s" % (region, year or "unknown", kind or "value", unit),
        "title": "%s%s%s排放因子" % (region, year, label),
        "value": number,
        "unit": unit,
        "region_name": region,
        "doc_number": "未标注",
        "issuer": "公开文件",
        "publish_date": ("%s-01-01" % year) if year else "",
        "effective_date": ("%s-01-01" % year) if year else "",
        "expiry_date": None,
        "status": "现行" if year else "待核实",
        "source_url": page_url,
        "as_of": ("%s-01-01" % year) if year else "",
        "content_sha256": _content_hash("%s:%s:%s" % (region, kind, number)),
    }


def parse_emission(body: bytes, page_url: str) -> list[dict]:
    if body.lstrip().startswith(b"%PDF"):
        try:
            text = _pdf_text(body)
        except Exception as exc:
            raise SchemaDrift("排放因子文件无法抽出文字") from exc
    else:
        text = _plain(_text(body))
    year_match = re.search(r"(20\d{2})\s*年", text)
    year = year_match.group(1) if year_match else ""
    found = list(_FACTOR.finditer(text))
    if found:
        records = []
        seen = set()
        for match in found:
            region, number, unit = match.group(1), float(match.group(2)), match.group(3)
            key = (region, unit)
            if key in seen:
                continue
            seen.add(key)
            records.append(_factor_record(region, year, "", number, unit, page_url))
        return records
    header = _FACTOR_HEADER.search(text)
    rows = list(_FACTOR_ROW.finditer(text[header.end():])) if header else []
    if rows:
        records = []
        for match in rows:
            region, om, bm = match.group(1), float(match.group(2)), float(match.group(3))
            records.append(_factor_record(region, year, "OM", om, "tCO2/MWh", page_url))
            records.append(_factor_record(region, year, "BM", bm, "tCO2/MWh", page_url))
        return records
    headers = list(_FOOTPRINT_HEADER.finditer(text))
    if headers:
        records = []
        seen = set()
        for index, header in enumerate(headers):
            end = headers[index + 1].start() if index + 1 < len(headers) else len(text)
            for match in _FOOTPRINT_ROW.finditer(text[header.end():end]):
                label, number = match.group(1), float(match.group(2))
                if label in seen:
                    continue
                seen.add(label)
                records.append(_factor_record(label, year, "", number, "kgCO2e/kWh", page_url))
        if records:
            return records
    raise SchemaDrift("文件里没有可解析的排放因子")


def parse_statistics(body: bytes, page_url: str) -> list[dict]:
    return parse_policy_html(body, page_url)
