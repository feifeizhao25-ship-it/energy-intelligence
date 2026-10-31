"""会员权益注册表端点：GET /api/entitlements（19 项要求第 6 项）。"""

from fastapi import APIRouter, HTTPException, Request

from app.core.market import request_market
from app.services.market_localization import localize_registry

from app.services.entitlements_registry import EntitlementsRegistryError, load_registry

router = APIRouter(prefix="/entitlements", tags=["会员权益"])


@router.get("")
async def get_entitlements(request: Request):
    """返回统一会员权益注册表（产品/版本/各档位六维权益）。"""
    try:
        registry = load_registry()
        return localize_registry(registry) if request_market(request) == "global" else registry
    except EntitlementsRegistryError as exc:
        # fail-closed：注册表不可用时明确 503，不返回残缺或编造的权益表
        raise HTTPException(status_code=503, detail=str(exc)) from exc
