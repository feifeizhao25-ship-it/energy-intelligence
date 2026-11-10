"""Select records past the retention period already stored on a plan.

The day counts stay in runtime/backend/data/entitlements.json. This module does not
change them and does not delete rows; a caller can pass the returned ids to its own store.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Iterable, Mapping

REGISTRY = Path(__file__).resolve().parents[2] / "data" / "entitlements.json"


def load_registry(path: Path = REGISTRY) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def retention_days(tier: str, registry: Mapping | None = None) -> int:
    data = registry if registry is not None else load_registry()
    days = data["tiers"][tier]["service"]["data_retention_days"]
    if not isinstance(days, int):
        raise ValueError(f"data_retention_days for {tier}")
    return days


def expired_record_ids(rows: Iterable[Mapping], days: int, now: datetime) -> list[str]:
    """days < 0 means the plan does not expire records. The cutoff is exact days, not a new window."""
    if days < 0:
        return []
    cutoff = now - timedelta(days=days)
    expired = []
    for row in rows:
        created = row["created_at"]
        if not isinstance(created, datetime):
            raise TypeError("created_at")
        if created < cutoff:
            expired.append(str(row["id"]))
    return expired
