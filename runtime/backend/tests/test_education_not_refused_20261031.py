"""'收益率是什么意思' used to come back as the refusal notice in the domestic app.

Root cause: the model answered correctly and then appended the system prompt's disclaimer in a variant
("不提供投资建议或收益承诺") that the negation masks did not list, so the whole answer was swapped for the notice.
Also 保本电价 / 无风险收益率 / 碳收益是指… (definitions) matched the promise patterns. Education stays allowed in both editions;
advice, guarantees and price forecasts are still refused."""
import re
import uuid
from datetime import datetime, timezone

import pytest

from app.api.v1.ai_assistant import CN_SYSTEM_PROMPT, SYSTEM_PROMPT, ai_assistant
from app.core.security import create_access_token, hash_password
from app.models.user import User
from app.services.bottom_line import NOTICE_EN, NOTICE_ZH, blocked_input_text, enforce_bottom_line, find_violations

# What the model actually returned in the retest (shortened), including the appended disclaimer variants.
EDU_ZH = [
    "收益率是指投资所产生的回报与投资成本的比率，通常用来衡量投资的盈利能力。储能项目的收入来源包括峰谷价差套利和辅助服务。\n\n我只能提供事实、数据、政策原文和可验证的计算，不提供投资建议或收益承诺。",
    "收益率是指投资回报与成本之比。具体项目要结合实际数据详细计算。\n\n我只能提供事实、数据、政策原文和可验证的计算，不提供投资建议、价格预测或收益承诺。",
    "保本电价是指光伏发电项目在运营期间能够覆盖所有成本并实现盈亏平衡的最低电价。保本点随造价和利用小时数变化。",
    "无风险收益率是指在没有任何风险的情况下，投资者可以获得的最低收益率，常用国债收益率作参考，在折现率里作为基准。",
    "碳收益是指通过减少温室气体排放而获得的收益。碳收益主要来源于碳交易市场和碳抵消项目。",
    "内部收益率（IRR）是使净现值等于零的折现率。本说明不构成投资建议、收益承诺或价格预测。",
    # retest 3: the definition of IRR with the usual decision rule (the model's raw answer was replaced by the notice).
    "内部收益率（IRR）是使净现值为零的折现率。\n\n### 实际应用：\n- **IRR越高**，说明项目的盈利能力越强。\n- **IRR低于资金成本**，项目可能不值得投资。\n- **IRR高于资金成本**，项目可能有投资价值。",
    "通常，投资者会将自己的预期收益率与IRR进行比较，如果IRR高于预期收益率，项目就被认为是值得投资的。",
    "如果IRR大于你的资金成本（比如银行贷款利率），说明项目是值得投资的；如果IRR小于资金成本，说明项目不值得投资。",
    "举个例子：假设初期投入100万元，三年现金流现值合计124.34万元。\nNPV = 124.34 - 100 = 24.34万元\n因为NPV > 0，所以这个项目是值得投资的。",
    "收益率只是衡量投资回报的一个指标。风险提示：过去的表现不能保证未来的收益；无法保证回报，也不承诺盈利。",
    "通过计算NPV，可以评估这个项目是否值得投资。折现率越高，NPV越低。",
    "例如你有一个光伏项目的IRR是12%，当前无风险利率是3%，行业平均IRR是10%。那么12% > 3%，说明项目比无风险投资更有吸引力。",
    "资金的时间价值：今天的1块钱比未来的1块钱更有价值，因为今天的钱可以投资并产生收益。",
    "在光伏行业，IRR达到8%-12%通常被认为是较好的水平。",
    "举个例子，假设你投资一个项目，初期投入100万元，之后每年收益20万元，持续5年，如果用IRR计算，IRR是10%。",
    "储能项目的运营成本较高，需要有效管理和控制成本以确保盈利。",
    "与行业基准比较：例如光伏项目的IRR达到12%，而行业基准是6%-10%，那么这个项目的IRR就相对较高。",
    "净现值为负时，说明项目不值得投资；净现值为正则有投资价值。这是判断规则，不是对具体项目的结论。",
]
EDU_EN = [
    "IRR is the discount rate at which the net present value of all cash flows equals zero. Higher IRR means cash comes back faster. I can provide facts and calculations, but not investment advice or price predictions.",
    "Payback period is the time needed for cumulative net cash flow to turn positive. A break-even price is the lowest price that covers all costs.",
    "A risk-free rate is the return on an asset with no default risk, usually a government bond yield, used as the base of a discount rate.",
]
ADVICE_ZH = [
    "这个项目稳赚不赔，建议买入。",
    "保本收益8%，闭眼入。",
    "保证年化收益8%，不会亏。",
    "明年电价会涨到0.5元，现在是最好的买入时机。",
    "强烈推荐投资该储能项目。我只能提供事实。但是我建议你买入。",
    "不提供投资建议，但强烈推荐投资该项目",
    "碳收益稳定，值得投资。",
    # a negation next to a promise does not excuse the promise
    "我不保证，但保证收益8%。",
    "不能保证未来收益，但我保证年化8%。",
    "不保证收益。保证收益不低于8%。",
    "为了保证收益不低于8%，请现在买入。",
    "这是无风险投资，稳赚。",
    "例如这个项目年化收益率保证12%，不会亏。",
    "你现在可以投资这个项目，我保证收益。",
    # a decision rule applied to a specific project is still a recommendation
    "IRR高于资金成本，该项目值得投资。",
    "你的项目IRR高于资金成本，建议投资，值得入手。",
    "这个项目IRR为12%，值得投资。",
    "举个例子，假设NPV > 0。我建议你买入，这个项目值得投资。",
    "NPV > 0，所以你的项目值得投资。",
    "本项目收益率高于回收期要求，具有投资价值。",
]
ADVICE_EN = ["I recommend investing in this project.", "It offers guaranteed returns.", "The price will rise next year.", "This is a risk-free return."]


