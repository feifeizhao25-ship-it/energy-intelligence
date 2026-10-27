"""按日期回看当时现行的政策或电价版本。"""
from __future__ import annotations

from datetime import date


def _parse(value: str | None):
    if not value:
        return None
    return date.fromisoformat(value[:10])


def effective_on(records: list[dict], day: str, key: str = "source_id") -> list[dict]:
    """effective_date <= day，且尚未到期、也未被更早的替代关系排除。"""
    moment = _parse(day)
    if moment is None:
        return []
    chosen = []
    for record in records:
        start = _parse(record.get("effective_date"))
        if start is None or start > moment:
            continue
        end = _parse(record.get("expiry_date"))
        if end is not None and end < moment:
            continue
        chosen.append(record)
    current_ids = {item.get(key) for item in chosen}
    # 新版本同一天也有效时，去掉被它替代的旧记录。新版本还没生效则保留旧记录。
    hidden = {item.get(key) for item in chosen if item.get("superseded_by") in current_ids}
    return [item for item in chosen if item.get(key) not in hidden]
