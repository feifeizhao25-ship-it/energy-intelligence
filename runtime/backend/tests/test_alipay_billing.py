import base64
from urllib.parse import parse_qs, urlparse

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from sqlalchemy import select

from app.config import settings
from app.models.payment_order import PaymentOrder
from app.models.user import User
from app.services.alipay_service import _canonical, alipay_service


@pytest.fixture
def alipay_keys(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    values = {
        "ALIPAY_APP_ID": "2026000000000001",
        "ALIPAY_SELLER_ID": "2088000000000001",
        "ALIPAY_PRIVATE_KEY": private_pem,
        "ALIPAY_PUBLIC_KEY": public_pem,
        "ALIPAY_NOTIFY_URL": "https://api.example.cn/api/v1/billing/domestic/alipay/notify",
        "ALIPAY_RETURN_URL": "https://example.cn/membership/result",
        "ALIPAY_SANDBOX": True,
        "ALIPAY_GATEWAY_URL": "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    }
    for name, value in values.items():
        monkeypatch.setattr(settings, name, value)
    return private_key


def _sign_callback(private_key, params):
    signature = private_key.sign(
        _canonical(params, callback=True).encode(), padding.PKCS1v15(), hashes.SHA256()
    )
    return base64.b64encode(signature).decode()


def test_page_pay_uses_canonical_price_and_valid_rsa2_signature(alipay_keys):
    amount = alipay_service.price_for("pro", "monthly")
    assert str(amount) == "198.00"
    url = alipay_service.create_page_pay_url(
        order_no="ENE202609020001", plan="pro", billing_period="monthly", amount=amount
    )
    params = {key: values[0] for key, values in parse_qs(urlparse(url).query).items()}
    signature = base64.b64decode(params.pop("sign"))
    alipay_keys.public_key().verify(
        signature, _canonical(params).encode(), padding.PKCS1v15(), hashes.SHA256()
    )
    assert params["method"] == "alipay.trade.page.pay"
    assert '"total_amount":"198.00"' in params["biz_content"]


def test_callback_signature_rejects_tampering(alipay_keys):
    params = {
        "app_id": settings.ALIPAY_APP_ID,
        "seller_id": settings.ALIPAY_SELLER_ID,
        "out_trade_no": "ENE202609020002",
        "trade_no": "2026090222001",
        "trade_status": "TRADE_SUCCESS",
        "total_amount": "398.00",
        "sign_type": "RSA2",
    }
    params["sign"] = _sign_callback(alipay_keys, params)
    assert alipay_service.verify_callback(params)
    params["total_amount"] = "0.01"
    assert not alipay_service.verify_callback(params)


@pytest.mark.asyncio
async def test_verified_callback_activates_once(
    client, auth_headers, db_session, alipay_keys
):
    created = await client.post(
        "/api/v1/billing/domestic/alipay/create",
        json={"plan": "full", "billing_period": "monthly"},
        headers=auth_headers,
    )
    assert created.status_code == 200, created.text
    body = created.json()
    assert body["amount_cny"] == "398.00"
    params = {
        "app_id": settings.ALIPAY_APP_ID,
        "seller_id": settings.ALIPAY_SELLER_ID,
        "out_trade_no": body["order_no"],
        "trade_no": "20260902220000000001",
        "trade_status": "TRADE_SUCCESS",
        "total_amount": "398.00",
        "sign_type": "RSA2",
    }
    params["sign"] = _sign_callback(alipay_keys, params)
    paid = await client.post("/api/v1/billing/domestic/alipay/notify", data=params)
    assert paid.status_code == 200
    assert paid.text == "success"
    repeated = await client.post("/api/v1/billing/domestic/alipay/notify", data=params)
    assert repeated.status_code == 200
    await db_session.rollback()
    order = (
        await db_session.execute(
            select(PaymentOrder).where(PaymentOrder.order_no == body["order_no"])
        )
    ).scalar_one()
    user = await db_session.get(User, order.user_id)
    assert order.status == "paid"
    assert user.subscription_plan == "full"


@pytest.mark.asyncio
async def test_valid_signature_with_wrong_seller_is_rejected(
    client, alipay_keys
):
    params = {
        "app_id": settings.ALIPAY_APP_ID,
        "seller_id": "2088999999999999",
        "out_trade_no": "missing",
        "trade_no": "20260902220000000002",
        "trade_status": "TRADE_SUCCESS",
        "total_amount": "198.00",
        "sign_type": "RSA2",
    }
    params["sign"] = _sign_callback(alipay_keys, params)
    response = await client.post("/api/v1/billing/domestic/alipay/notify", data=params)
    assert response.status_code == 400

