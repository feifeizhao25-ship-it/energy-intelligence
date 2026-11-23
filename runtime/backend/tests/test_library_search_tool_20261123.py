"""网页专业助手的资料库检索工具：/api/v1/ai/library-search 用和 /ai/ask 相同的 _retrieve，只返回来源，不调模型。"""
import pytest
from fastapi import HTTPException

from app.api.v1.domestic_product import LibrarySearchIn, domestic_library_search
from app.services.rag_service import RAGHit


@pytest.mark.asyncio
async def test_returns_numbered_sources_from_retrieve(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")
    seen = {}

    def fake_retrieve(query, market):
        seen["args"] = (query, market)
        return [RAGHit("policy-cn-114", "关于完善发电侧容量电价机制的通知", "煤电容量电价……" * 200, 0.9,
                       {"source_org": "国家发展改革委", "source_url": "https://www.ndrc.gov.cn/x", "doc_number": "发改价格〔2026〕114号"})]

    monkeypatch.setattr("app.api.v1.ai_assistant._retrieve", fake_retrieve)
    out = await domestic_library_search(LibrarySearchIn(query="发电侧容量电价现在是怎么定的？"), x_internal_token="tok")
    assert seen["args"] == ("发电侧容量电价现在是怎么定的？", "cn")
    assert out["count"] == 1
    src = out["sources"][0]
    assert src["ref"] == "S1" and src["id"] == "policy-cn-114"
    assert src["url"] == "https://www.ndrc.gov.cn/x" and src["source_org"] == "国家发展改革委"
    assert len(src["content"]) <= 1200


@pytest.mark.asyncio
async def test_empty_and_auth(monkeypatch):
    monkeypatch.setenv("NENGJIAN_INTERNAL_TOKEN", "tok")
    monkeypatch.setattr("app.api.v1.ai_assistant._retrieve", lambda q, m: [])
    out = await domestic_library_search(LibrarySearchIn(query="北京烤鸭的做法"), x_internal_token="tok")
    assert out == {"query": "北京烤鸭的做法", "count": 0, "sources": []}
    with pytest.raises(HTTPException) as err:
        await domestic_library_search(LibrarySearchIn(query="x"), x_internal_token="wrong")
    assert err.value.status_code == 401
