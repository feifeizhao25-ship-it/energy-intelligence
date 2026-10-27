"""空的国内模型正文要重试、换下一家，最后给说明而不是 503。"""
import pytest

from app.services.domestic_router import (
    EMPTY_ANSWER,
    FIRST_MAX_TOKENS,
    LENGTH_RETRY_MAX_TOKENS,
    RETRY_MAX_TOKENS,
    SECOND_RETRY_BACKOFF_SECONDS,
    complete_domestic,
    completion_kwargs,
    completion_text,
    log_empty_completion,
    outcome_from_response,
)


def test_completion_text_reads_reasoning_but_not_as_answer():
    class Message:
        content = ""
        reasoning_content = "先想机制电量，正文还没写"

    content, reasoning = completion_text(Message())
    assert content == ""
    assert "机制电量" in reasoning
    content, reasoning = completion_text({"content": "已公布的机制电量。", "reasoning_content": "草稿"})
    assert content == "已公布的机制电量。"
    assert reasoning == "草稿"
    content, _reasoning = completion_text(type("M", (), {"content": "", "model_extra": {"reasoning_content": "只在附加字段"}})())
    assert content == ""


@pytest.mark.asyncio
async def test_empty_completion_retries_once_then_uses_text(monkeypatch):
    calls = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        calls.append(max_tokens)
        if len(calls) == 1:
            return "", use_model
        return "发改价格〔2025〕136号明确了机制电量。", use_model

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash")],
    )
    result = await complete_domestic([{"role": "user", "content": "请说明136号文"}], transport=transport)
    assert calls == [FIRST_MAX_TOKENS, RETRY_MAX_TOKENS]
    assert result["provider"] == "deepseek"
    assert "136" in result["content"]


@pytest.mark.asyncio
async def test_empty_provider_falls_through_then_graceful(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        if "deepseek" in base:
            return "", use_model
        if max_tokens == FIRST_MAX_TOKENS:
            return "", use_model
        return "山东省代理购电价格以已公布的价格表为准。", use_model

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [
            ("deepseek", "https://api.deepseek.com", "k", "deepseek-flash"),
            ("dashscope", "https://dashscope.aliyuncs.com/compatible-mode/v1", "k2", "qwen3.5-plus"),
        ],
    )
    result = await complete_domestic(
        [{"role": "user", "content": "山东代理购电价格表在哪里"}], transport=transport, pause=_no_wait,
    )
    assert result["provider"] == "dashscope"
    assert "价格表" in result["content"]

    async def always_empty(base, key, use_model, payload, max_tokens, extra_body=None):
        return "", use_model

    empty = await complete_domestic(
        [{"role": "user", "content": "请说明136号文"}], transport=always_empty, pause=_no_wait,
    )
    assert empty == {"content": EMPTY_ANSWER, "provider": "domestic", "model": "unavailable"}

    from app.api.v1.domestic_product import DomesticChatIn, domestic_chat

    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic", lambda *args, **kwargs: _async_empty())
    out = await domestic_chat(
        DomesticChatIn(messages=[{"role": "user", "content": "请说明136号文对机制电量的划分。"}]),
        x_internal_token="tok",
    )
    assert out["content"] == EMPTY_ANSWER
    assert out["model"] == "unavailable"


async def _async_empty():
    return {"content": EMPTY_ANSWER, "provider": "domestic", "model": "unavailable"}


def test_deepseek_request_disables_thinking_and_keeps_budget():
    messages = [{"role": "user", "content": "请说明136号文"}]
    kwargs = completion_kwargs("deepseek", "deepseek-flash", messages, FIRST_MAX_TOKENS)
    assert kwargs["extra_body"] == {"thinking": {"type": "disabled"}}
    assert kwargs["max_tokens"] == FIRST_MAX_TOKENS
    assert kwargs["model"] == "deepseek-flash"
    other = completion_kwargs("dashscope", "qwen3.5-plus", messages, RETRY_MAX_TOKENS)
    assert "extra_body" not in other


