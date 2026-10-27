"""分类型时效 SLA 与界面三级标识用的同一套判断。"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path

SLA_PATH = Path(__file__).resolve().parents[2] / "data" / "freshness_sla.json"


def load_sla(path: Path | None = None) -> dict:
    return json.loads((path or SLA_PATH).read_text(encoding="utf-8"))


def badge(as_of: str, interval_days: int, today: date | None = None) -> dict:
    today = today or date.today()
    try:
        verified = date.fromisoformat(str(as_of)[:10])
    except ValueError:
        return {"level": "expired", "label": "已过期 · 不参与测算", "usable": False}
    if verified > today:
        return {"level": "expired", "label": "已过期 · 不参与测算", "usable": False}
    age = (today - verified).days
    interval = max(int(interval_days), 1)
    if age > interval:
        return {"level": "expired", "label": f"已过期 · 不参与测算（截至 {verified.isoformat()}）", "usable": False}
    if interval - age <= 7:
        return {"level": "due", "label": f"临近复核（≤7 天） · 截至 {verified.isoformat()}", "usable": True}
    return {"level": "valid", "label": f"有效 · 截至 {verified.isoformat()}", "usable": True}


def compliance_report(records: list[dict], today: date | None = None) -> dict:
    """records: [{type_id, updated_at, published_at}]。缺记录的类别记为未连接。"""
    sla = load_sla()
    today = today or date.today()
    by_type: dict[str, list[bool]] = {item["id"]: [] for item in sla["types"]}
    for row in records:
        type_id = row.get("type_id")
        if type_id not in by_type:
            continue
        spec = next(item for item in sla["types"] if item["id"] == type_id)
        limit_days = spec.get("update_days") or spec.get("check_days") or 2
        try:
            updated = date.fromisoformat(str(row.get("updated_at"))[:10])
            published = date.fromisoformat(str(row.get("published_at"))[:10])
        except ValueError:
            by_type[type_id].append(False)
            continue
        by_type[type_id].append((updated - published).days <= limit_days and updated <= today)
    rows = []
    for item in sla["types"]:
        samples = by_type[item["id"]]
        if not samples:
            rows.append({**item, "rate": None, "status": "未连接"})
        else:
            rate = sum(1 for ok in samples if ok) / len(samples)
            rows.append({**item, "rate": rate, "status": "达标" if rate == 1 else "未达标"})
    return {"as_of": today.isoformat(), "types": rows}


def superseded_label(doc: dict, titles: dict[str, str] | None = None) -> str | None:
    target = doc.get("superseded_by")
    if not target:
        return None
    title = (titles or {}).get(target) or target
    return f"已被 {title} 替代"
