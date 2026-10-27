"""空的国内模型正文要重试、换下一家，最后给说明而不是 503。"""
import pytest

from app.services.domestic_router import (
    EMPTY_ANSWER,
    FIRST_MAX_TOKENS,
    RETRY_MAX_TOKENS,
    complete_domestic,
    completion_text,
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

    async def transport(base, key, use_model, payload, max_tokens):
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

    async def transport(base, key, use_model, payload, max_tokens):
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
    result = await complete_domestic([{"role": "user", "content": "山东代理购电价格表在哪里"}], transport=transport)
    assert result["provider"] == "dashscope"
    assert "价格表" in result["content"]

    async def always_empty(base, key, use_model, payload, max_tokens):
        return "", use_model

    empty = await complete_domestic([{"role": "user", "content": "请说明136号文"}], transport=always_empty)
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
