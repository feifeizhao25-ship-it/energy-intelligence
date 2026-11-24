"""2026-11-23 真模型复测：网页套餐默认 deepseek-v3，后端原样发给 DeepSeek 官方接口，7 次全 400，
网页显示「请缩短问题后再试」。现在只放行官方型号，其余用 DEEPSEEK_MODEL；全部报错时给准确提示。不访问网络。"""
import pytest

from app.services.domestic_router import (
    BALANCE_ANSWER,
    EMPTY_ANSWER,
    UNAVAILABLE_ANSWER,
    complete_domestic,
    complete_domestic_with_tools,
    model_for,
)

CHAIN = [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash")]


async def _no_wait(_seconds):
    return None


@pytest.mark.parametrize("requested", ["deepseek-v3", "deepseek-v3-pro", "deepseek-v3.2", "DeepSeek-V3"])
def test_v3_names_never_reach_the_official_api(requested, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_ALLOWED_MODELS", raising=False)
    assert model_for("deepseek", requested, "deepseek-flash") == "deepseek-flash"


@pytest.mark.parametrize("requested", ["deepseek-chat", "deepseek-reasoner", "deepseek-flash", "deepseek-v4-pro", "deepseek-v4-flash"])
def test_official_names_pass_through(requested, monkeypatch):
    monkeypatch.delenv("DEEPSEEK_ALLOWED_MODELS", raising=False)
    assert model_for("deepseek", requested, "deepseek-flash") == requested


def test_other_families_and_empty_unchanged(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_ALLOWED_MODELS", raising=False)
    assert model_for("deepseek", None, "deepseek-flash") == "deepseek-flash"
    assert model_for("deepseek", "glm-4-plus", "deepseek-flash") == "deepseek-flash"
    assert model_for("glm", "glm-4-plus", "glm-4.7-flash") == "glm-4.7-flash"
    assert model_for("dashscope", "deepseek-v3", "qwen3.5-plus") == "qwen3.5-plus"


def test_gateway_cannot_reenable_v3(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_ALLOWED_MODELS", "deepseek-v3, deepseek-flash")
    assert model_for("deepseek", "deepseek-v3", "deepseek-flash") == "deepseek-flash"
    assert model_for("deepseek", "deepseek-flash", "deepseek-chat") == "deepseek-flash"
    assert model_for("deepseek", "deepseek-chat", "deepseek-flash") == "deepseek-chat"


@pytest.mark.asyncio
async def test_web_default_reaches_upstream_as_flash(monkeypatch):
    monkeypatch.delenv("DEEPSEEK_ALLOWED_MODELS", raising=False)
    monkeypatch.setattr("app.services.domestic_router.provider_chain", lambda: list(CHAIN))
    monkeypatch.setattr("app.services.domestic_router._cache_on", lambda: False, raising=False)
    seen = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None):
        seen.append(use_model)
        return "688号文要求以荷定源。", use_model

    out = await complete_domestic([{"role": "user", "content": "688号文"}], model="deepseek-v3", transport=transport, pause=_no_wait)
    assert seen and set(seen) == {"deepseek-flash"}
    assert "以荷定源" in out["content"]


class BadRequestError(Exception):
    pass


@pytest.mark.asyncio
async def test_all_errors_give_accurate_hint_not_shorten(monkeypatch):
    monkeypatch.setattr("app.services.domestic_router.provider_chain", lambda: list(CHAIN))
    monkeypatch.setattr("app.services.domestic_router._cache_on", lambda: False, raising=False)
    calls = []

    async def transport(*args, **kwargs):
        calls.append(1)
        raise BadRequestError("400")

    out = await complete_domestic([{"role": "user", "content": "q"}], transport=transport, pause=_no_wait)
    assert out["content"] == UNAVAILABLE_ANSWER and out["model"] == "unavailable"
    assert "缩短" not in out["content"]
    assert len(calls) == 1  # 报错不再走「缩短提示重试」那一轮

    async def tools_transport(*args, **kwargs):
        raise BadRequestError("400")

    tools = [{"type": "function", "function": {"name": "f", "parameters": {"type": "object", "properties": {}}}}]
    out = await complete_domestic_with_tools([{"role": "user", "content": "q"}], tools, transport=tools_transport)
    assert out["content"] == UNAVAILABLE_ANSWER


@pytest.mark.asyncio
async def test_empty_text_still_uses_empty_answer(monkeypatch):
    monkeypatch.setattr("app.services.domestic_router.provider_chain", lambda: list(CHAIN))
    monkeypatch.setattr("app.services.domestic_router._cache_on", lambda: False, raising=False)

    async def always_empty(base, key, use_model, payload, max_tokens, extra_body=None):
        return "", use_model

    out = await complete_domestic([{"role": "user", "content": "q"}], transport=always_empty, pause=_no_wait)
    assert out["content"] == EMPTY_ANSWER


class PaymentRequired(Exception):
    status_code = 402


@pytest.mark.asyncio
async def test_http_402_stops_immediately_with_balance_message(monkeypatch):
    monkeypatch.setattr(
        "app.services.domestic_router.provider_chain",
        lambda: list(CHAIN) + [("glm", "https://open.bigmodel.cn/api/paas/v4/", "k", "glm-4.7-flash")],
    )
    monkeypatch.setattr("app.services.domestic_router._cache_on", lambda: False, raising=False)
    calls = []

    async def transport(*args, **kwargs):
        calls.append(args[2] if len(args) > 2 else kwargs.get("use_model"))
        raise PaymentRequired("insufficient balance")

    out = await complete_domestic([{"role": "user", "content": "容量电价怎么定"}], transport=transport, pause=_no_wait)
    assert out["content"] == BALANCE_ANSWER
    assert out["error"] == "insufficient_balance" and out["http_status"] == 402
    assert "缩短" not in out["content"]
    assert len(calls) == 1

    async def tools_transport(*args, **kwargs):
        raise PaymentRequired("402")

    tools = [{"type": "function", "function": {"name": "f", "parameters": {"type": "object", "properties": {}}}}]
    out = await complete_domestic_with_tools([{"role": "user", "content": "q"}], tools, transport=tools_transport)
    assert out["http_status"] == 402 and "402" in out["content"]
