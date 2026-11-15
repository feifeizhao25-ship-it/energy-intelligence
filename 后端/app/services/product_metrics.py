"""Server-side product analytics emission (fire-and-forget).

Complements the authenticated client ingest endpoint
(/api/v1/analytics/events) for lifecycle facts the frontend does not
report today: user_signed_up, report_generated. Emission opens its own
DB session and must never fail or slow down the calling request path.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


async def emit_product_event(
    user_id: str,
    event_name: str,
    *,
    channel: Optional[str] = None,
    campaign: Optional[str] = None,
    experiment: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
    locale: str = "en-US",
) -> bool:
    """Persist one ProductEvent in its own session. Never raises.

    Returns True when the event row was committed.
    """
    try:
        from app.database import AsyncSessionLocal
        from app.models.product_event import ProductEvent
        from app.models.user import User

        async with AsyncSessionLocal() as session:
            user = await session.get(User, str(user_id))
            market = (getattr(user, "market", None) or "global")[:10]
            event = ProductEvent(
                event_id=str(uuid.uuid4()),
                user_id=str(user_id),
                workspace_id=None,
                event_name=event_name,
                market=market,
                locale=(locale or "en-US")[:20],
                channel=channel,
                campaign=campaign,
                experiment=experiment,
                properties=properties or {},
                occurred_at=datetime.now(timezone.utc),
            )
            session.add(event)
            await session.commit()
        return True
    except Exception:
        logger.warning("product event emission failed: %s", event_name, exc_info=True)
        return False
