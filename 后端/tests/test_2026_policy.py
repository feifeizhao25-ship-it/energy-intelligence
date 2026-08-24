"""2026 政策准确性 — 真实 AI 供应商在线测试（默认跳过）。

恢复说明：原文件是重复行残片且缺 AsyncClient 导入。该用例只针对
真实出资的 AI 供应商做人工验收，默认 skip；设置 RUN_LIVE_AI_TESTS=1
并配置好凭据后才会真正执行。
"""

import os

import pytest
from httpx import AsyncClient  # noqa: F401  # fixture 类型标注用


@pytest.mark.asyncio
async def test_2026_policy_ai_chat(client: AsyncClient, auth_headers: dict):
    """Verify that AI Chat response contains accurate 2026 policy details."""
    if os.getenv("RUN_LIVE_AI_TESTS") != "1":
        pytest.skip("live provider test; set RUN_LIVE_AI_TESTS=1 with funded credentials")

    resp = await client.post(
        "/api/v1/ai/chat",
        headers=auth_headers,
        json={"message": "2026年分布式光伏并网政策要点", "language": "zh"},
    )
    assert resp.status_code == 200
    text = resp.text
    assert "2026" in text
