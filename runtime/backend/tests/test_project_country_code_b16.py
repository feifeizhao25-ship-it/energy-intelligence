"""B16 (real field): a project has a country of its own. Reports used to default to CN because the project had no
country at all; the country is now a nullable column (migration 0010), set by the client or recognised from the
address on create, backfilled from the address for existing rows, and never defaulted."""
import importlib.util
import uuid
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa

from app.core.security import create_access_token, hash_password
from app.models.database import Project
from app.models.user import User

BACKEND = Path(__file__).resolve().parents[1]


def _body(address, **location):
    return {"name": "Country plant", "technology": "solar_pv", "capacity_kw": 20000,
            "location": {"latitude": 30.0, "longitude": -97.0, "address": address, **location}}


async def _headers(db_session):
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="p", role="user", market="global", subscription_plan="free", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


def test_column_is_nullable_two_letter_code():
    col = Project.__table__.c.country_code
    assert col.nullable and col.type.length == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("address,expected", [
    ("Austin, Texas", "US"), ("Jodhpur, Rajasthan", "IN"), ("山东省济南市", "CN"), ("Somewhere unnamed", None), (None, None),
])
async def test_country_is_recognised_from_the_address_when_not_given(client, db_session, address, expected):
    h = await _headers(db_session)
    r = await client.post("/api/v1/projects", headers=h, json=_body(address))
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    assert data["country_code"] == expected and data["location"]["country_code"] == expected
    got = (await client.get(f"/api/v1/projects/{data['id']}", headers=h)).json()["data"]
    assert got["country_code"] == expected


@pytest.mark.asyncio
async def test_explicit_country_wins_and_is_normalised(client, db_session):
    h = await _headers(db_session)
    r = await client.post("/api/v1/projects", headers=h, json=_body("Austin, Texas", country_code="ca"))
    assert r.status_code == 201 and r.json()["data"]["country_code"] == "CA"


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["USA", "1A", "U", ""])
async def test_invalid_country_code_is_rejected(client, db_session, bad):
    h = await _headers(db_session)
    r = await client.post("/api/v1/projects", headers=h, json=_body("Austin, Texas", country_code=bad))
    assert r.status_code == 422


def test_report_uses_the_stored_country_before_guessing_from_the_address():
    from app.routers.reports import _build_project_dict
    stored = SimpleNamespace(name="p", location="Somewhere unnamed", country_code="IN", capacity_mw=1, latitude=None, longitude=None,
                             description="", status="draft", technology="solar")
    assert _build_project_dict(stored)["country_code"] == "IN"
    legacy = SimpleNamespace(name="p", location="Austin, Texas", country_code=None, capacity_mw=1, latitude=None, longitude=None,
                             description="", status="draft", technology="solar")
    assert _build_project_dict(legacy)["country_code"] == "US"


def _migration():
    spec = importlib.util.spec_from_file_location("m0010", BACKEND / "alembic" / "versions" / "0010_project_country_code.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_migration_is_additive_nullable_and_backfills_from_the_address(tmp_path):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    engine = sa.create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:
        conn.execute(sa.text("CREATE TABLE projects (id VARCHAR(36) PRIMARY KEY, name VARCHAR(255) NOT NULL, location VARCHAR(255))"))
        for pid, loc in [("a", "Austin, Texas"), ("b", "Jodhpur, Rajasthan"), ("c", "山东省济南市"), ("d", "Nowhere in particular"), ("e", None)]:
            conn.execute(sa.text("INSERT INTO projects (id, name, location) VALUES (:i, 'n', :l)"), {"i": pid, "l": loc})
    module = _migration()
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            module.upgrade()
    with engine.connect() as conn:
        rows = dict(conn.execute(sa.text("SELECT id, country_code FROM projects")).fetchall())
        cols = {c["name"]: c for c in sa.inspect(conn).get_columns("projects")}
    assert rows == {"a": "US", "b": "IN", "c": "CN", "d": None, "e": None}
    assert cols["country_code"]["nullable"] is True
    with engine.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            module.downgrade()
    with engine.connect() as conn:
        assert "country_code" not in {c["name"] for c in sa.inspect(conn).get_columns("projects")}


def test_migration_chain_has_a_single_head():
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND / "alembic"))
    assert ScriptDirectory.from_config(cfg).get_heads() == ["0010_project_country_code"]
