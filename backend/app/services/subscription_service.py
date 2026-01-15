"""
Subscription Service

Handles feature gating and usage limits based on subscription tier.
"""

from datetime import datetime, timezone
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Subscription, Expense, Income, Loan, Saving


# Feature limits for free tier
FREE_TIER_LIMITS = {
    "expenses_per_month": 50,
    "incomes_per_month": 20,
    "max_loans": 3,
    "max_savings_goals": 3,
    "export_formats": ["json"],
    "reports": ["monthly"],
    "bank_integration": False,
    "ai_insights": False,
}

# Premium tier has no limits
PREMIUM_FEATURES = {
    "expenses_per_month": float("inf"),
    "incomes_per_month": float("inf"),
    "max_loans": float("inf"),
    "max_savings_goals": float("inf"),
    "export_formats": ["json", "csv", "xlsx"],
    "reports": ["monthly", "quarterly", "yearly", "custom"],
    "bank_integration": True,
    "ai_insights": True,
}


class SubscriptionService:
    """Service for checking subscription status and feature access."""

    @staticmethod
    def get_subscription(user_id: str, db: Session) -> Optional[Subscription]:
        """Get user's subscription record."""
        return db.query(Subscription).filter(
            Subscription.user_id == user_id
        ).first()

    @staticmethod
    def is_premium(subscription: Optional[Subscription]) -> bool:
        """Check if user has premium access."""
        if not subscription:
            return False

        # Lifetime users always have access
        if subscription.is_lifetime:
            return True

        # Active trial
        if subscription.status == "trialing":
            if subscription.trial_end:
                # Make sure trial_end is timezone-aware for comparison
                trial_end = subscription.trial_end
                if trial_end.tzinfo is None:
                    trial_end = trial_end.replace(tzinfo=timezone.utc)
                if trial_end > datetime.now(timezone.utc):
                    return True
            return False

        # Active paid subscription
        return subscription.status == "active"

    @staticmethod
    def get_feature_limits(subscription: Optional[Subscription]) -> dict:
        """Get feature limits based on subscription tier."""
        if SubscriptionService.is_premium(subscription):
            return PREMIUM_FEATURES
        return FREE_TIER_LIMITS

    @staticmethod
    def can_add_expense(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can add more expenses this month."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        # Count expenses this month
        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        count = db.query(func.count(Expense.id)).filter(
            Expense.user_id == user_id,
            Expense.created_at >= month_start
        ).scalar()

        limit = FREE_TIER_LIMITS["expenses_per_month"]
        if count >= limit:
            return False, f"Free tier limit: {limit} expenses per month. Upgrade to Premium for unlimited."

        return True, ""

    @staticmethod
    def can_add_income(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can add more income entries this month."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        count = db.query(func.count(Income.id)).filter(
            Income.user_id == user_id,
            Income.created_at >= month_start
        ).scalar()

        limit = FREE_TIER_LIMITS["incomes_per_month"]
        if count >= limit:
            return False, f"Free tier limit: {limit} income entries per month. Upgrade to Premium for unlimited."

        return True, ""

    @staticmethod
    def can_add_loan(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can add more loans."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        count = db.query(func.count(Loan.id)).filter(
            Loan.user_id == user_id
        ).scalar()

        limit = FREE_TIER_LIMITS["max_loans"]
        if count >= limit:
            return False, f"Free tier limit: {limit} loans. Upgrade to Premium for unlimited."

        return True, ""

    @staticmethod
    def can_add_savings_goal(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can add more savings goals."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        # Count unique savings categories (goals)
        count = db.query(func.count(func.distinct(Saving.category))).filter(
            Saving.user_id == user_id
        ).scalar()

        limit = FREE_TIER_LIMITS["max_savings_goals"]
        if count >= limit:
            return False, f"Free tier limit: {limit} savings goals. Upgrade to Premium for unlimited."

        return True, ""

    @staticmethod
    def can_use_bank_integration(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can use bank integration (Tink)."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        return False, "Bank integration requires Premium subscription."

    @staticmethod
    def can_use_ai_insights(user_id: str, db: Session) -> Tuple[bool, str]:
        """Check if user can use AI insights."""
        subscription = SubscriptionService.get_subscription(user_id, db)

        if SubscriptionService.is_premium(subscription):
            return True, ""

        return False, "AI Insights requires Premium subscription."

    @staticmethod
    def can_export_format(user_id: str, format: str, db: Session) -> Tuple[bool, str]:
        """Check if user can export in the specified format."""
        subscription = SubscriptionService.get_subscription(user_id, db)
        limits = SubscriptionService.get_feature_limits(subscription)

        if format.lower() in limits["export_formats"]:
            return True, ""

        return False, f"Export to {format.upper()} requires Premium subscription."

    @staticmethod
    def get_usage_stats(user_id: str, db: Session) -> dict:
        """Get current usage statistics for the user."""
        subscription = SubscriptionService.get_subscription(user_id, db)
        is_premium = SubscriptionService.is_premium(subscription)

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        expenses_count = db.query(func.count(Expense.id)).filter(
            Expense.user_id == user_id,
            Expense.created_at >= month_start
        ).scalar() or 0

        incomes_count = db.query(func.count(Income.id)).filter(
            Income.user_id == user_id,
            Income.created_at >= month_start
        ).scalar() or 0

        loans_count = db.query(func.count(Loan.id)).filter(
            Loan.user_id == user_id
        ).scalar() or 0

        savings_goals_count = db.query(func.count(func.distinct(Saving.category))).filter(
            Saving.user_id == user_id
        ).scalar() or 0

        limits = FREE_TIER_LIMITS if not is_premium else PREMIUM_FEATURES

        return {
            "is_premium": is_premium,
            "expenses": {
                "used": expenses_count,
                "limit": limits["expenses_per_month"] if not is_premium else None,
                "unlimited": is_premium,
            },
            "incomes": {
                "used": incomes_count,
                "limit": limits["incomes_per_month"] if not is_premium else None,
                "unlimited": is_premium,
            },
            "loans": {
                "used": loans_count,
                "limit": limits["max_loans"] if not is_premium else None,
                "unlimited": is_premium,
            },
            "savings_goals": {
                "used": savings_goals_count,
                "limit": limits["max_savings_goals"] if not is_premium else None,
                "unlimited": is_premium,
            },
        }
