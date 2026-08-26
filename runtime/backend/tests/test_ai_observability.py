from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services.ai_service import AIAssistant
from app.config import settings


@pytest.mark.asyncio
async def test_chat_returns_model_token_and_latency_metadata(monkeypatch):
    assistant = AIAssistant()
    response = SimpleNamespace(
        model="deepseek/deepseek-v3.2",
        choices=[SimpleNamespace(message=SimpleNamespace(content="可核验的回答"))],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=6, total_tokens=16),
    )
    create = AsyncMock(return_value=response)
    assistant.openai_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

    result = await assistant.chat_openai_with_metadata("问题", "系统指令")

    assert result["content"] == "可核验的回答"
    assert result["metadata"]["model"] == "deepseek/deepseek-v3.2"
    assert result["metadata"]["tokens_total"] == 16
    assert result["metadata"]["latency_ms"] >= 0


@pytest.mark.asyncio
async def test_chat_rejects_empty_provider_response():
    assistant = AIAssistant()
    response = SimpleNamespace(
        model="test-model",
        choices=[SimpleNamespace(message=SimpleNamespace(content=""))],
        usage=None,
    )
    assistant.openai_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=AsyncMock(return_value=response))))
    with pytest.raises(RuntimeError, match="empty content"):
        await assistant.chat_openai_with_metadata("问题", "系统指令")


@pytest.mark.asyncio
async def test_openrouter_circuit_opens_after_consecutive_failures(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(settings, "OPENROUTER_CIRCUIT_FAILURES", 2)
    monkeypatch.setattr(settings, "OPENROUTER_CIRCUIT_COOLDOWN_SECONDS", 60)
    assistant = AIAssistant()
    create = AsyncMock(side_effect=RuntimeError("provider unavailable"))
    assistant.openai_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))

    with pytest.raises(RuntimeError, match="provider unavailable"):
        await assistant.chat_openai_with_metadata("问题1", "系统指令")
    with pytest.raises(RuntimeError, match="provider unavailable"):
        await assistant.chat_openai_with_metadata("问题2", "系统指令")
    with pytest.raises(RuntimeError, match="circuit is open"):
        await assistant.chat_openai_with_metadata("问题3", "系统指令")
    assert create.await_count == 2


@pytest.mark.asyncio
async def test_stream_uses_same_openrouter_privacy_routing(monkeypatch):
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", "test-key")
    assistant = AIAssistant()

    async def chunks():
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="答"))])
        yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="案"))])

    create = AsyncMock(return_value=chunks())
    assistant.openai_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    output = [part async for part in assistant.stream_openai("问题", "系统指令")]
    assert output == ["答", "案"]
    request = create.await_args.kwargs
    assert request["extra_body"]["provider"] == {
        "data_collection": "deny", "zdr": True, "require_parameters": True
    }
    assert request["extra_body"]["models"][0] == settings.OPENROUTER_MODEL_FAST
