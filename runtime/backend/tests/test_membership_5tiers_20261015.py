"""会员五档对齐 + 流式 /ai/chat 配额。"""
import json
import uuid
from pathlib import Path

import pytest

from app.api.v1.ai_assistant import ai_assistant
from app.core.security import create_access_token
from app.utils.security import get_password_hash
from app.core.subscription import ENTITLEMENTS, LEGACY_TIERS, PLAN_QUOTAS, TIER_ORDER
from app.models.user import User

ROOT = Path(__file__).resolve().parents[2]
BACKEND_REG = ROOT / "backend" / "data" / "entitlements.json"
WEB_REG = ROOT / "web" / "src" / "lib" / "entitlements" / "entitlements.json"


def test_five_tiers_and_prices():
    reg = json.loads(BACKEND_REG.read_text("utf-8"))
    assert TIER_ORDER == ["free", "pro", "full", "team", "enterprise"]
    prices = [reg["tiers"][t]["price"]["yearly_cny"] for t in TIER_ORDER]
    assert prices == [0, 1980, 5800, 16800, 33000]
    assert LEGACY_TIERS == ["maintenance"]
    assert reg["tiers"]["maintenance"]["purchasable"] is False


def test_web_and_backend_registry_identical():
    assert BACKEND_REG.read_bytes() == WEB_REG.read_bytes()


def test_no_excel_or_ppt_in_entitlements_at_launch():
    for plan, ent in ENTITLEMENTS.items():
        fmts = {f.lower() for f in ent["export_formats"]}
        assert not fmts & {"xlsx", "excel", "pptx", "ppt"}, plan
    reg_text = BACKEND_REG.read_text("utf-8")
    for tier in json.loads(reg_text)["tiers"].values():
        feats = " ".join(tier["features_zh"] + tier["features_en"])
        assert "Excel" not in feats and "PPT" not in feats


def test_matrix_values_from_pricing_table():
    assert PLAN_QUOTAS["free"]["ai_queries_per_day"] == 5
    assert PLAN_QUOTAS["pro"]["max_projects"] == 30
    assert PLAN_QUOTAS["full"]["ai_queries_per_day"] == 300
    assert PLAN_QUOTAS["team"]["ai_queries_per_day"] == 1500
    assert ENTITLEMENTS["team"]["team_seats"] == 5


async def _free_user(db_session):
    user = User(
        id=str(uuid.uuid4()), phone=f"139{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"), name="免费用户", role="user",
        market="cn", subscription_plan="free", usage_quota={"ai_calls": {}, "report_exports": {}},
    )
    db_session.add(user)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


@pytest.mark.asyncio
async def test_stream_chat_enforces_quota(client, db_session, monkeypatch):
    headers = await _free_user(db_session)

    async def ok_stream(message, system_prompt, *, market="cn"):
        yield "可核验的说明"

    monkeypatch.setattr(ai_assistant, "stream_openai", ok_stream)
    for i in range(5):
        r = await client.post("/api/v1/ai/chat", params={"message": f"光伏容量因子 {i}"}, headers=headers)
        assert r.status_code == 200, r.text
        assert "[DONE]" in r.text
    r = await client.post("/api/v1/ai/chat", params={"message": "第6次"}, headers=headers)
    assert r.status_code == 429
    assert "升级" in json.dumps(r.json(), ensure_ascii=False)


@pytest.mark.asyncio
async def test_stream_chat_empty_output_not_charged(client, db_session, monkeypatch):
    headers = await _free_user(db_session)

    async def empty_stream(message, system_prompt, *, market="cn"):
        if False:
            yield ""

    monkeypatch.setattr(ai_assistant, "stream_openai", empty_stream)
    for _ in range(7):
        r = await client.post("/api/v1/ai/chat", params={"message": "x"}, headers=headers)
        assert r.status_code == 200


def test_legacy_maintenance_not_purchasable():
    from app.services.alipay_service import alipay_service
    with pytest.raises(ValueError):
        alipay_service.price_for("maintenance", "yearly")
    assert str(alipay_service.price_for("full", "yearly")) == "5800.00"
