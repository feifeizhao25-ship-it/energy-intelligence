"""在已收录语料上测量混合检索的 Recall@8。

数字由 hybrid_scores 现算，不写死目标值。
公开数据的实时库不在仓库里时，用登记表、离线样本和结构样本作为干扰文档。
"""
from __future__ import annotations

import json
from pathlib import Path

from app.services.hybrid_retrieval import hybrid_scores, recall_at_k, rerank

ROOT = Path(__file__).resolve().parents[2]


def _doc(source_id: str, title: str, content: str, origin: str, doc_number: str = "", issuer: str = "") -> dict:
    return {
        "source_id": source_id,
        "title": title,
        "content": content,
        "doc_number": doc_number,
        "issuer": issuer,
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
            source.get("doc_number") or "", source.get("issuer") or "",
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
        ranked = rerank(question.get("question") or "", hybrid_scores(question.get("question") or "", docs))
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
    return {
        "k": k,
        "questions": len(questions),
        "evaluated": len(measured),
        "missing_source": missing,
        "corpus_size": len(docs),
        "corpus_origins": sorted({doc["origin"] for doc in docs}),
        "engine": "local-lexical",
        "vector_weight_applied": False,
        "zero_score_not_counted": True,
        "recall_at_8": macro,
        "zero_score_questions": zero_score,
        "by_category": {key: (sum(values) / len(values)) for key, values in by_category.items()},
        "hardcoded": False,
        "note": "语料是已入库的登记文本、离线样本和结构样本，不是一次新的网络抓取。向量分为 0。得分为 0 的文档不计入前 8。",
        "rows": per_question,
    }


def write_report(path: Path, root: Path | None = None) -> dict:
    report = evaluate(load_corpus(root), load_questions(root))
    stored = {key: value for key, value in report.items() if key != "rows"}
    stored["sample_top"] = [
        {"id": item["id"], "recall": item["recall"], "top": item.get("top")}
        for item in report["rows"][:3]
    ]
    path.write_text(json.dumps(stored, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return stored
