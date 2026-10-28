"""用本机 bge-m3 重测黄金集 Recall@8 和忠实度。

权重或依赖缺失时退出码为 2，不把字符 n-gram 写成 bge。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.faithfulness import faithfulness_gate, faithfulness_threshold
from app.services.hybrid_retrieval import contextual_chunk, hybrid_scores, recall_at_k, rerank, rewrite_query
from app.services.local_embeddings import cosine_dense
from app.services.retrieval_eval import load_corpus, load_questions

EMBED = "BAAI/bge-m3"
RERANK = "BAAI/bge-reranker-v2-m3"
# 只重排前 8 名不会改变 Recall@8 的成员。窗口放大到 16，才可能把第 9–16 名换进前 8。
RERANK_WINDOW = 16
BEFORE = {
    "recall_at_8": 0.9076923076923077,
    "calculation_recall_at_8": 0.7666666666666667,
    "faithfulness_mean": 0.8861788617886179,
}


def _dense(model, texts: list[str]) -> list[list[float]]:
    rows = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
    return [list(map(float, row)) for row in rows]


def main() -> int:
    try:
        from sentence_transformers import CrossEncoder, SentenceTransformer
    except ImportError:
        print(json.dumps({"status": "missing-dependency", "model": EMBED}, ensure_ascii=False))
        return 2
    try:
        embedder = SentenceTransformer(EMBED)
        query_model_ok = True
    except Exception as exc:
        print(json.dumps({"status": "download-failed", "model": EMBED, "reason": exc.__class__.__name__}, ensure_ascii=False))
        return 2
    reranker = None
    rerank_reason = None
    try:
        reranker = CrossEncoder(RERANK, max_length=256)
    except Exception as exc:
        rerank_reason = exc.__class__.__name__
    docs = load_corpus()
    questions = load_questions()
    doc_texts = [contextual_chunk(doc) for doc in docs]
    doc_vectors = _dense(embedder, doc_texts)
    query_texts = [rewrite_query(question.get("question") or "") for question in questions]
    query_vectors = _dense(embedder, query_texts)
    per = []
    faith_scores = []
    by_category: dict[str, list[float]] = {}
    for index, question in enumerate(questions):
        relevant = {item["source_id"] for item in question.get("required_sources") or []}
        known = {doc["source_id"] for doc in docs}
        present = relevant & known
        if not present:
            per.append({"id": question.get("id"), "recall": None})
            continue
        query = query_texts[index]
        qvec = query_vectors[index]
        if index % 40 == 0:
            print(json.dumps({"progress": index, "of": len(questions)}), flush=True)
        vector_scores = {
            doc["source_id"]: max(0.0, cosine_dense(qvec, vec))
            for doc, vec in zip(docs, doc_vectors)
        }
        ranked = hybrid_scores(query, docs, vector_scores)
        if reranker is not None:
            window = ranked[:RERANK_WINDOW]
            pairs = [(query, (row.get("chunk") or "")[:800]) for row in window]
            raw = reranker.predict(pairs, batch_size=8, show_progress_bar=False)
            order = sorted(range(len(pairs)), key=lambda item: float(raw[item]), reverse=True)
            ranked = [window[item] for item in order] + ranked[RERANK_WINDOW:]
        else:
            ranked = rerank(query, ranked)["rows"]
        hits = [row for row in ranked if row.get("score", 0) > 0 or reranker is not None]
        if reranker is not None:
            hits = ranked
        score = recall_at_k(hits, present, 8)
        category = question.get("category") or "unknown"
        by_category.setdefault(category, []).append(score)
        per.append({"id": question.get("id"), "recall": score})
        claims = "。".join(question.get("must_include") or [])
        contexts = [contextual_chunk(doc) for doc in docs if doc.get("source_id") in present]
        gate = faithfulness_gate(claims + "。", contexts, faithfulness_threshold()) if claims else {"score": None}
        if gate.get("score") is not None:
            faith_scores.append(gate["score"])
    measured = [item["recall"] for item in per if item["recall"] is not None]
    macro = sum(measured) / len(measured) if measured else None
    out = {
        "status": "ok",
        "embedding_model": EMBED,
        "rerank_model": RERANK if reranker is not None else None,
        "rerank_reason": rerank_reason,
        "query_model_ok": query_model_ok,
        "recall_at_8": macro,
        "by_category": {key: sum(values) / len(values) for key, values in by_category.items()},
        "questions": len(questions),
        "evaluated": len(measured),
        "faithfulness_mean": (sum(faith_scores) / len(faith_scores)) if faith_scores else None,
        "faithfulness_threshold": faithfulness_threshold(),
        "previous_char_ngram_recall_at_8": 0.9615,
        "previous_bge_recall_at_8": BEFORE["recall_at_8"],
        "previous_calculation_recall_at_8": BEFORE["calculation_recall_at_8"],
        "previous_faithfulness_mean": BEFORE["faithfulness_mean"],
        "rerank_window": RERANK_WINDOW if reranker is not None else 0,
        "lexical": "bm25-zh-bigram",
        "note": "previous_* 是改写问句、双字 BM25 和发布日期进入分块之前的 bge-m3 实测。分块现在包含来源记录里的发布日期和生效日期，忠实度按这份上下文计算。本次数字只在 status=ok 且模型名称为 bge-m3 时有效。字符 n-gram 的 Recall@8 仍是 0.9615。",
    }
    target = ROOT / "data" / "eval" / "bge_m3_recall.json"
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
