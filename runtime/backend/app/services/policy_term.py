"""Policy expiry and issue date. Dates come from the record; none are invented."""
from __future__ import annotations

from datetime import date
from typing import Any, Mapping, Optional


def _parse(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def valid_until(doc: Mapping[str, Any]) -> Optional[date]:
    """Earliest expiry among valid_until, expiry_date, and expiry."""
    found = []
    for key in ("valid_until", "expiry_date", "expiry"):
        parsed = _parse(doc.get(key))
        if parsed is not None:
            found.append(parsed)
    return min(found) if found else None


def issue_date(doc: Mapping[str, Any]) -> Optional[str]:
    """发文日期：only an explicit publish_date or issue_date, not an unlabeled timestamp."""
    for key in ("publish_date", "issue_date"):
        parsed = _parse(doc.get(key))
        if parsed is not None:
            return parsed.isoformat()
    return None


def is_expired_policy(doc: Mapping[str, Any], today: date) -> bool:
    if doc.get("superseded_by"):
        return True
    until = valid_until(doc)
    return until is not None and until < today
