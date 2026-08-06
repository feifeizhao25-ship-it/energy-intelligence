"""Stripe 账单路由。

stripe 为可选依赖（见 app.services.stripe_service）：库未安装或
STRIPE_SECRET_KEY 未配置时，checkout/portal/subscription/invoices 返回 503
而非 import 崩溃；webhook 验签失败返回 400。
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.models.database import User
from app.services.stripe_service import (
    StripeNotConfigured,
    _import_stripe,
    stripe_configured,
    stripe_service,
)

router = APIRouter(prefix="/billing")


class CheckoutRequest(BaseModel):
    plan: str = "pro"


def _require_billing_ready() -> None:
    if not stripe_configured():
        raise HTTPException(status_code=503, detail="Billing service is not configured")


async def _get_user_or_404(user_id: str, db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/checkout")
async def create_checkout(
    req: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create Stripe checkout session for subscription."""
    _require_billing_ready()
    user = await _get_user_or_404(user_id, db)
    try:
        url = stripe_service.create_checkout_session(
            user_id, req.plan, user.stripe_customer_id
        )
        return {"url": url}
    except StripeNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-checkout")
async def create_checkout_compat(
    req: CheckoutRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """兼容旧路径，等价于 POST /billing/checkout。"""
    return await create_checkout(req, user_id, db)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events and update user plan in DB."""
    if not stripe_configured():
        raise HTTPException(status_code=503, detail="Billing service is not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook(payload, sig)
    except StripeNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
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
        user.plan = new_plan
        await db.flush()
    elif event["type"] == "customer.subscription.deleted":
        user.plan = "free"
        await db.flush()
    elif event["type"] == "checkout.session.completed":
        # Link stripe_customer_id to user after successful checkout
        customer_id = event["data"]["object"].get("customer")
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
    _require_billing_ready()
    user = await _get_user_or_404(user_id, db)

    customer_id = user.stripe_customer_id or "cus_demo"
    try:
        url = stripe_service.create_billing_portal_session(customer_id)
        return {"url": url}
    except StripeNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/subscription")
async def get_subscription(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get current subscription details from database."""
    user = await _get_user_or_404(user_id, db)

    stripe = _import_stripe()
    if stripe is not None and stripe_configured() and user.stripe_customer_id:
        try:
            from app.services.stripe_service import _require_stripe

            stripe = _require_stripe()
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
    user = await _get_user_or_404(user_id, db)
    stripe = _import_stripe()
    if not user.stripe_customer_id or stripe is None or not stripe_configured():
        return {"invoices": []}

    try:
        from app.services.stripe_service import _require_stripe

        stripe = _require_stripe()
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
