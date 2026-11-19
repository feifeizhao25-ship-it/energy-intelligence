"""国内版注册来源题「从哪知道我们」：默认关闭、只认枚举代码、只记国内新账号、注销即删。"""
import uuid

import pytest
from sqlalchemy import select

from app.api.v1 import auth as auth_api
from app.models.signup_source import SignupSourceEvent
from app.models.user import User
from app.services import signup_source as ss

ON = {ss.ENV_FLAG: "true"}


def test_nine_options_in_order_and_default_off():
    assert [label for _, label in ss.SIGNUP_SOURCES] == [
        "小红书", "抖音", "视频号", "公众号", "知乎", "哔哩哔哩", "搜索", "朋友推荐", "其他",
    ]
    assert ss.signup_source_enabled({}) is False
    assert ss.signup_source_enabled({ss.ENV_FLAG: "0"}) is False
    assert ss.signup_source_enabled(ON) is True
    assert ss.public_options({}) == {"enabled": False, "question": "从哪知道我们", "options": [], "skippable": True}
    assert len(ss.public_options(ON)["options"]) == 9


@pytest.mark.parametrize("raw", ["Zhihu", "知乎", " zhihu", "我朋友小王推荐的", "", None, 1, ["zhihu"], {"code": "zhihu"}])
def test_unknown_values_dropped(raw):
    assert ss.normalize(raw) == ""


def test_count_by_source_has_no_identity():
    out = ss.count_by_source([
        {"source": "douyin", "user_id": "u1", "phone": "13800000000"},
        {"source": "douyin"},
        {"source": "zhihu"},
        {"source": "自由文本"},
    ])
    assert out == {"douyin": 2, "zhihu": 1}
    assert "u1" not in str(out) and "1380" not in str(out)


async def _rows(db_session):
    db_session.expire_all()
    return (await db_session.execute(select(SignupSourceEvent))).scalars().all()


def _register_body(**extra):
    return {"email": f"u{uuid.uuid4().hex[:8]}@example.com", "password": "SecurePass123!", "name": "测试用户", **extra}


@pytest.mark.asyncio
async def test_options_endpoint_follows_flag(client, monkeypatch):
    monkeypatch.delenv(ss.ENV_FLAG, raising=False)
    r = await client.get("/api/v1/auth/signup-source")
    assert r.status_code == 200 and r.json()["enabled"] is False and r.json()["options"] == []
    monkeypatch.setenv(ss.ENV_FLAG, "1")
    codes = [o["code"] for o in (await client.get("/api/v1/auth/signup-source")).json()["options"]]
    assert codes == ["xiaohongshu", "douyin", "wechat_channels", "wechat_oa", "zhihu", "bilibili", "search", "friend", "other"]


@pytest.mark.asyncio
async def test_register_records_code_only_when_flag_on(client, db_session, monkeypatch):
    monkeypatch.delenv(ss.ENV_FLAG, raising=False)
    r = await client.post("/api/v1/auth/register", json=_register_body(signup_source="douyin"))
    assert r.status_code == 201
    assert await _rows(db_session) == []

    monkeypatch.setenv(ss.ENV_FLAG, "true")
    r = await client.post("/api/v1/auth/register", json=_register_body(signup_source="douyin"))
    assert r.status_code == 201
    rows = await _rows(db_session)
    assert [(row.source) for row in rows] == ["douyin"]
    # 账号行里不存来源
    user = (await db_session.execute(select(User).where(User.id == rows[0].user_id))).scalar_one()
    assert "douyin" not in str({c.name: getattr(user, c.name, None) for c in User.__table__.columns})


@pytest.mark.asyncio
async def test_register_drops_free_text_and_skip(client, db_session, monkeypatch):
    monkeypatch.setenv(ss.ENV_FLAG, "true")
    assert (await client.post("/api/v1/auth/register", json=_register_body(signup_source="在抖音刷到的"))).status_code == 201
    assert (await client.post("/api/v1/auth/register", json=_register_body())).status_code == 201
    assert (await client.post("/api/v1/auth/register", json=_register_body(signup_source="x" * 33))).status_code == 422
    assert await _rows(db_session) == []


@pytest.mark.asyncio
async def test_register_global_market_not_recorded(client, db_session, monkeypatch):
    monkeypatch.setenv(ss.ENV_FLAG, "true")
    r = await client.post("/api/v1/auth/register", json=_register_body(
        signup_source="search", market="global", data_transfer_consent=True))
    assert r.status_code == 201
    assert await _rows(db_session) == []


@pytest.mark.asyncio
async def test_sms_first_login_records_once(client, db_session, monkeypatch):
    monkeypatch.setenv(ss.ENV_FLAG, "true")

    async def fake_read(_phone):
        return "123456"

    async def fake_drop(_phone):
        return None

    monkeypatch.setattr(auth_api, "_read_sms_code", fake_read)
    monkeypatch.setattr(auth_api, "_drop_sms_code", fake_drop)
    body = {"phone": "13912345678", "code": "123456", "consent": True, "signup_source": "xiaohongshu"}
    r = await client.post("/api/v1/auth/sms/login", json=body)
    assert r.status_code == 200, r.text
    assert [row.source for row in await _rows(db_session)] == ["xiaohongshu"]
    # 老用户再登录：不再记、不改
    r = await client.post("/api/v1/auth/sms/login", json={**body, "signup_source": "zhihu"})
    assert r.status_code == 200
    assert [row.source for row in await _rows(db_session)] == ["xiaohongshu"]


@pytest.mark.asyncio
async def test_delete_account_removes_signup_source(client, auth_headers, db_session):
    from app.core.security import decode_token
    uid = decode_token(auth_headers["Authorization"].split()[1])
    db_session.add(SignupSourceEvent(id=str(uuid.uuid4()), user_id=uid, source="friend"))
    await db_session.commit()

    export = (await client.get("/api/v1/privacy/export", headers=auth_headers)).json()
    assert [e["source"] for e in export["signup_source"]] == ["friend"]

    r = await client.post("/api/v1/privacy/delete-account", json={"confirm": "DELETE"}, headers=auth_headers)
    assert r.status_code == 200
    assert await _rows(db_session) == []
