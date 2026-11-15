"""B10 (rest): what was still Chinese in the international edition after the catalogue was translated.

Retest evidence: AI answers carried a Chinese ``evidence`` block (confidence reason, "无来源", limitations), billing and
other error responses were Chinese, and FM-001 / FM-002 produced their formula reference, assumptions and standard
citations in Chinese (NDRC) which was only patched over afterwards. Now the skills write English at the source for
``market == "global"``, AI evidence follows the account market and error text follows the request market.
"""
import asyncio
import importlib.util
import json
import re
import uuid
from pathlib import Path

import pytest

from app.api.v1 import ai_assistant as mod
from app.api.v1.ai_assistant import ai_assistant
from app.skills import global_view

CJK = re.compile(r"[\u3400-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef]")
GL = {"X-App-Market": "global"}
SKILLS_DIR = Path(__file__).resolve().parents[2] / "services" / "financial-service" / "app" / "skills"


def _no_cjk(obj, where=""):
    text = json.dumps(obj, ensure_ascii=False)
    assert not CJK.search(text), f"{where}: {text[:400]}"


def _load(name):
    spec = importlib.util.spec_from_file_location(f"b10_{name}", SKILLS_DIR / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run(skill, params):
    return asyncio.run(skill.execute(params))


LCOE = {"capex": 1_000_000, "opex_annual": 15_000, "annual_generation_kwh": 1_800_000}
IRR = {"cashflows": [-1000, 200, 250, 300, 350, 400]}


# ---- FM-001 / FM-002 write English at the source ---------------------------------------------------------------------

@pytest.mark.parametrize("module,cls,params,sid", [("lcoe", "LcoeSkill", LCOE, "FM-001"), ("irr_npv", "IrrNpvSkill", IRR, "FM-002")])
def test_skill_result_is_english_at_the_source_for_global(module, cls, params, sid):
    skill = getattr(_load(module), cls)()
    raw = _run(skill, {**params, "market": "global"})  # no global_view post-processing here
    _no_cjk(raw, f"{sid} raw result")
    contract = raw["contract"]
    assert contract["sources"] == global_view.CATALOG[sid]["references"] == raw["references"]
    assert contract["formula_ref"] == global_view.CATALOG[sid]["formula_ref"]
    assert contract["valid_range"] == global_view.CATALOG[sid]["valid_range"]
    assert not any(w in json.dumps(raw) for w in ("发改委", "GB/T", "建设项目"))


@pytest.mark.parametrize("module,cls,params,marker", [("lcoe", "LcoeSkill", LCOE, "国家发改委"), ("irr_npv", "IrrNpvSkill", IRR, "建设项目经济评价")])
def test_skill_result_domestic_is_unchanged(module, cls, params, marker):
    skill = getattr(_load(module), cls)()
    raw = _run(skill, dict(params))
    assert marker in json.dumps(raw, ensure_ascii=False)
    assert raw["contract"]["assumptions"] == ["口径见引用，不额外承诺"]


@pytest.mark.parametrize("module,cls,sid", [("lcoe", "LcoeSkill", "FM-001"), ("irr_npv", "IrrNpvSkill", "FM-002")])
def test_skill_errors_are_english_for_global_and_chinese_for_domestic(module, cls, sid):
    skill = getattr(_load(module), cls)()
    with pytest.raises(ValueError) as gl:
        _run(skill, {"market": "global"})
    assert not CJK.search(str(gl.value)) and sid in str(gl.value)
    with pytest.raises(ValueError) as cn:
        _run(skill, {})
    assert CJK.search(str(cn.value))


@pytest.mark.asyncio
async def test_api_error_for_a_missing_parameter_names_the_field_in_english(client, auth_headers):
    r = await client.post("/api/v1/skills/FM-001/execute", headers={**auth_headers, **GL}, json={})
    assert r.status_code == 422
    _no_cjk(r.json(), "skill error")
    assert "capex" in json.dumps(r.json())


# ---- AI evidence follows the market ---------------------------------------------------------------------------------

def test_ai_evidence_is_english_for_global_and_unchanged_for_domestic():
    gl = mod._evidence_for("An answer.", [], "global")
    _no_cjk(gl, "evidence")
    assert gl["sources_status"] == "no sources" and gl["confidence"] == "low"
    assert gl["limitations"][0] == mod._AI_LIMITATIONS_EN[0] and gl["verification"]["label"] == "To verify"
    cn = mod._evidence_for("答案。", [])
    assert cn["sources_status"] == "无来源" and CJK.search(cn["confidence_reason"]) and cn["limitations"][0].startswith("AI 生成内容")


async def _global_user_headers(db_session):
    from app.core.security import create_access_token
    from app.models.user import User
    from app.utils.security import get_password_hash
    u = User(id=str(uuid.uuid4()), email=f"g{uuid.uuid4().hex[:6]}@example.com", password_hash=get_password_hash("Passw0rd!x"),
             name="g", role="user", market="global", subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_chat_json_for_an_international_account_has_no_chinese_anywhere(client, db_session, monkeypatch):
    async def fake_chat(message, system_prompt, *, market):
        return {"content": "Bottom line: LCOE is lifetime cost divided by lifetime energy.", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    h = await _global_user_headers(db_session)
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": "What does LCOE mean?"})
    assert r.status_code == 200, r.text
    body = r.json()
    _no_cjk({k: body[k] for k in ("message", "evidence", "structured", "sources")}, "chat-json")
    assert body["evidence"]["sources_status"] == "no sources"


@pytest.mark.asyncio
async def test_ai_unavailable_is_english_for_global(client, db_session, monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("down")

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", boom)
    h = await _global_user_headers(db_session)
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": "What does LCOE mean?"})
    assert r.status_code == 503
    _no_cjk(r.json(), "503")


# ---- error text follows the request market --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_billing_errors_are_english_for_global_and_chinese_for_domestic(client, auth_headers):
    gl = await client.post("/api/v1/billing/refund/quote", headers={**auth_headers, **GL}, json={"order_no": "  "})
    assert gl.status_code == 400
    _no_cjk(gl.json(), "billing 400")
    assert gl.json()["detail"] == "Provide the number of a paid order."
    nf = await client.post("/api/v1/billing/refund/quote", headers={**auth_headers, **GL}, json={"order_no": "NO-SUCH"})
    assert nf.status_code == 404 and nf.json()["detail"] == "Order not found."
    cn = await client.post("/api/v1/billing/refund/quote", headers=auth_headers, json={"order_no": "  "})
    assert cn.json()["detail"] == "请提供已支付订单号"


@pytest.mark.asyncio
async def test_validation_message_is_english_for_global(client, auth_headers):
    gl = await client.post("/api/v1/billing/refund/quote", headers={**auth_headers, **GL}, json={})
    assert gl.status_code == 422 and gl.json()["message"] == "Invalid request parameters."
    cn = await client.post("/api/v1/billing/refund/quote", headers=auth_headers, json={})
    assert cn.json()["message"] == "请求参数无效"


def test_unknown_chinese_error_gets_a_generic_english_line_by_status():
    from app.services.market_localization import localize_error_detail, localize_error_text
    assert localize_error_text("一个没有登记过的错误", 409) == "This conflicts with the current state of the account."
    assert localize_error_text("一个没有登记过的错误", 500) == "The service is temporarily unavailable. Please try again later."
    assert localize_error_text("Already English", 400) == "Already English"
    assert localize_error_detail({"error": "X", "message": "用户不存在"}, 404) == {"error": "X", "message": "User not found."}
