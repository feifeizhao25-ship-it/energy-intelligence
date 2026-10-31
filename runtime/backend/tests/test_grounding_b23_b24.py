"""B23 / B24: the same policy question must not get a different answer depending on the wording, and a policy question
with no source must not get an invented answer; dates that have passed must not be presented as future deadlines.

B23 evidence: "How does OBBBA change ITC eligibility for a Texas 100MW solar project?" retrieved nothing (the lexical
score counted filler words and OBBBA was 1 of 12 tokens) and the model expanded OBBBA to "Office of Budget and
Budgetary Analysis". B24 evidence: the answer said "construction must begin before July 4, 2026" on 2026-11-01.
"""
from datetime import date

import pytest

from app.api.v1 import ai_assistant as mod
from app.api.v1.ai_assistant import ai_assistant
from app.services import grounding
from app.services.policy_aliases import alias_score, detect_groups
from app.services.rag_service import RAGService

ITC = "policy-us-itc"

PHRASINGS = [
    "How does OBBBA change ITC eligibility for a Texas 100MW solar project?",
    "What did the One Big Beautiful Bill Act do to the solar investment tax credit?",
    "Is the 48E credit still available for new solar in 2026?",
    "obbba solar tax credit deadline",
    "Do I still get the ITC for a solar farm after the 2025 tax law? Cite sources with dates.",
]


@pytest.mark.parametrize("question", PHRASINGS)
def test_every_phrasing_retrieves_the_irs_source(question):
    hits = RAGService().search(question, top_k=3, market="global", exclude_stale=True).hits
    assert hits and hits[0].source_id == ITC and hits[0].score >= mod.MIN_SOURCE_RELEVANCE, [(h.source_id, h.score) for h in hits]
    assert mod._retrieve(question, "global")[0].source_id == ITC


@pytest.mark.parametrize("question", [
    "What is the capital of France", "how does IRR work", "How does the weather affect wind in the North Sea",
])
def test_unrelated_questions_do_not_get_a_source_attached(question):
    assert mod._retrieve(question, "global") == []


def test_alias_groups_recognise_spellings():
    assert set(detect_groups("OBBBA and the investment tax credit")) == {"obbba", "itc"}
    assert "obbba" in detect_groups("the One Big Beautiful Bill Act")
    assert detect_groups("how much does a wind turbine cost") == []
    assert alias_score("wind turbine cost", {"wind"}) is None


def test_policy_question_detector():
    assert grounding.is_policy_question("How does OBBBA change ITC eligibility?")
    assert grounding.is_policy_question("山东分布式光伏补贴政策是什么")
    assert not grounding.is_policy_question("What does IRR mean?")


@pytest.fixture
def no_model(monkeypatch):
    calls = []

    async def fake_chat(message, system_prompt, *, market):
        calls.append(system_prompt)
        return {"content": "Bottom line: The Office of Budget and Budgetary Analysis (OBBAA) does not change eligibility.", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    return calls


async def _global_headers(db_session):
    from app.core.security import create_access_token
    from app.models.user import User
    from app.utils.security import get_password_hash
    import uuid
    u = User(id=str(uuid.uuid4()), email=f"g{uuid.uuid4().hex[:6]}@example.com", password_hash=get_password_hash("Passw0rd!x"),
             name="g", role="user", market="global", subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_policy_question_without_a_source_is_refused_on_line_one_and_model_not_called(client, db_session, no_model, monkeypatch):
    monkeypatch.setattr(mod, "_retrieve", lambda q, m: [])
    h = await _global_headers(db_session)
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": PHRASINGS[0]})
    assert r.status_code == 200
    body = r.json()
    assert body["message"].splitlines()[0].startswith("Status: No source in our library")
    assert "OBBAA" not in body["message"] and no_model == []
    assert body["grounding"]["status"] == "no_source_refused" and body["sources"] == []
    assert body["ai_metadata"]["model_called"] is False


@pytest.mark.asyncio
async def test_same_question_five_ways_reaches_the_source_and_the_model_sees_it(client, db_session, no_model):
    h = await _global_headers(db_session)
    for q in PHRASINGS:
        r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": q})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["grounding"]["status"] == "sourced", q
        assert body["sources"] and "One Big Beautiful Bill Act" in body["sources"][0]["title"], q
        assert not body["message"].startswith("Status: No source"), q
    assert all("policy" not in p.lower() or "[S1]" in p for p in no_model)


@pytest.mark.asyncio
async def test_domestic_policy_question_without_source_is_refused_in_chinese(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(mod, "_retrieve", lambda q, m: [])
    called = []

    async def fake_chat(message, system_prompt, *, market):
        called.append(1)
        return {"content": "x", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    r = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": "山东分布式光伏补贴政策是什么"})
    assert r.json()["message"].startswith("状态：本库没有收录") and called == []


# ---- B24: dates --------------------------------------------------------------------------------------------------

TODAY = date(2026, 11, 1)


def test_prompt_carries_today_and_marks_the_july_4_window_as_passed(monkeypatch):
    monkeypatch.setattr(mod, "_today", lambda: TODAY)
    hits = RAGService().search(PHRASINGS[0], top_k=1, market="global").hits
    prompt = mod._grounded_prompt("BASE", hits, "global", "pro")
    assert "Today's date is 2026-11-01" in prompt
    assert "2026-07-04 [PASSED]" in prompt and "2027-12-31 [UPCOMING]" in prompt


@pytest.mark.parametrize("answer,expected", [
    ("Risk: Missing the construction commencement deadline of July 4, 2026.", ["2026-07-04"]),
    ("Construction must begin before 4 July 2026 to qualify.", ["2026-07-04"]),
    ("You must start by 2026-07-04 or lose the credit.", ["2026-07-04"]),
    ("The facility must be placed in service by December 31, 2027.", []),
    ("The law was signed on July 4, 2025.", []),
])
def test_date_check_flags_only_passed_deadlines(answer, expected):
    assert [e["date"] for e in grounding.date_check(answer, TODAY)] == expected


@pytest.mark.asyncio
async def test_answer_stating_a_passed_deadline_gets_a_date_check_note(client, db_session, monkeypatch):
    monkeypatch.setattr(mod, "_today", lambda: TODAY)

    async def fake_chat(message, system_prompt, *, market):
        return {"content": "Bottom line: Construction must begin before July 4, 2026 to keep the ITC [S1].", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    h = await _global_headers(db_session)
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": PHRASINGS[0]})
    body = r.json()
    assert body["time_check"]["expired_dates"][0]["date"] == "2026-07-04"
    assert "Date check: 2026-07-04 has already passed (today is 2026-11-01)" in body["message"]
