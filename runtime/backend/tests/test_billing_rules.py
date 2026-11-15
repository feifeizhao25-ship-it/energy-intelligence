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

import pytest

@pytest.mark.parametrize('amount', ['NaN', 'Infinity', '-Infinity', 'abc', '', '0', '-1', '1.001', '1e100'])
def test_refund_rejects_invalid_currency(amount):
    with pytest.raises(ValueError, match='金额'):
        refund_quote(paid_amount_cny=amount, period_start=NOW, period_end=NOW+timedelta(days=365), now=NOW)


def test_refund_mixed_timezone_inputs_match_utc():
    naive = NOW.replace(tzinfo=None)
    result = refund_quote(paid_amount_cny='365', period_start=naive, period_end=NOW+timedelta(days=365), now=NOW+timedelta(days=1))
    assert result['refund_cny'] == '364.00'


def test_renewal_and_downgrade_accept_naive_database_expiry():
    expires = (NOW+timedelta(days=30)).replace(tzinfo=None)
    renewal = renewal_quote(current_plan='pro', current_expires_at=expires, now=NOW, yearly_price_cny='1980')
    assert renewal['new_expires_at'] == '2027-11-17T00:00:00+00:00'
    scheduled = schedule_downgrade(current_plan='full', target_plan='pro', current_expires_at=expires, now=NOW)
    assert apply_scheduled_downgrade(scheduled, now=expires) == 'pro'


def test_full_refund_is_formatted_in_cents():
    result = refund_quote(paid_amount_cny='1980', period_start=NOW, period_end=NOW+timedelta(days=365), now=NOW)
    assert result['refund_cny'] == '1980.00'
