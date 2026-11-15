"""DeepSeek 长度预算：可配置的 max_tokens、关闭思考，以及 length 截断要告诉用户。"""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.config import settings
from app.services.ai_service import AIAssistant, INCOMPLETE_NOTICE


def _response(content, finish_reason="stop", model="deepseek-flash"):
    return SimpleNamespace(
        model=model,
        choices=[SimpleNamespace(
            finish_reason=finish_reason,
            message=SimpleNamespace(content=content),
        )],
        usage=SimpleNamespace(prompt_tokens=3, completion_tokens=2, total_tokens=5),
    )


def _assistant(monkeypatch, *, provider="deepseek"):
    monkeypatch.setattr(settings, "DEEPSEEK_API_KEY", "stub-key")
    monkeypatch.setattr(settings, "DASHSCOPE_API_KEY", None)
    monkeypatch.setattr(settings, "GLM_API_KEY", None)
    monkeypatch.setattr(settings, "OPENROUTER_API_KEY", None)
    assistant = AIAssistant()
    create = AsyncMock()
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    if provider == "deepseek":
        assistant.cn_client = client
        assistant.cn_provider = "deepseek"
        assistant.cn_model = "deepseek-flash"
    else:
        assistant.openai_client = client
    return assistant, create


@pytest.mark.asyncio
async def test_max_tokens_defaults_to_4000_and_follows_settings(monkeypatch):
    assistant, create = _assistant(monkeypatch, provider="openai")
    create.return_value = _response("完整回答", model="gpt-4o")
    monkeypatch.setattr(settings, "AI_MAX_TOKENS", 4000)

    await assistant.chat_openai_with_metadata("问题", "系统", market="global")
    assert create.await_args.kwargs["max_tokens"] == 4000
    assert create.await_args.kwargs["extra_body"] is None

    monkeypatch.setattr(settings, "AI_MAX_TOKENS", 6400)
    await assistant.chat_openai_with_metadata("问题", "系统", market="global")
    assert create.await_args.kwargs["max_tokens"] == 6400


@pytest.mark.asyncio
async def test_deepseek_calls_disable_reasoning(monkeypatch):
    assistant, create = _assistant(monkeypatch)
    create.return_value = _response("国内回答")

    await assistant.chat_openai_with_metadata("问题", "系统", market="cn")

    assert create.await_args.kwargs["extra_body"] == {"thinking": {"type": "disabled"}}
    assert create.await_args.kwargs["max_tokens"] == 4000


@pytest.mark.asyncio
async def test_length_truncation_appends_incomplete_notice(monkeypatch):
    assistant, create = _assistant(monkeypatch)
    create.return_value = _response("组件间距应按", finish_reason="length")

    result = await assistant.chat_openai_with_metadata("问题", "系统", market="cn")

    assert result["content"].startswith("组件间距应按")
    assert INCOMPLETE_NOTICE["cn"] in result["content"]
    assert result["metadata"]["incomplete"] is True
    assert result["metadata"]["finish_reason"] == "length"


@pytest.mark.asyncio
async def test_empty_length_returns_notice_instead_of_raising(monkeypatch):
    assistant, create = _assistant(monkeypatch)
    create.return_value = _response("", finish_reason="length")

    result = await assistant.chat_openai_with_metadata("问题", "系统", market="cn")

    assert result["content"] == INCOMPLETE_NOTICE["cn"]
    assert result["metadata"]["incomplete"] is True


@pytest.mark.asyncio
async def test_empty_non_length_still_raises(monkeypatch):
    assistant, create = _assistant(monkeypatch)
    create.return_value = _response(None, finish_reason="stop")

    with pytest.raises(RuntimeError, match="empty content"):
        await assistant.chat_openai_with_metadata("问题", "系统", market="cn")


@pytest.mark.asyncio
async def test_stream_length_yields_notice_after_partial_text(monkeypatch):
    assistant, create = _assistant(monkeypatch)

    async def chunks():
        yield SimpleNamespace(choices=[SimpleNamespace(
            finish_reason=None, delta=SimpleNamespace(content="前半"),
        )])
        yield SimpleNamespace(choices=[SimpleNamespace(
            finish_reason="length", delta=SimpleNamespace(content=None),
        )])

    create.return_value = chunks()
    output = [part async for part in assistant.stream_openai("问题", "系统", market="cn")]

    assert "".join(output).startswith("前半")
    assert INCOMPLETE_NOTICE["cn"] in "".join(output)
    assert create.await_args.kwargs["extra_body"]["thinking"] == {"type": "disabled"}
    assert create.await_args.kwargs["max_tokens"] == 4000


@pytest.mark.asyncio
async def test_stream_empty_length_yields_only_the_notice(monkeypatch):
    assistant, create = _assistant(monkeypatch)

    async def chunks():
        yield SimpleNamespace(choices=[SimpleNamespace(
            finish_reason="length", delta=SimpleNamespace(content=""),
        )])

    create.return_value = chunks()
    output = [part async for part in assistant.stream_openai("问题", "系统", market="cn")]
    assert output == [INCOMPLETE_NOTICE["cn"]]
