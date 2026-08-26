import pytest

from app.api.v1.ai_assistant import ai_assistant


@pytest.mark.asyncio
async def test_mobile_ai_chat_requires_auth(client):
    response = await client.post(
        "/api/v1/ai/chat-json",
        json={"message": "请解释光伏容量因子"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_mobile_ai_chat_returns_json(client, auth_headers, monkeypatch):
    async def fake_chat(message: str, system_prompt: str) -> dict:
        assert message == "请解释光伏容量因子"
        assert "Always cite data sources" in system_prompt
        return {"content": "容量因子需结合项目所在地和可核验资源数据计算。", "metadata": {"provider": "test"}}

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", fake_chat)
    response = await client.post(
        "/api/v1/ai/chat-json",
        json={"message": "请解释光伏容量因子"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["message"] == "容量因子需结合项目所在地和可核验资源数据计算。"
    assert response.json()["ai_metadata"]["provider"] == "test"


@pytest.mark.asyncio
async def test_mobile_ai_chat_rejects_empty_provider_response(
    client, auth_headers, monkeypatch
):
    async def empty_chat(message: str, system_prompt: str) -> dict:
        raise RuntimeError("AI provider returned empty content")

    monkeypatch.setattr(ai_assistant, "chat_openai_with_metadata", empty_chat)
    response = await client.post(
        "/api/v1/ai/chat-json",
        json={"message": "分析项目"},
        headers=auth_headers,
    )
    assert response.status_code == 503
