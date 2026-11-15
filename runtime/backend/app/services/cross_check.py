"""跨厂商核对。生成与裁判必须是不同厂商。

裁判提示词只问原文是否支持该句，只接受 yes / no / partial。
没有百炼密钥时不外呼。分歧句子标为待核验，并进入人工抽检队列。
"""
from __future__ import annotations

import os
import re

from app.services.citation_checker import STATUS_PARTIAL, STATUS_PENDING, STATUS_SUPPORTED, STATUS_UNSUPPORTED
from app.services.model_tier import estimate_cost_cny, tier_for

JUDGE_PROMPT = "只判断给定原文是否支持该句。只回答 yes、no 或 partial。不要解释。"
_MARK = re.compile(r"\d|(?:年|月|日)|〔|号|GB")
_ALLOWED = {"yes": "yes", "no": "no", "partial": "partial"}


def needs_cross_check(text: str) -> bool:
    return bool(_MARK.search(text or ""))


def parse_judge_label(raw: str) -> str | None:
    token = (raw or "").strip().lower().split()
    if not token:
        return None
    return _ALLOWED.get(token[0].strip("。."))


def judge_available() -> bool:
    return bool(os.environ.get("DASHSCOPE_API_KEY", "").strip())


def judge_request(sentence: str, source_text: str) -> dict:
    tier = tier_for("judge")
    return {
        "provider": tier["provider"],
        "model": tier["model"],
        "messages": [
            {"role": "system", "content": JUDGE_PROMPT},
            {"role": "user", "content": f"原文：\n{source_text}\n\n句子：\n{sentence}"},
        ],
        "estimated_cny": estimate_cost_cny(tier["model"], max(len(sentence) + len(source_text), 1), 8),
    }


def labels_agree(checker: str, judge: str) -> bool:
    mapping = {
        STATUS_SUPPORTED: "yes",
        STATUS_PARTIAL: "partial",
        STATUS_UNSUPPORTED: "no",
        STATUS_PENDING: "no",
    }
    return mapping.get(checker, checker) == judge


def apply_judgements(checked: dict, judgements: list[str]) -> dict:
    """judgements 与句子一一对应。不一致则该句改为待核验并进入抽检队列。"""
    sentences = []
    queue = []
    for row, judge in zip(checked["sentences"], judgements):
        item = dict(row)
        item["judge"] = judge
        if judge not in {"yes", "no", "partial"} or not labels_agree(row["label"], judge):
            item["status"] = STATUS_PENDING
            item["shown"] = row["shown"]
            item["review_queue"] = True
            queue.append({"text": row["text"], "checker": row["label"], "judge": judge})
        else:
            item["review_queue"] = False
        sentences.append(item)
    agreed = len(sentences) - len(queue)
    return {
        **checked,
        "sentences": sentences,
        "review_queue": queue,
        "agreement": (agreed / len(sentences)) if sentences else 1.0,
    }


def agreement_with_human(pairs: list[tuple[str, str]]) -> float:
    if not pairs:
        return 1.0
    hit = sum(1 for judge, human in pairs if judge == human)
    return hit / len(pairs)
