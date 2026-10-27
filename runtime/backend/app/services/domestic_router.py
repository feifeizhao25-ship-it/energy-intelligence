"""国内对话：DeepSeek → 百炼 → 智谱。各自使用自己的模型号。

deepseek-flash 是 DeepSeek 的模型号，不会改写成 glm-4-plus。
glm-4-flash 调用智谱时使用官方文档中的 glm-4.7-flash。
"""
from __future__ import annotations

from app.config import settings

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


# 推理模型会把预算花在 reasoning_content 上，1500 时正文可能是空的。空正文先加预算重试一次。
FIRST_MAX_TOKENS = 1500
RETRY_MAX_TOKENS = 4096
EMPTY_ANSWER = "这次没有生成可用回答。请缩短问题后再试一次。"


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


async def _invoke(transport, base, key, use_model, messages, max_tokens: int) -> tuple[str, str]:
    result = await transport(base, key, use_model, messages, max_tokens)
    if not isinstance(result, tuple):
        return str(result or "").strip(), use_model
    content = result[0] if result else ""
    reported = result[1] if len(result) > 1 and result[1] else use_model
    return str(content or "").strip(), str(reported)


async def complete_domestic(messages: list[dict], model: str | None = None, transport=None) -> dict:
    chain = provider_chain()
    if not chain:
        raise RuntimeError("CN AI provider is not configured")
    if transport is None:
        from openai import AsyncOpenAI

        async def transport(base, key, use_model, payload, max_tokens=FIRST_MAX_TOKENS):
            client = AsyncOpenAI(api_key=key, base_url=base)
            response = await client.chat.completions.create(
                model=use_model, messages=payload, temperature=0.4, max_tokens=max_tokens,
            )
            message = response.choices[0].message
            content, _reasoning = completion_text(message)
            return content, getattr(response, "model", None) or use_model

    errors = []
    for name, base, key, default_model in chain:
        use_model = model_for(name, model, default_model)
        try:
            content, reported = await _invoke(transport, base, key, use_model, messages, FIRST_MAX_TOKENS)
            if not content:
                content, reported = await _invoke(transport, base, key, use_model, messages, RETRY_MAX_TOKENS)
        except Exception as exc:
            errors.append(f"{name}: {exc.__class__.__name__}")
            continue
        if not content:
            errors.append(f"{name}: empty")
            continue
        return {"content": content, "provider": name, "model": reported or use_model}
    return {"content": EMPTY_ANSWER, "provider": "domestic", "model": "unavailable"}
