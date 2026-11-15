"""把 CSV 或网关报文解析成遥测点，并按已保存的阈值产生告警。"""

from __future__ import annotations

from datetime import datetime, timezone

SOURCES = {"csv", "webhook", "modbus"}
METRICS = {"power_kw", "irradiance", "alarm_code"}
OPERATORS = {"gt", "lt", "present"}


def _number(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("遥测里的数字无法读取") from exc
    return number


def _point(row: dict, source: str) -> dict:
    point_id = str(row.get("point_id") or "").strip()
    recorded = row.get("timestamp") or row.get("recorded_at")
    if not point_id or not recorded:
        raise ValueError("每个点都需要点号和时间")
    if isinstance(recorded, datetime):
        moment = recorded
    else:
        moment = datetime.fromisoformat(str(recorded).replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return {
        "point_id": point_id[:120],
        "recorded_at": moment,
        "power_kw": _number(row.get("power_kw")),
        "energy_kwh": _number(row.get("energy_kwh")),
        "irradiance": _number(row.get("irradiance")),
        "alarm_code": str(row.get("alarm_code") or "")[:40],
        "source": source,
    }


def parse_points(payload: dict) -> list[dict]:
    source = str(payload.get("source") or "")
    rows = payload.get("points")
    if source not in SOURCES or not isinstance(rows, list) or not rows or len(rows) > 5000:
        raise ValueError("请提供来源以及 1 到 5000 个点")
    return [_point(row, source) for row in rows]


def parse_csv(text: str) -> list[dict]:
    lines = [line.strip() for line in text.replace("\ufeff", "").splitlines() if line.strip()]
    if len(lines) < 2:
        raise ValueError("表格至少要有表头和一行数据")
    header = [cell.strip() for cell in lines[0].split(",")]
    if "point_id" not in header or "timestamp" not in header:
        raise ValueError("表格需要点号和时间列")
    rows = []
    for line in lines[1:5001]:
        cells = [cell.strip() for cell in line.split(",")]
        rows.append({name: cells[index] if index < len(cells) else "" for index, name in enumerate(header)})
    return parse_points({"source": "csv", "points": rows})


def rule_matches(rule: dict, point: dict) -> bool:
    metric = rule.get("metric")
    operator = rule.get("operator")
    if metric not in METRICS or operator not in OPERATORS:
        return False
    if metric == "alarm_code":
        return operator == "present" and bool(point.get("alarm_code"))
    value = point.get(metric)
    if value is None:
        return False
    threshold = float(rule.get("threshold") or 0)
    if operator == "gt":
        return value > threshold
    if operator == "lt":
        return value < threshold
    return False
