"""国内缺口：短信、微信支付、文献缓存、运维遥测、开票与导出。"""
import base64
import json
import os
import uuid
from decimal import Decimal
from io import BytesIO
import zipfile

import pytest
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import select

from app.config import settings
from app.models.database import Project
from app.models.payment_order import PaymentOrder
from app.models.user import User
from app.services.alipay_reconcile import reconcile_orders
from app.services.literature_batch_import import run_batch
from app.services.status_heartbeat import heartbeat_level, write_heartbeat
from app.services.wechat_pay_service import (
    WechatPayError,
    authorization_header,
    decrypt_resource,
    place_order,
    query_order,
    read_config,
    refund_order,
    verify_notify,
)
from ops.pilot_review import geo_weekly_report, seo_sample_pages


def _rsa():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    public_pem = private_key.public_key().public_bytes(
        serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
    ).decode()
    return private_key, private_pem, public_pem


def _arm_wechat(monkeypatch, private_pem, public_pem, *, sandbox="false"):
    monkeypatch.setattr(settings, "WECHAT_PAY_APP_ID", "wx-test-app")
    monkeypatch.setattr(settings, "WECHAT_PAY_MCH_ID", "1900000001")
    monkeypatch.setattr(settings, "WECHAT_PAY_API_KEY", "0123456789abcdef0123456789abcdef")
    monkeypatch.setattr(settings, "WECHAT_PAY_SERIAL_NO", "SERIALTEST")
    monkeypatch.setattr(settings, "WECHAT_PAY_PRIVATE_KEY", private_pem)
    monkeypatch.setattr(settings, "WECHAT_PAY_NOTIFY_URL", "https://example.cn/wechat/notify")
    monkeypatch.setattr(settings, "WECHAT_PAY_SANDBOX", False)
    monkeypatch.setenv("WECHAT_PAY_PLATFORM_PUBLIC_KEY", public_pem)
    monkeypatch.setenv("WECHAT_PAY_SANDBOX", sandbox)
    monkeypatch.setenv("WECHAT_PAY_API_V3_KEY", "0123456789abcdef0123456789abcdef")


@pytest.mark.asyncio
async def test_sms_without_keys_is_config_error(client):
    response = await client.post("/api/v1/auth/sms/send", json={"phone": "13800138000", "consent": True})
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "SMS_NOT_CONFIGURED"


