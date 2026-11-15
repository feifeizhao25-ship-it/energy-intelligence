"""A query that names a stale-excluded document must say the library record is awaiting re-verification.

That sentence is the first thing in the answer, ahead of any other document the reply cites.
Provincial and other documents may still be shown, under their own titles. The stale record stays out of citations.
The clock is frozen; production freshness still uses the wall clock.
"""
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

import pytest

from app.api.v1 import ai_assistant as aa
from app.services.rag_service import RAGService

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "list_overdue_sources.py"
REGISTRY = ROOT / "data" / "rag_sources.json"
QUERY = "136号文 机制电价 存量 增量"
NATIONAL_NUMBER = "发改价格〔2025〕136号"
NOTICE_ZH = "「136号文」的资料库记录正在等待重新核验。检索到的其他文件不是该文件。"


def _assert_notice_leads(answer: str, titles) -> None:
    assert answer.startswith(NOTICE_ZH)
    assert answer.count(NOTICE_ZH) == 1
    assert answer.index(NOTICE_ZH) < answer.index("[S1]")
    for title in titles:
        assert title and title not in NOTICE_ZH
        assert answer.index(NOTICE_ZH) < answer.index(title)


def _load_script():
    import importlib.util

    spec = importlib.util.spec_from_file_location("list_overdue_sources", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_named_136_is_disclosed_and_other_documents_keep_their_titles():
    hits = RAGService().search(QUERY, top_k=3, market="cn", exclude_stale=True).hits
    assert hits
    assert all(hit.source_id != "policy-cn-136" for hit in hits)
    for hit in hits:
        assert hit.metadata.get("doc_number") != NATIONAL_NUMBER
        assert NATIONAL_NUMBER not in (hit.title or "")

    labels = RAGService().named_stale_labels(QUERY, "cn")
    assert labels == ["136号文"]

    retrieved = aa._retrieve(QUERY, "cn")
    assert retrieved
    shown, evidence, _expired = aa._library_stand_in(QUERY, retrieved, "cn", None)
    _assert_notice_leads(shown, [hit.title for hit in retrieved])
    assert "136号文" in shown
    assert "policy-cn-136" not in shown
    assert NATIONAL_NUMBER not in shown
    assert all(source.get("source_id") != "policy-cn-136" for source in evidence.get("sources") or [])
    for hit in retrieved:
        assert hit.title in shown
        assert hit.metadata.get("doc_number") != NATIONAL_NUMBER


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_model_path_says_the_record_is_awaiting_reverification_without_calling_a_model():
    hits = aa._retrieve(QUERY, "cn")
    prompt = aa._grounded_prompt(aa.CN_SYSTEM_PROMPT, hits, "cn", query=QUERY)
    assert "资料库记录正在等待重新核验" in prompt
    assert "不得把检索到的其他文件写成该文件" in prompt
    assert "policy-cn-136" not in prompt
    assert hits
    cited = "\n".join(f"[S{i}] {hit.title}" for i, hit in enumerate(hits, 1))
    shown, _expired = aa._finish_answer(f"省级文件规定了竞价办法。\n{cited}", hits, "cn", query=QUERY)
    _assert_notice_leads(shown, [hit.title for hit in hits])
    assert shown.index(NOTICE_ZH) < shown.index("省级文件规定了竞价办法。")
    trailing, _expired = aa._finish_answer(f"{cited}\n\n{NOTICE_ZH}", hits, "cn", query=QUERY)
    _assert_notice_leads(trailing, [hit.title for hit in hits])
    assert "136号文" in shown
    assert "policy-cn-136" not in shown
    assert NATIONAL_NUMBER not in shown
    assert all(hit.source_id != "policy-cn-136" for hit in hits)


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_english_named_notice_uses_english_and_keeps_the_stale_source_out():
    query = "How does IRS Notice 2025-42 define beginning of construction?"
    hits = aa._retrieve(query, "global")
    shown, evidence, _expired = aa._library_stand_in(query, hits, "global", None)
    notice = 'The library record for "IRS Notice 2025-42" is awaiting re-verification.'
    if hits:
        notice += " Other retrieved documents are not that document."
        assert shown.startswith(notice)
        assert shown.index(notice) < shown.index("[S1]")
    else:
        assert shown.startswith("No data available in the source library.")
        assert shown.index("No data available") < shown.index(notice)
    assert shown.count(notice) == 1
    for hit in hits:
        assert shown.index(notice) < shown.index(hit.title)
    assert "awaiting re-verification" in shown
    assert "Notice 2025-42" in shown
    assert "policy-us-itc" not in shown
    assert all(source.get("source_id") != "policy-us-itc" for source in evidence.get("sources") or [])
    for hit in hits:
        assert hit.source_id != "policy-us-itc"
        assert hit.title in shown
    prompt = aa._grounded_prompt(aa.SYSTEM_PROMPT, hits, "global", query=query)
    assert "awaiting re-verification" in prompt
    assert "Do not present any other document as the named one" in prompt
    markers = " ".join(f"[S{i}]" for i in range(1, len(hits) + 1))
    finished, _expired = aa._finish_answer(
        f"See the notice for the physical work test. {markers}".rstrip(), hits, "global", query=query,
    )
    assert finished.count(notice) == 1
    if hits:
        assert finished.startswith(notice)
        assert finished.index(notice) < finished.index("See the notice for the physical work test.")
        assert finished.index(notice) < finished.index("[S1]")
        for hit in hits:
            assert finished.index(notice) < finished.index(hit.title)
    else:
        assert finished.index("See the notice for the physical work test.") < finished.index(notice)


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_no_source_status_stays_on_line_one_when_nothing_else_is_cited():
    message = aa._no_source_payload("global", None, "How does OBBBA change ITC eligibility?")["message"]
    assert message.splitlines()[0].startswith("Status: No source in our library")
    notice = 'The library record for "OBBBA" is awaiting re-verification.'
    assert notice in message
    assert message.index("Status: No source") < message.index(notice)
    assert "Other retrieved documents" not in message


@pytest.mark.usefixtures("library_clock_inside_review_window")
def test_inside_the_window_a_named_document_is_not_described_as_awaiting_reverification():
    hits = aa._retrieve(QUERY, "cn")
    assert hits and hits[0].source_id == "policy-cn-136"
    assert RAGService().named_stale_labels(QUERY, "cn") == []
    shown, _evidence, _expired = aa._library_stand_in(QUERY, hits, "cn", None)
    assert "等待重新核验" not in shown
    prompt = aa._grounded_prompt(aa.CN_SYSTEM_PROMPT, hits, "cn", query=QUERY)
    assert "等待重新核验" not in prompt


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_a_query_that_does_not_name_136_does_not_claim_it_is_awaiting_reverification():
    query = "广东新能源机制电价竞价"
    assert RAGService().named_stale_labels(query, "cn") == []
    shown, evidence, _expired = aa._library_stand_in(query, aa._retrieve(query, "cn"), "cn", None)
    assert "等待重新核验" not in shown
    assert "policy-cn-136" not in shown
    assert all(source.get("source_id") != "policy-cn-136" for source in evidence.get("sources") or [])


@pytest.mark.usefixtures("library_clock_past_review_window")
def test_ambiguous_short_number_does_not_rename_a_different_document():
    assert RAGService().named_stale_labels("42号文", "cn") == []
    labels = RAGService().named_stale_labels("发改能源〔2025〕1360号", "cn")
    assert all("136号文" not in label for label in labels)
    assert "policy-cn-136" not in labels


def _sse_events(response) -> list:
    events = [line[6:] for line in response.text.splitlines() if line.startswith("data: ")]
    assert events and events[-1] == "[DONE]"
    return [json.loads(event) for event in events[:-1]]


def _cited_answer(hits) -> str:
    return "省级文件规定了竞价办法。\n" + "\n".join(f"[S{i}] {hit.title}" for i, hit in enumerate(hits, 1))


@pytest.mark.usefixtures("library_clock_past_review_window")
@pytest.mark.asyncio
async def test_streaming_answer_leads_with_the_named_notice(client, auth_headers, monkeypatch):
    hits = aa._retrieve(QUERY, "cn")
    assert hits
    script = {"text": _cited_answer(hits)}

    async def fake_stream(message, system_prompt, *, market="cn"):
        assert message == QUERY and market == "cn"
        assert NOTICE_ZH in system_prompt
        yield script["text"]

    monkeypatch.setattr(aa.ai_assistant, "stream_openai", fake_stream)
    response = await client.post("/api/v1/ai/chat", params={"message": QUERY}, headers=auth_headers)
    assert response.status_code == 200, response.text
    events = _sse_events(response)
    assert [next(iter(event)) for event in events] == ["sources", "content", "structured"]
    _assert_notice_leads(events[1]["content"], [hit.title for hit in hits])
    assert events[2]["structured"]["headline"].startswith("「136号文」的资料库记录正在等待重新核验")
    assert all(source.get("source_id") != "policy-cn-136" for source in events[0]["sources"])
    assert NATIONAL_NUMBER not in events[1]["content"]

    script["text"] = _cited_answer(hits) + "\n\n" + NOTICE_ZH
    again = await client.post("/api/v1/ai/chat", params={"message": QUERY}, headers=auth_headers)
    assert again.status_code == 200, again.text
    moved = _sse_events(again)
    _assert_notice_leads(moved[1]["content"], [hit.title for hit in hits])
    assert moved[2]["structured"]["headline"].startswith("「136号文」的资料库记录正在等待重新核验")


@pytest.mark.usefixtures("library_clock_past_review_window")
@pytest.mark.asyncio
async def test_json_model_answer_leads_with_the_named_notice(client, auth_headers, monkeypatch):
    hits = aa._retrieve(QUERY, "cn")
    assert hits

    async def fake_chat(message, system_prompt, *, market="cn"):
        assert message == QUERY and market == "cn"
        assert NOTICE_ZH in system_prompt
        return {"content": _cited_answer(hits) + "\n\n" + NOTICE_ZH, "metadata": {"provider": "test", "model": "fake"}}

    monkeypatch.setattr(aa.ai_assistant, "chat_openai_with_metadata", fake_chat)
    response = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": QUERY})
    assert response.status_code == 200, response.text
    body = response.json()
    _assert_notice_leads(body["message"], [hit.title for hit in hits])
    assert body["structured"]["headline"].startswith("「136号文」的资料库记录正在等待重新核验")
    assert body["ai_metadata"]["provider"] == "test"
    assert all(source.get("source_id") != "policy-cn-136" for source in body["sources"])
    assert [source.get("source_id") for source in body["sources"]] == [hit.source_id for hit in hits]
    assert NATIONAL_NUMBER not in body["message"]


@pytest.mark.usefixtures("library_clock_past_review_window")
@pytest.mark.asyncio
async def test_json_library_stand_in_leads_with_the_named_notice(client, auth_headers, monkeypatch):
    async def unavailable(message, system_prompt, *, market="cn"):
        raise RuntimeError("CN AI provider is not configured")

    monkeypatch.setattr(aa.ai_assistant, "chat_openai_with_metadata", unavailable)
    response = await client.post("/api/v1/ai/chat-json", headers=auth_headers, json={"message": QUERY})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ai_metadata"]["stand_in"] == "library_only"
    assert body["ai_metadata"]["model_called"] is False
    titles = [source["title"] for source in body["sources"]]
    assert titles
    _assert_notice_leads(body["message"], titles)
    assert body["structured"]["headline"].startswith("「136号文」的资料库记录正在等待重新核验")
    assert all(source.get("source_id") != "policy-cn-136" for source in body["sources"])
    assert NATIONAL_NUMBER not in body["message"]


@pytest.mark.usefixtures("library_clock_past_review_window")
@pytest.mark.asyncio
async def test_ask_without_a_model_leads_with_the_named_notice(client, auth_headers, monkeypatch):
    async def forbidden(*args, **kwargs):
        raise AssertionError("model should not be called")

    monkeypatch.setattr(aa, "_llm_configured", lambda: False)
    monkeypatch.setattr(aa.ai_assistant, "chat_openai_with_metadata", forbidden)
    response = await client.post(
        "/api/v1/ai/ask", headers=auth_headers, json={"query": QUERY, "market": "cn"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["model"] is None
    titles = [source["title"] for source in body["sources"]]
    assert titles
    _assert_notice_leads(body["answer"], titles)
    assert body["structured"]["headline"].startswith("「136号文」的资料库记录正在等待重新核验")
    assert all(source.get("source_id") != "policy-cn-136" for source in body["sources"])
    assert NATIONAL_NUMBER not in body["answer"]


def test_overdue_list_is_read_only_and_uses_the_given_day():
    before = REGISTRY.read_bytes()
    module = _load_script()
    past = module.overdue_sources(date(2026, 11, 16))
    by_id = {row["id"]: row for row in past}
    assert by_id["policy-cn-136"] == {
        "id": "policy-cn-136",
        "last_verified_at": "2026-10-15",
        "interval": 30,
        "days_overdue": 2,
    }
    assert "policy-us-itc" in by_id
    assert "policy-cn-136" not in {row["id"] for row in module.overdue_sources(date(2026, 11, 7))}
    assert "policy-cn-gd-yfgjg-2025-263" not in by_id
    assert REGISTRY.read_bytes() == before

    env = {key: value for key, value in os.environ.items()
           if not (key.endswith("_API_KEY") or key.startswith("MINIMAX_") or key.startswith("NENGJIAN_"))}
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "--as-of", "2026-11-16"],
        capture_output=True, text=True, cwd=str(ROOT), env=env, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "id\tlast_verified_at\tinterval\tdays_overdue" in result.stdout
    assert "policy-cn-136\t2026-10-15\t30\t2" in result.stdout
    assert REGISTRY.read_bytes() == before
