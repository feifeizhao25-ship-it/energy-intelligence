"""问答接口检索（ai_assistant._retrieve，前 3 条、过下限）的离线对照：库内题有没有丢来源，库外题有没有挂来源。

用法（不调用任何模型或外部服务）：
    python scripts/eval_chat_retrieval_floor.py [阈值，默认 0.36]

库内题：data/eval 下 golden*/heldout*（不含国际版和拒答题）里 required_sources 在库中的题，看前 3 条是否含要求来源。
库外题：data/eval/out_of_corpus_v1.jsonl，看是否一条来源都不挂。
对照组是 RAG_MIN_COVERAGE=0（关掉加权覆盖率，即 2026-11-20 之前的行为）。
"""

import glob
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.api.v1 import ai_assistant as aa  # noqa: E402


def _rows(path):
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            yield json.loads(line)
        except ValueError:
            continue


def main() -> None:
    floor = sys.argv[1] if len(sys.argv) > 1 else "0.36"
    ids = {doc["source_id"] for doc in aa._RAG_SERVICE._corpus}
    positives = []
    for path in sorted(glob.glob(str(ROOT / "data/eval/golden*.jsonl")) + glob.glob(str(ROOT / "data/eval/heldout*.jsonl"))):
        if "global" in path:
            continue
        for row in _rows(path):
            if row.get("category") == "refusal" or not row.get("question"):
                continue
            required = {item["source_id"] for item in row.get("required_sources") or []} & ids
            if required:
                positives.append((row["question"], required))
    negatives = [row["question"] for row in _rows(ROOT / "data/eval/out_of_corpus_v1.jsonl")]

    def run(value):
        os.environ["RAG_MIN_COVERAGE"] = value
        hit = {i for i, (q, req) in enumerate(positives) if {h.source_id for h in aa._retrieve(q, "cn")} & req}
        leaks = [q for q in negatives if aa._retrieve(q, "cn")]
        return hit, leaks

    base_hit, base_leaks = run("0")
    new_hit, new_leaks = run(floor)
    print(json.dumps({
        "floor": float(floor),
        "in_corpus_questions": len(positives),
        "hit_at_3_before": len(base_hit),
        "hit_at_3_after": len(new_hit),
        "lost": [positives[i][0] for i in sorted(base_hit - new_hit)],
        "out_of_corpus_questions": len(negatives),
        "with_sources_before": len(base_leaks),
        "with_sources_after": len(new_leaks),
        "still_leaking": new_leaks,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
