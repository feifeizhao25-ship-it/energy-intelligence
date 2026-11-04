"""Public, non-user-specific previews for the five seven-day demo personas."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id

from app.services.personalization_v2 import PersonalizationEngine

router = APIRouter(prefix="/personalization")
_engine = PersonalizationEngine()


@router.get("/daily-layout")
async def daily_layout(
    persona_id: str = Query(..., description="Built-in demonstration persona ID"),
    day: int = Query(..., ge=1, le=7),
):
    """Return explicitly labelled demo content; no real user data is exposed."""
    layout = _engine.get_daily_layout(persona_id, day)
    if layout is None:
        raise HTTPException(status_code=404, detail="用户画像不存在")
    layout = {**layout, "source": "demo"}  # I-14: unmistakably the canned demo, never the signed-in user's own data
    return {"code": 0, "message": "success", "data": layout}



@router.get("/daily-layout/me")
async def my_daily_layout(
    tz: Optional[str] = Query(None, description="IANA time zone, e.g. Asia/Shanghai"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """The signed-in user's real daily layout (UI test I-14: ``/daily-layout`` only serves five canned personas).

    Built from the same real inputs as ``/home/workbench``: the user's role / focus / goal, their own projects and what
    they have already done, the time of day and what was shown before. Same hero + ordered cards + recommendations
    shape as the demo, with ``source = "user_data"``."""
    from app.api.v1.workbench import get_workbench

    wb = (await get_workbench(tz=tz, user_id=user_id, db=db))["data"]
    cards = wb.get("cards", [])
    lang = wb.get("lang", "zh")
    hero = wb.get("hero") or {}
    layout = {
        "persona_id": None,
        "source": "user_data",
        "personalized": bool(wb.get("personalized")),
        "date": wb.get("date"),
        "weekday": wb.get("weekday"),
        "day_stage": wb.get("state"),
        "hero": hero,
        "widgets": [
            {"id": c["id"], "priority": i, "title": c["title"], "summary": c["body"], "href": c["href"],
             "reason": c["reason"], "evidence_status": "user_data"}
            for i, c in enumerate(cards, start=1)
        ],
        "recommendation": {
            "kind": "recommendation",
            "title": "你可能关心" if lang == "zh" else "You may also be interested",
            "items": [{"title": c["title"], "href": c["href"]} for c in cards[:2]],
            "evidence_status": "user_data",
        },
        "disclaimer": wb.get("disclaimer"),
        "preferences": wb.get("preferences"),
    }
    return {"code": 0, "message": "success", "data": layout}
