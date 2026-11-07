"""One independent process for the PostgreSQL report-export check.

The parent test starts several of these. Each process loads the app itself, so
the in-process asyncio lock cannot coordinate them. They share only the
database named in REPORT_MP_DATABASE_URL.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime, timezone


def _refuse(url: str) -> None:
    if "energy_cn" in url or not url.startswith("postgresql"):
        raise SystemExit("refusing a non-isolated or non-PostgreSQL database")


def _prepare() -> str:
    url = os.environ["REPORT_MP_DATABASE_URL"]
    _refuse(url)
    os.environ["DATABASE_URL"] = url
    os.environ["ENERGY_TEST_MODE"] = "1"
    os.environ["APP_ENV"] = "test"
    os.environ["ENVIRONMENT"] = "test"
    os.environ.setdefault("REPORTS_DIR", "/tmp/report-mp-112-files")
    return url


def _month() -> str:
    return f"monthly_{datetime.now(timezone.utc).strftime('%Y-%m')}"


async def _client():
    from httpx import ASGITransport, AsyncClient
    from app.main import app
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://report-mp")


async def _database_name() -> str:
    from sqlalchemy import text
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        name = (await db.execute(text("SELECT current_database()"))).scalar_one()
    if name != "energy_report_mp_112":
        raise SystemExit(f"connected to {name}, expected energy_report_mp_112")
    return name


async def bootstrap() -> dict:
    import uuid
    import app.models.cashflow  # noqa: F401
    import app.models.report  # noqa: F401
    from app.core.security import create_access_token
    from app.database import AsyncSessionLocal, init_db
    from app.models.user import User
    from app.utils.security import get_password_hash
    await init_db()
    name = await _database_name()
    owner_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as db:
        db.add(User(
            id=owner_id, email=f"owner-{owner_id[:8]}@example.com",
            password_hash=get_password_hash("Passw0rd!x"), name="额度所有者",
            role="user", market="cn", subscription_plan="free",
            usage_quota={"ai_calls": {}, "report_exports": {}},
        ))
        db.add(User(
            id=other_id, email=f"other-{other_id[:8]}@example.com",
            password_hash=get_password_hash("Passw0rd!x"), name="其他用户",
            role="user", market="cn", subscription_plan="pro",
            usage_quota={"ai_calls": {}, "report_exports": {}},
        ))
        await db.commit()
    owner_token = create_access_token(owner_id)
    other_token = create_access_token(other_id)
    async with await _client() as client:
        created = await client.post("/api/v1/projects", headers={"Authorization": f"Bearer {owner_token}"}, json={
            "name": "多进程报告项目", "technology": "solar", "capacity_kw": 1000,
            "location": {"latitude": 23.1, "longitude": 113.3, "address": "广州"},
        })
        if created.status_code != 201:
            raise SystemExit(created.text)
        project_id = created.json()["data"]["id"]
        saved = await client.post(
            f"/api/v1/finance/models/{project_id}",
            headers={"Authorization": f"Bearer {owner_token}"},
            json={
                "capacity_mw": 100, "capex_per_w": 1.1, "opex_per_kw_yr": 17,
                "electricity_price": 45, "capacity_factor": 0.25, "currency": "CNY",
                "data_sources": [{
                    "title": "公开电价通知",
                    "url": "https://www.ndrc.gov.cn/xxgk/zcfb/tz/202502/t20250209_1396066.html",
                    "retrieved_at": "2026-11-07",
                }],
            },
        )
        if saved.status_code != 200:
            raise SystemExit(saved.text)
    return {
        "database": name, "owner_id": owner_id, "other_id": other_id,
        "owner_token": owner_token, "other_token": other_token, "project_id": project_id,
    }


async def set_usage(user_id: str, used: int) -> None:
    from app.database import AsyncSessionLocal
    from app.models.user import User
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        user.usage_quota = {"ai_calls": {}, "report_exports": {_month(): used}}
        await db.commit()


async def read_usage(user_id: str) -> int:
    from app.database import AsyncSessionLocal
    from app.models.user import User
    async with AsyncSessionLocal() as db:
        user = await db.get(User, user_id)
        await db.refresh(user)
        return int(((user.usage_quota or {}).get("report_exports") or {}).get(_month(), 0) or 0)


async def post_generate(token: str, project_id: str, mode: str) -> dict:
    if mode == "fail":
        import app.routers.reports as reports
        def boom(*args, **kwargs):
            raise RuntimeError("render failed")
        reports.generate_pdf = boom
    elif mode == "hold":
        import app.routers.reports as reports
        async def hold(**kwargs):
            return None
        reports._generate_report_task = hold
    async with await _client() as client:
        response = await client.post(
            "/api/v1/reports/generate",
            headers={"Authorization": f"Bearer {token}"},
            json={"project_id": project_id, "report_type": "feasibility", "format": "pdf"},
        )
    body = response.json()
    report_id = body.get("data", {}).get("report_id") if isinstance(body, dict) else None
    detail = body.get("detail") if isinstance(body, dict) else None
    return {"status": response.status_code, "report_id": report_id, "detail": detail, "pid": os.getpid()}


async def delete_report(token: str, report_id: str) -> dict:
    async with await _client() as client:
        response = await client.delete(
            f"/api/v1/reports/{report_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    return {"status": response.status_code, "pid": os.getpid(), "body": response.json()}


async def insert_user(plan: str) -> dict:
    import uuid
    from app.core.security import create_access_token
    from app.database import AsyncSessionLocal
    from app.models.user import User
    from app.utils.security import get_password_hash
    user_id = str(uuid.uuid4())
    async with AsyncSessionLocal() as db:
        db.add(User(
            id=user_id, email=f"{plan}-{user_id[:8]}@example.com",
            password_hash=get_password_hash("Passw0rd!x"), name=f"{plan}用户",
            role="user", market="cn", subscription_plan=plan,
            usage_quota={"ai_calls": {}, "report_exports": {}},
        ))
        await db.commit()
    return {"user_id": user_id, "token": create_access_token(user_id), "plan": plan}


async def generating(user_id: str) -> dict:
    from sqlalchemy import select
    from app.database import AsyncSessionLocal
    from app.models.report import Report
    async with AsyncSessionLocal() as db:
        rows = (await db.execute(
            select(Report.id, Report.status).where(Report.user_id == user_id, Report.status == "generating")
        )).all()
    return {"ids": [row[0] for row in rows]}


async def report_status(token: str, report_id: str) -> dict:
    async with await _client() as client:
        response = await client.get(
            f"/api/v1/reports/{report_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
    body = response.json()
    status = body.get("data", {}).get("status") if isinstance(body, dict) else None
    return {"status_code": response.status_code, "report_status": status, "pid": os.getpid()}


def main() -> None:
    _prepare()
    action = sys.argv[1]
    payload = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    if action == "bootstrap":
        result = asyncio.run(bootstrap())
    elif action == "set-usage":
        asyncio.run(set_usage(payload["user_id"], int(payload["used"])))
        result = {"ok": True}
    elif action == "usage":
        result = {"used": asyncio.run(read_usage(payload["user_id"]))}
    elif action == "post":
        result = asyncio.run(post_generate(payload["token"], payload["project_id"], payload.get("mode", "normal")))
    elif action == "delete":
        result = asyncio.run(delete_report(payload["token"], payload["report_id"]))
    elif action == "status":
        result = asyncio.run(report_status(payload["token"], payload["report_id"]))
    elif action == "insert-user":
        result = asyncio.run(insert_user(payload["plan"]))
    elif action == "generating":
        result = asyncio.run(generating(payload["user_id"]))
    else:
        raise SystemExit(f"unknown action {action}")
    sys.stdout.write(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
