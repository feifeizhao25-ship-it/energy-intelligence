"""Public, non-user-specific previews for the five seven-day demo personas."""

from fastapi import APIRouter, HTTPException, Query

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
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"code": 0, "message": "success", "data": layout}

