"""D-12: the international web analyst must call authenticated JSON chat.

POST /api/v1/ai/chat requires a bearer token, reads `message` from the query
string, and responds with text/event-stream. A JSON body posted there without
Authorization is the 401 captured in the UI run ("Not authenticated") and would
not be a chat reply even with a token.

POST /api/v1/ai/chat-json accepts `{message}` plus the same bearer token and
returns a JSON object whose reply is the `message` field.
"""

import re
from pathlib import Path

import pytest

from app.api.v1.ai_assistant import ai_assistant

ROOT = Path(__file__).resolve().parents[3]
WEB_GLOBAL_SRC = ROOT / "web-global" / "src"
STREAMING_CHAT = re.compile(r"""['"`]/api/v1/ai/chat['"`]""")


def _dart_and_ts_sources():
    return [path for path in WEB_GLOBAL_SRC.rglob("*") if path.suffix in {".ts", ".tsx"} and ".test." not in path.name]


def test_international_analyst_page_uses_json_chat_with_a_bearer_token():
    page = (WEB_GLOBAL_SRC / "pages" / "AIAnalystPage.tsx").read_text(encoding="utf-8")
    client = (WEB_GLOBAL_SRC / "lib" / "ai" / "analystChat.ts").read_text(encoding="utf-8")
    assert "postAnalystChat" in page
    assert "ANALYST_CHAT_PATH = '/api/v1/ai/chat-json'" in client
    assert "Authorization" in client
    assert "Bearer" in client
    assert "readStoredAuthToken" in client
    assert "text/event-stream" in client
    assert "replyFromAnalystPayload" in client
    # The page must not post at the streaming route. chat-json contains the
    # streaming path as a prefix, so match a quoted path that ends at chat.
    assert STREAMING_CHAT.search(page) is None
    assert STREAMING_CHAT.search(client) is None


def test_no_web_global_caller_posts_json_to_the_streaming_chat_route():
    offenders = []
    for path in _dart_and_ts_sources():
        text = path.read_text(encoding="utf-8")
        # Drop comments so the explanation of the old route is not a call site.
        code = re.sub(r"/\*[\s\S]*?\*/", "", text)
        code = re.sub(r"(^|[^:])//[^\n]*", r"\1", code)
        if STREAMING_CHAT.search(code):
            offenders.append(str(path.relative_to(ROOT)))
    assert offenders == []


@pytest.mark.asyncio
async def test_streaming_chat_rejects_an_anonymous_json_body(client):
    response = await client.post("/api/v1/ai/chat", json={"conversation_id": "conv-1", "message": "hello"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


@pytest.mark.asyncio
async def test_streaming_chat_does_not_read_message_from_a_json_body(client, auth_headers):
    response = await client.post(
        "/api/v1/ai/chat",
        headers=auth_headers,
        json={"message": "What does LCOE mean?"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_streaming_chat_is_an_event_stream_when_message_is_a_query_param(client, auth_headers, monkeypatch):
    async def fake_stream(message, system_prompt, *, market="cn"):
        assert message == "What does LCOE mean?"
        yield "LCOE is a cost per unit of energy."

    monkeypatch.setattr(ai_assistant, "stream_openai", fake_stream)
    response = await client.post(
        "/api/v1/ai/chat",
        params={"message": "What does LCOE mean?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert "text/event-stream" in response.headers["content-type"]
    assert "application/json" not in response.headers["content-type"]
    assert "LCOE is a cost per unit of energy." in response.text


@pytest.mark.asyncio
async def test_chat_json_returns_a_json_message_for_a_bearer_token(client, auth_headers, monkeypatch):
    async def fake_chat(message, system_prompt, *, market="cn"):
        assert message == "What does LCOE mean?"
        return {"content": "LCOE is a cost per unit of energy.", "metadata": {"provider": "test"}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    response = await client.post(
        "/api/v1/ai/chat-json",
        headers={**auth_headers, "Content-Type": "application/json"},
        json={"message": "What does LCOE mean?"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    assert "text/event-stream" not in response.headers["content-type"]
    body = response.json()
    assert isinstance(body["message"], str) and body["message"]
    assert "LCOE is a cost per unit of energy." in body["message"]
