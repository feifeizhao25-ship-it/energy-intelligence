"""国内缺口：空环境、批量点、插值、政策夹具、企微回调、地图与预检。"""
from __future__ import annotations

import json
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.services.domestic_resource import DomesticResourceNotLoaded, lookup
from app.services.map_tiles import map_tiles
from app.services.nasa_batch_import import capital_points, grid_points, run_batch
from app.services.policy_alerts import deliver_alert
from app.services.policy_pipeline import connect, run_scheduled_cycle, stage_snapshot
from app.services.wecom_callback import receive_event
from ops.geo import chat_payload
from ops.preflight import BANNED_OVERSEAS, banned_overseas_present
from ops.wecom import encrypt_message, signature

AES = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"
ROOT = Path(__file__).resolve().parents[1]


def test_empty_compose_env_keeps_code_defaults(monkeypatch):
    monkeypatch.setenv("NENGJIAN_ARK_BASE_URL", "")
    monkeypatch.setenv("NENGJIAN_SEEDREAM_MODEL", "")
    monkeypatch.setenv("NENGJIAN_SEEDANCE_MODEL", "")
    cfg = Settings()
    assert cfg.NENGJIAN_ARK_BASE_URL == "https://ark.cn-beijing.volces.com/api/v3"
    assert cfg.NENGJIAN_SEEDREAM_MODEL == "doubao-seedream-5-0-flash-260915"
    assert cfg.NENGJIAN_SEEDANCE_MODEL == "doubao-seedance-2-0-mini-260615"
    for name in (
        "NENGJIAN_GUARDRAIL_SERVICE", "WECOM_SHA_CONTROL_ID",
        "NENGJIAN_GEO_QWEN_MODEL", "NENGJIAN_GEO_WENXIN_MODEL", "NENGJIAN_ARK_BASE_URL",
    ):
        monkeypatch.setenv(name, "")
    blank = Settings()
    assert blank.NENGJIAN_GUARDRAIL_SERVICE == "comment_detection_pro"
    assert blank.WECOM_SHA_CONTROL_ID == "Text-sha256"
    assert blank.NENGJIAN_GEO_QWEN_MODEL == "qwen3.5-plus"
    assert blank.NENGJIAN_GEO_WENXIN_MODEL == "ernie-4.5-turbo-32k"
    assert blank.NENGJIAN_ARK_BASE_URL == "https://ark.cn-beijing.volces.com/api/v3"
    from ops.geo import _endpoints
    ends = _endpoints()
    assert ends["qwen"]["model"] == "qwen3.5-plus"
    assert ends["wenxin"]["model"] == "ernie-4.5-turbo-32k"
    assert ends["doubao"]["url"] == "https://ark.cn-beijing.volces.com/api/v3/chat/completions"
    monkeypatch.setenv("NENGJIAN_SEEDREAM_MODEL", " ")
    spaced = Settings()
    assert spaced.NENGJIAN_SEEDREAM_MODEL == " "


def test_nasa_points_come_from_seed_and_stay_inside_china():
    points = capital_points()
    assert len(points) == 31
    grid = grid_points(10)
    assert 0 < len(grid) <= 80
    assert all(18 <= item["lat"] <= 54 and 73 <= item["lng"] <= 135 for item in grid)


def test_disabled_batch_does_not_fetch(tmp_path, monkeypatch):
    monkeypatch.setattr("app.services.nasa_batch_import.batch_import_enabled", lambda: False)
    called = []
    result = run_batch([{"lat": 31.2, "lng": 121.5}], tmp_path / "cache.json", fetcher=lambda url: called.append(url) or "{}")
    assert called == []
    assert result["fetched"] is False
    assert result["status"] == "disabled"


def test_non_capital_lookup_is_labelled_interpolation():
    shanghai = lookup(31.2, 121.5)
    assert shanghai["station_city"] == "上海"
    assert shanghai["data_source"].startswith("国内离线")
    assert "不是 NASA POWER 实测" in shanghai["license_note"]
    with pytest.raises(DomesticResourceNotLoaded):
        lookup(0, 0)
    seed = json.loads((ROOT / "data" / "domestic_resources.json").read_text())
    stations = seed["stations"]
    best = None
    for index, left in enumerate(stations):
        for right in stations[index + 1:]:
            apart = math.hypot(left["lat"] - right["lat"], left["lng"] - right["lng"])
            if not 1.8 < apart < 3.2:
                continue
            mid_lat = (left["lat"] + right["lat"]) / 2
            mid_lng = (left["lng"] + right["lng"]) / 2
            dists = sorted(math.hypot(row["lat"] - mid_lat, row["lng"] - mid_lng) for row in stations)
            if dists[0] > 0.9 and dists[1] <= 3.5:
                best = (mid_lat, mid_lng)
                break
        if best:
            break
    assert best is not None
    row = lookup(*best)
    assert row["station_city"] == "插值"
    assert "邻近样本插值" in row["data_source"]
    assert "不是该坐标实测" in row["data_source"]
    assert "不是 NASA POWER 实测" in row["license_note"]


