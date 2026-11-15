"""国内构建：底线红队、预算、国内模型、RAG 时效、电价 SQL、运营入口。"""
import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from app.config import Settings
from app.services.bottom_line import NOTICE_ZH, enforce_bottom_line, find_violations
from app.services.budget_caps import BudgetExceeded, assert_product_budget, charge_product_budget, reset_budget_state
from app.services.electricity_prices import connect as price_connect, insert_price, query_prices
from app.services.policy_pipeline import connect as policy_connect, publish_approved, stage_snapshot
from app.services.rag_sources import SourceRegistry
from app.services.skill_improvement import (
    clawhub_install_allowed,
    evaluate_gates,
    needs_human_approval,
    run_cycle,
    strip_pii,
)
from ops.killswitch import is_killed
from ops.preflight import preflight
from ops.publish import build_tier_b_pack, mark_published, publish_a, publish_c, within_publish_window
from ops.seo import PILOT_CAP, generate_pages
from ops.switches import SWITCHES
from ops.wecom import decrypt_message, encrypt_message, fetch_approval_detail, signature, verify_callback

ROOT = Path(__file__).resolve().parents[1]
REDTEAM = json.loads((ROOT / "data" / "redteam_prompts.json").read_text())


def test_redteam_set_is_about_200_and_all_blocked():
    prompts = REDTEAM["prompts"]
    assert len(prompts) >= 200
    for prompt in prompts:
        assert find_violations(prompt, market="cn"), prompt
        assert enforce_bottom_line(prompt, market="cn") == NOTICE_ZH


def test_disclaimer_is_not_treated_as_advice():
    text = "测算结果仅供参考，不构成投资建议。"
    assert find_violations(text, market="cn") == []
    assert enforce_bottom_line(text, market="cn") == text


def test_global_market_skips_paraphrase_layer():
    assert find_violations("请给投资建议", market="global") == []


@pytest.mark.asyncio
async def test_cn_edition_blocks_overseas_resource_http(monkeypatch):
    monkeypatch.setattr("app.services.overseas_gate.settings.APP_EDITION", "cn")
    calls = {"n": 0}

    class Client:
        def __init__(self, *args, **kwargs):
            calls["n"] += 1

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, *args, **kwargs):
            calls["n"] += 1
            raise AssertionError("overseas http")

    monkeypatch.setattr("app.services.resource_service.httpx.AsyncClient", Client)
    monkeypatch.setattr("app.services.nasa_power_service.httpx.AsyncClient", Client)
    from app.api.v1.research import search_arxiv
    from app.schemas.resource import SolarResourceRequest, WindResourceRequest
    from app.services.nasa_power_service import NASAPowerService
    from app.services.resource_service import fetch_solar_resource, fetch_wind_resource

    from app.services.domestic_resource import DomesticResourceNotLoaded

    solar = await fetch_solar_resource(SolarResourceRequest(lat=31.2, lng=121.5))
    wind = await fetch_wind_resource(WindResourceRequest(lat=31.2, lng=121.5))
    nasa = await NASAPowerService().get_solar_resource(31.2, 121.5)
    assert solar.ghi > 0 and "NASA" not in solar.data_source
    assert wind.mean_speed > 0
    assert nasa["ghi_annual"] > 0 and "NASA" not in nasa["data_source"]
    with pytest.raises(DomesticResourceNotLoaded):
        await fetch_solar_resource(SolarResourceRequest(lat=0, lng=0))
    assert await search_arxiv("solar") == []
    assert calls["n"] == 0


def test_cn_budget_caps(monkeypatch):
    reset_budget_state()
    monkeypatch.setattr("app.services.budget_caps.settings.APP_EDITION", "cn")
    monkeypatch.setattr("app.services.budget_caps.settings.NENGJIAN_USER_DAILY_BUDGET_CNY", 0.02)
    monkeypatch.setattr("app.services.budget_caps.settings.NENGJIAN_USER_MONTHLY_BUDGET_CNY", 1)
    monkeypatch.setattr("app.services.budget_caps.settings.NENGJIAN_MODEL_CALL_CNY", 0.02)
    assert_product_budget("user-a", "cn")
    charge_product_budget("user-a")
    with pytest.raises(BudgetExceeded):
        assert_product_budget("user-a", "cn")
    reset_budget_state()


def test_nengjian_key_alias_does_not_print_secret():
    cfg = Settings(NENGJIAN_DEEPSEEK_API_KEY="unit-test-key", DEEPSEEK_API_KEY=None)
    assert cfg.DEEPSEEK_API_KEY == "unit-test-key"


def test_policy_136_is_not_688():
    registry = SourceRegistry.from_file()
    doc = registry.get("policy-cn-136")
    assert "136" in doc["version"]
    assert "688" not in doc["title"]
    assert "688" not in doc["version"]
    other = registry.get("policy-cn-688")
    assert other and "688" in other["version"]
    assert other["effective_date"]
    assert other["expiry"] is None
    assert registry.validate() == []


def test_price_query_is_sql_not_a_vector_hit(tmp_path):
    conn = price_connect(tmp_path / "prices.sqlite")
    assert query_prices(conn, "江苏", 2026, 9) == []
    insert_price(conn, {
        "province": "江苏", "year": 2026, "month": 9, "price_yuan_per_kwh": 0.4123,
        "source_url": "https://example.gov/price", "effective_date": "2026-09-01",
        "retrieved_at": "2026-10-01", "license_note": "测试行，不是生产电价",
    })
    rows = query_prices(conn, "江苏", 2026, 9)
    assert rows[0]["price_yuan_per_kwh"] == 0.4123
    assert "example.gov" in rows[0]["source_url"]


