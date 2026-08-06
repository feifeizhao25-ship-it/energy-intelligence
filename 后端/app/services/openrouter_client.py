"""OpenRouter client with secret-only configuration and privacy-aware routing."""

from __future__ import annotations

import os
from typing import Dict, Iterable, List, Optional

import httpx


class OpenRouterConfigurationError(RuntimeError):
    pass


def configured_models(value: Optional[str] = None) -> List[str]:
    raw = value if value is not None else os.getenv(
        "OPENROUTER_MODELS", "x-ai/grok-4.5"
    )
    models = [item.strip() for item in raw.split(",") if item.strip()]
    if not models:
        raise OpenRouterConfigurationError("OPENROUTER_MODELS 至少需要一个模型")
    return models


class OpenRouterClient:
    """Minimal chat-completions adapter with no secret persistence."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        models: Optional[Iterable[str]] = None,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._api_key = api_key
        self.base_url = (
            base_url or os.getenv("OPENROUTER_BASE_URL")
            or "https://openrouter.ai/api/v1"
        ).rstrip("/")
        self.models = list(models) if models is not None else configured_models()
        self.transport = transport

    def _key(self) -> str:
        key = self._api_key or os.getenv("OPENROUTER_API_KEY", "")
        if not key:
            raise OpenRouterConfigurationError(
                "OPENROUTER_API_KEY 未配置；请使用部署平台 Secret，禁止写入代码"
            )
        return key

    def chat(self, messages: List[Dict[str, str]], **options) -> Dict:
        payload = {
            "model": self.models[0],
            "models": self.models,
            "messages": messages,
            "provider": {
                "data_collection": "deny",
                "zdr": True,
                "allow_fallbacks": len(self.models) > 1,
            },
            **options,
        }
        with httpx.Client(
            timeout=60.0,
            transport=self.transport,
            headers={
                "Authorization": "Bearer %s" % self._key(),
                "Content-Type": "application/json",
                "HTTP-Referer": os.getenv(
                    "OPENROUTER_SITE_URL", "https://energy-intelligence.invalid"
                ),
                "X-Title": "Energy Intelligence",
            },
        ) as client:
            response = client.post(
                "%s/chat/completions" % self.base_url,
                json=payload,
            )
            response.raise_for_status()
            return response.json()
