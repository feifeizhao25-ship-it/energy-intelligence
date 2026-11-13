"""Whether a source license may be cited in a domestic energy candidate.

Government publications may be quoted. NC, GPL, AGPL, and undeclared
licenses stay out. This does not publish anything.
"""
from __future__ import annotations

_BLOCKED = ("agpl", "gpl-2", "gpl-3", "cc-by-nc", "non-commercial", "noassertion", "非商用", "未声明", "未知")
_ALLOWED = ("政府", "government", "mit", "apache", "bsd", "cc-by", "cc by", "公有", "open government")


def license_allows_citation(text: str) -> bool:
    raw = (text or "").strip()
    if not raw:
        return False
    low = raw.lower()
    if any(token in low or token in raw for token in _BLOCKED):
        return False
    return any(token in low or token in raw for token in _ALLOWED)
