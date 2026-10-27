"""各模型空回答计数。只记次数，不记正文，不记密钥。"""
from __future__ import annotations

_counts: dict[str, dict[str, int]] = {}


def record_completion(model: str, empty: bool) -> None:
    row = _counts.setdefault(model or "unknown", {"calls": 0, "empty": 0})
    row["calls"] += 1
    if empty:
        row["empty"] += 1


def empty_rates() -> dict[str, dict]:
    report = {}
    for model, row in sorted(_counts.items()):
        calls = row["calls"]
        report[model] = {
            "calls": calls,
            "empty": row["empty"],
            "empty_rate": (row["empty"] / calls) if calls else 0.0,
        }
    return report


def weekly_empty_report() -> dict:
    rates = empty_rates()
    return {
        "title": "国内模型空回答周报",
        "models": rates,
        "note": "只统计本进程内的完成次数。",
    }


def reset_empty_stats() -> None:
    _counts.clear()
