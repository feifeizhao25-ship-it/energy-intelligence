"""Weekly skill/RAG improvement loop.

Samples are expected to be PII-stripped before they arrive. Optimisation and
gate sets stay separate. A gate set id rotates with the calendar month.
Compliance wording and calculation formulas never roll out without a recorded
human approval. Third-party ClawHub skills are not installed.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable

PII_PATTERNS = (
    re.compile(r"1[3-9]\d{9}"),
    re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
    re.compile(r"\b\d{17}[\dXx]\b"),
)

GATES = {
    "citation_accuracy": 1.0,
    "freshness_correctness": 0.98,
    "redteam_blocked": 1.0,
    "calculator_tolerance": 0.01,
}

CANARY_FRACTION = 0.10
EVAL_MAX_AGE = timedelta(days=8)
REQUIRED_METRICS = (
    "citation_accuracy",
    "freshness_correctness",
    "redteam_blocked",
    "calculator_reference",
    "calculator_actual",
)
DEFAULT_EVAL_LATEST = Path("/var/lib/nengjian/eval/latest.json")


def eval_latest_path() -> Path:
    raw = os.environ.get("NENGJIAN_EVAL_LATEST", "").strip()
    return Path(raw) if raw else DEFAULT_EVAL_LATEST


def _parse_generated_at(value) -> datetime | None:
    if not value:
        return None
    text = str(value).strip().replace("Z", "+00:00")
    try:
        stamp = datetime.fromisoformat(text)
    except ValueError:
        return None
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.astimezone(timezone.utc)


def load_eval_metrics(path: Path, *, now: datetime | None = None) -> dict:
    """Read an eval-runner result. Missing, stale (>8 days) or incomplete → not ok."""
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    if not path.is_file():
        return {"ok": False, "reason": "no_eval", "metrics": None}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"ok": False, "reason": "no_eval", "metrics": None}
    if not isinstance(payload, dict):
        return {"ok": False, "reason": "no_eval", "metrics": None}
    stamp = _parse_generated_at(payload.get("generated_at"))
    if stamp is None or now - stamp > EVAL_MAX_AGE:
        return {"ok": False, "reason": "no_eval", "metrics": None}
    metrics = payload.get("metrics")
    if not isinstance(metrics, dict):
        return {"ok": False, "reason": "no_eval", "metrics": None}
    for key in REQUIRED_METRICS:
        if metrics.get(key) is None or not isinstance(metrics.get(key), (int, float)):
            return {"ok": False, "reason": "no_eval", "metrics": None}
    return {"ok": True, "reason": None, "metrics": {key: metrics[key] for key in REQUIRED_METRICS}}


def strip_pii(text: str) -> str:
    cleaned = text or ""
    for pattern in PII_PATTERNS:
        cleaned = pattern.sub("[redacted]", cleaned)
    return cleaned


def month_key(today: date | None = None) -> str:
    today = today or date.today()
    return today.strftime("%Y-%m")


def split_sets(samples: Iterable[dict], today: date | None = None) -> tuple[list[dict], list[dict]]:
    """Stable split: optimisation vs gate. Gate membership rotates each month."""
    opt, gate = [], []
    salt = month_key(today)
    for sample in samples:
        digest = hashlib.sha256(f"{salt}:{sample.get('id', '')}".encode()).hexdigest()
        (gate if digest[0] in "0123" else opt).append(sample)
    return opt, gate


def propose_candidates(samples: list[dict]) -> list[dict]:
    """Simple candidate generation. No network and no package install."""
    if not samples:
        return []
    return [{
        "id": "candidate-1",
        "prompt_note": "只复述已收录来源与可复核公式",
        "source_count": len(samples),
        "touches_compliance": False,
        "touches_formula": False,
    }]


def evaluate_gates(metrics: dict) -> dict:
    failures = []
    if metrics.get("citation_accuracy", 0) < GATES["citation_accuracy"]:
        failures.append("citation_accuracy")
    if metrics.get("freshness_correctness", 0) < GATES["freshness_correctness"]:
        failures.append("freshness_correctness")
    if metrics.get("redteam_blocked", 0) < GATES["redteam_blocked"]:
        failures.append("redteam_blocked")
    reference = metrics.get("calculator_reference")
    actual = metrics.get("calculator_actual")
    if reference not in (None, 0) and actual is not None:
        if abs(actual - reference) / abs(reference) > GATES["calculator_tolerance"]:
            failures.append("calculator_tolerance")
    return {"passed": not failures, "failures": failures}


def needs_human_approval(candidate: dict) -> bool:
    return bool(candidate.get("touches_compliance") or candidate.get("touches_formula"))


def clawhub_install_allowed() -> bool:
    return False


def run_cycle(
    samples: list[dict],
    metrics_for: Callable[[dict, list[dict]], dict],
    *,
    human_approved: bool = False,
    baseline_score: float | None = None,
    canary_score: float | None = None,
    today: date | None = None,
    eval_file: Path | None = None,
    now: datetime | None = None,
) -> dict:
    if eval_file is not None:
        loaded = load_eval_metrics(eval_file, now=now)
        if not loaded["ok"]:
            return {
                "status": "noop",
                "reason": "no_eval",
                "rolled_out": False,
                "production_auto_deploy": False,
            }
        measured = loaded["metrics"]

        def metrics_for(_candidate, _gate, _measured=measured):
            return dict(_measured)

    cleaned = []
    for sample in samples:
        item = dict(sample)
        item["text"] = strip_pii(str(item.get("text") or ""))
        cleaned.append(item)
    if not cleaned:
        return {"status": "noop", "reason": "no samples", "rolled_out": False}
    opt, gate = split_sets(cleaned, today)
    candidates = propose_candidates(opt or cleaned)
    candidate = candidates[0]
    if needs_human_approval(candidate) and not human_approved:
        return {"status": "needs_human_approval", "rolled_out": False, "candidate": candidate}
    metrics = metrics_for(candidate, gate or cleaned)
    verdict = evaluate_gates(metrics)
    if not verdict["passed"]:
        return {"status": "rejected", "rolled_out": False, "verdict": verdict, "gate_month": month_key(today)}
    if canary_score is not None and baseline_score is not None and canary_score < baseline_score:
        return {"status": "rolled_back", "rolled_out": False, "canary_fraction": CANARY_FRACTION}
    return {
        "status": "canary",
        "rolled_out": False,
        "canary_fraction": CANARY_FRACTION,
        "full_rollout_requires_canary_pass": True,
        "production_auto_deploy": False,
        "gate_month": month_key(today),
        "verdict": verdict,
    }