@pytest.mark.parametrize("text", EDU_ZH)
def test_definitional_answers_are_not_replaced_in_the_domestic_edition(text):
    assert find_violations(text, market="cn") == []
    assert enforce_bottom_line(text, market="cn") == text


@pytest.mark.parametrize("text", EDU_EN)
def test_definitional_answers_are_not_replaced_in_the_international_edition(text):
    assert find_violations(text, market="global") == []
    assert enforce_bottom_line(text, market="global") == text


@pytest.mark.parametrize("text", ADVICE_ZH)
def test_advice_guarantees_and_forecasts_are_still_replaced_in_the_domestic_edition(text):
    assert enforce_bottom_line(text, market="cn") == NOTICE_ZH


@pytest.mark.parametrize("text", ADVICE_EN)
def test_advice_is_still_replaced_in_the_international_edition(text):
    assert enforce_bottom_line(text, market="global") == NOTICE_EN


def test_the_disclaimer_in_any_combination_does_not_hide_a_violation_next_to_it():
    text = "不提供投资建议或收益承诺。但这个项目稳赚不赔。"
    assert enforce_bottom_line(text, market="cn") == NOTICE_ZH


@pytest.mark.parametrize("q", ["收益率是什么意思？储能项目怎么看？", "什么是内部收益率IRR？", "净现值NPV怎么理解？", "度电成本LCOE怎么算？",
                               "什么是保本电价？", "无风险收益率是什么？", "碳收益是什么意思？", "储能项目的收益来源有哪些？"])
def test_definitional_questions_are_not_blocked_at_input(q):
    assert blocked_input_text(q, "cn") is None


@pytest.mark.parametrize("q", ["这个项目值得投资吗", "推荐买入哪个项目", "明年电价会涨吗", "保证年化收益8%的方案有吗"])
def test_advice_questions_are_still_blocked_at_input(q):
    assert blocked_input_text(q, "cn") == NOTICE_ZH


def test_prompts_allow_education_and_say_not_to_append_the_refusal():
    assert "科普" in CN_SYSTEM_PROMPT and "不要附加" in CN_SYSTEM_PROMPT and "收益率" in CN_SYSTEM_PROMPT
    assert "education" in SYSTEM_PROMPT and "do not append" in SYSTEM_PROMPT
    assert not re.search(r"[\u3400-\u9fff]", SYSTEM_PROMPT), "the international prompt stays English"


async def _headers(db_session, market):
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="edu", role="user", market=market, subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
@pytest.mark.parametrize("market,question,answer", [("cn", "收益率是什么意思？储能项目怎么看？", EDU_ZH[0]), ("global", "What does IRR mean?", EDU_EN[0])])
async def test_endpoint_returns_the_definition_not_the_notice(client, db_session, monkeypatch, market, question, answer):
    async def fake_chat(message, system_prompt, *, market):
        return {"content": answer, "metadata": {"provider": "test"}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    r = await client.post("/api/v1/ai/chat-json", headers=await _headers(db_session, market), json={"message": question})
    assert r.status_code == 200
    body = r.json()
    assert body["message"] != NOTICE_ZH and body["message"] != NOTICE_EN
    assert body["message"].split("。")[0].split(".")[0][:12] == answer.split("。")[0].split(".")[0][:12]
    assert "blocked" not in (body.get("ai_metadata") or {})


@pytest.mark.asyncio
@pytest.mark.parametrize("market,question,notice", [("cn", "这个项目值得投资吗", NOTICE_ZH), ("global", "Should I invest in this project? Recommend investing.", NOTICE_EN)])
async def test_endpoint_still_refuses_advice(client, db_session, monkeypatch, market, question, notice):
    async def fake_chat(message, system_prompt, *, market):
        return {"content": "建议买入，稳赚不赔。" if market == "cn" else "I recommend investing. Guaranteed returns.", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    r = await client.post("/api/v1/ai/chat-json", headers=await _headers(db_session, market), json={"message": question})
    assert r.status_code == 200 and r.json()["message"] == notice