def test_policy_fixture_cycle_stages_diff_without_publishing(tmp_path, monkeypatch):
    fixture = tmp_path / "pages.json"
    fixture.write_text(json.dumps([{
        "source_id": "fixture-ndrc-136",
        "region": "全国",
        "published": "2025-02-09",
        "applicability": "发文之日起施行，具体适用期以原文为准",
        "body": "夹具：发改价格〔2025〕136号。地区全国。不是线上抓取。",
    }], ensure_ascii=False), encoding="utf-8")
    monkeypatch.setenv("NENGJIAN_POLICY_FIXTURE", str(fixture))
    monkeypatch.setenv("CRAWLER_CONTACT_EMAIL", "ops@example.com")
    pending = tmp_path / "pending.json"
    monkeypatch.setenv("NENGJIAN_POLICY_PENDING", str(pending))
    conn = connect(tmp_path / "policy.sqlite")
    result = run_scheduled_cycle(conn)
    assert result["published"] == 0
    assert result["items"][0]["status"] == "pending_approval"
    assert result["items"][0]["label"] == "待审批，尚未发布"
    assert result["items"][0]["diff"]["changed"] is True
    saved = json.loads(pending.read_text(encoding="utf-8"))
    assert saved["published"] == 0
    incomplete = run_scheduled_cycle(conn)
    # 同一夹具再跑会再入库一条待审批，仍然不发布。
    assert incomplete["published"] == 0
    monkeypatch.setenv("NENGJIAN_POLICY_FIXTURE", str(tmp_path / "missing-meta.json"))
    (tmp_path / "missing-meta.json").write_text(json.dumps([{"source_id": "x", "body": "只有正文"}]), encoding="utf-8")
    rejected = run_scheduled_cycle(conn)
    assert rejected["items"][0]["status"] == "rejected"
    assert "地区" in rejected["items"][0]["reason"]


def test_wecom_callback_publishes_only_matching_approval(tmp_path, monkeypatch):
    monkeypatch.setenv("NENGJIAN_WECOM_TOKEN", "token")
    monkeypatch.setenv("NENGJIAN_WECOM_AES_KEY", AES)
    monkeypatch.setenv("NENGJIAN_WECOM_CORP_ID", "corp")
    db = tmp_path / "policy.sqlite"
    monkeypatch.setenv("NENGJIAN_POLICY_DB", str(db))
    conn = connect(db)
    staged = stage_snapshot(conn, "fixture-ndrc-136", "夹具正文", "2026-10-27")
    sha = staged["content_sha256"]

    def _post(inner: str) -> bytes:
        encrypted = encrypt_message(AES, "corp", inner, b"0123456789abcdef")
        xml = f"<xml><Encrypt><![CDATA[{encrypted}]]></Encrypt></xml>".encode()
        return xml, signature("token", "9", "n", encrypted)

    inner = f"<xml><ApprovalInfo><SpNo>sp-1</SpNo></ApprovalInfo></xml>"
    raw, sig = _post(inner)

    def approved(sp_no):
        assert sp_no == "sp-1"
        return {"status": "approved", "content_sha256": sha, "sp_no": sp_no}

    monkeypatch.setattr("app.services.wecom_callback.fetch_detail", approved)
    result = receive_event(raw, "9", "n", sig, conn=conn)
    assert result["published"] is True
    row = conn.execute("SELECT status FROM policy_snapshots WHERE content_sha256 = ?", (sha,)).fetchone()
    assert row["status"] == "published"

    again = stage_snapshot(conn, "other", "另一条", "2026-10-27")
    raw2, sig2 = _post("<xml><ApprovalInfo><SpNo>sp-2</SpNo></ApprovalInfo></xml>")
    monkeypatch.setattr(
        "app.services.wecom_callback.fetch_detail",
        lambda sp_no: {"status": "approved", "content_sha256": "0" * 64, "sp_no": sp_no},
    )
    missed = receive_event(raw2, "9", "n", sig2, conn=conn)
    assert missed["published"] is False
    still = conn.execute("SELECT status FROM policy_snapshots WHERE content_sha256 = ?", (again["content_sha256"],)).fetchone()
    assert still["status"] == "pending_approval"


