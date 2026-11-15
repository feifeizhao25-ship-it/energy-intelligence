"""Per-user product budget for domestic model calls.

Amounts stay in process memory so a test process cannot bill a real account.
Charging happens only after a domestic model call succeeds. The caps default
high enough that ordinary unit tests do not trip them.
"""
from __future__ import annotations

from datetime import date

from app.config import settings

_spend: dict[tuple[str, str], float] = {}


class BudgetExceeded(Exception):
    def __init__(self, period: str, limit: float) -> None:
        self.period = period
        self.limit = limit
        super().__init__(f"已达到{period}产品预算上限（{limit:g} 元）")


def _keys(user_id: str, today: date | None = None) -> tuple[tuple[str, str], tuple[str, str]]:
    today = today or date.today()
    return (user_id, today.isoformat()), (user_id, today.strftime("%Y-%m"))


def spent(user_id: str, today: date | None = None) -> tuple[float, float]:
    day_key, month_key = _keys(user_id, today)
    return _spend.get(day_key, 0.0), _spend.get(month_key, 0.0)


def assert_product_budget(user_id: str, market: str = "cn", today: date | None = None) -> None:
    if market == "global" or (settings.APP_EDITION or "").lower() != "cn":
        return
    daily, monthly = spent(user_id, today)
    if daily >= settings.NENGJIAN_USER_DAILY_BUDGET_CNY:
        raise BudgetExceeded("每日", settings.NENGJIAN_USER_DAILY_BUDGET_CNY)
    if monthly >= settings.NENGJIAN_USER_MONTHLY_BUDGET_CNY:
        raise BudgetExceeded("每月", settings.NENGJIAN_USER_MONTHLY_BUDGET_CNY)


def charge_product_budget(user_id: str, amount: float | None = None, today: date | None = None) -> None:
    if (settings.APP_EDITION or "").lower() != "cn":
        return
    cost = settings.NENGJIAN_MODEL_CALL_CNY if amount is None else amount
    day_key, month_key = _keys(user_id, today)
    _spend[day_key] = _spend.get(day_key, 0.0) + cost
    _spend[month_key] = _spend.get(month_key, 0.0) + cost


def reset_budget_state() -> None:
    _spend.clear()
