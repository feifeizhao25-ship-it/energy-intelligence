"""每周专家抽检。只组审批卡，不填写专家分数。

分数只来自企业微信审批回传。低于 3 分进入失败样本，48 小时内可进入优化集。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

BEIJING = timezone(timedelta(hours=8))


def select_sample(answers: list[dict], reports: list[dict]) -> dict:
    picked_answers = list(answers[:20])
    picked_reports = list(reports[:5])
    return {
        "status": "pending_wecom",
        "scheduled": "每周一 09:00",
        "answers": picked_answers,
        "reports": picked_reports,
        "scores": None,
        "card": {
            "title": "本周回答抽检",
            "dimensions": ["准确", "引用", "底线", "可读性"],
            "scale": "1-5",
            "count": {"answers": len(picked_answers), "reports": len(picked_reports)},
        },
    }


def apply_scores(sample: dict, scores: list[dict], now: datetime | None = None) -> dict:
    """scores 由审批回调传入。没有分数就保持待审批。"""
    if sample.get("status") != "pending_wecom":
        return sample
    if not scores:
        return sample
    moment = now or datetime.now(BEIJING)
    failures = []
    for row in scores:
        dims = [row.get("accuracy"), row.get("citation"), row.get("bottom_line"), row.get("readability")]
        if any(isinstance(value, (int, float)) and value < 3 for value in dims):
            failures.append({
                "id": row.get("id"),
                "scores": {key: row.get(key) for key in ("accuracy", "citation", "bottom_line", "readability")},
                "entered_at": moment.isoformat(),
                "optimize_by": (moment + timedelta(hours=48)).isoformat(),
            })
    sample = dict(sample)
    sample["scores"] = scores
    sample["failures"] = failures
    sample["status"] = "scored"
    sample["approval"] = "wecom"
    return sample


def due_for_optimization(failure: dict, now: datetime) -> bool:
    optimize_by = datetime.fromisoformat(failure["optimize_by"])
    return now <= optimize_by
