"""政策页、省级代理购电电价页、测算落地页。质量门不过就不生成。试点最多 50 页。"""
from __future__ import annotations

from ops.killswitch import is_killed
from ops.publish import AIGC_LABEL
from ops.switches import SWITCHES

PILOT_CAP = 50

try:
    from app.services.bottom_line import find_violations
except Exception:  # pragma: no cover - package import path
    def find_violations(text: str, market: str = "cn") -> list[str]:
        return []


def quality_gate(page: dict) -> list[str]:
    problems = []
    table = page.get("table") or []
    if len(table) < 1:
        problems.append("missing unique data table")
    if not page.get("source_url"):
        problems.append("missing source citation")
    blob = " ".join(str(page.get(key) or "") for key in ("title", "body"))
    if find_violations(blob, market="cn"):
        problems.append("bottom line")
    return problems


def generate_pages(pages: list[dict]) -> dict:
    if is_killed() or not SWITCHES["seo_generate"]:
        return {"generated": [], "skipped": len(pages), "reason": "switch off", "cap": PILOT_CAP}
    accepted = []
    rejected = []
    for page in pages:
        problems = quality_gate(page)
        if problems:
            rejected.append({"id": page.get("id"), "problems": problems})
            continue
        if len(accepted) >= PILOT_CAP:
            rejected.append({"id": page.get("id"), "problems": ["pilot cap"]})
            continue
        accepted.append({**page, "label": AIGC_LABEL, "published": False})
    return {"generated": accepted, "rejected": rejected, "cap": PILOT_CAP}
