"""Market-isolated AI provider routing for Energy Intelligence."""

from time import monotonic
from anthropic import Anthropic
from openai import AsyncOpenAI
from app.config import settings

# DeepSeek 思考模式和正文共用同一份 max_tokens。预算耗尽时 finish_reason=length，
# 正文可能在句中截断，也可能被思考过程挤成空字符串。
INCOMPLETE_NOTICE = {
    "cn": "回答未完成：已达到生成长度上限，内容可能在句中截断。请缩短问题或分步提问。",
    "global": "Answer incomplete: the reply hit the length limit and may stop mid-sentence. Please shorten the question or ask in steps.",
}


class AIAssistant:
    """Route CN data only to direct domestic providers and GL data globally."""

    def __init__(self):
        self.cn_client = None
        self.cn_provider = None
        self.cn_model = None
        # 批量文本优先 DeepSeek；百炼 qwen3.5-plus 留给高风险复核；智谱作兜底。
        if settings.DEEPSEEK_API_KEY:
            self.cn_provider, self.cn_model = "deepseek", settings.DEEPSEEK_MODEL
            self.cn_client = AsyncOpenAI(api_key=settings.DEEPSEEK_API_KEY, base_url=settings.DEEPSEEK_BASE_URL)
        elif settings.DASHSCOPE_API_KEY:
            self.cn_provider, self.cn_model = "dashscope", settings.DASHSCOPE_MODEL
            self.cn_client = AsyncOpenAI(api_key=settings.DASHSCOPE_API_KEY, base_url=settings.DASHSCOPE_BASE_URL)
        elif settings.GLM_API_KEY:
            self.cn_provider, self.cn_model = "glm", settings.GLM_MODEL
            self.cn_client = AsyncOpenAI(api_key=settings.GLM_API_KEY, base_url=settings.GLM_BASE_URL)

        cn_edition = (settings.APP_EDITION or "").lower() == "cn"
        if cn_edition:
            self.openai_client = None
            self.anthropic_client = None
        else:
            self.openai_client = (
                AsyncOpenAI(
                    api_key=settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY,
                    base_url=settings.OPENROUTER_BASE_URL if settings.OPENROUTER_API_KEY else None,
                    default_headers={"HTTP-Referer": "https://energyiq.tianji-astrology.com", "X-Title": "Energy Intelligence"}
                    if settings.OPENROUTER_API_KEY else None,
                ) if (settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY) else None
            )
            self.anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None
        self.openrouter_failures = 0
        self.openrouter_open_until = 0.0

    @staticmethod
    def _normalize_market(market: str) -> str:
        return "global" if market == "global" else "cn"

    def _provider(self, market: str):
        market = self._normalize_market(market)
        if market == "cn":
            if self.cn_client is None:
                raise RuntimeError("CN AI provider is not configured")
            return self.cn_client, self.cn_provider, self.cn_model, None
        if self.openai_client is None:
            raise RuntimeError("Global AI provider is not configured")
        if settings.OPENROUTER_API_KEY:
            return self.openai_client, "openrouter", settings.OPENROUTER_MODEL_QUALITY, {
                "models": [settings.OPENROUTER_MODEL_QUALITY, settings.OPENROUTER_MODEL_FAST, "google/gemini-2.5-flash"],
                "provider": {"data_collection": "deny", "zdr": True, "require_parameters": True},
            }
        return self.openai_client, "openai", "gpt-4o", None

    def _assert_openrouter_available(self, market: str) -> None:
        if market == "global" and settings.OPENROUTER_API_KEY and monotonic() < self.openrouter_open_until:
            raise RuntimeError("OpenRouter circuit is open; retry after cooldown")

    def _record_openrouter_failure(self, market: str) -> None:
        if market != "global" or not settings.OPENROUTER_API_KEY:
            return
        self.openrouter_failures += 1
        if self.openrouter_failures >= max(1, settings.OPENROUTER_CIRCUIT_FAILURES):
            self.openrouter_open_until = monotonic() + max(1, settings.OPENROUTER_CIRCUIT_COOLDOWN_SECONDS)

    def _reset_openrouter_circuit(self, market: str) -> None:
        if market == "global" and settings.OPENROUTER_API_KEY:
            self.openrouter_failures = 0
            self.openrouter_open_until = 0.0

    @staticmethod
    def _max_tokens() -> int:
        try:
            value = int(settings.AI_MAX_TOKENS)
        except (TypeError, ValueError):
            return 4000
        return value if value >= 1 else 4000

    @staticmethod
    def _extra_body(provider: str, extra_body):
        """DeepSeek 默认会思考，思考文本和回答共用长度预算。事实回答关掉思考。"""
        if provider != "deepseek":
            return extra_body
        merged = dict(extra_body or {})
        thinking = dict(merged.get("thinking") or {})
        thinking["type"] = "disabled"
        merged["thinking"] = thinking
        return merged

    @staticmethod
    def incomplete_notice(market: str) -> str:
        return INCOMPLETE_NOTICE["global" if market == "global" else "cn"]

    def _with_incomplete_notice(self, content: str, market: str) -> str:
        notice = self.incomplete_notice(market)
        text = (content or "").strip()
        if not text:
            return notice
        if notice in text:
            return text
        return f"{text}\n\n{notice}"

    async def chat_openai(self, message: str, system_prompt: str, *, market: str = "cn") -> str:
        result = await self.chat_openai_with_metadata(message, system_prompt, market=market)
        return result["content"]

    async def chat_openai_with_metadata(self, message: str, system_prompt: str, *, market: str = "cn") -> dict:
        market = self._normalize_market(market)
        client, provider, model, extra_body = self._provider(market)
        self._assert_openrouter_available(market)
        started_at = monotonic()
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
                max_tokens=self._max_tokens(),
                temperature=0.4,
                extra_body=self._extra_body(provider, extra_body),
            )
            choice = response.choices[0]
            finish_reason = getattr(choice, "finish_reason", None) or ""
            content = (getattr(choice.message, "content", None) or "").strip()
            incomplete = finish_reason == "length"
            if incomplete:
                content = self._with_incomplete_notice(content, market)
            elif not content:
                raise RuntimeError("AI provider returned empty content")
        except Exception:
            self._record_openrouter_failure(market)
            raise
        self._reset_openrouter_circuit(market)
        usage = response.usage
        return {"content": content, "metadata": {
            "provider": provider, "market": market, "model": response.model,
            "tokens_input": usage.prompt_tokens if usage else 0,
            "tokens_output": usage.completion_tokens if usage else 0,
            "tokens_total": usage.total_tokens if usage else 0,
            "latency_ms": int((monotonic() - started_at) * 1000),
            "finish_reason": finish_reason or None,
            "incomplete": incomplete,
        }}

    async def stream_openai(self, message: str, system_prompt: str, *, market: str = "cn"):
        market = self._normalize_market(market)
        client, provider, model, extra_body = self._provider(market)
        if extra_body is not None:
            extra_body = dict(extra_body)
            extra_body["models"] = [settings.OPENROUTER_MODEL_FAST, settings.OPENROUTER_MODEL_QUALITY, "google/gemini-2.5-flash-lite"]
            model = settings.OPENROUTER_MODEL_FAST
        self._assert_openrouter_available(market)
        truncated = False
        produced = False
        try:
            stream = await client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": message}],
                stream=True, max_tokens=self._max_tokens(), temperature=0.7,
                extra_body=self._extra_body(provider, extra_body),
            )
            async for chunk in stream:
                choices = getattr(chunk, "choices", None) or []
                if not choices:
                    continue
                choice = choices[0]
                if getattr(choice, "finish_reason", None) == "length":
                    truncated = True
                delta = getattr(choice, "delta", None)
                piece = getattr(delta, "content", None) if delta is not None else None
                if piece:
                    produced = True
                    yield piece
            if truncated:
                notice = self.incomplete_notice(market)
                yield f"\n\n{notice}" if produced else notice
        except Exception:
            self._record_openrouter_failure(market)
            raise
        self._reset_openrouter_circuit(market)

    def chat_anthropic(self, message: str, system_prompt: str) -> str:
        if self.anthropic_client is None:
            raise RuntimeError("Anthropic provider is not configured")
        response = self.anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022", max_tokens=1500, system=system_prompt,
            messages=[{"role": "user", "content": message}],
        )
        return response.content[0].text


ai_assistant = AIAssistant()
