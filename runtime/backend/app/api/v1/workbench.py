"""Per-user personalised workbench: GET /api/v1/home/workbench (+ preferences).

Reads only the caller's own records. Preferences and the "already shown" history
live in ``User.usage_quota["home_personalization"]``, so they are covered by the
existing account export and deletion in privacy.py.
"""
from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import FinancialModel, Project, ResourceAssessment
from app.models.report import Report
from app.models.user import User
from app.services import personal_workbench as pw

router = APIRouter(prefix="/home")
KEY = "home_personalization"


class PreferencesBody(BaseModel):
    enabled: Optional[bool] = None
    role: Optional[str] = Field(None, description="investor | operations | developer | analyst")
    tech_focus: Optional[List[str]] = Field(None, description="solar_pv | wind | storage | hybrid")
    goal: Optional[str] = Field(None, description="yield | reliability | pipeline | market")
    region: Optional[str] = Field(None, max_length=60)
    timezone: Optional[str] = Field(None, max_length=60)
    reset_history: bool = False


def _lang(user: User) -> str:
    return "en" if (user.market or "cn") == "global" else "zh"


_FIXED = re.compile(r"^UTC([+-])(\d{2}):(\d{2})$")


def _zone(name: str):
    """IANA name, or a fixed offset such as ``UTC+05:30`` (what apps without a time-zone database send)."""
    m = _FIXED.match(name.strip())
    if m:
        minutes = int(m.group(2)) * 60 + int(m.group(3))
        if minutes > 14 * 60:
            raise ValueError(name)
        return timezone(timedelta(minutes=minutes if m.group(1) == "+" else -minutes))
    return ZoneInfo(name)


def _tz(user: User, prefs: Dict, override: Optional[str]):
    for name in (override, prefs.get("timezone"), "UTC" if (user.market or "cn") == "global" else "Asia/Shanghai"):
        if not name:
            continue
        try:
            return _zone(name)
        except (ZoneInfoNotFoundError, ValueError):
            continue
    return ZoneInfo("UTC")


def _clean_prefs(body: PreferencesBody, prefs: Dict) -> Dict:
    out = dict(prefs)
    if body.enabled is not None:
        out["enabled"] = bool(body.enabled)
    if body.role is not None:
        out["role"] = body.role if body.role in pw.ROLES else ""
    if body.tech_focus is not None:
        out["tech_focus"] = [t for t in body.tech_focus if t in pw.TECHS][:4]
    if body.goal is not None:
        out["goal"] = body.goal if body.goal in pw.GOALS else ""
    if body.region is not None:
        out["region"] = body.region.strip()
    if body.timezone is not None:
        try:
            ZoneInfo(body.timezone)
            out["timezone"] = body.timezone
        except (ZoneInfoNotFoundError, ValueError):
            out["timezone"] = ""
    if body.reset_history:
        out["seen"], out["open_days"] = {}, []
    return out


