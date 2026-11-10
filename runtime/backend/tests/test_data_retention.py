"""The retention selector uses the day count already on the plan."""
from datetime import datetime, timedelta, timezone

from app.services.data_retention import expired_record_ids, load_registry, retention_days

NOW = datetime(2026, 11, 9, tzinfo=timezone.utc)


def test_free_plan_keeps_the_existing_seven_day_window():
    registry = load_registry()
    assert retention_days("free", registry) == registry["tiers"]["free"]["service"]["data_retention_days"]
    assert retention_days("free", registry) == 7
    rows = [
        {"id": "old", "created_at": NOW - timedelta(days=8)},
        {"id": "kept", "created_at": NOW - timedelta(days=6)},
    ]
    assert expired_record_ids(rows, retention_days("free", registry), NOW) == ["old"]


def test_unlimited_plan_expires_nothing():
    registry = load_registry()
    assert retention_days("enterprise", registry) == -1
    rows = [{"id": "old", "created_at": NOW - timedelta(days=4000)}]
    assert expired_record_ids(rows, retention_days("enterprise", registry), NOW) == []
