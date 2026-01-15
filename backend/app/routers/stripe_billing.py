"""
Stripe Billing Router

Handles subscription management, checkout sessions, and webhooks.
"""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models, database
from ..services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/billing",
    tags=["billing"],
)

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Price IDs (set in environment after creating in Stripe)
PRICE_IDS = {
    "monthly": os.getenv("STRIPE_PRICE_MONTHLY"),
    "annual": os.getenv("STRIPE_PRICE_ANNUAL"),
    "lifetime": os.getenv("STRIPE_PRICE_LIFETIME"),
}

TRIAL_DAYS = 7


# Pydantic models
class CreateCheckoutRequest(BaseModel):
    plan_type: str  # "monthly", "annual", "lifetime"


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionStatusResponse(BaseModel):
    status: str
    plan_type: str
    is_premium: bool
    is_trial: bool
    trial_ends_at: Optional[datetime] = None
    trial_days_left: Optional[int] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    is_lifetime: bool


class UsageStatsResponse(BaseModel):
    is_premium: bool
    expenses: dict
    incomes: dict
    loans: dict
    savings_goals: dict


# Helper functions
def get_or_create_stripe_customer(user: models.User, db: Session) -> str:
    """Get existing or create new Stripe customer."""
    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user.id
    ).first()

    if subscription and subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    # Create Stripe customer
    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": user.id}
    )

    if not subscription:
        subscription = models.Subscription(
            user_id=user.id,
            stripe_customer_id=customer.id,
            status="free",
            plan_type="free"
        )
        db.add(subscription)
    else:
        subscription.stripe_customer_id = customer.id

    db.commit()
    return customer.id


def ensure_subscription_exists(user_id: str, db: Session) -> models.Subscription:
    """Ensure user has a subscription record, create trial if not."""
    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).first()

    if not subscription:
        # New user - start trial
        now = datetime.now(timezone.utc)
        trial_end = now + timedelta(days=TRIAL_DAYS)
        subscription = models.Subscription(
            user_id=user_id,
            status="trialing",
            plan_type="trial",
            trial_start=now,
            trial_end=trial_end
        )
        db.add(subscription)
        db.commit()
        db.refresh(subscription)
        logger.info(f"Created trial subscription for user {user_id}")

    return subscription


def check_trial_expiration(subscription: models.Subscription, db: Session) -> models.Subscription:
    """Check if trial has expired and update status if needed."""
    if subscription.status == "trialing" and subscription.trial_end:
        trial_end = subscription.trial_end
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)

        if trial_end < datetime.now(timezone.utc):
            subscription.status = "free"
            subscription.plan_type = "free"
            db.commit()
            logger.info(f"Trial expired for user {subscription.user_id}")

    return subscription


# Endpoints
@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    user_id: str = Query(..., description="The user ID"),
    db: Session = Depends(database.get_db)
):
    """Get current subscription status."""
    # Ensure subscription exists (creates trial for new users)
    subscription = ensure_subscription_exists(user_id, db)

    # Check trial expiration
    subscription = check_trial_expiration(subscription, db)

    is_trial = subscription.status == "trialing"
    is_premium = SubscriptionService.is_premium(subscription)

    # Calculate trial days left
    trial_days_left = None
    if is_trial and subscription.trial_end:
        trial_end = subscription.trial_end
        if trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
        delta = trial_end - datetime.now(timezone.utc)
        trial_days_left = max(0, delta.days)

    return SubscriptionStatusResponse(
        status=subscription.status,
        plan_type=subscription.plan_type,
        is_premium=is_premium,
        is_trial=is_trial,
        trial_ends_at=subscription.trial_end,
        trial_days_left=trial_days_left,
        current_period_end=subscription.current_period_end,
        cancel_at_period_end=subscription.cancel_at_period_end,
        is_lifetime=subscription.is_lifetime
    )


@router.get("/usage", response_model=UsageStatsResponse)
async def get_usage_stats(
    user_id: str = Query(..., description="The user ID"),
    db: Session = Depends(database.get_db)
):
    """Get current usage statistics."""
    stats = SubscriptionService.get_usage_stats(user_id, db)
    return UsageStatsResponse(**stats)


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    request: CreateCheckoutRequest,
    user_id: str = Query(..., description="The user ID"),
    db: Session = Depends(database.get_db)
):
    """Create Stripe Checkout Session for subscription."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    plan_type = request.plan_type

    if plan_type not in PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid plan type")

    price_id = PRICE_IDS[plan_type]
    if not price_id:
        raise HTTPException(status_code=500, detail=f"Price ID for {plan_type} not configured")

    # Get user
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    customer_id = get_or_create_stripe_customer(user, db)

    # Determine checkout mode
    mode = "payment" if plan_type == "lifetime" else "subscription"

    session_params = {
        "customer": customer_id,
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": mode,
        "success_url": f"{FRONTEND_URL}/settings?tab=billing&success=true&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{FRONTEND_URL}/pricing?canceled=true",
        "metadata": {
            "user_id": user_id,
            "plan_type": plan_type
        },
        "locale": "pl",  # Polish locale for PLN
        "allow_promotion_codes": True,
    }

    # Add subscription-specific settings
    if mode == "subscription":
        session_params["subscription_data"] = {
            "metadata": {
                "user_id": user_id,
                "plan_type": plan_type
            }
        }

    try:
        session = stripe.checkout.Session.create(**session_params)
        logger.info(f"Created checkout session {session.id} for user {user_id}, plan {plan_type}")
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    user_id: str = Query(..., description="The user ID"),
    db: Session = Depends(database.get_db)
):
    """Create Stripe Customer Portal session."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).first()

    if not subscription or not subscription.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account found. Please subscribe first.")

    try:
        session = stripe.billing_portal.Session.create(
            customer=subscription.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/settings?tab=billing"
        )
        return PortalResponse(portal_url=session.url)
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating portal: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="Stripe-Signature"),
    db: Session = Depends(database.get_db)
):
    """Handle Stripe webhook events."""
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("Stripe webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f"Invalid webhook payload: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        logger.error(f"Invalid webhook signature: {e}")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Received Stripe webhook: {event_type}")

    # Handle different event types
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data, db)

    elif event_type == "invoice.paid":
        await handle_invoice_paid(data, db)

    elif event_type == "invoice.payment_failed":
        await handle_payment_failed(data, db)

    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data, db)

    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data, db)

    elif event_type == "customer.subscription.trial_will_end":
        await handle_trial_will_end(data, db)

    return {"status": "success"}


