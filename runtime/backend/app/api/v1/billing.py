import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user_id
from app.core.database import get_db
from app.models.database import User
from app.services.stripe_service import stripe_service

stripe.api_key = settings.STRIPE_SECRET_KEY
router = APIRouter(prefix="/billing")


@router.post("/create-checkout")
async def create_checkout(
    plan: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe checkout session for subscription."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    customer_id = user.stripe_customer_id if user else None
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

    customer_id = event.get("data", {}).get("object", {}).get("customer", "")
    if not customer_id:
        return {"status": "ok"}

    # Find user by stripe_customer_id
    result = await db.execute(
        select(User).where(User.stripe_customer_id == customer_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return {"status": "ok"}

    if event["type"] == "customer.subscription.created":
        new_plan = event["data"]["object"].get("metadata", {}).get("plan", "pro")
        await db.execute(
            select(User).where(User.id == user.id)
        )
        user.plan = new_plan
        await db.flush()
    elif event["type"] == "customer.subscription.deleted":
        user.plan = "free"
        await db.flush()
    elif event["type"] == "checkout.session.completed":
        # Link stripe_customer_id to user after successful checkout
        customer_id = event["data"]["object"].get("customer")
        user_id_meta = event["data"]["object"].get("metadata", {}).get("user_id")
        if customer_id and user:
            user.stripe_customer_id = customer_id
            await db.flush()
    elif event["type"] == "invoice.payment_succeeded":
        # Extend subscription period — log or update as needed
        pass

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
