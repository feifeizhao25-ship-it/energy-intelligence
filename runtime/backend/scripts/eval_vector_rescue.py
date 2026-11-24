"""问答检索：词面（现状）对 词面+本地向量补召回 的离线对照。不调用任何模型接口或外部服务；向量在本机 CPU 上算。

用法：LOCAL_EMBEDDING_MODEL=BAAI/bge-small-zh-v1.5 EMBEDDING_LOCAL_ENGINE=fastembed \
      python scripts/eval_vector_rescue.py [额外问题集.jsonl ...]
库内题：data/eval 下 golden*/heldout*（不含国际版和拒答题），看前 3 条是否含要求来源。
库外题：out_of_corpus_v1.jsonl、refusal_expand_en2.jsonl，看是否一条来源都不挂。
额外问题集每行 {"id","kind":"in_corpus"|其他,"question","expected_source"}（例如 #182 的 chat_realistic_v1.jsonl）。
"""
import glob
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.api.v1 import ai_assistant as aa  # noqa: E402


def _rows(path):
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            yield json.loads(line)


def main() -> None:
    ids = {doc["source_id"] for doc in aa._RAG_SERVICE._corpus}
    sets = {"golden+heldout": [], "extra_in": []}
    negatives = {}
    for path in sorted(glob.glob(str(ROOT / "data/eval/golden*.jsonl")) + glob.glob(str(ROOT / "data/eval/heldout*.jsonl"))):
        if "global" in path:
            continue
        for row in _rows(path):
            if row.get("category") == "refusal" or not row.get("question"):
                continue
            required = {item["source_id"] for item in row.get("required_sources") or []} & ids
            if required:
                sets["golden+heldout"].append((row["question"], required))
    for name in ("out_of_corpus_v1.jsonl", "refusal_expand_en2.jsonl"):
        negatives[name] = [row["question"] for row in _rows(ROOT / "data/eval" / name)]
    for extra in sys.argv[1:]:
        for row in _rows(extra):
            if row.get("kind") == "in_corpus":
                required = {row.get("expected_source")} & ids
                if required:
                    sets["extra_in"].append((row["question"], required))
            else:
                negatives.setdefault(row["id"].rsplit("-", 1)[0], []).append(row["question"])

    def run(flag):
        os.environ["RAG_VECTOR_RESCUE"] = flag
        out = {}
        started = time.perf_counter()
        calls = 0
        for name, rows in sets.items():
            out[name] = {"n": len(rows), "hit@3": sum(1 for q, req in rows if {h.source_id for h in aa._retrieve(q, "cn")} & req)}
            calls += len(rows)
        out["out_of_corpus_attached"] = {name: sum(1 for q in qs if aa._retrieve(q, "cn")) for name, qs in negatives.items()}
        calls += sum(len(qs) for qs in negatives.values())
        out["ms_per_query"] = round((time.perf_counter() - started) * 1000 / max(1, calls), 2)
        return out

    lexical = run("0")
    os.environ["RAG_VECTOR_RESCUE"] = "1"
    aa._retrieve("预热向量索引", "cn")
    rescued = run("1")
    from app.services.local_embeddings import local_model_name
    print(json.dumps({"model": local_model_name(), "min_score": __import__("app.services.vector_rescue", fromlist=["min_score"]).min_score(),
                      "lexical": lexical, "lexical_plus_vector_rescue": rescued}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
