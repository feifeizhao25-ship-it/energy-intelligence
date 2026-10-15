"""个人信息权利接口：已挂载、导出、删除（匿名化 + 订单留存）、同意默认关闭。"""
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select

from app.main import app
from app.models.database import Project
from app.models.payment_order import PaymentOrder
from app.models.user import User


def test_privacy_routes_mounted_and_broken_module_removed():
    paths = set(app.openapi()["paths"])
    assert {"/api/v1/privacy/export", "/api/v1/privacy/delete-account", "/api/v1/privacy/consent"} <= paths
    assert not (Path(__file__).resolve().parents[1] / "app" / "services" / "compliance_gdpr.py").exists()


@pytest.mark.asyncio
async def test_requires_auth(client):
    assert (await client.get("/api/v1/privacy/export")).status_code == 401


async def _user_id(db_session, headers):
    from app.core.security import decode_token
    return decode_token(headers["Authorization"].split()[1])


@pytest.mark.asyncio
async def test_export_then_delete(client, auth_headers, db_session):
    uid = await _user_id(db_session, auth_headers)
    db_session.add(Project(id=str(uuid.uuid4()), user_id=uid, name="隐私测试项目", technology="solar", capacity_mw=1.0))
    db_session.add(PaymentOrder(id=str(uuid.uuid4()), order_no=f"T{uuid.uuid4().hex[:12]}", user_id=uid,
                                plan="pro", billing_period="yearly", amount_cny=Decimal("1980.00"), status="paid"))
    await db_session.commit()

    r = await client.get("/api/v1/privacy/export", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["id"] == uid and body["user"]["phone"]
    assert [p["name"] for p in body["projects"]] == ["隐私测试项目"]
    assert body["payment_orders"][0]["amount_cny"] == "1980.00"
    assert "attachment" in r.headers["content-disposition"]

    assert (await client.post("/api/v1/privacy/delete-account", json={"confirm": "no"}, headers=auth_headers)).status_code == 400
    r = await client.post("/api/v1/privacy/delete-account", json={"confirm": "DELETE"}, headers=auth_headers)
    assert r.status_code == 200 and r.json()["deleted"] is True

    db_session.expire_all()
    user = (await db_session.execute(select(User).where(User.id == uid))).scalar_one()
    assert user.phone is None and user.email is None and user.name == "已注销用户"
    assert (await db_session.execute(select(Project).where(Project.user_id == uid))).scalars().all() == []
    assert len((await db_session.execute(select(PaymentOrder).where(PaymentOrder.user_id == uid))).scalars().all()) == 1
    assert (await client.get("/api/v1/privacy/export", headers=auth_headers)).status_code == 404


@pytest.mark.asyncio
async def test_consent_defaults_off_and_updates(client, auth_headers):
    r = await client.get("/api/v1/privacy/consent", headers=auth_headers)
    assert r.json()["analytics"] is False and r.json()["marketing"] is False
    r = await client.put("/api/v1/privacy/consent", json={"analytics": True}, headers=auth_headers)
    assert r.status_code == 200
    r = await client.get("/api/v1/privacy/consent", headers=auth_headers)
    assert r.json()["analytics"] is True and r.json()["marketing"] is False
