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
from ..services.email_service import (
    send_payment_confirmation_email,
    send_trial_ending_email,
    send_trial_ended_email,
    send_subscription_canceled_email,
    send_payment_failed_email,
)
from ..dependencies import get_current_user

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


def validate_user_id_format(user_id: str) -> bool:
    """
    Validate user_id format for security.
    User IDs should be valid email addresses in this system.
    """
    import re
    if not user_id or len(user_id) > 255:
        return False
    # Basic email format validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, user_id))


def get_user_or_none(user_id: str, db: Session) -> Optional[models.User]:
    """
    Get user by ID, returning None if not found.
    SECURITY: Does NOT auto-create users. Webhooks should not create users.
    """
    if not validate_user_id_format(user_id):
        logger.warning(f"Invalid user_id format received: {user_id[:50]}...")
        return None

    user = db.query(models.User).filter(models.User.id == user_id).first()
    return user


def ensure_user_exists(user_id: str, db: Session) -> Optional[models.User]:
    """
    Get user if exists in database.

    SECURITY CHANGE: No longer auto-creates users from webhooks.
    Users must be created through proper authentication flows.
    """
    if not validate_user_id_format(user_id):
        logger.warning(f"Invalid user_id format: {user_id[:50]}...")
        return None

    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        logger.warning(f"User not found for webhook: {user_id}")
        return None

    return user


def ensure_subscription_exists(user_id: str, db: Session) -> Optional[models.Subscription]:
    """
    Ensure user has a subscription record, create trial if not.
    Returns None if user doesn't exist (user must be created through auth flow).
    """
    # First check if user exists (foreign key requirement)
    user = ensure_user_exists(user_id, db)
    if not user:
        logger.warning(f"Cannot create subscription - user doesn't exist: {user_id}")
        return None

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

            # Send trial ended email (prevent duplicates)
            try:
                user = db.query(models.User).filter(models.User.id == subscription.user_id).first()
                if user and user.email and not user.trial_ended_email_sent_at:
                    if send_trial_ended_email(user.email, user.name):
                        user.trial_ended_email_sent_at = datetime.now(timezone.utc)
                        db.commit()
                        logger.info(f"Trial ended email sent to user {subscription.user_id}")
            except Exception as e:
                # Don't fail if email fails
                logger.error(f"Failed to send trial ended email: {e}")

    return subscription


