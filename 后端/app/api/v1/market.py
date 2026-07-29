"""市场价格数据 API — RAG 注册表价格类条目（7 天核验档）。

fail-closed 原则：核验逾期（freshness_status=stale）的条目标 ``stale=true``
且默认不出数值（``content`` 置空），只允许前端展示「数据已过期」，
不得把过期行情当现价展示。
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user_id
from app.services.rag_sources import SourceRegistry, verification_status

router = APIRouter(prefix="/data")


def _get_registry() -> SourceRegistry:
    """每次请求重新加载注册表；测试可 monkeypatch 本函数注入伪造条目。"""
    return SourceRegistry.from_file()


@router.get("/market")
async def market_data(user_id: str = Depends(get_current_user_id)):
    """价格类语料条目（鉴权）。过期条目 fail-closed 不出数值。"""
    registry = _get_registry()
    items = []
    stale_count = 0
    for source in registry.sources:
        if source.get("type") != "price":
            continue
        freshness = registry.freshness_of(source)
        stale = freshness == "stale"
        stale_count += 1 if stale else 0
        items.append(
            {
                "source_id": source["source_id"],
                "lang": source["lang"],
                "title": source["title"],
                "source_url": source["source_url"],
                "source_org": source["source_org"],
                "last_verified_at": source["last_verified_at"],
                "verify_interval_days": int(source.get("verify_interval_days", 7)),
                "freshness_status": freshness,
                "verification": verification_status(source),
                "stale": stale,
                # fail-closed：过期条目不出数值/内容，只给元数据
                "content": None if stale else source.get("content"),
            }
        )
    data = {"items": items, "total": len(items), "stale_count": stale_count}
    if stale_count:
        data["note"] = "部分价格数据已过核验期，按 fail-closed 原则不展示数值，请以官方来源为准。"
    return {"data": data}
