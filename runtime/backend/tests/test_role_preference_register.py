"""能24 / 智14：注册可以带上角色和关注领域；不带时不写入默认角色。"""
import uuid

import pytest

pytestmark = pytest.mark.asyncio


def _body(**extra):
    return {
        "name": "Preference User",
        "email": f"pref_{uuid.uuid4().hex[:8]}@test.com",
        "password": "Test1234!",
        "market": "global",
        "data_transfer_consent": True,
        **extra,
    }


async def _prefs(client, token):
    response = await client.get(
        "/api/v1/home/workbench/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text
    return response.json()["data"]


async def test_register_without_a_role_does_not_invent_one(client):
    response = await client.post("/api/v1/auth/register", json=_body())
    assert response.status_code == 201, response.text
    data = await _prefs(client, response.json()["data"]["access_token"])
    assert data["role"] == ""
    assert data["tech_focus"] == []
    assert data["guidance"] == "No role or technology focus has been chosen. None is assumed."


async def test_register_keeps_the_role_and_focus_the_person_chose(client):
    response = await client.post("/api/v1/auth/register", json=_body(role="analyst", tech_focus=["wind", "not-a-tech"]))
    assert response.status_code == 201, response.text
    data = await _prefs(client, response.json()["data"]["access_token"])
    assert data["role"] == "analyst"
    assert data["tech_focus"] == ["wind"]
    assert data["guidance"] is None


async def test_unknown_role_is_not_rewritten_into_a_known_one(client):
    response = await client.post("/api/v1/auth/register", json=_body(role="chief-poet"))
    assert response.status_code == 201, response.text
    data = await _prefs(client, response.json()["data"]["access_token"])
    assert data["role"] == ""
    assert "chief-poet" not in str(data["guidance"])
