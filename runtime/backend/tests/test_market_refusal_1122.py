"""2026-11-21 test: a German user asking about the EEG 10 kWp feed-in tariff got the no-source refusal
with the hint 'for example "IRS Notice 2025-42"'. The example now follows the jurisdiction the question
names, else the user's profile country, else a neutral hint. Status line 1 is unchanged; the model is not called."""
import uuid

import pytest

from app.api.v1 import ai_assistant as mod
from app.api.v1.ai_assistant import ai_assistant
from app.services import grounding

EEG_Q = "What is the EEG feed-in tariff for a 10 kWp rooftop system?"


@pytest.mark.parametrize("q,code", [
    (EEG_Q, "DE"),
    ("Bundesnetzagentur Einspeisevergütung 2026", "DE"),
    ("How does the 48E credit differ from the 48 ITC?", "US"),
    ("Smart Export Guarantee rates", "GB"),
    ("What does RED III require for permitting?", "EU"),
    ("What is the feed-in policy?", None),
])
def test_jurisdiction_from_the_question(q, code):
    assert grounding.jurisdiction_of(q) == code


def test_question_wins_over_profile_country_and_profile_is_the_fallback():
    assert grounding.jurisdiction_of("IRS 48E rules", "Germany") == "US"
    assert grounding.jurisdiction_of("What is the feed-in policy?", "Germany") == "DE"
    assert grounding.jurisdiction_of("What is the feed-in policy?", "Narnia") is None


def test_german_question_gets_no_irs_example():
    reply = grounding.no_source_reply("global", EEG_Q)
    assert reply.splitlines()[0].startswith("Status: No source in our library")
    assert "IRS" not in reply and "EEG 2023" in reply and "Bundesnetzagentur" in reply
    assert "I won't guess at what a law or credit says." in reply


def test_us_question_keeps_the_irs_example_and_neutral_has_none():
    assert "IRS Notice 2025-42" in grounding.no_source_reply("global", "48E vs 48 ITC")
    neutral = grounding.no_source_reply("global", "What is the feed-in policy?")
    assert "IRS" not in neutral and "country it applies to" in neutral


def test_cn_reply_unchanged():
    assert grounding.no_source_reply("cn", EEG_Q) == grounding.NO_SOURCE["cn"]


@pytest.fixture
def no_model(monkeypatch):
    calls = []

    async def fake_chat(message, system_prompt, *, market):
        calls.append(system_prompt)
        return {"content": "x", "metadata": {}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    return calls


async def _user(db_session, country=None):
    from app.core.security import create_access_token
    from app.models.user import User
    from app.utils.security import get_password_hash
    u = User(id=str(uuid.uuid4()), email=f"g{uuid.uuid4().hex[:6]}@example.com", password_hash=get_password_hash("Passw0rd!x"),
             name="g", role="user", market="global", subscription_plan="free", usage_quota={}, country=country)
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_endpoint_german_user_eeg_question(client, db_session, no_model, monkeypatch):
    monkeypatch.setattr(mod, "_retrieve", lambda q, m: [])
    h = await _user(db_session, "Germany")
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": EEG_Q})
    body = r.json()
    assert r.status_code == 200
    assert body["message"].splitlines()[0].startswith("Status: No source in our library")
    assert "IRS" not in body["message"] and "Bundesnetzagentur" in body["message"]
    assert no_model == [] and body["ai_metadata"]["model_called"] is False


@pytest.mark.asyncio
async def test_endpoint_profile_country_used_when_question_names_none(client, db_session, no_model, monkeypatch):
    monkeypatch.setattr(mod, "_retrieve", lambda q, m: [])
    h = await _user(db_session, "Germany")
    r = await client.post("/api/v1/ai/chat-json", headers=h, json={"message": "What feed-in tariff policy applies to my rooftop?"})
    assert "Bundesnetzagentur" in r.json()["message"]
