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
from app.services.hybrid_retrieval import hybrid_scores, recall_at_k, rerank
from app.services.local_embeddings import cosine_dense
from app.services.retrieval_eval import load_corpus, load_questions

EMBED = "BAAI/bge-m3"
RERANK = "BAAI/bge-reranker-v2-m3"


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
        reranker = CrossEncoder(RERANK)
    except Exception as exc:
        rerank_reason = exc.__class__.__name__
    docs = load_corpus()
    questions = load_questions()
    doc_texts = [f"{doc.get('title') or ''}\n{doc.get('content') or ''}" for doc in docs]
    doc_vectors = _dense(embedder, doc_texts)
    per = []
    faith_scores = []
    by_category: dict[str, list[float]] = {}
    for question in questions:
        relevant = {item["source_id"] for item in question.get("required_sources") or []}
        known = {doc["source_id"] for doc in docs}
        present = relevant & known
        if not present:
            per.append({"id": question.get("id"), "recall": None})
            continue
        query = question.get("question") or ""
        qvec = _dense(embedder, [query])[0]
        vector_scores = {
            doc["source_id"]: max(0.0, cosine_dense(qvec, vec))
            for doc, vec in zip(docs, doc_vectors)
        }
        ranked = hybrid_scores(query, docs, vector_scores)
        if reranker is not None:
            pairs = [(query, row.get("chunk") or "") for row in ranked[:24]]
            raw = reranker.predict(pairs)
            order = sorted(range(len(pairs)), key=lambda index: float(raw[index]), reverse=True)
            head = [ranked[index] for index in order]
            tail = ranked[24:]
            ranked = head + tail
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
        contexts = [doc.get("content") or "" for doc in docs if doc.get("source_id") in present]
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
        "note": "previous_char_ngram_recall_at_8 来自字符 n-gram 实测。本次数字只在 status=ok 且模型名称为 bge-m3 时有效。",
    }
    target = ROOT / "data" / "eval" / "bge_m3_recall.json"
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
