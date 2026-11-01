"""B16 (edit entry): the app lets the user set / correct a project's country; PUT /projects/{id}/country."""
import uuid

import pytest

from app.core.security import create_access_token, hash_password
from app.models.user import User


async def _user(db_session):
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="p", role="user", market="global", subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def _body(address):
    return {"name": "Plant", "technology": "solar_pv", "capacity_kw": 5000,
            "location": {"latitude": 30.0, "longitude": -97.0, "address": address}}


@pytest.mark.asyncio
async def test_user_can_set_and_correct_the_country(client, db_session):
    h = await _user(db_session)
    pid = (await client.post("/api/v1/projects", headers=h, json=_body("Somewhere unnamed"))).json()["data"]["id"]
    assert (await client.get(f"/api/v1/projects/{pid}", headers=h)).json()["data"]["country_code"] is None
    r = await client.put(f"/api/v1/projects/{pid}/country", headers=h, json={"country_code": "de"})
    assert r.status_code == 200 and r.json()["data"]["country_code"] == "DE"
    assert (await client.get(f"/api/v1/projects/{pid}", headers=h)).json()["data"]["location"]["country_code"] == "DE"


@pytest.mark.asyncio
async def test_clearing_recognises_it_from_the_address_again(client, db_session):
    h = await _user(db_session)
    pid = (await client.post("/api/v1/projects", headers=h, json=_body("Austin, Texas"))).json()["data"]["id"]
    await client.put(f"/api/v1/projects/{pid}/country", headers=h, json={"country_code": "FR"})
    r = await client.put(f"/api/v1/projects/{pid}/country", headers=h, json={"country_code": None})
    assert r.json()["data"]["country_code"] == "US"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["USA", "1A", "", "中国"])
async def test_invalid_codes_are_rejected(client, db_session, bad):
    h = await _user(db_session)
    pid = (await client.post("/api/v1/projects", headers=h, json=_body("Austin, Texas"))).json()["data"]["id"]
    assert (await client.put(f"/api/v1/projects/{pid}/country", headers=h, json={"country_code": bad})).status_code == 422


@pytest.mark.asyncio
async def test_other_users_projects_are_404(client, db_session):
    owner, other = await _user(db_session), await _user(db_session)
    pid = (await client.post("/api/v1/projects", headers=owner, json=_body("Austin, Texas"))).json()["data"]["id"]
    assert (await client.put(f"/api/v1/projects/{pid}/country", headers=other, json={"country_code": "FR"})).status_code == 404
    assert (await client.get(f"/api/v1/projects/{pid}", headers=owner)).json()["data"]["country_code"] == "US"
