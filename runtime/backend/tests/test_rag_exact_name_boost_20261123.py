"""核10：问句点名文号（含「688号文」简称）或书名号里的文件名时，这份文件排第一（2026-11-23）。"""
import pytest

from app.services.rag_service import RAGService, exact_name_match, title_names, _serial_owners


@pytest.fixture(scope="module")
def svc():
    return RAGService()


@pytest.mark.parametrize("query,want", [
    ("绿电直连 688号文 要求", "policy-cn-688"),
    ("分布式光伏发电开发建设管理办法", "policy-cn-nonum-152179d7"),
    ("电力现货市场基本规则 有效期", "policy-cn-fgnyg-2023-1217"),
    ("发电侧容量电价机制 114号文", "policy-cn-114"),
])
def test_named_document_ranks_first(svc, query, want):
    hits = svc.search(query, top_k=3, market="cn").hits
    assert hits and hits[0].source_id == want, [h.source_id for h in hits]


def test_title_names_strip_trial_suffix():
    assert title_names({"title": "关于印发《电力现货市场基本规则（试行）》的通知"}) == ["电力现货市场基本规则"]
    assert title_names({"title": "没有书名号的标题"}) == []


def test_shared_serial_needs_issuer_prefix():
    corpus = [{"source_id": "a", "doc_number": "沪发改价管〔2026〕42号", "title": "甲"},
              {"source_id": "b", "doc_number": "国家发展和改革委员会令 2026年第42号", "title": "乙"},
              {"source_id": "c", "doc_number": "发改能源〔2026〕688号", "title": "丙"}]
    owners = _serial_owners(corpus)
    assert exact_name_match("688号文", corpus[2], owners)
    assert not exact_name_match("42号文 要求", corpus[0], owners)  # 42 号有两份，没写发文机关不算点名

