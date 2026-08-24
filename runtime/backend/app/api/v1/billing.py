import stripe
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.models.database import User
from app.services.stripe_service import stripe_service
from app.core.subscription import PLAN_QUOTAS

stripe.api_key = settings.STRIPE_SECRET_KEY
router = APIRouter(prefix="/billing")


@router.get("/usage")
async def get_usage(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """返回会员权益的真实用量、剩余额度与 80%/95% 预警。"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    now = datetime.now(timezone.utc)
    usage = dict(user.usage_quota or {})
    limits = PLAN_QUOTAS.get(user.subscription_plan or "free", PLAN_QUOTAS["free"])

    def usage_item(category: str, used: int, limit: int, period: str):
        ratio = 0 if limit == -1 else used / max(limit, 1)
        level = "unlimited" if limit == -1 else "blocked" if ratio >= 1 else "critical" if ratio >= 0.95 else "warning" if ratio >= 0.8 else "normal"
        return {"category": category, "used": used, "limit": limit, "remaining": -1 if limit == -1 else max(limit - used, 0), "usage_ratio": round(ratio, 4), "warning_level": level, "period": period}

    day_key = f"daily_{now.strftime('%Y-%m-%d')}"
    month_key = f"monthly_{now.strftime('%Y-%m')}"
    return {"plan": user.subscription_plan or "free", "items": [
        usage_item("ai_queries", int(dict(usage.get("ai_calls", {})).get(day_key, 0) or 0), limits["ai_queries_per_day"], "day"),
        usage_item("report_exports", int(dict(usage.get("report_exports", {})).get(month_key, 0) or 0), limits["report_exports_per_month"], "month"),
    ]}


@router.post("/create-checkout")
async def create_checkout(
    plan: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe checkout session for subscription."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    customer_id = user.stripe_customer_id
    try:
        url = stripe_service.create_checkout_session(user_id, plan, customer_id)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events and update user plan in DB."""
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, sig)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_object = event.get("data", {}).get("object", {})
    customer_id = event_object.get("customer", "")
    metadata = event_object.get("metadata", {}) or {}
    user_id_meta = metadata.get("user_id")
    user = await db.get(User, user_id_meta) if user_id_meta else None
    if not user and customer_id:
        result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
        user = result.scalar_one_or_none()
    if not user:
        return {"status": "ok"}

    if event["type"] == "customer.subscription.created":
        new_plan = metadata.get("plan")
        if new_plan not in {"pro", "enterprise"}:
            raise HTTPException(status_code=400, detail="Invalid subscription plan metadata")
        user.plan = new_plan
        if customer_id:
            user.stripe_customer_id = customer_id
    elif event["type"] == "customer.subscription.deleted":
        user.plan = "free"
    elif event["type"] == "checkout.session.completed":
        if customer_id:
            user.stripe_customer_id = customer_id
        plan = metadata.get("plan")
        if plan in {"pro", "enterprise"}:
            user.plan = plan

    await db.commit()

    return {"status": "ok"}


@router.get("/portal")
async def customer_portal(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe billing portal session."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=409,
            detail="No billing customer exists. Complete checkout before opening the portal.",
        )
    customer_id = user.stripe_customer_id
    try:
        url = stripe_service.create_billing_portal_session(customer_id)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription")
async def get_subscription(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current subscription details from database."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.stripe_customer_id:
        try:
            subs = stripe.Subscription.list(customer=user.stripe_customer_id, limit=1)
            if subs.data:
                sub = subs.data[0]
                return {
                    "plan": user.plan,
                    "status": sub.status,
                    "current_period_end": sub.current_period_end,
                    "customer_id": user.stripe_customer_id,
                }
        except Exception:
            pass

    return {
        "plan": user.plan or "free",
        "status": "active",
        "current_period_end": None,
        "customer_id": user.stripe_customer_id,
    }


@router.get("/invoices")
async def list_invoices(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get billing invoices from Stripe."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.stripe_customer_id:
        return {"invoices": []}

    try:
        invoices = stripe.Invoice.list(customer=user.stripe_customer_id, limit=20)
        return {
            "invoices": [
                {
                    "id": inv.id,
                    "amount_paid": inv.amount_paid / 100,
                    "currency": inv.currency,
                    "status": inv.status,
                    "created": inv.created,
                    "pdf": inv.invoice_pdf,
                }
                for inv in invoices.data
            ]
        }
    except Exception:
        return {"invoices": []}
