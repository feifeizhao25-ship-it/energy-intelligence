"""
AI assistant service for Energy Intelligence Platform.
Integrates with OpenAI and Anthropic APIs.
"""

from openai import AsyncOpenAI
from anthropic import Anthropic
from app.config import settings


class AIAssistant:
    def __init__(self):
        # 客户端惰性创建：未配置密钥时保持 None，调用方返回 503，
        # 而不是在导入期直接崩溃（红线：无密钥环境也要能启动）。
        self.openai_client = (
            AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            if settings.OPENAI_API_KEY else None
        )
        self.anthropic_client = (
            Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY else None
        )

    def _require_openai(self) -> AsyncOpenAI:
        if self.openai_client is None:
            raise RuntimeError("OpenAI provider is not configured")
        return self.openai_client

    async def chat_openai(self, message: str, system_prompt: str) -> str:
        """Chat using OpenAI GPT-4."""
        client = self._require_openai()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            max_tokens=1500,
            temperature=0.7,
        )
        return response.choices[0].message.content

    async def stream_openai(self, message: str, system_prompt: str):
        """Stream chat response from OpenAI."""
        client = self._require_openai()
        stream = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message},
            ],
            stream=True,
            max_tokens=1500,
            temperature=0.7,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

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
