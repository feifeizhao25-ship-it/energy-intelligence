"""检索回答的忠实度。

用回答里的短句是否被给定上下文覆盖来打分，不调用外部评审模型。
0.90 与现有门禁一致，标在结果里，不写成已经重新标定的正式标准。
"""
from __future__ import annotations

import os
import re

PROVISIONAL_THRESHOLD = 0.90


def faithfulness_threshold() -> float:
    raw = (os.environ.get("RAGAS_FAITHFULNESS_MIN") or "").strip()
    if not raw:
        return PROVISIONAL_THRESHOLD
    try:
        value = float(raw)
    except ValueError:
        return PROVISIONAL_THRESHOLD
    if value < 0 or value > 1:
        return PROVISIONAL_THRESHOLD
    return value


def _sentences(text: str) -> list[str]:
    parts = re.split(r"[。！？；\n]", text or "")
    return [part.strip() for part in parts if len(part.strip()) >= 4]


def _supported(sentence: str, context: str) -> bool:
    if sentence in context:
        return True
    chars = [ch for ch in sentence if "\u4e00" <= ch <= "\u9fff"]
    if len(chars) < 4:
        return sentence.lower() in context.lower()
    hits = 0
    windows = 0
    for index in range(len(chars) - 1):
        windows += 1
        if chars[index] + chars[index + 1] in context:
            hits += 1
    if windows == 0:
        return False
    return hits / windows >= 0.6


def faithfulness_score(answer: str, contexts: list[str]) -> dict:
    blob = "\n".join(part for part in contexts if part)
    sentences = _sentences(answer)
    if not sentences or not blob.strip():
        return {
            "score": None,
            "supported": 0,
            "claims": 0,
            "engine": "local-overlap",
            "reason": "没有可对照的回答或上下文",
        }
    supported = sum(1 for sentence in sentences if _supported(sentence, blob))
    return {
        "score": supported / len(sentences),
        "supported": supported,
        "claims": len(sentences),
        "engine": "local-overlap",
        "reason": None,
    }


def faithfulness_gate(answer: str, contexts: list[str], threshold: float | None = None) -> dict:
    measured = faithfulness_score(answer, contexts)
    limit = PROVISIONAL_THRESHOLD if threshold is None else threshold
    score = measured["score"]
    return {
        **measured,
        "threshold": limit,
        "provisional": True,
        "passed": score is not None and score >= limit,
        "applied": False,
        "note": "门槛为暂定值。未通过只留在提案里，不改线上检索。",
    }
