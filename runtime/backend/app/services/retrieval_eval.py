"""在已收录语料上测量混合检索的 Recall@8。

数字由 hybrid_scores 现算，不写死目标值。
公开数据的实时库不在仓库里时，用登记表、离线样本和结构样本作为干扰文档。
向量来自 embed_texts：有密钥走国内接口，否则走本地模型或字符 n-gram。
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from app.services.embeddings_cn import embed_texts
from app.services.hybrid_retrieval import contextual_chunk, hybrid_scores, recall_at_k, rerank, rewrite_query
from app.services.local_embeddings import pairwise_query_scores

ROOT = Path(__file__).resolve().parents[2]


def _doc(source_id: str, title: str, content: str, origin: str, doc_number: str = "", issuer: str = "", locator: str = "", publish_date: str = "", effective_date: str = "") -> dict:
    return {
        "source_id": source_id,
        "title": title,
        "content": content,
        "doc_number": doc_number,
        "issuer": issuer,
        "locator": locator,
        "publish_date": publish_date,
        "effective_date": effective_date,
        "origin": origin,
    }


def load_corpus(root: Path | None = None) -> list[dict]:
    base = root or ROOT
    docs = []
    rag = json.loads((base / "data" / "rag_sources.json").read_text(encoding="utf-8"))
    for source in rag.get("sources") or []:
        content = "\n".join(
            part for part in (
                source.get("title"), source.get("locator"), source.get("content"), source.get("version"),
            ) if part
        )
        docs.append(_doc(
            source["source_id"], source.get("title") or "", content, "rag_sources",
            source.get("doc_number") or "", source.get("issuer") or "", source.get("locator") or "",
            source.get("publish_date") or source.get("published_at") or "",
            source.get("effective_date") or "",
        ))
    registry_path = base / "data" / "public_sources" / "registry.json"
    if registry_path.is_file():
        registry = json.loads(registry_path.read_text(encoding="utf-8"))
        for row in registry.get("sources") or []:
            if not row.get("enabled"):
                continue
            text = " ".join(part for part in (row.get("name"), row.get("attribution"), row.get("human_note")) if part)
            docs.append(_doc(row["source_id"], row.get("name") or "", text, "public_registry"))
    datasets = base / "data" / "cn_datasets.json"
    if datasets.is_file():
        payload = json.loads(datasets.read_text(encoding="utf-8"))
        for item in payload.get("datasets") or []:
            docs.append(_doc(
                "dataset:%s" % item.get("id"),
                item.get("title") or "",
                "%s %s" % (payload.get("license_note") or "", item.get("title") or ""),
                "cn_datasets",
            ))
    resources = base / "data" / "domestic_resources.json"
    if resources.is_file():
        payload = json.loads(resources.read_text(encoding="utf-8"))
        note = payload.get("license_note") or ""
        for station in payload.get("stations") or []:
            label = "%s%s" % (station.get("province") or "", station.get("city") or "")
            docs.append(_doc(
                "offline:%s" % label,
                label,
                "%s 年辐照示例 %s" % (note, station.get("ghi_annual") or ""),
                "domestic_resources",
            ))
    return docs


def load_questions(root: Path | None = None) -> list[dict]:
    path = (root or ROOT) / "data" / "eval" / "golden_v1.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_heldout_questions(root: Path | None = None) -> list[dict]:
    """留出集。问法不沿用黄金集套话，调参时要和黄金集一起看。"""
    path = (root or ROOT) / "data" / "eval" / "heldout_v1.jsonl"
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def claim_overlap(docs: list[dict], questions: list[dict]) -> dict:
    """主张和所要求来源的分块是否重合。没有可切分主张的题不计入平均。"""
    from app.services.faithfulness import faithfulness_gate, faithfulness_threshold

    by_id = {doc["source_id"]: doc for doc in docs}
    scores = []
    for question in questions:
        claims = "。".join(question.get("must_include") or [])
        if not claims:
            continue
        present = {item["source_id"] for item in question.get("required_sources") or []}
        contexts = [contextual_chunk(by_id[source_id]) for source_id in present if source_id in by_id]
        gate = faithfulness_gate(claims + "。", contexts, faithfulness_threshold())
        if gate.get("score") is not None:
            scores.append(gate["score"])
    mean = sum(scores) / len(scores) if scores else None
    return {"claim_overlap": mean, "scored_claims": len(scores), "threshold": faithfulness_threshold()}


def _query_uses_vectors(query: str, docs: list[dict]) -> bool:
    if re.search(r"[\u4e00-\u9fff]", query or ""):
        return True
    tokens = set(re.findall(r"[A-Za-z0-9]{2,}", (query or "").lower()))
    if not tokens:
        return False
    blob = "\n".join(contextual_chunk(doc) for doc in docs).lower()
    return any(token in blob for token in tokens)


def vector_scores_for(query: str, docs: list[dict]) -> dict:
    if not docs or not _query_uses_vectors(query, docs):
        return {"applied": False, "model": None, "scores": {}}
    embedded = embed_texts([query, *[contextual_chunk(doc) for doc in docs]])
    if embedded.get("status") != "ok" or len(embedded.get("vectors") or []) != len(docs) + 1:
        return {"applied": False, "model": embedded.get("model"), "scores": {}, "reason": embedded.get("reason") or embedded.get("status")}
    vectors = embedded["vectors"]
    raw = {
        doc["source_id"]: score
        for doc, score in zip(docs, pairwise_query_scores(vectors[0], vectors[1:]))
    }
    return {"applied": True, "model": embedded.get("model"), "engine": embedded.get("engine") or embedded.get("provider"), "scores": {key: max(0.0, value) for key, value in raw.items()}}


def evaluate(docs: list[dict], questions: list[dict], k: int = 8) -> dict:
    known = {doc["source_id"] for doc in docs}
    per_question = []
    by_category: dict[str, list[float]] = {}
    missing = 0
    zero_score = 0
    for question in questions:
        relevant = {item["source_id"] for item in question.get("required_sources") or []}
        present = relevant & known
        category = question.get("category") or "unknown"
        if not present:
            missing += 1
            per_question.append({
                "id": question.get("id"),
                "category": category,
                "recall": None,
                "reason": "语料中没有要求的来源",
            })
            continue
        query = rewrite_query(question.get("question") or "")
        vectors = vector_scores_for(query, docs)
        ranked = rerank(query, hybrid_scores(query, docs, vectors["scores"]))
        # 得分为 0 的文档只是稳定排序留在前面，不算检索命中。
        hits = [row for row in ranked["rows"] if row.get("score", 0) > 0]
        if not hits:
            zero_score += 1
        score = recall_at_k(hits, present, k)
        by_category.setdefault(category, []).append(score)
        per_question.append({
            "id": question.get("id"),
            "category": category,
            "recall": score,
            "top": [row["source_id"] for row in hits[:k]],
        })
    measured = [item["recall"] for item in per_question if item["recall"] is not None]
    macro = sum(measured) / len(measured) if measured else None
    probe = vector_scores_for(questions[0].get("question") or "", docs) if questions else {"applied": False, "model": None, "engine": None}
    return {
        "k": k,
        "questions": len(questions),
        "evaluated": len(measured),
        "missing_source": missing,
        "corpus_size": len(docs),
        "corpus_origins": sorted({doc["origin"] for doc in docs}),
        "engine": probe.get("engine") or probe.get("model") or "local-lexical",
        "embedding_model": probe.get("model"),
        "vector_weight_applied": bool(probe.get("applied")),
        "zero_score_not_counted": True,
        "recall_at_8": macro,
        "zero_score_questions": zero_score,
        "by_category": {key: (sum(values) / len(values)) for key, values in by_category.items()},
        "hardcoded": False,
        "note": "语料是已入库的登记文本、离线样本和结构样本，不是一次新的网络抓取。词面是中文双字 BM25。含公式、标准或文号的问句用词面 0.82、向量 0.18，其余问句用词面 0.55、向量 0.45。无中文且与语料无共同词的查询不使用向量。得分为 0 的文档不计入前 8。embedding_model 为 local-char-ngram 时表示本机没有加载 bge 权重，用的是字符 n-gram，不是文本嵌入模型。",
        "rows": per_question,
    }


def write_report(path: Path, root: Path | None = None) -> dict:
    docs = load_corpus(root)
    report = evaluate(docs, load_questions(root))
    stored = {key: value for key, value in report.items() if key != "rows"}
    stored["sample_top"] = [
        {"id": item["id"], "recall": item["recall"], "top": item.get("top")}
        for item in report["rows"][:3]
    ]
    path.write_text(json.dumps(stored, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    index_path = path.with_name("vector_index_meta.json")
    index_path.write_text(json.dumps({
        "corpus_size": len(docs),
        "source_ids": [doc["source_id"] for doc in docs],
        "embedding_model": stored.get("embedding_model"),
        "engine": stored.get("engine"),
        "vector_weight_applied": stored.get("vector_weight_applied"),
        "note": "索引在评测时按 source_id 现算，不把向量数值写入仓库。",
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return stored
