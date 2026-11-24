"""本地向量补召回（RAG_VECTOR_RESCUE，默认关闭）与本地模型加载参数（2026-11-23）。

CI 里没有 fastembed 和模型文件：逻辑用假向量测；真模型测试只在本机装了 fastembed 且模型已缓存时运行。
"""
import importlib.util
import os
from types import SimpleNamespace

import pytest

from app.api.v1 import ai_assistant as aa
from app.services import local_embeddings as LE
from app.services import vector_rescue as VR


def _hit(sid, score=0.5):
    return SimpleNamespace(source_id=sid, score=score)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    for key in ("RAG_VECTOR_RESCUE", "RAG_VECTOR_MIN_SCORE", "RAG_VECTOR_CACHE_DIR", "LOCAL_EMBEDDING_CACHE_DIR",
                "LOCAL_EMBEDDING_OFFLINE", "LOCAL_EMBEDDING_THREADS"):
        monkeypatch.delenv(key, raising=False)
    VR._INDEX.clear()
    yield
    VR._INDEX.clear()


def test_default_off_and_threshold_parsing(monkeypatch):
    assert VR.enabled() is False
    assert VR.min_score() == 0.72
    monkeypatch.setenv("RAG_VECTOR_MIN_SCORE", "0.8")
    assert VR.min_score() == 0.8
    monkeypatch.setenv("RAG_VECTOR_MIN_SCORE", "abc")
    assert VR.min_score() == 0.72
    monkeypatch.setenv("RAG_VECTOR_RESCUE", "1")
    assert VR.enabled() is True


def test_retrieve_unchanged_when_flag_off(monkeypatch):
    def boom(*_a, **_k):
        raise AssertionError("flag off must not touch vectors")
    monkeypatch.setattr(VR, "rescue", boom)
    before = [h.source_id for h in aa._retrieve("发改价格〔2025〕136号以哪一天区分存量项目和增量项目", "cn")]
    assert before  # 词面本来就能命中


def test_retrieve_falls_back_to_lexical_when_model_missing(monkeypatch):
    """CI 环境没有 fastembed：embed_local 退回字符 n-gram，补召回整段跳过，结果与关闭时一致。"""
    query = "发改价格〔2025〕136号以哪一天区分存量项目和增量项目"
    off = [h.source_id for h in aa._retrieve(query, "cn")]
    monkeypatch.setenv("RAG_VECTOR_RESCUE", "1")
    monkeypatch.setenv("EMBEDDING_LOCAL_ENGINE", "ngram")
    on = [h.source_id for h in aa._retrieve(query, "cn")]
    assert on == off
    assert aa._retrieve("北京烤鸭的做法是什么？", "cn") == []


def test_retrieve_global_market_never_uses_vectors(monkeypatch):
    monkeypatch.setenv("RAG_VECTOR_RESCUE", "1")
    monkeypatch.setattr(VR, "rescue", lambda *a, **k: (_ for _ in ()).throw(AssertionError("global")))
    aa._retrieve("solar investment tax credit", "global")


def _fake_index(monkeypatch, doc_scores, query_ok=True):
    monkeypatch.setattr(VR, "get_index", lambda corpus, text_of: SimpleNamespace(doc_scores=lambda _v: dict(doc_scores)))
    monkeypatch.setattr(VR, "_embed", lambda texts: {"vectors": [[1.0]]} if query_ok else None)


def test_rescue_when_lexical_gate_failed(monkeypatch):
    pool = [_hit("a"), _hit("b"), _hit("c"), _hit("d")]
    _fake_index(monkeypatch, {"a": 0.50, "b": 0.75, "c": 0.73, "d": 0.10, "x": 0.99})
    out = VR.rescue("q", [], lambda: pool, [], str)
    assert [h.source_id for h in out] == ["b", "c", "a"]  # 只在词面候选里按向量排序；不在候选里的 x 不会被引用


def test_no_rescue_below_threshold(monkeypatch):
    _fake_index(monkeypatch, {"a": 0.71, "b": 0.60})
    assert VR.rescue("q", [], lambda: [_hit("a"), _hit("b")], [], str) == []
    monkeypatch.setenv("RAG_VECTOR_MIN_SCORE", "0.70")
    assert [h.source_id for h in VR.rescue("q", [], lambda: [_hit("a"), _hit("b")], [], str)] == ["a", "b"]


