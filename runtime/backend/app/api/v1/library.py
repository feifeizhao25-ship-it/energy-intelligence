"""资料库接口：条目（带展示规则的结论）、个性化「为你推荐」、关注/静音/总开关、来访与已读记录。仅登录用户。

国内版（User.market = cn）只返回中文条目，国际版（global）只返回英文条目，两边的文案、错误信息都不混用。
"""
from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.library import feed as fd
from app.library import service, store
from app.models.user import User

router = APIRouter(prefix="/library")

NOT_FOUND = {"zh": "资料不存在或尚未上线", "en": "This item does not exist or is not published yet"}
BAD_TOPIC = {"zh": "未知的主题", "en": "Unknown topic"}


class PrefsBody(BaseModel):
    enabled: Optional[bool] = None
    follow: List[str] = Field(default_factory=list)
    unfollow: List[str] = Field(default_factory=list)
    mute: List[str] = Field(default_factory=list)
    unmute: List[str] = Field(default_factory=list)


def _ok(data):
    return {"code": 0, "message": "success", "data": data}


def _today(zone) -> date:
    return datetime.now(zone).date()


async def _ctx(db: AsyncSession, user_id: str, tz: Optional[str]):
    """用户、工作台偏好（角色/技术/目标/地区）、本地日期。工作台那边的取数逻辑原样复用。"""
    from app.api.v1 import workbench as wb

    user = await db.scalar(select(User).where(User.id == user_id))
    usage = dict(user.usage_quota or {})
    wb_prefs = dict(usage.get(wb.KEY) or {})
    zone = wb._tz(user, wb_prefs, tz)
    return user, usage, wb_prefs, zone, wb


@router.get("/entries")
async def entries(tz: Optional[str] = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user, usage, _, zone, _ = await _ctx(db, user_id, tz)
    edition, today = store.edition_of(user.market), _today(zone)
    items = store.annotated(edition, today)
    marks = service.visit_badges(usage, items)
    for e in items:
        if e["id"] in marks:
            e["badge"] = marks[e["id"]]
    return _ok({"entries": items, "edition": edition, "lang": store.LANG[edition], "generated_for": today.isoformat(), "preview_pending": store.show_pending()})


@router.get("/entries/{entry_id}")
async def entry_detail(entry_id: str, tz: Optional[str] = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user, _, _, zone, _ = await _ctx(db, user_id, tz)
    edition = store.edition_of(user.market)
    e = store.find(edition, entry_id, _today(zone))
    if not e:
        raise HTTPException(status_code=404, detail=NOT_FOUND[store.LANG[edition]])
    return _ok(e)


@router.get("/feed")
async def feed(tz: Optional[str] = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user, usage, wb_prefs, zone, wb = await _ctx(db, user_id, tz)
    today = _today(zone)
    facts = await wb._facts(db, user_id, zone)
    out, new_usage = service.build_feed(user_id, user.market, usage, wb._profile(user, wb_prefs, facts, zone), facts, today)
    if new_usage != usage:
        user.usage_quota = new_usage
        await db.commit()
    return _ok(out)


@router.get("/preferences")
async def get_prefs(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.id == user_id))
    return _ok(service.public_prefs(dict(user.usage_quota or {}), store.LANG[store.edition_of(user.market)]))


@router.put("/preferences")
async def put_prefs(body: PrefsBody, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.id == user_id))
    lang = store.LANG[store.edition_of(user.market)]
    try:
        usage = service.apply_prefs(dict(user.usage_quota or {}), enabled=body.enabled, follow=body.follow, unfollow=body.unfollow, mute=body.mute, unmute=body.unmute)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=BAD_TOPIC[lang]) from e
    user.usage_quota = usage
    await db.commit()
    return _ok(service.public_prefs(usage, lang))


@router.post("/visit")
async def visit(tz: Optional[str] = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user, usage, _, zone, _ = await _ctx(db, user_id, tz)
    user.usage_quota = service.record_visit(usage, _today(zone))
    await db.commit()
    return _ok({"ok": True})


@router.post("/opened/{entry_id}")
async def opened(entry_id: str, tz: Optional[str] = Query(None), user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user, usage, _, zone, _ = await _ctx(db, user_id, tz)
    edition, today = store.edition_of(user.market), _today(zone)
    if not store.find(edition, entry_id, today):
        raise HTTPException(status_code=404, detail=NOT_FOUND[store.LANG[edition]])
    user.usage_quota = service.record_open(usage, entry_id, today)
    await db.commit()
    return _ok({"ok": True})