def test_outcome_reads_finish_reason_and_drops_reasoning():
    class Choice:
        finish_reason = "length"
        message = type("M", (), {"content": "", "reasoning_content": "先想完预算就没了"})()

    class Response:
        model = "deepseek-flash"
        choices = [Choice()]

    content, model, finish = outcome_from_response(Response(), "deepseek-flash")
    assert content == ""
    assert model == "deepseek-flash"
    assert finish == "length"


def test_empty_log_has_finish_reason_and_not_the_prompt(caplog):
    secret = "sk-unit-test-secret"
    prompt = "请按原文说明发改价格〔2025〕136号怎样划分机制电量。"
    with caplog.at_level("WARNING"):
        log_empty_completion("deepseek", "deepseek-flash", "insufficient_system_resource", 2, RETRY_MAX_TOKENS)
    assert "finish_reason=insufficient_system_resource" in caplog.text
    assert "max_tokens=4096" in caplog.text
    assert secret not in caplog.text
    assert prompt not in caplog.text
    assert "reasoning_content" not in caplog.text


@pytest.mark.asyncio
async def test_second_retry_waits_then_uses_text(monkeypatch, caplog):
    calls = []
    waits = []
    prompt = "请按原文说明发改价格〔2025〕136号怎样划分机制电量，不要展开未公布的数字。"
    secret = "sk-unit-test-secret"

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        assert key == secret
        assert extra_body == {"thinking": {"type": "disabled"}}
        calls.append((max_tokens, extra_body))
        if len(calls) < 3:
            return "", use_model, "insufficient_system_resource"
        return "发改价格〔2025〕136号把上网电量分成机制电量与市场交易电量。", use_model, "stop"

    async def pause(seconds):
        waits.append(seconds)

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [("deepseek", "https://api.deepseek.com", secret, "deepseek-flash")],
    )
    with caplog.at_level("WARNING"):
        result = await complete_domestic([{"role": "user", "content": prompt}], transport=transport, pause=pause)
    assert calls == [
        (FIRST_MAX_TOKENS, {"thinking": {"type": "disabled"}}),
        (RETRY_MAX_TOKENS, {"thinking": {"type": "disabled"}}),
        (RETRY_MAX_TOKENS, {"thinking": {"type": "disabled"}}),
    ]
    assert waits == [SECOND_RETRY_BACKOFF_SECONDS]
    assert result["provider"] == "deepseek"
    assert "机制电量" in result["content"]
    assert "finish_reason=insufficient_system_resource" in caplog.text
    assert secret not in caplog.text
    assert prompt not in caplog.text


@pytest.mark.asyncio
async def test_length_second_retry_raises_max_tokens(monkeypatch):
    calls = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        calls.append(max_tokens)
        if len(calls) < 3:
            return "", use_model, "length"
        return "已公布的机制电量以136号文原文为准。", use_model, "stop"

    async def pause(seconds):
        assert seconds == SECOND_RETRY_BACKOFF_SECONDS

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash")],
    )
    result = await complete_domestic([{"role": "user", "content": "136号文"}], transport=transport, pause=pause)
    assert calls == [FIRST_MAX_TOKENS, RETRY_MAX_TOKENS, LENGTH_RETRY_MAX_TOKENS]
    assert "136" in result["content"]


@pytest.mark.asyncio
async def test_provider_error_is_not_retried_and_key_is_not_logged(monkeypatch, caplog):
    calls = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        calls.append(base)
        if "deepseek" in base:
            raise RuntimeError("boom sk-should-not-log")
        return "山东省代理购电价格以已公布的价格表为准。", use_model, "stop"

    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: [
            ("deepseek", "https://api.deepseek.com", "sk-should-not-log", "deepseek-flash"),
            ("dashscope", "https://dashscope.aliyuncs.com/compatible-mode/v1", "k2", "qwen3.5-plus"),
        ],
    )
    with caplog.at_level("WARNING"):
        result = await complete_domestic([{"role": "user", "content": "价格表"}], transport=transport, pause=_no_wait)
    assert calls == [
        "https://api.deepseek.com",
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    ]
    assert result["provider"] == "dashscope"
    assert "sk-should-not-log" not in caplog.text
    assert "RuntimeError" in caplog.text


async def _no_wait(_seconds):
    return None
