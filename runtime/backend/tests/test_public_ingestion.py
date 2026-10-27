"""公开数据入库：许可证闸门、夹具解析、冲突不覆盖、定时错峰。不访问网络。"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.ingestion.http_client import PoliteClient, latin1_headers, user_agent
from app.ingestion.parsers import SchemaDrift, parse
from app.ingestion.registry import REGISTRY_PATH, WEB_ATTRIBUTIONS, attribution_catalog, build_registry, load_registry
from app.ingestion.runner import run_source
from app.ingestion.schedule import BUCKETS
from app.ingestion.store import IngestStore
from app.services.electricity_prices import connect as price_connect, insert_price
from app.services.nasa_batch_import import planned_monthly_url
from app.services.policy_pipeline import connect as policy_connect

FIXTURES = Path(__file__).parent / "fixtures" / "public_ingestion"
BLOCKED = ("cnki.net", "wanfangdata.com.cn", "cqvip.com", "energydc.cn", "data.cma.cn", "solcast.com", "sciencedb.01094")


def _read(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def _source(**overrides) -> dict:
    base = {
        "source_id": "pub-test",
        "name": "测试来源",
        "enabled": True,
        "reason": "",
        "parser": "tariff",
        "kind": "tariff",
        "sla_type": "agency_tariff",
        "interval_days": 3,
        "license_terms": "政府公开信息",
        "attribution": "数据来自测试公告。政府公开信息。请保留文号与原文链接，不得冒充发布机关。",
        "source_tier": "一手官方",
        "jurisdiction": "省",
        "fulltext_allowed": False,
        "sample_urls": ["https://example.test/notice.html"],
        "max_bytes": 100000,
        "timeout": 5,
        "human_note": "",
        "schedule": {"bucket": "monthly_official"},
    }
    base.update(overrides)
    return base


def _client(body: bytes, robots: bytes = b"", status_for_robots: int = 404):
    def fetcher(url, headers, timeout, max_bytes):
        assert "contact: ops@example.com" in headers["User-Agent"]
        if url.endswith("/robots.txt"):
            return status_for_robots, robots
        return 200, body

    return PoliteClient("ops@example.com", fetcher=fetcher, sleep=lambda _delay: None, clock=lambda: 0)


def test_contact_user_agent_survives_latin1_header_encoding():
    original = user_agent("ops@example.com")
    encoded = latin1_headers({"User-Agent": original})["User-Agent"]
    assert encoded.encode("latin-1").decode("utf-8") == original
    assert "contact: ops@example.com" in original


def test_registry_matches_generator_and_blocks_noncommercial_sources():
    registry = load_registry()
    assert registry == build_registry()
    assert registry["source_count"] == 56
    assert registry["enabled_count"] + registry["disabled_count"] == 56
    by_name = {row["name"]: row for row in registry["sources"]}
    assert by_name["PVOD v1.0 中国光伏出力数据集（Science Data Bank）"]["code"] == "research_only"
    assert "付费" in by_name["CNKI 中国知网"]["reason"]
    assert "付费" in by_name["万方数据 / 维普"]["reason"]
    assert "授权" in by_name["中国气象数据网 data.cma.cn"]["reason"]
    assert by_name["NASA POWER API"]["enabled"] is True
    assert by_name["OpenAlex Works API（元数据 CC0；全文按篇许可）"]["fulltext_allowed"] is False
    assert by_name["各省电网公司「代理购电价格」月度公示（一手源）"]["needs_human"] is True
    assert by_name["各省电网公司「代理购电价格」月度公示（一手源）"]["sample_urls"] == []
    for row in registry["sources"]:
        if row["enabled"]:
            assert row["attribution"].startswith("数据来自")
            assert row["schedule"]["cron"] != "15 2 * * *"
            for url in row["sample_urls"]:
                assert not any(host in url for host in BLOCKED)
        else:
            assert row["sample_urls"] == []
            assert row["attribution"] == ""
    assert json.loads(WEB_ATTRIBUTIONS.read_text(encoding="utf-8")) == attribution_catalog(registry)
    nasa = by_name["NASA POWER API"]
    assert nasa["sample_urls"] == []
    assert nasa["needs_human"] is True
    assert "robots" in nasa["human_note"]
    assert planned_monthly_url(39.9042, 116.4074, 2023) not in nasa["sample_urls"]
    assert by_name["OpenStreetMap 中国提取（Geofabrik）power=*"]["sample_urls"] == [
        "https://download.geofabrik.de/asia/china.html"
    ]
    assert by_name["arXiv API"]["sample_urls"] == ["https://arxiv.org/rss/physics.app-ph"]
    assert "{from}" in by_name["Zenodo"]["sample_urls"][0]
    from app.ingestion.access_routes import blocked_reason
    for row in registry["sources"]:
        for url in row["sample_urls"]:
            assert blocked_reason(url) == ""


def test_schedule_does_not_reuse_the_province_crawl_slot():
    from app.tasks.celery_app import celery_app

    assert celery_app.conf.timezone == "Asia/Shanghai"
    daily = celery_app.conf.beat_schedule["policy-snapshot-daily"]
    assert daily["schedule"].hour == {2}
    assert daily["schedule"].minute == {15}
    for bucket in BUCKETS:
        entry = celery_app.conf.beat_schedule["public-ingest-%s" % bucket]
        assert entry["task"] == "energy.domestic.public_ingest"
        assert not (entry["schedule"].hour == {2} and entry["schedule"].minute == {15})
    assert "energy.domestic.public_ingest" in celery_app.tasks


def test_disabled_and_missing_contact_do_not_fetch(tmp_path):
    calls = []

    def fetcher(url, headers, timeout, max_bytes):
        calls.append(url)
        return 200, b""

    client = PoliteClient("ops@example.com", fetcher=fetcher, sleep=lambda _delay: None, clock=lambda: 0)
    disabled = run_source(_source(enabled=False, reason="付费墙"), contact="ops@example.com", client=client)
    assert disabled["status"] == "disabled"
    missing = run_source(_source(), contact="", client=client)
    assert missing["status"] == "skipped"
    assert missing["reason"] == "未配置联系邮箱"
    human = run_source(_source(sample_urls=[], human_note="分省公告地址仍为空"), contact="ops@example.com", client=client)
    assert human["status"] == "needs_human"
    assert calls == []


def test_fixtures_normalise_into_existing_shapes(tmp_path):
    figshare = parse("figshare", _read("figshare_article.json"), "https://api.figshare.com/v2/articles/32182515")
    assert figshare[0]["literature"]["source"] == "figshare"
    assert figshare[0]["effective_date"] == "2026-03-01"
    with pytest.raises(SchemaDrift):
        parse("figshare", b'{"title":"x","license":{"name":"CC BY-NC 4.0"}}', "https://example.test")

    tariff = parse("tariff", _read("tariff_notice.html"), "https://example.test/jiangsu")
    assert tariff[0]["province"] == "江苏"
    assert tariff[0]["value"] == 0.4521
    assert tariff[0]["effective_date"] == "2026-10-01"
    assert tariff[0]["expiry_date"] == "2026-10-31"
    assert tariff[0]["record_key"] == "tariff:江苏:2026-10"

    extract = parse("osm", _read("geofabrik_china.html"), "https://download.geofabrik.de/asia/china.html")
    assert extract[0]["bulk_href"].endswith(".osm.pbf")
    overpass = parse("osm", _read("overpass_power.json"), "https://overpass-api.de/api/interpreter")
    kinds = {item["feature"]["geometry"]["type"] for item in overpass}
    assert kinds == {"Point", "LineString"}
    xml_features = parse("osm", _read("osm_power.xml"), "https://example.test/osm")
    assert len(xml_features) == 2

    plants = parse("gppd", _read("gppd_sample.csv"), "https://example.test/gppd.csv")
    assert [item["title"] for item in plants] == ["测试光伏电站"]
    assert plants[0]["value"] == 50.5
    gem = parse("gem", _read("gem_sample.csv"), "https://example.test/gem.csv")
    assert gem[0]["title"] == "测试风电场"

    nasa = parse("nasa", _read("nasa_power.json"), "https://power.larc.nasa.gov/api")
    assert nasa[0]["unit"] == "kWh/m2/day"
    assert nasa[0]["effective_date"] == "2023-01-01"
    assert nasa[0]["expiry_date"] is None
    with pytest.raises(SchemaDrift):
        parse("nasa", b'{"properties":{}}', "https://power.larc.nasa.gov/api")

    works = parse("openalex", _read("openalex_works.json"), "https://api.openalex.org/works")
    assert works[0]["literature"]["citations"][0]["title"] == "被引论文"
    assert "pdfUrl" not in works[0]["literature"]
    crossref = parse("crossref", _read("crossref_works.json"), "https://api.crossref.org/works")
    assert crossref[0]["literature"]["doi"] == "10.1000/soiling"
    arxiv = parse("arxiv", _read("arxiv_atom.xml"), "https://export.arxiv.org/api/query")
    assert arxiv[0]["literature"]["source"] == "arxiv"
    rss = parse("arxiv", _read("arxiv_rss.xml"), "https://arxiv.org/rss/physics.app-ph")
    assert rss[0]["title"] == "光伏积灰示例"
    assert rss[0]["literature"]["abstract"] == ""
    doaj = parse("doaj", _read("doaj_articles.json"), "https://doaj.org/api")
    assert doaj[0]["title"] == "储能调度综述"
    zenodo = parse("zenodo", _read("zenodo_records.json"), "https://zenodo.org/api/records")
    assert [item["title"] for item in zenodo] == ["可商用记录"]
    oai = parse("zenodo", _read("zenodo_oai.xml"), "https://zenodo.org/oai2d")
    assert [item["title"] for item in oai] == ["可商用记录"]
    chinaxiv = parse("chinaxiv", _read("chinaxiv_oai.xml"), "http://www.chinaxiv.org/oai")
    assert chinaxiv[0]["literature"]["source"] == "chinaxiv"
    assert chinaxiv[0]["literature"].get("pdfUrl") is None

    quote = parse("carbon", _read("carbon_quote.html"), "https://overview.cneeex.com/qgtpfqjy/mrgk/")
    assert quote[0]["value"] == 68.5
    assert quote[0]["as_of"] == "2026-10-26"
    factors = parse("emission", _read("emission_factor.txt"), "https://example.test/factor.txt")
    assert {item["region_name"] for item in factors} >= {"华北", "全国"}
    table = parse("emission", _read("emission_table.txt"), "https://example.test/factor.pdf")
    by_key = {item["record_key"]: item["value"] for item in table}
    assert by_key["factor:华北:2024:OM:tCO2/MWh"] == 0.9531
    assert by_key["factor:华北:2024:BM:tCO2/MWh"] == 0.3095
    footprint = parse("emission", _read("emission_footprint.txt"), "https://example.test/footprint.pdf")
    footprint_values = {item["region_name"]: item["value"] for item in footprint}
    assert footprint_values["全国"] == 0.5777
    assert footprint_values["光伏发电"] == 0.052
    assert {item["unit"] for item in footprint} == {"kgCO2e/kWh"}
    policy = parse("policy_html", _read("policy_page.html"), "https://www.nea.gov.cn/")
    assert policy[0]["published"] == "2026-10-20"
    assert policy[0]["applicability"]

    store = IngestStore(tmp_path / "ingest.sqlite")
    client = _client(_read("tariff_notice.html"))
    report = run_source(
        _source(), contact="ops@example.com", client=client, store=store,
        snapshot_dir=tmp_path / "snaps", dry_run=False, fetched_at="2026-10-27T01:00:00+00:00",
    )
    assert report["status"] == "fetched"
    saved = store.accepted()[0]
    assert saved["verification_code"] == "verified"
    assert saved["freshness"]["usable"] is True
    assert len(saved["snapshot_sha256"]) == 64
    rows = store.verified_tariff_rows()
    conn = price_connect(tmp_path / "prices.sqlite")
    insert_price(conn, {
        "province": rows[0]["province"],
        "year": 2026,
        "month": 10,
        "price_yuan_per_kwh": rows[0]["priceYuanPerKwh"],
        "source_url": rows[0]["sourceUrl"],
        "effective_date": "2026-10-01",
        "retrieved_at": "2026-10-27",
        "license_note": rows[0]["licenseNote"],
    })

    literature = IngestStore(tmp_path / "lit.sqlite")
    for record in works:
        record = {**record, "source_id": "pub-25", "kind": "literature", "attribution": "数据来自 OpenAlex。元数据为 CC0。",
                  "license": "CC0", "source_tier": "学术", "snapshot_sha256": "a" * 64, "fetched_at": "2026-10-27T00:00:00+00:00",
                  "as_of": "2024-01-01", "fulltext_allowed": False}
        literature.upsert(record, "2026-10-27T00:00:00+00:00")
    cache = literature.literature_cache("开放元数据，定时任务不保存全文。")
    assert cache["records"][0]["citations"][0]["title"] == "被引论文"
    assert cache["fetched_live_on_request"] is False

    layers = IngestStore(tmp_path / "map.sqlite")
    for record in overpass:
        record = {**record, "source_id": "pub-10", "kind": "grid_asset", "attribution": "数据来自开放街图。许可为 ODbL 1.0，请署名开放街图贡献者。",
                  "license": "ODbL", "source_tier": "协会", "snapshot_sha256": "b" * 64, "fetched_at": "2026-10-27T00:00:00+00:00",
                  "as_of": "2026-10-27"}
        layers.upsert(record, "2026-10-27T00:00:00+00:00")
    document = layers.map_document()
    assert len(document["layers"][0]["features"]) == 2
    assert "开放街图" in document["license_note"]

    policy_db = tmp_path / "policy.sqlite"
    run_source(
        _source(parser="policy_html", kind="policy", sample_urls=["https://www.nea.gov.cn/"], source_tier="一手官方", jurisdiction="全国"),
        contact="ops@example.com", client=_client(_read("policy_page.html")), store=IngestStore(tmp_path / "policy-ingest.sqlite"),
        dry_run=False, fetched_at="2026-10-27T01:00:00+00:00", policy_db=policy_db,
    )
    conn = policy_connect(policy_db)
    row = conn.execute("SELECT status FROM policy_snapshots").fetchone()
    assert row["status"] == "pending_approval"


def test_conflicting_value_stays_pending_and_drift_alerts(tmp_path):
    store = IngestStore(tmp_path / "ingest.sqlite")
    moment = "2026-10-27T01:00:00+00:00"
    first = run_source(
        _source(), contact="ops@example.com", client=_client(_read("tariff_notice.html")),
        store=store, dry_run=False, fetched_at=moment,
    )
    assert first["pending"] == 0
    other = _read("tariff_notice.html").replace(b"0.4521", b"0.5100")
    second = run_source(
        _source(source_id="pub-other"), contact="ops@example.com", client=_client(other),
        store=store, dry_run=False, fetched_at="2026-10-27T02:00:00+00:00",
    )
    assert second["pending"] == 1
    assert store.pending()[0]["queue"] == "待核验"
    assert store.accepted("tariff:江苏:2026-10")[0]["value"] == 0.4521
    revised = dict(store.accepted("tariff:江苏:2026-10")[0])
    revised["source_id"] = "pub-alt"
    revised["issuer"] = "另一发布机关"
    revised["value"] = 0.51
    revised["content_sha256"] = "c" * 64
    conflict = store.upsert(revised, "2026-10-27T03:00:00+00:00")
    assert conflict["queue"] == "待核验"
    assert conflict["verification_label"] == "冲突"
    assert store.accepted("tariff:江苏:2026-10")[0]["value"] == 0.4521

    alerts = []
    drifted = run_source(
        _source(parser="nasa", kind="irradiance", interval_days=365, source_tier="学术"),
        contact="ops@example.com", client=_client(b'{"properties":{}}'),
        store=store, dry_run=False, alert=lambda source_id, title, detail: alerts.append((source_id, title, detail)),
    )
    assert drifted["status"] == "schema_drift"
    assert alerts and "结构偏离" in alerts[0][1]
    assert len(store.accepted()) == 1


def test_emission_notice_follows_the_single_same_site_pdf():
    notice = _read("emission_notice.html")
    factor = _read("emission_factor.txt")
    seen = []

    def fetcher(url, headers, timeout, max_bytes):
        seen.append(url)
        if url.endswith("/robots.txt"):
            return 404, b""
        if url.endswith(".pdf"):
            return 200, factor
        return 200, notice

    client = PoliteClient("ops@example.com", fetcher=fetcher, sleep=lambda _delay: None, clock=lambda: 0)
    report = run_source(
        _source(parser="emission", kind="emission_factor", sample_urls=["https://example.test/notice.html"]),
        contact="ops@example.com", client=client,
    )
    assert report["status"] == "fetched"
    assert report["records"] == 2
    assert seen[-1] == "https://example.test/factors.pdf"


def test_robots_disallow_skips_without_alert():
    robots = _read("robots_disallow.txt")
    calls = []

    def fetcher(url, headers, timeout, max_bytes):
        calls.append(url)
        if url.endswith("/robots.txt"):
            return 200, robots
        return 200, "<html><title>不应抓到</title></html>".encode("utf-8")

    client = PoliteClient("ops@example.com", fetcher=fetcher, sleep=lambda _delay: None, clock=lambda: 0)
    alerts = []
    report = run_source(
        _source(parser="generic", kind="dataset_meta", sample_urls=["https://example.test/private/file"]),
        contact="ops@example.com", client=client, alert=lambda *args: alerts.append(args),
    )
    assert report["status"] == "skipped"
    assert report["fetched"][0]["reason"] == "robots 不允许"
    assert all(url.endswith("/robots.txt") for url in calls)
    assert alerts == []


def test_task_is_closed_until_switch_and_contact(monkeypatch):
    monkeypatch.delenv("PUBLIC_INGESTION_ENABLED", raising=False)
    monkeypatch.delenv("CRAWLER_CONTACT_EMAIL", raising=False)
    from app.tasks.public_ingestion import public_ingest

    assert public_ingest("daily_literature")["status"] == "noop"
    monkeypatch.setenv("PUBLIC_INGESTION_ENABLED", "1")
    monkeypatch.setenv("NENGJIAN_POLICY_ALERT_LOG", "/tmp/nengjian-public-ingest-alerts.jsonl")
    skipped = public_ingest("daily_literature")
    assert skipped["status"] == "skipped"
    from app.ingestion.alerts import notify_problem
    closed = notify_problem("pub-test", "公开数据抓取失败", "夹具")
    assert closed["sent"] is False
    assert closed["reason"] == "opt-in missing"


def test_checked_in_registry_file_is_the_build_output():
    assert REGISTRY_PATH.is_file()
    assert load_registry(REGISTRY_PATH)["generator"] == "app.ingestion.registry"
