from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession
router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])
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
    try:
        result = await db.execute(stmt)
        docs = result.scalars().all()
    except OperationalError:
        await db.rollback()
        docs = []