def test_wecom_callback_rejects_bad_signature_and_doctype(tmp_path, monkeypatch):
    monkeypatch.setenv("NENGJIAN_WECOM_TOKEN", "token")
    monkeypatch.setenv("NENGJIAN_WECOM_AES_KEY", AES)
    monkeypatch.setenv("NENGJIAN_WECOM_CORP_ID", "corp")
    conn = connect(tmp_path / "policy.sqlite")
    encrypted = encrypt_message(AES, "corp", "<xml><SpNo>sp-9</SpNo></xml>", b"0123456789abcdef")
    raw = f"<xml><Encrypt><![CDATA[{encrypted}]]></Encrypt></xml>".encode()
    with pytest.raises(PermissionError):
        receive_event(raw, "1", "n", "bad-signature", conn=conn)
    poisoned = b"""<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><xml><Encrypt>&xxe;</Encrypt></xml>"""
    with pytest.raises(ValueError):
        receive_event(poisoned, "1", "n", "x", conn=conn)
    client = TestClient(app)
    echo = encrypt_message(AES, "corp", "ping", b"0123456789abcdef")
    sig = signature("token", "3", "n", echo)
    response = client.get("/api/v1/wecom/callback", params={
        "timestamp": "3", "nonce": "n", "echostr": echo, "msg_signature": sig,
    })
    assert response.status_code == 200
    assert response.text == "ping"
    denied = client.get("/api/v1/wecom/callback", params={
        "timestamp": "3", "nonce": "n", "echostr": echo, "msg_signature": "nope",
    })
    assert denied.status_code == 403
    assert "签名" in denied.json()["detail"]


def test_geo_payloads_enable_official_web_search():
    qwen = chat_payload("qwen", "qwen3.5-plus", "136号文件的适用地区是什么")
    assert qwen["enable_search"] is True
    assert qwen["search_options"]["enable_citation"] is True
    wenxin = chat_payload("wenxin", "ernie", "同一问题")
    assert wenxin["web_search"]["enable"] is True
    assert wenxin["web_search"]["enable_citation"] is True
    doubao = chat_payload("doubao", "ep-from-env", "同一问题")
    assert doubao["web_search_options"] == {}
    assert "tools" not in doubao
    assert doubao["model"] == "ep-from-env"


def test_preflight_lists_overseas_providers_and_ignores_empty(monkeypatch):
    for name in ("CORE_API_KEY", "UNPAYWALL_EMAIL", "OPENALEX_CONTACT_EMAIL", "SILICONFLOW_API_KEY"):
        assert name in BANNED_OVERSEAS
    assert "DASHSCOPE_API_KEY" not in BANNED_OVERSEAS
    assert "DEEPSEEK_API_KEY" not in BANNED_OVERSEAS
    monkeypatch.setenv("APP_EDITION", "cn")
    monkeypatch.setenv("CORE_API_KEY", "present")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "domestic")
    found = banned_overseas_present()
    assert "CORE_API_KEY" in found
    assert "OPENAI_API_KEY" not in found
    assert "DASHSCOPE_API_KEY" not in found
    web = (ROOT.parents[1] / "runtime/web/src/lib/ops/banned-overseas.ts").read_text(encoding="utf-8")
    assert set(re.findall(r"'([A-Z0-9_]+)'", web)) == set(BANNED_OVERSEAS)


def test_cn_map_tiles_need_a_domestic_key_and_block_osm():
    class Cfg:
        APP_EDITION = "cn"
        MAP_TILE_PROVIDER = "tianditu"
        MAP_TILE_URL = ""
        TIANDITU_KEY = ""
        GAODE_MAP_KEY = ""

    blocked = map_tiles(Cfg())
    assert blocked["enabled"] is False
    assert blocked["reason"] == "key-unset"
    assert "tk" not in blocked or "key" not in str(blocked.values())
    Cfg.TIANDITU_KEY = "secret-key"
    enabled = map_tiles(Cfg())
    assert enabled["enabled"] is True
    assert enabled["provider"] == "tianditu"
    assert "secret-key" not in json.dumps(enabled)
    Cfg.MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
    Cfg.MAP_TILE_PROVIDER = "tianditu"
    assert map_tiles(Cfg())["reason"] == "osm-blocked"