def test_no_rescue_without_lexical_candidates(monkeypatch):
    _fake_index(monkeypatch, {"a": 0.99})
    assert VR.rescue("q", [], lambda: [], [], str) == []


def test_merge_inserts_vector_top1_third_when_gate_passed(monkeypatch):
    live = [_hit("a"), _hit("b"), _hit("c")]
    pool = [_hit("a"), _hit("b"), _hit("c"), _hit("z")]
    _fake_index(monkeypatch, {"z": 0.9, "a": 0.5})
    assert [h.source_id for h in VR.rescue("q", live, lambda: pool, [], str)] == ["a", "b", "z"]
    # 向量第一名不在词面候选里：不改
    _fake_index(monkeypatch, {"y": 0.95, "a": 0.5})
    assert [h.source_id for h in VR.rescue("q", live, lambda: pool, [], str)] == ["a", "b", "c"]
    # 向量第一名已在结果里：不改
    _fake_index(monkeypatch, {"b": 0.95})
    assert [h.source_id for h in VR.rescue("q", live, lambda: pool, [], str)] == ["a", "b", "c"]


def test_rescue_returns_lexical_when_query_embedding_fails(monkeypatch):
    live = [_hit("a")]
    _fake_index(monkeypatch, {"a": 0.9}, query_ok=False)
    assert VR.rescue("q", live, lambda: [_hit("a")], [], str) == live


def test_coverage_floor_override_gives_superset():
    query = "光伏电站设计的时候阵列之间要留多宽的间距？"
    live = {h.source_id for h in aa._RAG_SERVICE.search(query, top_k=10, market="cn").hits}
    loose = {h.source_id for h in aa._RAG_SERVICE.search(
        query, top_k=10, market="cn", apply_coverage_floor=False,
    ).hits}
    assert len(loose) > len(live)
    assert live <= loose


def test_fastembed_options_from_env(monkeypatch):
    assert LE.fastembed_options() == {}
    monkeypatch.setenv("LOCAL_EMBEDDING_CACHE_DIR", "/srv/models")
    monkeypatch.setenv("LOCAL_EMBEDDING_THREADS", "2")
    monkeypatch.setenv("LOCAL_EMBEDDING_OFFLINE", "1")
    assert LE.fastembed_options() == {"cache_dir": "/srv/models", "threads": 2, "local_files_only": True}
    monkeypatch.setenv("LOCAL_EMBEDDING_THREADS", "x")
    assert "threads" not in LE.fastembed_options()


def test_doc_chunks_shape():
    chunks = VR.doc_chunks({"title": "标题"}, "字" * 1000)
    assert chunks[0] == "字" * 320 and chunks[1].startswith("标题\n") and len(chunks) <= VR.MAX_CHUNKS_PER_DOC


_MODEL_DIR = os.environ.get("LOCAL_EMBEDDING_CACHE_DIR_FOR_TESTS", "")


@pytest.mark.skipif(importlib.util.find_spec("fastembed") is None or not _MODEL_DIR, reason="本机没有 fastembed 或模型缓存")
def test_real_bge_small_rescues_paraphrase(monkeypatch):
    monkeypatch.setenv("LOCAL_EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
    monkeypatch.setenv("EMBEDDING_LOCAL_ENGINE", "fastembed")
    monkeypatch.setenv("LOCAL_EMBEDDING_CACHE_DIR", _MODEL_DIR)
    monkeypatch.setenv("LOCAL_EMBEDDING_OFFLINE", "1")
    query = "发电侧容量电价现在是怎么定的？"  # #182 真实问法 CR-IN-04，应命中 114 号文
    assert "policy-cn-114" not in {h.source_id for h in aa._retrieve(query, "cn")}
    monkeypatch.setenv("RAG_VECTOR_RESCUE", "1")
    assert [h.source_id for h in aa._retrieve(query, "cn")][0] == "policy-cn-114"
    assert aa._retrieve("北京烤鸭的做法是什么？", "cn") == []
