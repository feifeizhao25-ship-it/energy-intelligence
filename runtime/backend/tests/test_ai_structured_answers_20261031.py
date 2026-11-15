"""One-sentence conclusion, answer cards and the plain-language switch for the energy AI assistant."""
import re

import pytest

from app.api.v1.ai_assistant import ai_assistant
from app.services.answer_structure import (
    extract_headline, extract_key_numbers, extract_risks, glossary_for, structure_answer, style_instruction,
)

CN = ("一句话结论：这个 20 MW 光伏项目在当前假设下内部收益率约为 8.5%。\n\n"
      "### 1. 关键数字\n- 内部收益率 8.5%，投资回收期约 9 年。\n- 总投资 9,600 万元。\n\n"
      "### 2. 依据\n平准化度电成本按 [S1] 的方法计算。\n\n"
      "风险提示：电价假设可能变化，实际结果存在不确定性。")


def test_headline_prefers_the_labelled_line_and_removes_it_from_the_body():
    h, body = extract_headline(CN)
    assert h == "这个 20 MW 光伏项目在当前假设下内部收益率约为 8.5%。" and "一句话结论" not in body
    h2, _ = extract_headline("Bottom line: Payback is about 9 years under these inputs.\nMore text")
    assert h2 == "Payback is about 9 years under these inputs."


def test_headline_falls_back_to_first_sentence_without_markdown_symbols():
    h, _ = extract_headline("### 1. 容量系数是全年实际发电量与满发电量之比。它受地点影响。")
    assert not h.startswith("#") and h.endswith("。") and "它受地点" not in h


def test_key_numbers_are_only_numbers_that_appear_in_the_answer():
    nums = extract_key_numbers(CN)
    values = [n["value"] for n in nums]
    assert "8.5%" in values and all(v.split()[0].replace(",", "") in CN.replace(",", "") for v in values)
    assert extract_key_numbers("没有任何数字的回答。") == []


def test_basis_lists_only_cited_sources_and_scrubbed_markers_get_nothing():
    sources = [{"title": "NREL ATB", "publisher": "NREL", "published_at": "2025", "url": "https://x.org", "freshness_status": "fresh"},
               {"title": "unused", "publisher": "x"}]
    s = structure_answer("结论：a。依据 [S1]。", "cn", sources, "plain")
    assert [b["ref"] for b in s["basis"]] == ["S1"] and s["basis"][0]["title"] == "NREL ATB" and s["has_sources"]
    s2 = structure_answer("结论：没有引用。", "cn", sources, "plain")
    assert s2["basis"] == [] and s2["has_sources"] is False


def test_risks_come_from_the_answer_and_are_capped():
    assert any("电价假设可能变化" in r for r in extract_risks(CN, en=False))
    long = "。".join(f"风险因素第{i}条会影响项目收益的结果" for i in range(10)) + "。"
    assert len(extract_risks(long, en=False)) == 3


def test_glossary_only_in_plain_style_and_in_the_right_language():
    cn = structure_answer("结论：LCOE 和 IRR 都是常用指标。", "cn", [], "plain")
    assert {g["term"] for g in cn["glossary"]} == {"LCOE", "IRR"} and all(re.search(r"[\u4e00-\u9fff]", g["plain"]) for g in cn["glossary"])
    en = structure_answer("Bottom line: LCOE and IRR are common.", "global", [], "plain")
    assert en["glossary"] and not any(re.search(r"[\u4e00-\u9fff]", g["plain"]) for g in en["glossary"])
    assert structure_answer("Bottom line: LCOE.", "global", [], "pro")["glossary"] == []
    assert glossary_for("nothing technical here", True) == []


def test_style_instruction_shape_and_language():
    cn = style_instruction("cn", "plain")
    assert "一句话结论" in cn and "大白话" in cn and "LaTeX" in cn
    en = style_instruction("global", "pro")
    assert "Bottom line:" in en and not re.search(r"[\u4e00-\u9fff]", en)
    assert "Explain each technical term" in style_instruction("global", "plain")