@pytest.mark.asyncio
async def test_sms_development_reveal_can_login(client, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DEV_REVEAL", "1")
    sent = await client.post("/api/v1/auth/sms/send", json={"phone": "13800138001", "consent": True})
    assert sent.status_code == 200, sent.text
    code = sent.json()["data"]["dev_code"]
    logged = await client.post("/api/v1/auth/sms/login", json={"phone": "13800138001", "code": code, "consent": True})
    assert logged.status_code == 200, logged.text
    assert logged.json()["data"]["access_token"]
    refused = await client.post("/api/v1/auth/sms/send", json={"phone": "13800138001", "consent": False})
    assert refused.status_code == 400


@pytest.mark.asyncio
async def test_wechat_six_flows(monkeypatch):
    private_key, private_pem, public_pem = _rsa()
    _arm_wechat(monkeypatch, private_pem, public_pem)
    seen = {}

    async def transport(request):
        seen["path"] = request["url"]
        seen["auth"] = request["headers"]["Authorization"]
        if request["url"].endswith("/native"):
            return {"status": 200, "body": json.dumps({"code_url": "weixin://pay/example"})}
        if request["url"].endswith("/jsapi"):
            return {"status": 200, "body": json.dumps({"prepay_id": "prepay-1"})}
        if "/refund/" in request["url"]:
            return {"status": 200, "body": json.dumps({"status": "SUCCESS"})}
        return {"status": 200, "body": json.dumps({"trade_state": "SUCCESS"})}

    native = await place_order(order_no="N1", description="年付", amount_yuan=Decimal("1980.00"), trade_type="native", transport=transport)
    assert native["code_url"].startswith("weixin://")
    assert seen["auth"].startswith("WECHATPAY2-SHA256-RSA2048")
    assert seen["path"].endswith("/v3/pay/transactions/native")
    jsapi = await place_order(order_no="J1", description="年付", amount_yuan=Decimal("1980.00"), trade_type="jsapi", openid="openid-1", transport=transport)
    assert jsapi["prepay_id"] == "prepay-1"
    queried = await query_order("N1", transport=transport)
    assert queried["trade_state"] == "SUCCESS"
    refunded = await refund_order(order_no="N1", refund_no="R1", amount_yuan=Decimal("1980.00"), transport=transport)
    assert refunded["status"] == "SUCCESS"
    config = read_config()
    nonce = "0123456789ab"
    resource = {"out_trade_no": "N1", "transaction_id": "T1", "trade_state": "SUCCESS", "amount": {"total": 198000, "currency": "CNY"}}
    ciphertext = AESGCM(config["api_v3_key"].encode()).encrypt(nonce.encode(), json.dumps(resource).encode(), b"transaction")
    body = json.dumps({"resource": {"ciphertext": base64.b64encode(ciphertext).decode(), "nonce": nonce, "associated_data": "transaction"}})
    signature = base64.b64encode(private_key.sign(f"1\n{nonce}\n{body}\n".encode(), padding.PKCS1v15(), hashes.SHA256())).decode()
    assert verify_notify(config, "1", nonce, body, signature)
    assert decrypt_resource(config["api_v3_key"], json.loads(body)["resource"])["transaction_id"] == "T1"
    header = authorization_header(config, "GET", "/v3/pay/transactions/out-trade-no/N1?mchid=1900000001", "")
    assert "mchid=\"1900000001\"" in header
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("WECHAT_PAY_SANDBOX", "true")
    with pytest.raises(WechatPayError):
        read_config()


@pytest.mark.asyncio
async def test_wechat_notify_activates_membership(client, auth_headers, db_session, monkeypatch):
    private_key, private_pem, public_pem = _rsa()
    _arm_wechat(monkeypatch, private_pem, public_pem)

    async def fake_place(**kwargs):
        return {"code_url": "weixin://pay/sandbox"}

    monkeypatch.setattr("app.api.v1.billing.place_order", fake_place)
    created = await client.post(
        "/api/v1/billing/domestic/wechat/create",
        json={"plan": "pro", "billing_period": "yearly", "trade_type": "native"},
        headers=auth_headers,
    )
    assert created.status_code == 200, created.text
    order_no = created.json()["order_no"]
    config = read_config()
    nonce = "0123456789ab"
    resource = {"out_trade_no": order_no, "transaction_id": "WX-TRADE-1", "trade_state": "SUCCESS", "amount": {"total": 198000, "currency": "CNY"}}
    ciphertext = AESGCM(config["api_v3_key"].encode()).encrypt(nonce.encode(), json.dumps(resource).encode(), b"transaction")
    body = json.dumps({"resource": {"ciphertext": base64.b64encode(ciphertext).decode(), "nonce": nonce, "associated_data": "transaction"}})
    signature = base64.b64encode(private_key.sign(f"9\n{nonce}\n{body}\n".encode(), padding.PKCS1v15(), hashes.SHA256())).decode()
    paid = await client.post(
        "/api/v1/billing/domestic/wechat/notify",
        content=body,
        headers={"content-type": "application/json", "wechatpay-timestamp": "9", "wechatpay-nonce": nonce, "wechatpay-signature": signature},
    )
    assert paid.status_code == 200, paid.text
    await db_session.rollback()
    order = (await db_session.execute(select(PaymentOrder).where(PaymentOrder.order_no == order_no))).scalar_one()
    user = await db_session.get(User, order.user_id)
    await db_session.refresh(user)
    assert order.status == "paid" and order.provider == "wechat"
    assert user.subscription_plan == "pro"


@pytest.mark.asyncio
async def test_alipay_simulate_flag_is_rejected(client):
    response = await client.post("/api/v1/billing/domestic/alipay/notify", data={"simulate": "1", "out_trade_no": "nope"})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_reconcile_alerts_on_diff(client, db_session):
    user = User(id=str(uuid.uuid4()), phone=f"139{uuid.uuid4().hex[:8]}", password_hash="x", name="对账", market="cn")
    db_session.add(user)
    await db_session.flush()
    db_session.add(PaymentOrder(
        id=str(uuid.uuid4()), order_no="ENE-RECON-1", user_id=user.id, provider="alipay",
        plan="pro", billing_period="yearly", amount_cny=Decimal("1980.00"), status="paid",
    ))
    await db_session.commit()
    response = await client.post(
        "/api/v1/billing/domestic/reconcile",
        json={"bill": [{"order_no": "ENE-RECON-1", "amount": "1.00", "status": "TRADE_SUCCESS"}]},
        headers={"x-cron-secret": "dev-secret-key"},
    )
    assert response.status_code == 409
    assert response.json()["alert"] is True


def test_reconcile_math_and_heartbeat(tmp_path):
    result = reconcile_orders(
        [{"order_no": "A", "amount": "10.00", "status": "paid"}],
        [{"order_no": "A", "amount": "10.00", "status": "TRADE_SUCCESS"}],
    )
    assert result["alert"] is False
    path = tmp_path / "beat.json"
    from datetime import datetime, timezone, timedelta
    old = datetime.now(timezone.utc) - timedelta(days=3)
    write_heartbeat(path, now=old, acknowledge=True)
    assert heartbeat_level({"acknowledgedAt": old.isoformat()}) == "escalate"


@pytest.mark.asyncio
async def test_literature_batch_and_domestic_search(client, auth_headers, monkeypatch, tmp_path):
    called = {"n": 0}

    async def fetcher():
        called["n"] += 1
        return [{"source": "cnki", "title": "不应入库", "external_id": "1"}]

    monkeypatch.delenv("LITERATURE_BATCH_IMPORT", raising=False)
    with pytest.raises(RuntimeError):
        await run_batch(fetcher, tmp_path / "cache.json", "开放许可说明足够长")
    assert called["n"] == 0
    monkeypatch.setenv("LITERATURE_BATCH_IMPORT", "1")
    with pytest.raises(ValueError):
        await run_batch(fetcher, tmp_path / "cache.json", "开放许可说明足够长")

    async def allowed():
        return [{
            "source": "arxiv-cache", "title": "光伏积灰综述", "external_id": "solar-1",
            "year": 2024, "abstract": "清洗周期", "licence": "arXiv API terms", "url": "https://arxiv.org/abs/1",
        }]

    await run_batch(allowed, tmp_path / "cache.json", "开放许可：arXiv 与 OpenAlex 元数据，不抓取知网。")
    monkeypatch.setenv("NENGJIAN_LITERATURE_CACHE", str(tmp_path / "cache.json"))
    monkeypatch.setattr(settings, "APP_EDITION", "cn")
    found = await client.get("/api/v1/research/papers?q=积灰", headers=auth_headers)
    assert found.status_code == 200, found.text
    assert found.json()["items"][0]["title"] == "光伏积灰综述"
    empty = await client.get("/api/v1/research/papers?q=zz", headers=auth_headers)
    assert empty.json()["notice"] == "未配置国内学术源/未开启境外"
    assert empty.json()["items"] == []


@pytest.mark.asyncio
async def test_operations_telemetry_then_real_summary(client, auth_headers, db_session):
    user = (await db_session.execute(select(User))).scalar_one()
    project_id = str(uuid.uuid4())
    db_session.add(Project(id=project_id, user_id=user.id, name="遥测项目"))
    await db_session.commit()
    missing = await client.get(f"/api/v1/operations/health/{project_id}", headers=auth_headers)
    assert missing.status_code == 503
    rule = await client.post(
        f"/api/v1/operations/alarms/rules/{project_id}",
        json={"metric": "power_kw", "operator": "gt", "threshold": 10, "severity": "warning"},
        headers=auth_headers,
    )
    assert rule.status_code == 200, rule.text
    ingested = await client.post(
        f"/api/v1/operations/telemetry/{project_id}",
        json={"source": "webhook", "points": [{"point_id": "inv-1", "timestamp": "2026-10-27T00:00:00+00:00", "power_kw": 12, "energy_kwh": 3}]},
        headers=auth_headers,
    )
    assert ingested.status_code == 200, ingested.text
    health = await client.get(f"/api/v1/operations/health/{project_id}", headers=auth_headers)
    assert health.status_code == 200
    assert health.json()["health_score"] is None
    assert health.json()["sample_count"] == 1
    alerts = await client.get("/api/v1/operations/alerts", headers=auth_headers)
    assert alerts.status_code == 200
    assert len(alerts.json()["alerts"]) == 1


@pytest.mark.asyncio
async def test_invoice_has_no_number_and_export_zip(client, auth_headers, db_session):
    user = (await db_session.execute(select(User))).scalar_one()
    db_session.add(PaymentOrder(
        id=str(uuid.uuid4()), order_no="ENE-INV-1", user_id=user.id, provider="alipay",
        plan="pro", billing_period="yearly", amount_cny=Decimal("1980.00"), status="paid",
    ))
    await db_session.commit()
    invoice = await client.post(
        "/api/v1/billing/invoices/request",
        json={"order_no": "ENE-INV-1", "title": "测试抬头"},
        headers=auth_headers,
    )
    assert invoice.status_code == 202, invoice.text
    assert invoice.json()["invoice_no"] is None
    exported = await client.get("/api/v1/privacy/export?format=zip", headers=auth_headers)
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("application/zip")
    names = zipfile.ZipFile(BytesIO(exported.content)).namelist()
    assert {"projects.json", "reports.json", "snapshots.json"} <= set(names)


def test_pilot_sample_is_manual_and_weekly_off(monkeypatch):
    assert len(seo_sample_pages()) >= 50
    monkeypatch.delenv("NENGJIAN_GEO_WEEKLY", raising=False)
    assert geo_weekly_report()["enabled"] is False
    assert os.environ.get("PAYMENT_SIMULATION") != "1"
