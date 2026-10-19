"""Local worker task; requires worker and beat processes in the deployment."""
import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from app.config import settings
from app.services.subscription_downgrades import process_due_downgrades
from app.tasks.celery_app import celery_app


async def run_due_downgrades():
    # Create and dispose within the same loop; do not reuse the web app's pool.
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            async with db.begin():
                return await process_due_downgrades(db)
    finally:
        await engine.dispose()


@celery_app.task(name="energy.subscriptions.apply_due_downgrades")
def apply_due_downgrades():
    return asyncio.run(run_due_downgrades())
