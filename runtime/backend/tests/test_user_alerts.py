"""GET /api/v1/alerts is the caller's policy subscriptions, saved rules, and project alarms."""
import uuid

import pytest

from app.core.security import create_access_token
from app.models.alert import AlertRule
from app.models.database import Project
from app.models.operation_telemetry import OperationAlarmEvent
from app.models.user import User
from app.utils.security import get_password_hash


async def _user(db, plan: str) -> dict:
    user = User(
        id=str(uuid.uuid4()),
        phone=f"137{uuid.uuid4().hex[:8]}",
        password_hash=get_password_hash("TestPass123!"),
        name=f"{plan}用户",
        role="user",
        market="cn",
        subscription_plan=plan,
        usage_quota={},
    )
    db.add(user)
    await db.commit()
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}", "id": user.id}


@pytest.mark.asyncio
async def test_alerts_require_login_and_stay_on_the_caller(client, db_session):
    anonymous = await client.get("/api/v1/alerts")
    assert anonymous.status_code == 401

    owner = await _user(db_session, "pro")
    other = await _user(db_session, "enterprise")
    free = await _user(db_session, "free")
    owner_headers = {"Authorization": owner["Authorization"]}
    other_headers = {"Authorization": other["Authorization"]}

    refused = await client.post(
        "/api/v1/alerts/subscriptions",
        headers={"Authorization": free["Authorization"]},
        json={"province": "上海", "topic": "机制电价"},
    )
    assert refused.status_code == 403
    assert refused.json()["detail"] == "当前套餐不含政策提醒"

    created = await client.post(
        "/api/v1/alerts/subscriptions",
        headers=owner_headers,
        json={"province": "上海", "topic": "机制电价"},
    )
    assert created.status_code == 201, created.text
    subscription_id = created.json()["data"]["id"]

    project_id = str(uuid.uuid4())
    db_session.add(Project(id=project_id, user_id=owner["id"], name="告警项目"))
    db_session.add(AlertRule(
        id=str(uuid.uuid4()), user_id=owner["id"], name="已保存规则", source_id="policy-demo", threshold=0.7,
    ))
    db_session.add(OperationAlarmEvent(
        id=str(uuid.uuid4()), project_id=project_id, rule_id="rule-1", point_id="inv-1",
        severity="warning", message="功率越过阈值",
    ))
    await db_session.commit()

    listed = await client.get("/api/v1/alerts", headers=owner_headers)
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["policy"]["subscriptions"][0]["province"] == "上海"
    assert body["policy"]["rules"][0]["name"] == "已保存规则"
    assert body["project"]["alerts"][0]["message"] == "功率越过阈值"
    assert body["price"]["available"] is False

    hidden = await client.get("/api/v1/alerts", headers=other_headers)
    assert hidden.json()["policy"]["subscriptions"] == []
    assert hidden.json()["policy"]["rules"] == []
    assert hidden.json()["project"]["alerts"] == []

    stolen = await client.delete(f"/api/v1/alerts/subscriptions/{subscription_id}", headers=other_headers)
    assert stolen.status_code == 404
    removed = await client.delete(f"/api/v1/alerts/subscriptions/{subscription_id}", headers=owner_headers)
    assert removed.status_code == 200
    after = await client.get("/api/v1/alerts", headers=owner_headers)
    assert after.json()["policy"]["subscriptions"] == []
