"""Personalization API — 前端 dashboard 的每日编排端点。

数据来自 app.services.personalization_v2.PersonalizationEngine（演示数据，
引擎内部已逐项标注 evidence_status="demo"）。
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.dependencies import get_current_user_id
from app.services.personalization_v2 import PersonalizationEngine

router = APIRouter(prefix="/personalization")

_engine = PersonalizationEngine()


@router.get("/daily-layout")
async def daily_layout(
    persona_id: str = Query(..., description="人设 ID，如 chen_xin / john_smith"),
    day: int = Query(..., ge=1, le=7, description="第几天（1-7）"),
    user_id: str = Depends(get_current_user_id),
):
    """返回该人设当天的仪表盘编排（hero 卡 + widgets + 推荐卡）。"""
    layout = _engine.get_daily_layout(persona_id, day)
    if layout is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return layout
