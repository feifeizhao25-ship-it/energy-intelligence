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


async def complete_domestic(messages: list[dict], model: str | None = None, transport=None) -> dict:
    chain = provider_chain()
    if not chain:
        raise RuntimeError("CN AI provider is not configured")
    if transport is None:
        from openai import AsyncOpenAI

        async def transport(base, key, use_model, payload):
            client = AsyncOpenAI(api_key=key, base_url=base)
            response = await client.chat.completions.create(model=use_model, messages=payload, temperature=0.4, max_tokens=1500)
            return (response.choices[0].message.content or "").strip(), response.model

    errors = []
    for name, base, key, default_model in chain:
        use_model = model_for(name, model, default_model)
        try:
            content, reported = await transport(base, key, use_model, messages)
        except Exception as exc:
            errors.append(f"{name}: {exc.__class__.__name__}")
            continue
        if not content:
            errors.append(f"{name}: empty")
            continue
        return {"content": content, "provider": name, "model": reported or use_model}
    raise RuntimeError("domestic providers failed: " + "; ".join(errors))
