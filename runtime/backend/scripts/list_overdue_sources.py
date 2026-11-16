#!/usr/bin/env python3
"""List library sources whose review window has passed.

Read-only. Prints id, last_verified_at, interval, and days overdue.
Does not write last_verified_at or any other source field, and does not edit legal text.

The default date is the wall clock. Pass --as-of YYYY-MM-DD only to inspect another day.
"""
from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.rag_sources import SourceRegistry  # noqa: E402


def overdue_sources(today: date | None = None, sources: list | None = None) -> list[dict]:
    """Sources with a recorded verification date strictly past verify_interval_days.

    ``today`` defaults to the wall clock. Future or unparseable verification dates are omitted:
    they are not a completed review window. Nothing here is written back.
    """
    today = today or date.today()
    if sources is None:
        sources = SourceRegistry.from_file().sources
    rows = []
    for source in sources:
        verified_raw = str(source.get("last_verified_at") or "")
        try:
            verified = date.fromisoformat(verified_raw)
        except ValueError:
            continue
        if verified > today:
            continue
        interval = max(int(source.get("verify_interval_days") or 365), 1)
        age = (today - verified).days
        if age <= interval:
            continue
        rows.append({
            "id": source.get("source_id"),
            "last_verified_at": verified_raw,
            "interval": interval,
            "days_overdue": age - interval,
        })
    rows.sort(key=lambda row: (-row["days_overdue"], str(row["id"] or "")))
    return rows


def format_report(rows: list[dict]) -> str:
    lines = ["id\tlast_verified_at\tinterval\tdays_overdue"]
    for row in rows:
        lines.append(f"{row['id']}\t{row['last_verified_at']}\t{row['interval']}\t{row['days_overdue']}")
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="List library sources past their review window (read-only).")
    parser.add_argument("--as-of", default=None, help="ISO date to inspect; default is the wall clock")
    args = parser.parse_args(argv)
    today = date.fromisoformat(args.as_of) if args.as_of else date.today()
    sys.stdout.write(format_report(overdue_sources(today)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
