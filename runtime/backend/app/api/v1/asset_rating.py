"""Asset rating has no model yet. The route says so and does not return a score."""
from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user_id
from app.utils.response import success

router = APIRouter()


def asset_rating_payload(asset_id: str) -> dict:
    return {
        "asset_id": asset_id,
        "status": "not_available",
        "reason": "asset rating model is not ready",
        "score": None,
    }


@router.get("/assets/{asset_id}/rating")
async def asset_rating(asset_id: str, user_id: str = Depends(get_current_user_id)):
    del user_id
    return success(data=asset_rating_payload(asset_id))