def test_policy_publish_requires_matching_approval(tmp_path):
    conn = policy_connect(tmp_path / "policy.sqlite")
    staged = stage_snapshot(conn, "policy-cn-136", "正文", "2026-10-27")
    with pytest.raises(PermissionError):
        publish_approved(conn, "policy-cn-136", staged["content_sha256"], {"status": "timeout"})
    with pytest.raises(PermissionError):
        publish_approved(conn, "policy-cn-136", staged["content_sha256"], {"status": "approved", "content_sha256": "0" * 64})
    published = publish_approved(conn, "policy-cn-136", staged["content_sha256"], {
        "status": "approved", "content_sha256": staged["content_sha256"], "approval_id": "sp1",
    })
    assert published["status"] == "published"


def test_skill_loop_noop_human_gate_and_no_clawhub():
    assert clawhub_install_allowed() is False
    assert run_cycle([], lambda *_: {})["status"] == "noop"
    assert strip_pii("联系 13800138000 或 a@b.cn") == "联系 [redacted] 或 [redacted]"
    blocked = run_cycle(
        [{"id": "1", "text": "失败样本"}],
        lambda *_: {},
        human_approved=False,
    )
    # candidate does not touch compliance, so it is judged by metrics
    assert blocked["status"] == "rejected"
    assert needs_human_approval({"touches_formula": True})
    ok = evaluate_gates({
        "citation_accuracy": 1, "freshness_correctness": 0.99, "redteam_blocked": 1,
        "calculator_reference": 100, "calculator_actual": 100.5,
    })
    assert ok["passed"]
    bad = evaluate_gates({
        "citation_accuracy": 0.9, "freshness_correctness": 1, "redteam_blocked": 1,
        "calculator_reference": 100, "calculator_actual": 102,
    })
    assert "citation_accuracy" in bad["failures"]
    assert "calculator_tolerance" in bad["failures"]


def test_ops_preflight_hides_secret_values(tmp_path, monkeypatch):
    secret = "super-secret-value"
    envfile = tmp_path / "secrets.env"
    envfile.write_text(f"NENGJIAN_DEEPSEEK_API_KEY={secret}\n", encoding="utf-8")
    monkeypatch.delenv("NENGJIAN_DEEPSEEK_API_KEY", raising=False)
    report = preflight(envfile)
    blob = json.dumps(report)
    assert secret not in blob
    assert report["modules"]["deepseek"]["enabled"] is True
    assert report["modules"]["glm"]["enabled"] is False


def test_publish_tiers_and_kill_switch(monkeypatch, tmp_path):
    assert all(value is False for value in SWITCHES.values())
    noon = datetime(2026, 10, 27, 12, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
    night = datetime(2026, 10, 27, 22, 0, tzinfo=ZoneInfo("Asia/Shanghai"))
    assert within_publish_window(noon)
    assert not within_publish_window(night)
    assert publish_a(noon, True, "abc", True)["published"] is False
    assert publish_c()["published"] is False
    assert build_tier_b_pack("标题", "正文", "abc")["ready"] is False
    SWITCHES["publish_b"] = True
    try:
        pack = build_tier_b_pack("标题", "正文", "abc")
        marked = mark_published(pack, "https://example.com/post")
        assert marked["status"] == "已发布"
    finally:
        SWITCHES["publish_b"] = False
    kill = tmp_path / "KILL"
    kill.write_text("1", encoding="utf-8")
    monkeypatch.setenv("NENGJIAN_KILL_FILE", str(kill))
    assert is_killed()
    monkeypatch.delenv("NENGJIAN_KILL_FILE", raising=False)
    assert is_killed("停止所有操作")


def test_seo_cap_and_quality_gate():
    page = {"id": "p", "title": "江苏代理购电电价", "body": "方法与来源", "table": [["月份", "电价"]], "source_url": "https://example.gov/a"}
    bad = {"id": "bad", "title": "推荐投资", "body": "值得投资", "table": [["a", "b"]], "source_url": "https://example.gov/b"}
    SWITCHES["seo_generate"] = True
    try:
        result = generate_pages([page, bad] + [{**page, "id": f"x{i}"} for i in range(PILOT_CAP)])
    finally:
        SWITCHES["seo_generate"] = False
    assert len(result["generated"]) == PILOT_CAP
    assert any(item["id"] == "bad" for item in result["rejected"])


def test_wecom_aes_roundtrip_and_fail_closed():
    aes = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG"
    token = "token"
    encrypted = encrypt_message(aes, "corp", "hello", b"0123456789abcdef")
    assert decrypt_message(aes, encrypted, "corp") == "hello"
    sig = signature(token, "1", "n", encrypted)
    assert verify_callback(token, "1", "n", encrypted, sig)
    assert fetch_approval_detail("1")["status"] == "unavailable"


def test_portals_cover_nation_and_31_provinces():
    portals = json.loads((ROOT / "data" / "policy_portals.json").read_text())
    assert "全国" in portals
    assert len(portals) == 32
    assert portals["全国"][0].startswith("https://www.ndrc.gov.cn")