# Endpoints
@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_subscription_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get current subscription status."""
    # Ensure subscription exists (creates trial for new users)
    # User is already authenticated via dependency, so this should always work
    subscription = ensure_subscription_exists(current_user.household_id, db)

    if not subscription:
        # This shouldn't happen since user is authenticated, but handle gracefully
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve subscription status"
        )

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
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Get current usage statistics."""
    stats = SubscriptionService.get_usage_stats(current_user.household_id, db)
    return UsageStatsResponse(**stats)


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout_session(
    request: CreateCheckoutRequest,
    current_user: models.User = Depends(get_current_user),
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

    customer_id = get_or_create_stripe_customer(current_user, db)

    # Determine checkout mode
    mode = "payment" if plan_type == "lifetime" else "subscription"

    session_params = {
        "customer": customer_id,
        "line_items": [{"price": price_id, "quantity": 1}],
        "mode": mode,
        "success_url": f"{FRONTEND_URL}/onboarding?from=payment&session_id={{CHECKOUT_SESSION_ID}}",
        "cancel_url": f"{FRONTEND_URL}/#pricing",
        "metadata": {
            "user_id": current_user.id,
            "plan_type": plan_type
        },
        "locale": "pl",  # Polish locale for PLN
        "allow_promotion_codes": True,
    }

    # Add subscription-specific settings
    if mode == "subscription":
        session_params["subscription_data"] = {
            "metadata": {
                "user_id": current_user.id,
                "plan_type": plan_type
            }
        }

    try:
        session = stripe.checkout.Session.create(**session_params)
        logger.info(f"Created checkout session {session.id} for user {current_user.id}, plan {plan_type}")
        return CheckoutResponse(
            checkout_url=session.url,
            session_id=session.id
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating checkout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portal", response_model=PortalResponse)
async def create_portal_session(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    """Create Stripe Customer Portal session."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.user_id == current_user.household_id
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
    """
    Handle Stripe webhook events.

    SECURITY:
    - Verifies webhook signature to ensure authenticity
    - Uses idempotency check to prevent duplicate processing
    - Validates user_id format in metadata before use
    """
    if not STRIPE_WEBHOOK_SECRET:
        logger.error("Stripe webhook secret not configured")
        raise HTTPException(status_code=500, detail="Webhook configuration error")

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        logger.error("Invalid webhook payload")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid webhook signature")
        raise HTTPException(status_code=400, detail="Invalid signature")

    event_id = event.get("id")
    event_type = event["type"]
    data = event["data"]["object"]

    # SECURITY: Idempotency check - prevent duplicate processing
    from ..security import WebhookIdempotency
    if WebhookIdempotency.is_processed(db, event_id, "stripe"):
        logger.info(f"Stripe webhook already processed: {event_id}")
        return {"status": "success", "message": "already processed"}

    logger.info(f"Processing Stripe webhook: {event_type} (event_id: {event_id})")

    try:
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

        # Mark event as processed after successful handling
        WebhookIdempotency.mark_processed(db, event_id, "stripe", event_type)

    except Exception as e:
        # Log error but don't mark as processed (allow retry)
        logger.error(f"Error processing webhook {event_id}: {e}")
        raise HTTPException(status_code=500, detail="Webhook processing error")

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

    # SECURITY: Validate user_id format
    if not validate_user_id_format(user_id):
        logger.error(f"Invalid user_id format in checkout metadata: {user_id[:50]}...")
        return

    # SECURITY: User must already exist (created during auth flow)
    user = get_user_or_none(user_id, db)
    if not user:
        logger.error(f"User not found for checkout completion: {user_id}")
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
    amount_total = session_data.get("amount_total", 0)
    payment = models.PaymentHistory(
        user_id=user_id,
        stripe_checkout_session_id=session_data.get("id"),
        amount=amount_total,
        currency=session_data.get("currency", "pln"),
        status="succeeded",
        plan_type=plan_type,
        description=f"Premium {plan_type} purchase"
    )
    db.add(payment)
    db.commit()

    # Send payment confirmation email
    try:
        # Get invoice URL if available (for recurring subscriptions)
        receipt_url = None
        if session_data.get("invoice"):
            try:
                invoice = stripe.Invoice.retrieve(session_data.get("invoice"))
                receipt_url = invoice.get("hosted_invoice_url")
            except Exception as e:
                logger.warning(f"Could not retrieve invoice for receipt URL: {e}")

        send_payment_confirmation_email(
            to_email=user.email,
            user_name=user.name,
            plan_type=plan_type,
            amount_grosze=amount_total,
            receipt_url=receipt_url,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
        )
    except Exception as e:
        # Don't fail the webhook if email fails
        logger.error(f"Failed to send payment confirmation email: {e}")


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

        failure_reason = str(invoice_data.get("last_finalization_error", {}).get("message", "Unknown error"))

        # Record failed payment
        payment = models.PaymentHistory(
            user_id=subscription.user_id,
            stripe_invoice_id=invoice_data.get("id"),
            amount=invoice_data.get("amount_due", 0),
            currency=invoice_data.get("currency", "pln"),
            status="failed",
            failure_reason=failure_reason
        )
        db.add(payment)
        db.commit()
        logger.warning(f"Payment failed for user {subscription.user_id}")

        # Send payment failed email
        try:
            user = db.query(models.User).filter(models.User.id == subscription.user_id).first()
            if user and user.email:
                send_payment_failed_email(
                    to_email=user.email,
                    user_name=user.name,
                    failure_reason=failure_reason,
                )
        except Exception as e:
            logger.error(f"Failed to send payment failed email: {e}")


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
        canceled_at = datetime.now(timezone.utc)
        subscription.status = "canceled"
        subscription.canceled_at = canceled_at
        subscription.plan_type = "free"
        db.commit()
        logger.info(f"Subscription canceled for user {subscription.user_id}")

        # Send subscription canceled email
        try:
            user = db.query(models.User).filter(models.User.id == subscription.user_id).first()
            if user and user.email:
                send_subscription_canceled_email(
                    to_email=user.email,
                    user_name=user.name,
                    cancel_date=canceled_at,
                )
        except Exception as e:
            logger.error(f"Failed to send subscription canceled email: {e}")


async def handle_trial_will_end(subscription_data: dict, db: Session):
    """Handle trial ending soon notification."""
    customer_id = subscription_data.get("customer")

    subscription = db.query(models.Subscription).filter(
        models.Subscription.stripe_customer_id == customer_id
    ).first()

    if subscription:
        logger.info(f"Trial ending soon for user: {subscription.user_id}")

        # Send trial ending email (prevent duplicates)
        try:
            user = db.query(models.User).filter(models.User.id == subscription.user_id).first()
            if user and user.email and not user.trial_ending_email_sent_at:
                # Calculate days left
                trial_days_left = 3  # Default from Stripe's trial_will_end event (sent 3 days before)
                trial_end_date = subscription.trial_end

                if trial_end_date:
                    if trial_end_date.tzinfo is None:
                        trial_end_date = trial_end_date.replace(tzinfo=timezone.utc)
                    delta = trial_end_date - datetime.now(timezone.utc)
                    trial_days_left = max(0, delta.days)

                if send_trial_ending_email(
                    to_email=user.email,
                    user_name=user.name,
                    trial_days_left=trial_days_left,
                    trial_end_date=trial_end_date,
                ):
                    user.trial_ending_email_sent_at = datetime.now(timezone.utc)
                    db.commit()
                    logger.info(f"Trial ending email sent to user {subscription.user_id}")
        except Exception as e:
            logger.error(f"Failed to send trial ending email: {e}")
