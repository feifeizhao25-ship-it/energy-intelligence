"""Provincial electricity prices are SQL rows, not vector hits.

The seed file holds no live tariff. Callers insert rows that already cite a
source URL, an effective date and a retrieval date. Empty results stay empty.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS electricity_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    province TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    price_yuan_per_kwh REAL NOT NULL,
    source_url TEXT NOT NULL,
    effective_date TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    license_note TEXT NOT NULL
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def insert_price(conn: sqlite3.Connection, row: dict) -> None:
    required = ("province", "year", "month", "price_yuan_per_kwh", "source_url", "effective_date", "retrieved_at", "license_note")
    missing = [key for key in required if row.get(key) in (None, "")]
    if missing:
        raise ValueError("missing " + ",".join(missing))
    conn.execute(
        """INSERT INTO electricity_prices
           (province, year, month, price_yuan_per_kwh, source_url, effective_date, retrieved_at, license_note)
           VALUES (:province, :year, :month, :price_yuan_per_kwh, :source_url, :effective_date, :retrieved_at, :license_note)""",
        row,
    )
    conn.commit()


def query_prices(conn: sqlite3.Connection, province: str, year: int, month: int) -> list[dict]:
    rows = conn.execute(
        """SELECT province, year, month, price_yuan_per_kwh, source_url, effective_date, retrieved_at, license_note
           FROM electricity_prices WHERE province = ? AND year = ? AND month = ? ORDER BY effective_date DESC""",
        (province, year, month),
    ).fetchall()
    return [dict(row) for row in rows]