def _d(v, tz) -> Optional[date]:
    """Calendar day in the *user's* time zone (stored timestamps are UTC)."""
    if v is None:
        return None
    if isinstance(v, datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v.astimezone(tz).date()
    return v


async def _facts(db: AsyncSession, user_id: str, tz) -> List[pw.ProjectFacts]:
    projects = (await db.execute(select(Project).where(Project.user_id == user_id))).scalars().all()
    ids = [p.id for p in projects]
    res, fin, rep = {}, {}, {}
    if ids:
        for pid, ts in (await db.execute(select(ResourceAssessment.project_id, ResourceAssessment.created_at).where(ResourceAssessment.project_id.in_(ids)))).all():
            res[pid] = max(res.get(pid) or ts, ts)
        for pid, ts in (await db.execute(select(FinancialModel.project_id, FinancialModel.created_at).where(FinancialModel.project_id.in_(ids)))).all():
            fin[pid] = max(fin.get(pid) or ts, ts)
        for pid, ts in (await db.execute(select(Report.project_id, Report.created_at).where(Report.project_id.in_(ids), Report.user_id == user_id))).all():
            rep[pid] = max(rep.get(pid) or ts, ts)
    facts = []
    for p in projects:
        stamps = [x for x in (p.updated_at, p.created_at, res.get(p.id), fin.get(p.id), rep.get(p.id)) if x]
        facts.append(pw.ProjectFacts(
            id=p.id, name=p.name, technology=p.technology or "", location=p.location or "",
            has_resource=p.id in res, has_finance=p.id in fin, has_report=p.id in rep,
            last_touched=_d(max(stamps, key=lambda x: x.replace(tzinfo=timezone.utc) if x.tzinfo is None else x), tz) if stamps else None,
        ))
    return facts


def _profile(user: User, prefs: Dict, facts: List[pw.ProjectFacts], tz) -> pw.Profile:
    region = prefs.get("region") or (facts[0].location if facts and facts[0].location else "") or (user.country or "")
    return pw.Profile(
        lang=_lang(user), role=prefs.get("role", ""), tech_focus=tuple(prefs.get("tech_focus", [])),
        goal=prefs.get("goal", ""), region=region, account_created=_d(user.created_at, tz),
    )


def _public_prefs(prefs: Dict) -> Dict:
    return {
        "enabled": prefs.get("enabled", True), "role": prefs.get("role", ""),
        "tech_focus": prefs.get("tech_focus", []), "goal": prefs.get("goal", ""),
        "region": prefs.get("region", ""), "timezone": prefs.get("timezone", ""),
    }


@router.get("/workbench")
async def get_workbench(
    tz: Optional[str] = Query(None, description="IANA time zone, e.g. Asia/Shanghai"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await db.scalar(select(User).where(User.id == user_id))
    usage = dict(user.usage_quota or {})
    prefs = dict(usage.get(KEY) or {})
    lang = _lang(user)
    if prefs.get("enabled", True) is False:
        return {"code": 0, "message": "success", "data": {
            "personalized": False, "lang": lang, "preferences": _public_prefs(prefs),
            "cards": [], "disclaimer": pw.DISCLAIMER[lang],
            "note": "个性化已关闭，可在设置里重新打开。" if lang == "zh" else "Personalisation is off; turn it on in settings.",
        }}
    zone = _tz(user, prefs, tz)
    now = datetime.now(zone)
    facts = await _facts(db, user_id, zone)
    act = pw.Activity(
        projects=facts, last_active=max([f.last_touched for f in facts if f.last_touched], default=None),
        open_days=tuple(prefs.get("open_days", [])), seen=dict(prefs.get("seen", {})),
    )
    data = pw.compose(_profile(user, prefs, facts, zone), act, now, user_key=str(user_id))
    today = data["date"]
    seen = dict(prefs.get("seen", {}))
    for c in data["cards"]:
        seen[c["id"]] = today  # last day shown; a same-day refresh keeps the same board
    days = sorted(set(list(prefs.get("open_days", [])) + [today]))[-30:]
    cutoff = (date.fromisoformat(today) - timedelta(days=30)).isoformat()
    prefs["seen"] = {k: v for k, v in seen.items() if v >= cutoff}
    prefs["open_days"] = days
    usage[KEY] = prefs
    user.usage_quota = usage
    await db.commit()
    data.update({
        "personalized": True, "lang": lang, "preferences": _public_prefs(prefs),
        "note": ("这些建议根据你的角色、项目进度、时间和已看过的内容生成；可以随时关闭。" if lang == "zh"
                 else "These suggestions come from your role, project progress, the time and what you have already seen; you can turn them off any time."),
    })
    return {"code": 0, "message": "success", "data": data}


@router.get("/workbench/preferences")
async def get_preferences(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.id == user_id))
    return {"code": 0, "message": "success", "data": _public_prefs(dict((user.usage_quota or {}).get(KEY) or {}))}


@router.put("/workbench/preferences")
async def put_preferences(body: PreferencesBody, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.id == user_id))
    usage = dict(user.usage_quota or {})
    usage[KEY] = _clean_prefs(body, dict(usage.get(KEY) or {}))
    user.usage_quota = usage
    await db.commit()
    return {"code": 0, "message": "success", "data": _public_prefs(usage[KEY])}
