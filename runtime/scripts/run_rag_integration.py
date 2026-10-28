"""检索集成评测入口。

仓库里原先没有 run_rag_integration.py。本脚本接上已有的
runtime/backend/app/services/retrieval_eval.py。
需要 bge-m3 的 Recall@8 时，另跑 runtime/backend/scripts/measure_bge_recall.py，
不要把字符 n-gram 的结果写成 bge。
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.retrieval_eval import evaluate, load_corpus, load_questions  # noqa: E402


def main() -> int:
    if "--bge" in sys.argv:
        print(json.dumps({
            "status": "use-measure-script",
            "script": "runtime/backend/scripts/measure_bge_recall.py",
            "reason": "bge-m3 需要单独加载句向量模型。本入口默认只跑当前嵌入配置，避免把字符 n-gram 写成 bge。",
        }, ensure_ascii=False))
        return 2
    docs = load_corpus()
    questions = load_questions()
    report = evaluate(docs, questions)
    stored = {key: value for key, value in report.items() if key != "rows"}
    stored["replacement_for"] = "run_rag_integration.py"
    stored["bge_script"] = "runtime/backend/scripts/measure_bge_recall.py"
    print(json.dumps(stored, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
