"""微信自助退款默认关闭：不调用支付渠道，不改订单状态；显式打开后才走原路退款。"""
import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.payment_order import PaymentOrder
from app.models.user import User


async def _paid_wechat_order(db_session) -> str:
    user = (await db_session.execute(select(User))).scalars().one()
    order_no = f"ENE-RF-{uuid.uuid4().hex[:10]}"
    db_session.add(PaymentOrder(
        id=str(uuid.uuid4()), order_no=order_no, user_id=user.id, provider="wechat",
        plan="pro", billing_period="yearly", amount_cny=Decimal("1980.00"), status="paid",
    ))
    await db_session.commit()
    return order_no


def _fake_refund(calls):
    async def refund(**kwargs):
        calls.append(kwargs)
        return {"status": "SUCCESS"}
    return refund


async def _status(db_session, order_no: str) -> str:
    await db_session.rollback()
    order = (await db_session.execute(select(PaymentOrder).where(PaymentOrder.order_no == order_no))).scalar_one()
    await db_session.refresh(order)
    return order.status


@pytest.mark.asyncio
@pytest.mark.parametrize("value", [None, "", "0", "false", "off"])
async def test_refund_is_manual_unless_switched_on(client, auth_headers, db_session, monkeypatch, value):
    if value is None:
        monkeypatch.delenv("NENGJIAN_SELF_SERVICE_REFUND", raising=False)
    else:
        monkeypatch.setenv("NENGJIAN_SELF_SERVICE_REFUND", value)
    calls = []
    monkeypatch.setattr("app.api.v1.billing.refund_order", _fake_refund(calls))
    order_no = await _paid_wechat_order(db_session)

    response = await client.post("/api/v1/billing/domestic/wechat/refund", json={"order_no": order_no}, headers=auth_headers)

    assert response.status_code == 409, response.text
    assert calls == []
    assert await _status(db_session, order_no) == "paid"


@pytest.mark.asyncio
async def test_refund_runs_when_switched_on(client, auth_headers, db_session, monkeypatch):
    monkeypatch.setenv("NENGJIAN_SELF_SERVICE_REFUND", "1")
    calls = []
    monkeypatch.setattr("app.api.v1.billing.refund_order", _fake_refund(calls))
    order_no = await _paid_wechat_order(db_session)

    response = await client.post("/api/v1/billing/domestic/wechat/refund", json={"order_no": order_no}, headers=auth_headers)

    assert response.status_code == 200, response.text
    assert len(calls) == 1 and calls[0]["order_no"] == order_no
    assert await _status(db_session, order_no) == "refunded"
