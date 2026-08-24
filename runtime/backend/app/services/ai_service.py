"""
AI assistant service for Energy Intelligence Platform.
Integrates with OpenAI and Anthropic APIs.
"""

from openai import AsyncOpenAI
from anthropic import Anthropic
from app.config import settings
from time import monotonic


class AIAssistant:
    def __init__(self):
        # 客户端惰性创建：未配置密钥时保持 None，调用方返回 503，
        # 而不是在导入期直接崩溃（红线：无密钥环境也要能启动）。
        self.openai_client = (
            AsyncOpenAI(
                api_key=settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY,
                base_url=settings.OPENROUTER_BASE_URL if settings.OPENROUTER_API_KEY else None,
                default_headers={"HTTP-Referer": "https://xinnengyuan.ai", "X-Title": "新能源智库"} if settings.OPENROUTER_API_KEY else None,
            )
            if (settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY) else None
        )
        self.anthropic_client = (
            Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY else None
        )
        self.openrouter_failures = 0
        self.openrouter_open_until = 0.0

    def _assert_openrouter_available(self) -> None:
        if settings.OPENROUTER_API_KEY and monotonic() < self.openrouter_open_until:
            raise RuntimeError("OpenRouter circuit is open; retry after cooldown")

    def _record_openrouter_failure(self) -> None:
        if not settings.OPENROUTER_API_KEY:
            return
        self.openrouter_failures += 1
        threshold = max(1, settings.OPENROUTER_CIRCUIT_FAILURES)
        if self.openrouter_failures >= threshold:
            self.openrouter_open_until = monotonic() + max(
                1, settings.OPENROUTER_CIRCUIT_COOLDOWN_SECONDS
            )

    def _reset_openrouter_circuit(self) -> None:
        if settings.OPENROUTER_API_KEY:
            self.openrouter_failures = 0
            self.openrouter_open_until = 0.0

    def _require_openai(self) -> AsyncOpenAI:
        if self.openai_client is None:
            raise RuntimeError("OpenAI provider is not configured")
        return self.openai_client

    async def chat_openai(self, message: str, system_prompt: str) -> str:
        """Chat using OpenAI GPT-4."""
        result = await self.chat_openai_with_metadata(message, system_prompt)
        return result["content"]

    async def chat_openai_with_metadata(self, message: str, system_prompt: str) -> dict:
        """Chat and return auditable provider/model/token/latency metadata."""
        client = self._require_openai()
        self._assert_openrouter_available()
        started_at = monotonic()
        try:
            response = await client.chat.completions.create(
                model=settings.OPENROUTER_MODEL_QUALITY if settings.OPENROUTER_API_KEY else "gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                max_tokens=1500,
                temperature=0.4,
                extra_body={"models": [settings.OPENROUTER_MODEL_QUALITY, settings.OPENROUTER_MODEL_FAST, "google/gemini-2.5-flash"], "provider": {"data_collection": "deny", "zdr": True, "require_parameters": True}} if settings.OPENROUTER_API_KEY else None,
            )
            content = (response.choices[0].message.content or "").strip()
            if not content:
                raise RuntimeError("AI provider returned empty content")
        except Exception:
            self._record_openrouter_failure()
            raise
        self._reset_openrouter_circuit()
        usage = response.usage
        return {
            "content": content,
            "metadata": {
                "provider": "openrouter" if settings.OPENROUTER_API_KEY else "openai",
                "model": response.model,
                "tokens_input": usage.prompt_tokens if usage else 0,
                "tokens_output": usage.completion_tokens if usage else 0,
                "tokens_total": usage.total_tokens if usage else 0,
                "latency_ms": int((monotonic() - started_at) * 1000),
            },
        }

    async def stream_openai(self, message: str, system_prompt: str):
        """Stream chat response from OpenAI."""
        client = self._require_openai()
        self._assert_openrouter_available()
        try:
            stream = await client.chat.completions.create(
                model=settings.OPENROUTER_MODEL_FAST if settings.OPENROUTER_API_KEY else "gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message},
                ],
                stream=True,
                max_tokens=1500,
                temperature=0.7,
                extra_body={"models": [settings.OPENROUTER_MODEL_FAST, settings.OPENROUTER_MODEL_QUALITY, "google/gemini-2.5-flash-lite"], "provider": {"data_collection": "deny", "zdr": True, "require_parameters": True}} if settings.OPENROUTER_API_KEY else None,
            )
            async for chunk in stream:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
        except Exception:
            self._record_openrouter_failure()
            raise
        self._reset_openrouter_circuit()

    def chat_anthropic(self, message: str, system_prompt: str) -> str:
        """Chat using Anthropic Claude."""
        if self.anthropic_client is None:
            raise RuntimeError("Anthropic provider is not configured")
        response = self.anthropic_client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=1500,
            system=system_prompt,
            messages=[
                {"role": "user", "content": message},
            ],
        )
        return response.content[0].text


ai_assistant = AIAssistant()
