"""Users register the sources a report cites (the report refuses to generate without one)."""
import re

import pytest

from tests.test_reports_flow_20261031 import SOLAR, _generate, _project

SRC = {"title": "Grid tariff notice 2026", "url": "https://example.gov/notice", "publisher": "State regulator", "published_at": "2026-09-01"}


async def _global_user(db_session):
    import uuid
    from app.core.security import create_access_token, hash_password
    from app.models.user import User
    u = User(id=str(uuid.uuid4()), email=f"{uuid.uuid4().hex[:8]}@example.com", password_hash=hash_password("TestPass123!"),
             name="g", role="user", market="global", subscription_plan="pro", usage_quota={})
    db_session.add(u)
    await db_session.commit()
    return {"Authorization": f"Bearer {create_access_token(str(u.id))}"}


@pytest.mark.asyncio
async def test_sources_need_a_saved_model_first(client, auth_headers, db_session):
    pid = await _project(client, auth_headers)
    gh = await _global_user(db_session)
    gpid = await _project(client, gh)
    r = await client.put(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers, json={"sources": [SRC]})
    assert r.status_code == 409 and "请先为该项目保存财务模型" in r.json()["detail"]
    r = await client.put(f"/api/v1/finance/data-sources/{gpid}", headers=gh, json={"sources": [SRC]})
    assert r.status_code == 409 and not re.search(r"[\u4e00-\u9fff]", r.json()["detail"])
    g = await client.get(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers)
    assert g.status_code == 200 and g.json()["has_financial_model"] is False and g.json()["sources"] == []


@pytest.mark.asyncio
async def test_register_sources_then_generate_report(client, auth_headers, tmp_path, monkeypatch):
    monkeypatch.setenv("REPORTS_DIR", str(tmp_path))
    pid = await _project(client, auth_headers)
    assert (await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=SOLAR)).status_code == 200
    refused = await _generate(client, auth_headers, pid, market="global")
    assert refused.status_code == 422
    put = await client.put(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers, json={"sources": [SRC, SRC]})
    assert put.status_code == 200 and put.json()["count"] == 1  # duplicates collapse
    got = await client.get(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers)
    assert got.json()["sources"][0]["title"] == SRC["title"]
    ok = await _generate(client, auth_headers, pid, market="global")
    assert ok.status_code == 200, ok.text
    cleared = await client.put(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers, json={"sources": []})
    assert cleared.status_code == 200
    assert (await _generate(client, auth_headers, pid, market="global")).status_code == 422


@pytest.mark.asyncio
@pytest.mark.parametrize("bad,zh_part,en_part", [
    ([{"url": "https://x.org"}], "缺少标题", "needs a title"),
    ([{"title": "t", "url": "javascript:alert(1)"}], "必须以 http", "must start with http"),
    ([{"title": "x" * 201}], "超过 200", "longer than 200"),
    ([{"title": "t"}] * 0 + ["nope"], "格式不正确", "is not valid"),
])
async def test_invalid_sources_are_rejected_in_the_users_language(client, auth_headers, db_session, bad, zh_part, en_part):
    pid = await _project(client, auth_headers)
    await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=SOLAR)
    gh = await _global_user(db_session)
    gpid = await _project(client, gh)
    await client.post(f"/api/v1/finance/models/{gpid}", headers=gh, json=SOLAR)
    zh = await client.put(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers, json={"sources": bad})
    assert zh.status_code == 422 and zh_part in zh.json()["detail"]
    en = await client.put(f"/api/v1/finance/data-sources/{gpid}", headers=gh, json={"sources": bad})
    assert en.status_code == 422 and en_part in en.json()["detail"]


@pytest.mark.asyncio
async def test_too_many_sources_and_other_users_project(client, auth_headers):
    pid = await _project(client, auth_headers)
    await client.post(f"/api/v1/finance/models/{pid}", headers=auth_headers, json=SOLAR)
    many = [{"title": f"s{i}"} for i in range(31)]
    r = await client.put(f"/api/v1/finance/data-sources/{pid}", headers=auth_headers, json={"sources": many})
    assert r.status_code == 422
    r = await client.get("/api/v1/finance/data-sources/does-not-exist", headers=auth_headers)
    assert r.status_code == 404
    r = await client.get(f"/api/v1/finance/data-sources/{pid}")
    assert r.status_code in (401, 403)