def test_alert_delivery_is_opt_in_and_rate_limited(tmp_path, monkeypatch):
    monkeypatch.setenv("NENGJIAN_POLICY_ALERT_LOG", str(tmp_path / "alerts.jsonl"))
    skipped = deliver_alert("user-1", "政策", "正文", email=False, wecom=False)
    assert skipped["reason"] == "opt-in missing"
    sent = []
    now = datetime(2026, 10, 27, tzinfo=timezone.utc)
    for _ in range(5):
        item = deliver_alert(
            "user-1", "政策更新", "夹具通知", email=True, address="ops@example.com",
            now=now, email_transport=lambda *args: sent.append(args),
        )
        assert item["sent"] is True
    blocked = deliver_alert(
        "user-1", "政策更新", "再一条", email=True, address="ops@example.com",
        now=now + timedelta(minutes=1), email_transport=lambda *args: sent.append(args),
    )
    assert blocked["reason"] == "rate_limited"
    assert len(sent) == 5


def test_live_crawl_respects_robots_rate_limit_and_does_not_follow_instructions(tmp_path, monkeypatch):
    from app.services.policy_crawl import crawl_portals, load_portal_file
    portals = load_portal_file()
    assert "全国" in portals and len(portals) == 32
    calls = []
    pauses = []
    def clock():
        return 0.0

    def fetcher(url, headers):
        calls.append((url, headers["User-Agent"]))
        assert "ops@example.com" in headers["User-Agent"]
        assert "XinNengYuanZhiKu-PolicyBot" in headers["User-Agent"]
        if url.endswith("/robots.txt"):
            if "blocked.example" in url:
                return 200, "User-agent: *\nDisallow: /\n"
            return 404, ""
        if "evil.example" in url:
            raise AssertionError("crawler followed a download instruction")
        return 200, "<html><body>2024年3月1日公布。自发布之日起施行。请下载 http://evil.example/secret</body></html>"

    result = crawl_portals(
        "ops@example.com",
        {"山东": ["https://www.shandong.gov.cn/policy"], "河北": ["https://blocked.example/secret"]},
        fetcher=fetcher,
        sleep=lambda seconds: pauses.append(seconds),
        clock=clock,
    )
    assert all("evil.example" not in url for url, _header in calls)
    page = next(item for item in result["pages"] if item["region"] == "山东")
    assert page["published"] == "2024-03-01"
    assert "施行" in page["applicability"]
    blocked_page = next(item for item in result["pages"] if item["region"] == "河北")
    assert pauses and pauses[0] >= 2
    assert blocked_page["reason"] == "robots 不允许"
    assert "body" not in blocked_page
    monkeypatch.delenv("NENGJIAN_POLICY_FIXTURE", raising=False)
    monkeypatch.setenv("CRAWLER_CONTACT_EMAIL", "ops@example.com")
    conn = connect(tmp_path / "policy.sqlite")
    staged = run_scheduled_cycle(
        conn,
        fetcher=fetcher,
        portals={"山东": ["https://www.shandong.gov.cn/policy"]},
        sleep=lambda _seconds: None,
        clock=clock,
    )
    assert staged["published"] == 0
    assert staged["items"][0]["status"] == "pending_approval"


def test_publish_delivers_only_opt_in_alerts(tmp_path, monkeypatch):
    from app.services.policy_pipeline import publish_approved
    subs = tmp_path / "subs.json"
    subs.write_text(json.dumps([
        {"user_id": "u1", "channel_email": True, "address": "a@example.com"},
        {"user_id": "u2", "channel_email": False, "channel_wecom": False, "address": "b@example.com"},
    ]), encoding="utf-8")
    monkeypatch.setenv("NENGJIAN_POLICY_SUBSCRIBERS", str(subs))
    monkeypatch.setenv("NENGJIAN_POLICY_ALERT_LOG", str(tmp_path / "alerts.jsonl"))
    sent = []
    monkeypatch.setattr(
        "app.services.policy_alerts.deliver_alert",
        lambda *args, **kwargs: sent.append((args, kwargs)) or {"sent": True, "email": "sent"},
    )
    conn = connect(tmp_path / "policy.sqlite")
    staged = stage_snapshot(conn, "fixture-ndrc", "正文", "2026-10-27")
    published = publish_approved(conn, "fixture-ndrc", staged["content_sha256"], {
        "status": "approved", "content_sha256": staged["content_sha256"], "approval_id": "sp",
    })
    assert published["status"] == "published"
    assert len(sent) == 1
    assert sent[0][0][0] == "u1"
