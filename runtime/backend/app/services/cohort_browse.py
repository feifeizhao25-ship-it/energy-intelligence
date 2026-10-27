"""同省同角色的聚合浏览。少于 20 人的分组不展示。"""
from __future__ import annotations

MIN_GROUP = 20


def visible_cohorts(groups: list[dict], minimum: int = MIN_GROUP) -> list[dict]:
    shown = []
    for group in groups:
        count = int(group.get("count") or 0)
        if count < minimum:
            continue
        shown.append({
            "province": group.get("province") or "",
            "role": group.get("role") or "",
            "count": count,
            "items": list(group.get("items") or []),
        })
    return shown
