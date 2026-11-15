"""Growth improvement loop: discover -> check freshness -> compliance -> evaluate vs. 15% control -> PROPOSE.

Nothing here applies a change. `propose()` returns proposals for a human to approve (weekly, <=5 shown, <=3 created).
`should_rollback()` is evaluated continuously on guardrails. Everything is gated by GROWTH_LOOP_ENABLED (default OFF).
"""
from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import date

from . import claims
from .flags import GrowthFlags

CONTROL_PERCENT = 15          # fixed; not configurable (same rule as the existing self-improve loops)
MAX_NEW_PER_WEEK = 3
FRESH_DAYS = {"policy": 30, "platform_rule": 30, "paper": 90, "oss": 90, "article": 60}
ALLOWED_LICENSES = {"MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "CC-BY-4.0", "CC0-1.0", "public-record"}


def in_control(user_key: str, salt: str = "growth") -> bool:
    h = int(hashlib.sha256(f"{salt}:{user_key}".encode()).hexdigest()[:8], 16)
    return h % 100 < CONTROL_PERCENT


def wilson_bounds(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n <= 0:
        return 0.0, 1.0
    p = successes / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    m = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return (c - m) / d, (c + m) / d


@dataclass
class Tactic:
    id: str
    kind: str                    # policy | platform_rule | paper | oss | article
    source_url: str
    source_date: str             # YYYY-MM-DD
    license: str                 # SPDX or "public-record"
    summary: str
    variable: str                # exactly one variable per experiment
    products: list = field(default_factory=list)


def admit(t: Tactic, today: date | None = None) -> tuple[bool, list[str]]:
    today = today or date.today()
    why: list[str] = []
    if not t.source_url.startswith("https://"):
        why.append("source_not_https")
    try:
        age = (today - date.fromisoformat(t.source_date)).days
        if age > FRESH_DAYS.get(t.kind, 60):
            why.append("stale")
    except ValueError:
        why.append("source_date_invalid")
    if t.license not in ALLOWED_LICENSES:
        why.append("license_not_allowed")
    if "," in t.variable or " and " in t.variable.lower():
        why.append("more_than_one_variable")
    for cat, _ in claims.scan(t.summary):
        why.append(f"claim:{cat}")
    return (not why), why


@dataclass
class Arm:
    n: int
    conversions: int
    refunds: int = 0


def decide(control: Arm, treat: Arm, min_n: int = 400, max_refund_rate: float = 0.05) -> dict:
    """Promote only if the treatment's conservative lower bound beats the control's upper bound and guardrails hold."""
    if control.n < min_n or treat.n < min_n:
        return {"decision": "keep_testing", "reason": "insufficient_sample"}
    t_lo, _ = wilson_bounds(treat.conversions, treat.n)
    _, c_hi = wilson_bounds(control.conversions, control.n)
    if treat.n and treat.refunds / treat.n > max_refund_rate:
        return {"decision": "reject", "reason": "refund_guardrail"}
    if t_lo > c_hi:
        return {"decision": "propose_promote", "reason": "wilson_separated", "lift": round(treat.conversions / treat.n - control.conversions / control.n, 4)}
    return {"decision": "keep_testing" if t_lo > 0 else "reject", "reason": "not_separated"}


def should_rollback(treat: Arm, control: Arm, max_refund_rate: float = 0.05, compliance_hits: int = 0) -> bool:
    if compliance_hits > 0:
        return True
    if treat.n >= 100 and treat.refunds / treat.n > max_refund_rate:
        return True
    if treat.n >= 400 and control.n >= 400:
        _, t_hi = wilson_bounds(treat.conversions, treat.n)
        c_lo, _ = wilson_bounds(control.conversions, control.n)
        if t_hi < c_lo:   # clearly worse than control
            return True
    return False


def propose(candidates: list[Tactic], flags: GrowthFlags, already_this_week: int = 0, today: date | None = None) -> dict:
    """Return {'enabled', 'proposals', 'rejected'}; proposals are 'pending_review' only."""
    if not flags.growth_loop:
        return {"enabled": False, "proposals": [], "rejected": []}
    out, rej = [], []
    room = max(MAX_NEW_PER_WEEK - already_this_week, 0)
    for t in candidates:
        ok, why = admit(t, today)
        if not ok:
            rej.append({"id": t.id, "why": why}); continue
        if len(out) >= room:
            rej.append({"id": t.id, "why": ["weekly_cap"]}); continue
        out.append({"id": t.id, "status": "pending_review", "variable": t.variable, "source_url": t.source_url, "products": t.products})
    return {"enabled": True, "proposals": out, "rejected": rej}
