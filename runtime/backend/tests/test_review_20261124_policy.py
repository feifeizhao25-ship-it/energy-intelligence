"""能1、能2：点名文号只返回那一份文件；分布式光伏备案问题能命中已入库的办法。"""
import pytest

from app.services.rag_service import RAGService


def test_unknown_document_number_returns_no_substitute():
    hits = RAGService().search("发改能源规〔2099〕999号现在还有效吗", top_k=5, market="cn").hits
    assert hits == []


def test_distributed_pv_filing_question_returns_the_measures_and_its_limit():
    service = RAGService()
    for query in ("分布式光伏备案需要哪些材料", "分布式光伏并网、备案和绿证相关的政策文献"):
        hits = service.search(query, top_k=3, market="cn").hits
        assert hits, query
        assert hits[0].source_id == "policy-cn-nonum-152179d7"
        assert "第六条" in (hits[0].content or "")
        assert "第六条之后没有入库" in (hits[0].metadata or {}).get("excerpt_limit", "")


@pytest.mark.asyncio
async def test_library_stand_in_quotes_the_measures_clause():
    from app.api.v1.ai_assistant import _library_stand_in

    hits = RAGService().search("分布式光伏备案需要哪些材料", top_k=1, market="cn").hits
    text, evidence, _expired = _library_stand_in("分布式光伏备案需要哪些材料", hits, "cn", None)
    assert text.startswith("该文件已失效") or "分布式光伏发电开发建设管理办法" in text
    assert "原文节选" in text
    assert "第六条" in text
    assert evidence.get("sources")
