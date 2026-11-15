"""留出集必须和黄金集分开，而且答案只能来自已经入库的文档。"""
from __future__ import annotations

import json
import re

from app.services.continuous_improvement import run_cycle
from app.services.hybrid_retrieval import contextual_chunk
from app.services.faithfulness import _sentences, _supported
from app.services.retrieval_eval import load_corpus, load_heldout_questions, load_questions

BOILERPLATE = re.compile(r"第\s*\d+\s*题|只复述已收录|不要补充未收录|请只根据已收录|对照已收录条款")


def test_heldout_is_frozen_and_grounded():
    heldout = load_heldout_questions()
    golden = {item["question"] for item in load_questions()}
    assert len(heldout) >= 100
    assert len({item["id"] for item in heldout}) == len(heldout)
    docs = {doc["source_id"]: doc for doc in load_corpus()}
    for item in heldout:
        assert item["question"] not in golden
        assert not BOILERPLATE.search(item["question"])
        assert item.get("split") == "heldout"
        sources = {row["source_id"] for row in item["required_sources"]}
        assert sources and sources <= set(docs)
        blob = "\n".join(contextual_chunk(docs[source_id]) for source_id in sources)
        for claim in item["must_include"]:
            assert all(_supported(sentence, blob) for sentence in _sentences(claim + "。"))


def test_weekly_eval_keeps_heldout_next_to_golden(tmp_path, monkeypatch):
    monkeypatch.setenv("IMPROVEMENT_ENABLED", "1")

    def evaluate():
        return {
            "recall_at_8": 0.99,
            "heldout_recall_at_8": 0.72,
            "claim_overlap": 1.0,
            "heldout_claim_overlap": 0.8,
            "k": 8,
            "questions": 260,
            "heldout_questions": 120,
            "evaluated": 260,
            "engine": "bge",
            "embedding_model": "BAAI/bge-m3",
        }

    result = run_cycle(
        directory=tmp_path,
        watchlist={"github_topics": [], "huggingface_dataset_queries": [], "huggingface_model_queries": [], "arxiv_queries": [], "vetted": []},
        fetch=lambda _url: "{}",
        ingest=lambda bucket: {"status": "noop", "bucket": bucket},
        evaluate=evaluate,
        audit=lambda: {"status": "skipped", "reason": "未配置页面地址"},
        submit=lambda sha: {"submitted": False, "reason": "template id empty", "content_sha256": sha},
    )
    metrics = result["proposal"]["metrics"]
    assert metrics["heldout_recall_at_8"] == 0.72
    assert metrics["recall_at_8"] == 0.99
    assert any("留出题召回低于黄金集" in line for line in result["proposal"]["suggestions"])
    stored = json.loads((tmp_path / "latest_metrics.json").read_text(encoding="utf-8"))
    assert stored["heldout_recall_at_8"] == 0.72
