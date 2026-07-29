"""
Knowledge 路由 — 知识库文章浏览与搜索
符合 V4 测试规范 TC-KNOW-001 ~ TC-KNOW-003
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.knowledge import KnowledgeDoc
from app.models.favorite import Favorite
from app.schemas.common import SuccessResponse
from app.utils.response import success
from app.utils.exceptions import NotFoundError
from sqlalchemy import delete

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# ═══════════ Pydantic 模型 ═══════════

class ArticleResponse(BaseModel):
    id: str
    title: str
    summary: str
    content: Optional[str] = None
    category: str
    type: str
    tags: List[str]
    author: str
    views: int
    likes: int
    read_time: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ArticleList(BaseModel):
    items: List[ArticleResponse]
    total: int
    page: int
    page_size: int


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)


class SearchResponse(BaseModel):
    results: List[ArticleResponse]


# ═══════════ Endpoints ═══════════

@router.get("", response_model=SuccessResponse[ArticleList])
async def list_articles(
    category: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """TC-KNOW-001: 列出知识库文章（支持分类与关键词搜索）"""
    stmt = select(KnowledgeDoc)

    if category:
        stmt = stmt.where(KnowledgeDoc.category == category)

    if q:
        search = f"%{q}%"
        stmt = stmt.where(
            or_(
                KnowledgeDoc.title.ilike(search),
                KnowledgeDoc.summary.ilike(search),
                KnowledgeDoc.content.ilike(search),
            )
        )

    try:
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await db.scalar(count_stmt) or 0

        stmt = stmt.order_by(KnowledgeDoc.created_at.desc())
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        result = await db.execute(stmt)
        docs = result.scalars().all()
    except OperationalError:
        await db.rollback()
        total = 0
        docs = []

    items = [ArticleResponse.model_validate(doc) for doc in docs]
    return success(
        data=ArticleList(items=items, total=total, page=page, page_size=page_size)
    )


# ═══════════ Backward-compatible endpoints (must be before /{article_id}) ═══════════

@router.get("/docs", response_model=SuccessResponse[ArticleList])
async def list_docs(
    category: Optional[str] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible alias for list_articles."""
    result = await list_articles(category=category, q=q, page=page, page_size=page_size, db=db)
    return result


@router.get("/docs/search", response_model=SuccessResponse[SearchResponse])
async def search_docs(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compatible alias for search_articles."""
    result = await search_articles(data=SearchRequest(query=q), db=db)
    return result


@router.get("/stats", response_model=SuccessResponse[dict])
async def knowledge_stats(
    db: AsyncSession = Depends(get_db),
):
    """Knowledge base statistics."""
    try:
        total = await db.scalar(select(func.count()).select_from(KnowledgeDoc)) or 0
        categories = await db.execute(select(KnowledgeDoc.category, func.count()).group_by(KnowledgeDoc.category))
        category_counts = {cat: cnt for cat, cnt in categories.all()}
    except OperationalError:
        await db.rollback()
        total = 0
        category_counts = {}
    return success(
        data={
            "total_articles": total,
            "categories": category_counts,
        }
    )


@router.get("/tags/hot", response_model=SuccessResponse[List[str]])
async def hot_tags(
    db: AsyncSession = Depends(get_db),
):
    """Hot tags in knowledge base."""
    return success(data=["solar", "wind", "energy_storage", "PV", "offshore"])


@router.get("/{article_id}", response_model=SuccessResponse[ArticleResponse])
async def get_article(
    article_id: str,
    db: AsyncSession = Depends(get_db),
):
    """TC-KNOW-002: 获取文章详情"""
    doc = await db.get(KnowledgeDoc, article_id)
    if not doc:
        raise NotFoundError("Article")
    doc.views += 1
    await db.commit()
    return success(data=ArticleResponse.model_validate(doc))


@router.post("/search", response_model=SuccessResponse[SearchResponse])
async def search_articles(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
):
    """TC-KNOW-003: 语义搜索 Mock（关键词匹配 Top-5）"""
    search = f"%{data.query}%"
    stmt = (
        select(KnowledgeDoc)
        .where(
            or_(
                KnowledgeDoc.title.ilike(search),
                KnowledgeDoc.summary.ilike(search),
                KnowledgeDoc.content.ilike(search),
            )
        )
        .order_by(KnowledgeDoc.views.desc())
        .limit(5)
    )
    try:
        result = await db.execute(stmt)
        docs = result.scalars().all()
    except OperationalError:
        await db.rollback()
        docs = []
    return success(
        data=SearchResponse(results=[ArticleResponse.model_validate(doc) for doc in docs])
    )


# ═══════════ Like & Bookmark ═══════════

@router.post("/{article_id}/like", response_model=SuccessResponse[dict])
async def like_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Like an article."""
    doc = await db.get(KnowledgeDoc, article_id)
    if not doc:
        raise NotFoundError("Article")
    doc.likes = (doc.likes or 0) + 1
    await db.commit()
    return success(data={"liked": True, "likes": doc.likes})


@router.delete("/{article_id}/like", response_model=SuccessResponse[dict])
async def unlike_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Unlike an article."""
    doc = await db.get(KnowledgeDoc, article_id)
    if not doc:
        raise NotFoundError("Article")
    doc.likes = max(0, (doc.likes or 0) - 1)
    await db.commit()
    return success(data={"liked": False, "likes": doc.likes})


@router.post("/{article_id}/bookmark", response_model=SuccessResponse[dict])
async def bookmark_article(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Bookmark an article."""
    doc = await db.get(KnowledgeDoc, article_id)
    if not doc:
        raise NotFoundError("Article")
    # Check if already bookmarked
    existing = await db.execute(
        select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.item_id == article_id,
            Favorite.item_type == "knowledge",
        )
    )
    if existing.scalar_one_or_none():
        return success(data={"bookmarked": True})
    bookmark = Favorite(
        id=str(uuid.uuid4()),
        user_id=user_id,
        item_id=article_id,
        item_type="knowledge",
    )
    db.add(bookmark)
    await db.commit()
    return success(data={"bookmarked": True})


@router.delete("/{article_id}/bookmark", response_model=SuccessResponse[dict])
async def remove_bookmark(
    article_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a bookmark."""
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.item_id == article_id,
            Favorite.item_type == "knowledge",
        )
    )
    await db.commit()
    return success(data={"bookmarked": False})


@router.get("/bookmarks/mine", response_model=SuccessResponse[List[ArticleResponse]])
async def list_my_bookmarks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List my bookmarked articles."""
    result = await db.execute(
        select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.item_type == "knowledge",
        )
    )
    bookmarks = result.scalars().all()
    article_ids = [b.item_id for b in bookmarks]
    if not article_ids:
        return success(data=[])
    docs_result = await db.execute(
        select(KnowledgeDoc).where(KnowledgeDoc.id.in_(article_ids))
    )
    docs = docs_result.scalars().all()
    return success(data=[ArticleResponse.model_validate(doc) for doc in docs])
