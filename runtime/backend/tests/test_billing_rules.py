"""定稿计费规则: 续费顺延 / 降级下周期 / 退款按未使用比例 (只测算)."""
from datetime import datetime, timezone, timedelta
from app.services.billing_rules import renewal_quote, schedule_downgrade, apply_scheduled_downgrade, refund_quote
NOW = datetime(2026,10,18, tzinfo=timezone.utc)

def test_renewal_extends_from_expiry():
    q = renewal_quote(current_plan="pro", current_expires_at=NOW+timedelta(days=100), now=NOW, yearly_price_cny=1980)
    assert q["amount_cny"]=="1980.00" and q["new_expires_at"].startswith("2028-")  # 现到期日+100天在2027, 再顺延1年

def test_downgrade_scheduled_not_immediate():
    s = schedule_downgrade(current_plan="full", target_plan="pro", current_expires_at=NOW+timedelta(days=30), now=NOW)
    assert s["status"]=="scheduled" and apply_scheduled_downgrade(s, now=NOW) is None
    assert apply_scheduled_downgrade(s, now=NOW+timedelta(days=31))=="pro"

def test_refund_prorated_unused():
    q = refund_quote(paid_amount_cny="1980", period_start=NOW-timedelta(days=182), period_end=NOW+timedelta(days=183), now=NOW)
    assert 900 < float(q["refund_cny"]) < 1100 and q["status"]=="quote_only"
    q2 = refund_quote(paid_amount_cny="1980", period_start=NOW-timedelta(days=400), period_end=NOW-timedelta(days=35), now=NOW)
    assert q2["refund_cny"]=="0.00"
