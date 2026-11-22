"""2026-11-21 第二轮：新能源国内版专业助手「政策+出处」只回了前言和伪标签 <ds_tool>（调用 query_knowledge_base…）</ds_tool>。
原因：网页端 callDomesticBackend 只发 {model, messages}，/api/v1/ai/domestic 也只收这两项，工具定义被丢掉，
模型永远拿不到工具，只能在正文里模仿调用。现在 tools / tool_choice 原样转给模型，tool_calls 原样返回。不访问网络。"""
import pytest

from app.services.domestic_router import EMPTY_ANSWER, complete_domestic_with_tools

TOOLS = [{
    "type": "function",
    "function": {
        "name": "query_knowledge_base",
        "description": "检索知识库",
        "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    },
}]
CHAIN = [("deepseek", "https://api.deepseek.com", "k", "deepseek-flash"), ("glm", "https://open.bigmodel.cn/api/paas/v4", "k2", "glm-4.7-flash")]


@pytest.fixture
def chain(monkeypatch):
    monkeypatch.setattr("app.services.domestic_router.provider_chain", lambda: list(CHAIN))


@pytest.mark.asyncio
async def test_tools_are_forwarded_and_tool_calls_returned(chain):
    seen = []

    async def transport(base, key, use_model, payload, max_tokens, extra_body=None, tools=None, tool_choice=None):
        seen.append((use_model, tools, tool_choice, extra_body))
        return {
            "content": "",
            "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": "query_knowledge_base", "arguments": '{"query":"GB50797"}'}}],
            "model": "deepseek-flash",
            "finish_reason": "tool_calls",
        }

    out = await complete_domestic_with_tools([{"role": "user", "content": "GB50797 对倾角有什么要求？请给出处"}], TOOLS, "auto", "deepseek-flash", transport=transport)
    assert seen == [("deepseek-flash", TOOLS, "auto", {"thinking": {"type": "disabled"}})]
    assert out["provider"] == "deepseek"
    assert out["tool_calls"][0]["function"] == {"name": "query_knowledge_base", "arguments": '{"query":"GB50797"}'}
    assert out["tool_calls"][0]["id"] == "call_1"


@pytest.mark.asyncio
async def test_failing_provider_falls_through_and_dict_arguments_are_serialised(chain):
    async def transport(base, key, use_model, payload, max_tokens, extra_body=None, tools=None, tool_choice=None):
        if "deepseek" in base:
            raise RuntimeError("boom")
        return {"content": "", "tool_calls": [{"id": "c", "function": {"name": "query_knowledge_base", "arguments": {"query": "储能"}}}], "model": "glm-4.7-flash"}

    out = await complete_domestic_with_tools([{"role": "user", "content": "q"}], TOOLS, transport=transport)
    assert out["provider"] == "glm"
    assert out["tool_calls"][0]["function"]["arguments"] == '{"query": "储能"}'


@pytest.mark.asyncio
async def test_empty_everywhere_is_the_honest_empty_answer(chain):
    async def transport(*args, **kwargs):
        return {"content": "", "tool_calls": [], "model": "m", "finish_reason": "length"}

    out = await complete_domestic_with_tools([{"role": "user", "content": "q"}], TOOLS, transport=transport)
    assert out["content"] == EMPTY_ANSWER and "tool_calls" not in out


@pytest.mark.asyncio
async def test_endpoint_routes_tools_and_keeps_bottom_line(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")
    from app.api.v1.domestic_product import DomesticChatIn, domestic_chat
    from app.services.bottom_line import NOTICE_ZH

    async def no_plain(*args, **kwargs):
        raise AssertionError("tools request must not use the plain path")

    got = {}

    async def with_tools(messages, tools, tool_choice=None, model=None):
        got.update(tools=tools, tool_choice=tool_choice, n=len(messages))
        return {"content": "", "provider": "deepseek", "model": "deepseek-flash",
                "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "query_knowledge_base", "arguments": "{}"}}]}

    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic", no_plain)
    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic_with_tools", with_tools)
    out = await domestic_chat(DomesticChatIn(messages=[{"role": "user", "content": "GB50797 倾角要求"}], tools=TOOLS, tool_choice="auto"), x_internal_token="tok")
    assert got == {"tools": TOOLS, "tool_choice": "auto", "n": 1}
    assert out["tool_calls"][0]["id"] == "c1"
    assert out["content"] == ""

    # 第二轮：带工具结果回来，模型给出正文；底线照样检查正文。
    async def leaking(messages, tools, tool_choice=None, model=None):
        assert messages[-1]["role"] == "tool"
        return {"content": "这个项目值得投资", "provider": "deepseek", "model": "deepseek-flash"}

    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic_with_tools", leaking)
    out = await domestic_chat(DomesticChatIn(messages=[
        {"role": "user", "content": "GB50797 倾角要求"},
        {"role": "assistant", "content": None, "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "query_knowledge_base", "arguments": "{}"}}]},
        {"role": "tool", "tool_call_id": "c1", "name": "query_knowledge_base", "content": "[]"},
    ], tools=TOOLS), x_internal_token="tok")
    assert out["content"] == NOTICE_ZH


@pytest.mark.asyncio
async def test_endpoint_without_tools_is_unchanged(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")
    from app.api.v1.domestic_product import DomesticChatIn, domestic_chat

    async def plain(messages, model=None):
        return {"content": "发改价格〔2025〕136号明确了机制电量。", "provider": "deepseek", "model": "deepseek-flash"}

    async def no_tools(*args, **kwargs):
        raise AssertionError("no tools -> plain path")

    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic", plain)
    monkeypatch.setattr("app.api.v1.domestic_product.complete_domestic_with_tools", no_tools)
    out = await domestic_chat(DomesticChatIn(messages=[{"role": "user", "content": "136号文"}]), x_internal_token="tok")
    assert "136" in out["content"] and "tool_calls" not in out