# Webhook handlers
async def handle_checkout_completed(session_data: dict, db: Session):
    """Handle successful checkout completion."""
    user_id = session_data.get("metadata", {}).get("user_id")
    plan_type = session_data.get("metadata", {}).get("plan_type")
    customer_id = session_data.get("customer")

    if not user_id:
        logger.error("No user_id in checkout session metadata")
        return

    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == user_id
    ).first()

    if not subscription:
        subscription = models.Subscription(user_id=user_id)
        db.add(subscription)

    subscription.stripe_customer_id = customer_id

    now = datetime.now(timezone.utc)

    # Handle lifetime purchase (one-time payment)
    if plan_type == "lifetime":
        subscription.is_lifetime = True
        subscription.lifetime_purchased_at = now
        subscription.status = "active"
        subscription.plan_type = "lifetime"
        logger.info(f"Activated lifetime subscription for user {user_id}")
    else:
        # Subscription will be updated via subscription.updated webhook
        subscription.stripe_subscription_id = session_data.get("subscription")
        subscription.status = "active"
        subscription.plan_type = plan_type
        logger.info(f"Activated {plan_type} subscription for user {user_id}")

    # Record payment
    payment = models.PaymentHistory(
        user_id=user_id,
        stripe_checkout_session_id=session_data.get("id"),
        amount=session_data.get("amount_total", 0),
        currency=session_data.get("currency", "pln"),
        status="succeeded",
        plan_type=plan_type,
        description=f"Premium {plan_type} purchase"
    )
    db.add(payment)
    db.commit()


async def handle_invoice_paid(invoice_data: dict, db: Session):
    """Handle successful invoice payment."""
    customer_id = invoice_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription:
        subscription.status = "active"

        # Record payment
        payment = models.PaymentHistory(
            user_id=subscription.user_id,
            stripe_invoice_id=invoice_data.get("id"),
            amount=invoice_data.get("amount_paid", 0),
            currency=invoice_data.get("currency", "pln"),
            status="succeeded",
            receipt_url=invoice_data.get("hosted_invoice_url")
        )
        db.add(payment)
        db.commit()
        logger.info(f"Recorded invoice payment for user {subscription.user_id}")


async def handle_payment_failed(invoice_data: dict, db: Session):
    """Handle failed payment."""
    customer_id = invoice_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription:
        subscription.status = "past_due"

        # Record failed payment
        payment = models.PaymentHistory(
            user_id=subscription.user_id,
            stripe_invoice_id=invoice_data.get("id"),
            amount=invoice_data.get("amount_due", 0),
            currency=invoice_data.get("currency", "pln"),
            status="failed",
            failure_reason=str(invoice_data.get("last_finalization_error", {}).get("message", "Unknown error"))
        )
        db.add(payment)
        db.commit()
        logger.warning(f"Payment failed for user {subscription.user_id}")


async def handle_subscription_updated(subscription_data: dict, db: Session):
    """Handle subscription status changes."""
    customer_id = subscription_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription:
        subscription.stripe_subscription_id = subscription_data.get("id")
        subscription.status = subscription_data.get("status")

        # Get price ID from items
        items = subscription_data.get("items", {}).get("data", [])
        if items:
            subscription.stripe_price_id = items[0].get("price", {}).get("id")

        # Update period dates
        current_period = subscription_data.get("current_period_start")
        if current_period:
            subscription.current_period_start = datetime.fromtimestamp(current_period, tz=timezone.utc)

        period_end = subscription_data.get("current_period_end")
        if period_end:
            subscription.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

        subscription.cancel_at_period_end = subscription_data.get("cancel_at_period_end", False)

        # Determine plan type from price
        price_id = subscription.stripe_price_id
        if price_id == PRICE_IDS.get("monthly"):
            subscription.plan_type = "monthly"
        elif price_id == PRICE_IDS.get("annual"):
            subscription.plan_type = "annual"

        db.commit()
        logger.info(f"Updated subscription for user {subscription.user_id}: {subscription.status}")


async def handle_subscription_deleted(subscription_data: dict, db: Session):
    """Handle subscription cancellation."""
    customer_id = subscription_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription and not subscription.is_lifetime:
        subscription.status = "canceled"
        subscription.canceled_at = datetime.now(timezone.utc)
        subscription.plan_type = "free"
        db.commit()
        logger.info(f"Subscription canceled for user {subscription.user_id}")


async def handle_trial_will_end(subscription_data: dict, db: Session):
    """Handle trial ending soon notification."""
    customer_id = subscription_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription:
        # Could trigger email notification here
        logger.info(f"Trial ending soon for user: {subscription.user_id}")
