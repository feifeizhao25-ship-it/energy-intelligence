"""Growth kit (2026-11-01): attribution, referral anti-abuse, share cards, SEO page quality gate, growth loop.

Design rules (see docs/growth in the package):
- stdlib only; no network calls; no third-party account logins; no fake engagement.
- every user-visible capability is behind a flag that defaults to OFF (see flags.py).
- the loop only PROPOSES; promotion needs a human approval and a better result than the control.
"""
from .flags import GrowthFlags  # noqa: F401

__all__ = ["GrowthFlags"]
