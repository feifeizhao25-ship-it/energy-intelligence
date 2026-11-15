"""国内产品补齐：席位以外的开关、预检、模型和审批模板。"""
import json
from pathlib import Path

from app.services.domestic_router import GLM_OFFICIAL_ID, model_for
from ops.preflight import preflight
from ops.switches import SWITCHES
from ops.wecom import TEMPLATES


def test_switches_default_off_and_env_override(monkeypatch):
    assert all(value is False for value in SWITCHES.values())
    monkeypatch.setenv("NENGJIAN_SWITCH_BAIDU_PUSH", "1")
    from ops.switches import load_switches
    loaded = load_switches()
    assert loaded["baidu_push"] is True
    assert loaded["publish_a"] is False


def test_preflight_hashes_shared_keys_and_flags_banned_overseas(tmp_path, monkeypatch):
    secret = "shared-key-value"
    product = tmp_path / "secrets.env"
    openclaw = tmp_path / "openclaw.env"
    product.write_text(f"NENGJIAN_DEEPSEEK_API_KEY={secret}\n", encoding="utf-8")
    openclaw.write_text(f"OPENCLAW_DEEPSEEK_API_KEY={secret}\n", encoding="utf-8")
    monkeypatch.setenv("NENGJIAN_OPENCLAW_SECRETS_FILE", str(openclaw))
    monkeypatch.setenv("APP_EDITION", "cn")
    monkeypatch.setenv("OPENAI_API_KEY", "should-not-print")
    report = preflight(product)
    blob = json.dumps(report)
    assert secret not in blob
    assert "should-not-print" not in blob
    assert report["shared_keys"][0]["product"] == "NENGJIAN_DEEPSEEK_API_KEY"
    assert report["shared_keys"][0]["openclaw"] == "OPENCLAW_DEEPSEEK_API_KEY"
    assert len(report["shared_keys"][0]["sha256_prefix"]) == 12
    assert "OPENAI_API_KEY" in report["banned_overseas"]
    monkeypatch.delenv("APP_EDITION")
    monkeypatch.delenv("OPENAI_API_KEY")


def test_deepseek_flash_is_not_remapped_to_glm():
    assert model_for("deepseek", "deepseek-flash", "deepseek-flash") == "deepseek-flash"
    assert model_for("glm", "deepseek-flash", "glm-4.7-flash") == "glm-4.7-flash"
    assert model_for("glm", "glm-4-flash", "glm-4.7-flash") == GLM_OFFICIAL_ID
    assert GLM_OFFICIAL_ID == "glm-4.7-flash"


def test_wecom_has_policy_and_finance_templates():
    assert set(TEMPLATES) == {"content", "business", "compliance", "promotion", "switch", "incident", "policy", "finance"}


def test_celery_uses_shanghai():
    from app.tasks.celery_app import celery_app
    assert celery_app.conf.timezone == "Asia/Shanghai"


def test_domestic_seed_covers_shanghai_and_refuses_origin():
    from app.services.domestic_resource import DomesticResourceNotLoaded, lookup
    row = lookup(31.2, 121.5)
    assert row["station_city"] == "上海"
    assert row["lat"] == 31.2
    assert "不是 NASA POWER 实测" in row["license_note"]
    assert row["data_source"].startswith("国内离线")
    try:
        lookup(0, 0)
    except DomesticResourceNotLoaded:
        return
    raise AssertionError("origin should be unloaded")
