"""库外问题不挂来源（EN-STUB-RAG-03）：“光伏”“电站”“成本”这类通用词撞上不算相关。

词面重合只数共同的字和双字，“2031 年火星光伏电站的度电成本是多少？”能和《电力重大事故隐患判定标准》凑到 0.48，
过了 0.35 的下限。现在再按全库文档频率加权算覆盖率：语料里从没出现过的“火星”权重最大，对不上就不算命中。
阈值 0.36 用 data/eval 下的黄金集、留出集和 out_of_corpus_v1.jsonl 调出。
"""

import json
from pathlib import Path

import pytest

from app.api.v1 import ai_assistant as aa
from app.services.rag_service import min_coverage, weighted_coverage

ROOT = Path(__file__).resolve().parents[1]
MARS = "2031 年火星光伏电站的度电成本是多少？"
OUT_OF_CORPUS = [
    json.loads(line)["question"]
    for line in (ROOT / "data" / "eval" / "out_of_corpus_v1.jsonl").read_text(encoding="utf-8").splitlines()
    if line.strip()
]


def test_mars_question_has_no_sources():
    assert aa._retrieve(MARS, "cn") == []


@pytest.mark.parametrize("question", OUT_OF_CORPUS)
def test_out_of_corpus_questions_have_no_sources(question):
    assert [h.source_id for h in aa._retrieve(question, "cn")] == []


@pytest.mark.usefixtures("library_clock_inside_review_window")
@pytest.mark.parametrize("question,needle", [
    ("GB 50797 光伏发电站设计规范对方阵间距有什么要求？", "50797"),
    ("设计规范 GB 50797 对光伏方阵间距有什么要求？", "50797"),
])
def test_in_corpus_questions_keep_their_source(question, needle):
    hits = aa._retrieve(question, "cn")
    assert hits and needle in json.dumps([h.title for h in hits] + [h.metadata.get("doc_number") for h in hits], ensure_ascii=False)


def test_query_naming_a_registered_document_is_not_cut_by_coverage():
    # “136号文”点名了库里的文件；问句里“替代”“换掉”这类语料外措辞不该把相关通知挤掉。
    svc = aa._RAG_SERVICE
    with_floor = {h.source_id for h in svc.search("绿电直连通知和136号文是什么关系，是替代吗？", top_k=8, market="cn", exclude_stale=False).hits}
    assert with_floor


def test_weighted_coverage_counts_rare_words_more():
    df = {"光伏": 9, "电站": 9, "火星": 0}
    assert weighted_coverage({"光伏", "电站", "火星"}, {"光伏", "电站"}, df, 10) < 0.36
    assert weighted_coverage({"光伏", "电站"}, {"光伏", "电站"}, df, 10) == 1.0
    assert weighted_coverage(set(), {"光伏"}, df, 10) == 0.0


def test_coverage_floor_env_override(monkeypatch):
    monkeypatch.setenv("RAG_MIN_COVERAGE", "0")
    assert min_coverage() == 0
    monkeypatch.setenv("RAG_MIN_COVERAGE", "2")
    assert min_coverage() == 0.36
    monkeypatch.setenv("RAG_MIN_COVERAGE", "x")
    assert min_coverage() == 0.36


def test_floor_off_brings_back_the_old_behaviour(monkeypatch):
    monkeypatch.setenv("RAG_MIN_COVERAGE", "0")
    assert aa._retrieve(MARS, "cn")  # 旧行为：通用词撞上的通知被当成来源


@pytest.mark.asyncio
async def test_ask_without_a_model_says_not_collected(client, auth_headers, monkeypatch):
    monkeypatch.setattr(aa, "_llm_configured", lambda: False)
    r = await client.post("/api/v1/ai/ask", headers=auth_headers, json={"query": MARS, "market": "cn"})
    assert r.status_code == 200
    body = r.json()
    assert body["sources"] == []
    assert any(word in body["answer"] for word in ("未收录", "没有", "暂无", "无法"))

