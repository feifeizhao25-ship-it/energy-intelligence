"""入库结果。数值冲突进入待核验，不覆盖已接受的值。"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from app.services.evidence_envelope import (
    CONFLICT,
    NUMERIC_AGREEMENT_TOLERANCE,
    VERIFICATION_LABELS,
    present_claim,
    verify_numeric_claim,
    verify_policy_claim,
)
from app.services.literature_batch_import import validate_records

SCHEMA = """
CREATE TABLE IF NOT EXISTS accepted (
    record_key TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pending_review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_key TEXT NOT NULL,
    source_id TEXT NOT NULL,
    queue TEXT NOT NULL,
    label TEXT NOT NULL,
    reason TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def _number(value):
    if isinstance(value, bool) or value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _point(record: dict) -> dict:
    return {
        "value": _number(record.get("value")),
        "publisher": record.get("issuer") or record.get("source_id") or "",
        "url": record.get("source_url") or "",
        "snapshot_sha256": record.get("snapshot_sha256") or "",
        "type": "government" if record.get("source_tier") == "一手官方" else "dataset",
        "source_id": record.get("source_id"),
    }


def classify_single(record: dict) -> tuple[str, str, str]:
    if _number(record.get("value")) is not None:
        code, reason = verify_numeric_claim([_point(record)])
    else:
        code, reason = verify_policy_claim([_point(record)])
    return code, VERIFICATION_LABELS.get(code, "待核验"), reason


def _same_value(old: dict, new: dict) -> bool:
    old_number, new_number = _number(old.get("value")), _number(new.get("value"))
    if old_number is not None or new_number is not None:
        if old_number is None or new_number is None:
            return False
        base = max(abs(old_number), abs(new_number), 1.0)
        return abs(old_number - new_number) / base < NUMERIC_AGREEMENT_TOLERANCE
    return (old.get("content_sha256") or "") == (new.get("content_sha256") or "")


class IngestStore:
    def __init__(self, path: Path):
        self.path = Path(path)
        self.conn = connect(self.path)

    def close(self):
        self.conn.close()

    def accepted(self, record_key: str | None = None) -> list[dict]:
        if record_key is None:
            rows = self.conn.execute("SELECT payload FROM accepted ORDER BY record_key").fetchall()
        else:
            rows = self.conn.execute("SELECT payload FROM accepted WHERE record_key = ?", (record_key,)).fetchall()
        return [json.loads(row["payload"]) for row in rows]

    def pending(self) -> list[dict]:
        rows = self.conn.execute(
            "SELECT record_key, source_id, queue, label, reason, payload, created_at FROM pending_review ORDER BY id"
        ).fetchall()
        return [dict(row) | {"payload": json.loads(row["payload"])} for row in rows]

    def upsert(self, record: dict, updated_at: str) -> dict:
        key = record["record_key"]
        current = self.conn.execute("SELECT payload FROM accepted WHERE record_key = ?", (key,)).fetchone()
        if current is None:
            code, label, reason = classify_single(record)
            stored = {**record, "verification_code": code, "verification_label": label, "verification_reason": reason}
            self.conn.execute(
                "INSERT INTO accepted (record_key, source_id, kind, payload, updated_at) VALUES (?, ?, ?, ?, ?)",
                (key, record["source_id"], record["kind"], json.dumps(stored, ensure_ascii=False), updated_at),
            )
            self.conn.commit()
            return {"action": "accepted", "verification_code": code, "verification_label": label}
        old = json.loads(current["payload"])
        if _same_value(old, record):
            refreshed = dict(old)
            for field in ("fetched_at", "snapshot_sha256", "as_of", "freshness", "source_url"):
                if record.get(field):
                    refreshed[field] = record[field]
            others = [item for item in (old.get("corroborated_by") or []) if item != record.get("source_id")]
            if record.get("source_id") and record.get("source_id") != old.get("source_id"):
                others.append(record["source_id"])
            refreshed["corroborated_by"] = others
            if _number(record.get("value")) is not None and others:
                claim = present_claim([_point(old), _point(record)], claim_type="numeric")
                refreshed["verification_code"] = claim["status"]
                refreshed["verification_label"] = claim["label"]
                refreshed["verification_reason"] = claim["reason"]
            self.conn.execute(
                "UPDATE accepted SET payload = ?, updated_at = ? WHERE record_key = ?",
                (json.dumps(refreshed, ensure_ascii=False), updated_at, key),
            )
            self.conn.commit()
            return {"action": "refreshed", "verification_label": refreshed.get("verification_label")}
        if _number(old.get("value")) is not None and _number(record.get("value")) is not None:
            claim = present_claim([_point(old), _point(record)], claim_type="numeric")
            label = claim["label"]
            reason = claim["reason"]
            code = claim["status"]
        else:
            label, reason, code = "待核验", "已有记录与新抓取内容不一致", "review_recommended"
        if code != CONFLICT and label != "冲突":
            label = "待核验"
        queued = {
            **record,
            "queue": "待核验",
            "verification_code": code,
            "verification_label": label,
            "verification_reason": reason,
            "kept_value": old.get("value"),
        }
        self.conn.execute(
            """INSERT INTO pending_review (record_key, source_id, queue, label, reason, payload, created_at)
               VALUES (?, ?, '待核验', ?, ?, ?, ?)""",
            (key, record["source_id"], label, reason, json.dumps(queued, ensure_ascii=False), updated_at),
        )
        self.conn.commit()
        return {"action": "pending", "queue": "待核验", "verification_label": label, "verification_code": code}

    def verified_tariff_rows(self) -> list[dict]:
        rows = []
        for record in self.accepted():
            if record.get("kind") != "tariff" or record.get("verification_code") != "verified":
                continue
            if _number(record.get("value")) is None or not record.get("province"):
                continue
            rows.append({
                "province": record["province"],
                "month": "%04d-%02d" % (int(record["year"]), int(record["month"])),
                "priceYuanPerKwh": record["value"],
                "sourceUrl": record["source_url"],
                "asOf": record["as_of"],
                "licenseNote": record.get("attribution") or record.get("license") or "",
            })
        return rows

    def map_document(self) -> dict:
        features = []
        notes = []
        for record in self.accepted():
            feature = record.get("feature")
            if not feature:
                continue
            copied = json.loads(json.dumps(feature))
            copied.setdefault("properties", {})
            copied["properties"]["attribution"] = record.get("attribution") or ""
            copied["properties"]["source_id"] = record.get("source_id")
            features.append(copied)
            if record.get("attribution") and record["attribution"] not in notes:
                notes.append(record["attribution"])
        return {
            "license_note": " ".join(notes) or "图层尚未写入署名。",
            "layers": [
                {"id": "grid-connection", "title": "变电站、线路与电厂", "kind": "grid", "features": features},
                {"id": "land-use", "title": "用地边界", "kind": "land", "features": []},
            ],
        }

    def literature_cache(self, licence_note: str) -> dict:
        incoming = []
        for record in self.accepted():
            item = record.get("literature")
            if not item:
                continue
            incoming.append({
                **item,
                "licence": (record.get("attribution") or licence_note)[:200],
                "licenceNote": record.get("attribution") or licence_note,
            })
        cleaned = validate_records(incoming, licence_note) if incoming else []
        for row, original in zip(cleaned, incoming):
            row["licenceNote"] = original.get("licenceNote") or licence_note
        return {"licence_note": licence_note, "records": cleaned, "fetched_live_on_request": False}