@pytest.mark.asyncio
async def test_chat_json_returns_structured_card_and_passes_style_to_the_model(client, auth_headers, monkeypatch):
    seen = {}

    async def fake_chat(message, system_prompt, *, market):
        seen["prompt"] = system_prompt
        return {"content": CN, "metadata": {"provider": "test"}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    r = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": "解释一下收益率", "style": "plain"})
    assert r.status_code == 200
    st = r.json()["structured"]
    assert st["headline"].startswith("这个 20 MW") and st["style"] == "plain" and st["key_numbers"] and st["risks"]
    assert "大白话" in seen["prompt"]
    r2 = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": "解释一下收益率", "style": "pro"})
    assert r2.json()["structured"]["style"] == "pro" and r2.json()["structured"]["glossary"] == []
    assert "规范的专业术语" in seen["prompt"]


@pytest.mark.asyncio
async def test_default_style_is_plain_for_domestic_and_invalid_style_is_rejected(client, auth_headers, monkeypatch):
    async def fake_chat(message, system_prompt, *, market):
        return {"content": "结论：好。", "metadata": {}}
    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    r = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": "你好"})
    assert r.json()["structured"]["style"] == "plain"
    bad = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": "你好", "style": "loud"})
    assert bad.status_code == 422


@pytest.mark.asyncio
async def test_ask_without_a_model_still_returns_a_structured_card(client, auth_headers, monkeypatch):
    from app.api.v1 import ai_assistant as mod
    monkeypatch.setattr(mod, "_llm_configured", lambda: False)
    r = await client.post("/api/v1/ai/ask", headers=auth_headers, json={"query": "zzzz nothing matches qqqq", "market": "global"})
    assert r.status_code == 200
    st = r.json()["structured"]
    assert st["style"] == "pro" and st["headline"] and not re.search(r"[\u4e00-\u9fff]", st["headline"])
    assert st["limitations"] and not re.search(r"[\u4e00-\u9fff]", " ".join(st["limitations"]))


@pytest.mark.asyncio
async def test_stream_sends_the_structured_card_after_the_text(client, auth_headers, monkeypatch):
    async def fake_stream(message, system_prompt, *, market):
        yield CN[:30]
        yield CN[30:]

    monkeypatch.setattr(ai_assistant, "stream_openai", fake_stream)
    r = await client.post("/api/v1/ai/chat?message=解释收益率&style=plain", headers=auth_headers)
    assert r.status_code == 200
    events = [line[6:] for line in r.text.splitlines() if line.startswith("data: ")]
    assert events[-1] == "[DONE]"
    import json
    kinds = [list(json.loads(e))[0] for e in events[:-1]]
    assert kinds == ["sources", "content", "structured"]
    assert json.loads(events[-2])["structured"]["headline"].startswith("这个 20 MW")


@pytest.mark.asyncio
async def test_quota_exhausted_message_follows_the_account_language(client, db_session, monkeypatch):
    import uuid
    from app.core.security import create_access_token, hash_password
    from app.models.user import User
    from datetime import datetime, timezone
    out = {}
    for market in ("cn", "global"):
        day = f"daily_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}"
        u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
                 name="q", role="user", market=market, subscription_plan="free", usage_quota={"ai_calls": {day: 99}})
        db_session.add(u)
        await db_session.commit()
        h = {"Authorization": f"Bearer {create_access_token(str(u.id))}"}
        r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": "hi"})
        assert r.status_code == 429
        out[market] = r.json()["detail"]
    assert "今日 AI 对话次数已用完" in out["cn"]["message"]
    assert not re.search(r"[\u4e00-\u9fff]", out["global"]["message"]) and "per day" in out["global"]["message"]
    assert out["global"]["upgrade_url"] == "/pricing"
