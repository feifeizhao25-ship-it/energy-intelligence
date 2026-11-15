"""库外问题不返回来源；标准号（如 GB 50797）即使不带年代号也要命中对应标准。"""
from datetime import date

import pytest

from app.services.rag_service import RAGService, standard_number_score


def _row(source_id, content, doc_number="", title=None):
    today = date.today().isoformat()
    return {
        "source_id": source_id,
        "type": "standard",
        "lang": "cn",
        "title": title or source_id,
        "content": content,
        "year": 2024,
        "last_verified_at": today,
        "verify_interval_days": 365,
        "doc_number": doc_number,
        "version": doc_number or "2024",
    }


def test_out_of_library_questions_return_no_sources():
    service = RAGService()
    assert service.search("苹果手机多少钱", top_k=5, market="cn").hits == []
    assert service.search("今天北京天气怎么样", top_k=5, market="cn").hits == []
    assert service.search("how do I cook pasta", top_k=5, market="global").hits == []


def test_relevance_floor_drops_weak_overlap_and_keeps_a_real_match(monkeypatch):
    weak = _row("weak", "alpha beta 以及一大段完全不同的内容")
    strong = _row("strong", "alpha beta gamma delta epsilon")
    service = RAGService(corpus=[weak, strong])
    query = "alpha beta gamma delta epsilon"
    monkeypatch.setenv("RAG_MIN_RELEVANCE", "0.5")
    hits = service.search(query, top_k=5, market="cn").hits
    assert [hit.source_id for hit in hits] == ["strong"]

    monkeypatch.setenv("RAG_MIN_RELEVANCE", "0")
    kept = service.search(query, top_k=5, market="cn").hits
    assert {hit.source_id for hit in kept} == {"weak", "strong"}


def test_exact_standard_number_outranks_a_passing_mention():
    canonical = _row("std-gb50797", "发电量公式见第 6.6 节。", doc_number="GB 50797-2012", title="光伏发电站设计标准")
    mention = _row("other", "正文引用了 GB 50797 但不是该标准本身。", doc_number="发改价格〔2025〕136号")
    hits = RAGService(corpus=[mention, canonical]).search("GB 50797 组件间距", top_k=5, market="cn").hits
    assert [hit.source_id for hit in hits] == ["std-gb50797", "other"]
    assert hits[0].score == 1.0
    assert hits[0].score > hits[1].score


def test_near_standard_number_is_not_a_match():
    doc = _row("other-std", "另一份标准。", doc_number="GB 50796-2012")
    assert RAGService(corpus=[doc]).search("GB 50797", market="cn").hits == []
    assert standard_number_score("GB 50797", doc) == 0.0
    assert standard_number_score("GB/T 19964", {"doc_number": "GB 19964-2012"}) == 0.0


@pytest.mark.parametrize("query", ["GB 50797", "GB50797", "GB 50797-2012"])
def test_library_standard_number_hits_gb50797(query):
    hits = RAGService().search(query, top_k=3, market="cn").hits
    assert hits and hits[0].source_id == "std-gb50797"
    assert hits[0].score >= 1.0


def test_library_iec_number_hits_its_standard():
    hits = RAGService().search("IEC 61724", top_k=3, market="global").hits
    assert hits and hits[0].source_id == "std-iec61724"
    assert hits[0].score >= 1.0
