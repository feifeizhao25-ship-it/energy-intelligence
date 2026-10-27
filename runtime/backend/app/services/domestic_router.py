"""国内对话：DeepSeek → 百炼 → 智谱。各自使用自己的模型号。

deepseek-flash 是 DeepSeek 的模型号，不会改写成 glm-4-plus。
glm-4-flash 调用智谱时使用官方文档中的 glm-4.7-flash。

deepseek-flash 默认开启思考（https://api-docs.deepseek.com/guides/thinking_mode ）。
思考文本在 reasoning_content，和 content 共用 max_tokens。预算被思考花光时
finish_reason 为 length，正文为空。推理资源不足时 finish_reason 为
insufficient_system_resource，同一次请求稍后再试可以成功。
本接口要的是事实正文，所以关闭思考，空正文再重试两次，第二次等待后再发。
"""
from __future__ import annotations

import asyncio
import logging

from app.config import settings

logger = logging.getLogger(__name__)

GLM_OFFICIAL_ID = "glm-4.7-flash"


def provider_chain() -> list[tuple[str, str, str, str]]:
    chain = []
    if settings.DEEPSEEK_API_KEY:
        chain.append(("deepseek", settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_API_KEY, settings.DEEPSEEK_MODEL))
    if settings.DASHSCOPE_API_KEY:
        chain.append(("dashscope", settings.DASHSCOPE_BASE_URL, settings.DASHSCOPE_API_KEY, settings.DASHSCOPE_MODEL))
    if settings.GLM_API_KEY:
        chain.append(("glm", settings.GLM_BASE_URL, settings.GLM_API_KEY, settings.GLM_MODEL or GLM_OFFICIAL_ID))
    return chain


def family_of(model: str | None) -> str | None:
    name = (model or "").lower()
    if name.startswith("deepseek"):
        return "deepseek"
    if name.startswith("glm"):
        return "glm"
    if name.startswith("qwen"):
        return "dashscope"
    return None


def model_for(provider: str, requested: str | None, default_model: str) -> str:
    """只在请求落在该供应商时使用请求里的模型号，否则用该供应商自己的默认号。"""
    requested = (requested or "").strip()
    if family_of(requested) != provider:
        return default_model
    if provider == "glm":
        return GLM_OFFICIAL_ID
    if provider == "deepseek":
        return requested or default_model
    return default_model


# 思考关闭后，预算给正文。1500 仍可能在长回答上以 length 截断，所以空正文再加大一次。
# 官方没有单独的最小 max_tokens；length 表示本次 max_tokens 已用尽。
FIRST_MAX_TOKENS = 1500
RETRY_MAX_TOKENS = 4096
LENGTH_RETRY_MAX_TOKENS = 8192
SECOND_RETRY_BACKOFF_SECONDS = 1.0
EMPTY_ANSWER = "这次没有生成可用回答。请缩短问题后再试一次。"
# 默认思考会把正文挤空。事实回答关掉思考，思考过程也不返回给用户。
DEEPSEEK_EXTRA_BODY = {"thinking": {"type": "disabled"}}


def completion_text(message) -> tuple[str, str]:
    """读出正文和 reasoning_content。推理过程不当作给用户的回答。"""
    if message is None:
        return "", ""
    if isinstance(message, dict):
        content = message.get("content") or ""
        reasoning = message.get("reasoning_content") or ""
    else:
        content = getattr(message, "content", None) or ""
        reasoning = getattr(message, "reasoning_content", None) or ""
        extra = getattr(message, "model_extra", None) or {}
        if isinstance(extra, dict) and not reasoning:
            reasoning = extra.get("reasoning_content") or ""
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        content = "".join(parts)
    return str(content or "").strip(), str(reasoning or "").strip()


def completion_kwargs(provider: str, model: str, messages: list, max_tokens: int) -> dict:
    """发给兼容接口的参数。只有 DeepSeek 附带关闭思考的 extra_body。"""
    kwargs = {
        "model": model,
        "messages": messages,
        "temperature": 0.4,
        "max_tokens": max_tokens,
    }
    if provider == "deepseek":
        kwargs["extra_body"] = dict(DEEPSEEK_EXTRA_BODY)
    return kwargs


def outcome_from_response(response, fallback_model: str) -> tuple[str, str, str]:
    """正文、模型号、finish_reason。reasoning_content 不作为回答。"""
    choice = response.choices[0]
    content, _reasoning = completion_text(getattr(choice, "message", None))
    finish = getattr(choice, "finish_reason", None) or ""
    reported = getattr(response, "model", None) or fallback_model
    return content, str(reported), str(finish)


def log_empty_completion(provider: str, model: str, finish_reason: str, attempt: int, max_tokens: int) -> None:
    """只记结束原因和预算。不记正文，不记密钥。"""
    logger.warning(
        "domestic_empty provider=%s model=%s finish_reason=%s attempt=%s max_tokens=%s",
        provider,
        model,
        finish_reason or "unknown",
        attempt,
        max_tokens,
    )


async def _invoke(transport, base, key, use_model, messages, max_tokens: int, extra_body) -> tuple[str, str, str]:
    result = await transport(base, key, use_model, messages, max_tokens, extra_body=extra_body)
    if not isinstance(result, tuple):
        return str(result or "").strip(), use_model, ""
    content = result[0] if result else ""
    reported = result[1] if len(result) > 1 and result[1] else use_model
    finish = result[2] if len(result) > 2 and result[2] else ""
    return str(content or "").strip(), str(reported), str(finish or "")


async def complete_domestic(messages: list[dict], model: str | None = None, transport=None, pause=None) -> dict:
    chain = provider_chain()
    if not chain:
        raise RuntimeError("CN AI provider is not configured")
    wait = pause or asyncio.sleep
    if transport is None:
        from openai import AsyncOpenAI

        async def transport(base, key, use_model, payload, max_tokens=FIRST_MAX_TOKENS, extra_body=None):
            client = AsyncOpenAI(api_key=key, base_url=base)
            kwargs = {
                "model": use_model,
                "messages": payload,
                "temperature": 0.4,
                "max_tokens": max_tokens,
            }
            if extra_body:
                kwargs["extra_body"] = extra_body
            response = await client.chat.completions.create(**kwargs)
            return outcome_from_response(response, use_model)

    for name, base, key, default_model in chain:
        use_model = model_for(name, model, default_model)
        extra_body = dict(DEEPSEEK_EXTRA_BODY) if name == "deepseek" else None
        budgets = (FIRST_MAX_TOKENS, RETRY_MAX_TOKENS, RETRY_MAX_TOKENS)
        last_reason = ""
        try:
            for attempt, budget in enumerate(budgets, start=1):
                if attempt == 3:
                    await wait(SECOND_RETRY_BACKOFF_SECONDS)
                    if last_reason == "length":
                        budget = LENGTH_RETRY_MAX_TOKENS
                content, reported, last_reason = await _invoke(
                    transport, base, key, use_model, messages, budget, extra_body,
                )
                if content:
                    return {"content": content, "provider": name, "model": reported or use_model}
                log_empty_completion(name, reported or use_model, last_reason, attempt, budget)
        except Exception as exc:
            logger.warning("domestic_provider_error provider=%s error=%s", name, exc.__class__.__name__)
            continue
    return {"content": EMPTY_ANSWER, "provider": "domestic", "model": "unavailable"}
