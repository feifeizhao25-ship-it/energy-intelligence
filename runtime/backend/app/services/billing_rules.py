"""会员计费规则 (2026-10-18 定稿, 只定义规则与计算, 不执行任何真实支付/退款通道调用).

定稿口径:
- 只卖年付 (见 data/entitlements.json sales_billing_period=yearly), 无月付。
- 续费: 到期续费按当前档位年付价; 未到期续费从现到期日顺延 1 年, 已过期从付款日重新起算 1 年。
- 降级: 不立即生效, 记录待生效降级意图, 于当前周期结束次日切换到目标档位; 周期内权益不变, 不退差价。
- 退款: 按未使用天数比例退 (应退 = 实付 x 剩余天数 / 周期总天数, 向下取整到分);
  周期未开始全额退, 周期已结束不退。本模块只出具测算 (quote), 实际退款由财务在支付渠道后台人工执行并回填单号。
"""
from __future__ import annotations
from datetime import datetime, timezone
from decimal import Decimal, ROUND_FLOOR

TIER_ORDER = ["free", "pro", "full", "team", "enterprise"]

def _add_year(start: datetime) -> datetime:
    from calendar import monthrange
    target = start.year * 12 + start.month - 1 + 12
    year, month_zero = divmod(target, 12)
    month = month_zero + 1
    return start.replace(year=year, month=month, day=min(start.day, monthrange(year, month)[1]))

def renewal_quote(*, current_plan: str, current_expires_at, now: datetime, yearly_price_cny) -> dict:
    """续费测算: 返回应付年付价与新到期日 (不扣款)。"""
    if current_plan not in TIER_ORDER or current_plan == "free":
        raise ValueError("免费版无需续费")
    base = current_expires_at if (current_expires_at and current_expires_at > now) else now
    return {"plan": current_plan, "billing_period": "yearly", "amount_cny": str(Decimal(str(yearly_price_cny)).quantize(Decimal("0.01"))),
            "new_expires_at": _add_year(base).isoformat(), "rule": "未到期从现到期日顺延1年, 已过期从付款日起算1年"}

def schedule_downgrade(*, current_plan: str, target_plan: str, current_expires_at, now: datetime) -> dict:
    """降级登记: 返回待生效信息 (不立即改档, 不退差价)。"""
    if current_plan not in TIER_ORDER or target_plan not in TIER_ORDER:
        raise ValueError("档位无效")
    if TIER_ORDER.index(target_plan) >= TIER_ORDER.index(current_plan):
        raise ValueError("降级目标必须低于当前档位 (升级请走购买/续费)")
    effective = current_expires_at if (current_expires_at and current_expires_at > now) else now
    return {"from_plan": current_plan, "to_plan": target_plan, "effective_at": effective.isoformat(),
            "status": "scheduled", "rule": "下个周期生效, 当前周期权益不变, 不退差价"}

def apply_scheduled_downgrade(scheduled: dict, *, now: datetime):
    """周期到达时返回应切换到的档位; 未到返回 None。供到期扫描任务调用。"""
    if not scheduled or scheduled.get("status") != "scheduled":
        return None
    effective = datetime.fromisoformat(scheduled["effective_at"])
    if effective.tzinfo is None: effective = effective.replace(tzinfo=timezone.utc)
    return scheduled["to_plan"] if now >= effective else None

def refund_quote(*, paid_amount_cny, period_start: datetime, period_end: datetime, now: datetime) -> dict:
    """退款测算: 未使用按比例退, 只出测算不出款。"""
    paid = Decimal(str(paid_amount_cny))
    if paid <= 0: raise ValueError("实付金额须大于 0")
    total_days = (period_end - period_start).days
    if total_days <= 0: raise ValueError("周期无效")
    if now <= period_start:
        refund, remaining = paid, total_days
    elif now >= period_end:
        refund, remaining = Decimal("0.00"), 0
    else:
        remaining = (period_end - now).days
        refund = (paid * Decimal(remaining) / Decimal(total_days)).quantize(Decimal("0.01"), rounding=ROUND_FLOOR)
    return {"paid_cny": str(paid.quantize(Decimal("0.01"))), "refund_cny": str(refund), "remaining_days": remaining,
            "total_days": total_days, "status": "quote_only", "rule": "未使用天数按比例退, 向下取整到分; 实际退款由财务在支付渠道人工执行"}
