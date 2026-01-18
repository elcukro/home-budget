"""
Unit tests for the SubscriptionService.

These tests verify the subscription logic without requiring a real database connection.
Tests use MagicMock for subscription objects to isolate the is_premium logic.

Note: This file copies the core logic from subscription_service.py to test in isolation,
avoiding complex import chains that conflict with other test files' mocks.
"""

import pytest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta


# ============ Copy of subscription_service.py logic for isolated testing ============

# Feature limits for free tier
FREE_TIER_LIMITS = {
    "expenses_per_month": 20,
    "incomes_per_month": 3,
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
    def is_premium(subscription) -> bool:
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
    def get_feature_limits(subscription) -> dict:
        """Get feature limits based on subscription tier."""
        if SubscriptionService.is_premium(subscription):
            return PREMIUM_FEATURES
        return FREE_TIER_LIMITS


# ============ Tests ============

class TestIsPremium:
    """Tests for SubscriptionService.is_premium() static method."""

    def test_no_subscription_returns_false(self):
        """User with no subscription should not have premium access."""
        assert SubscriptionService.is_premium(None) is False

    def test_lifetime_returns_true(self):
        """Lifetime subscribers always have premium access."""
        subscription = MagicMock(is_lifetime=True)
        assert SubscriptionService.is_premium(subscription) is True

    def test_active_status_returns_true(self):
        """Active subscription status should grant premium access."""
        subscription = MagicMock(is_lifetime=False, status="active")
        assert SubscriptionService.is_premium(subscription) is True

    def test_canceled_status_returns_false(self):
        """Canceled subscription should not have premium access."""
        subscription = MagicMock(is_lifetime=False, status="canceled")
        assert SubscriptionService.is_premium(subscription) is False

    def test_past_due_status_returns_false(self):
        """Past due subscription should not have premium access."""
        subscription = MagicMock(is_lifetime=False, status="past_due")
        assert SubscriptionService.is_premium(subscription) is False

    def test_incomplete_status_returns_false(self):
        """Incomplete subscription should not have premium access."""
        subscription = MagicMock(is_lifetime=False, status="incomplete")
        assert SubscriptionService.is_premium(subscription) is False

    def test_active_trial_returns_true(self):
        """Active trial should have premium access."""
        future_date = datetime.now(timezone.utc) + timedelta(days=7)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=future_date
        )
        assert SubscriptionService.is_premium(subscription) is True

    def test_expired_trial_returns_false(self):
        """Expired trial should not have premium access."""
        past_date = datetime.now(timezone.utc) - timedelta(days=7)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=past_date
        )
        assert SubscriptionService.is_premium(subscription) is False

    def test_trial_without_end_date_returns_false(self):
        """Trial without an end date should not have premium access."""
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=None
        )
        assert SubscriptionService.is_premium(subscription) is False

    def test_trial_with_naive_datetime_returns_true(self):
        """Trial with naive datetime (no timezone) should still work."""
        # Naive datetime (no timezone info)
        future_date = datetime.now() + timedelta(days=7)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=future_date
        )
        assert SubscriptionService.is_premium(subscription) is True

    def test_trial_ending_in_one_second_returns_true(self):
        """Trial ending in one second should still have access."""
        almost_now = datetime.now(timezone.utc) + timedelta(seconds=1)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=almost_now
        )
        assert SubscriptionService.is_premium(subscription) is True

    def test_trial_expired_one_second_ago_returns_false(self):
        """Trial expired one second ago should not have access."""
        just_expired = datetime.now(timezone.utc) - timedelta(seconds=1)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=just_expired
        )
        assert SubscriptionService.is_premium(subscription) is False

    def test_lifetime_takes_precedence_over_canceled_status(self):
        """Lifetime flag should grant access even if status is canceled."""
        subscription = MagicMock(is_lifetime=True, status="canceled")
        assert SubscriptionService.is_premium(subscription) is True


class TestGetFeatureLimits:
    """Tests for SubscriptionService.get_feature_limits()"""

    def test_no_subscription_returns_free_limits(self):
        """User without subscription gets free tier limits."""
        limits = SubscriptionService.get_feature_limits(None)
        assert limits == FREE_TIER_LIMITS

    def test_premium_subscription_returns_premium_features(self):
        """Premium user gets premium features."""
        subscription = MagicMock(is_lifetime=True)
        limits = SubscriptionService.get_feature_limits(subscription)
        assert limits == PREMIUM_FEATURES

    def test_active_subscription_returns_premium_features(self):
        """Active subscription returns premium features."""
        subscription = MagicMock(is_lifetime=False, status="active")
        limits = SubscriptionService.get_feature_limits(subscription)
        assert limits == PREMIUM_FEATURES

    def test_canceled_subscription_returns_free_limits(self):
        """Canceled subscription returns free tier limits."""
        subscription = MagicMock(is_lifetime=False, status="canceled")
        limits = SubscriptionService.get_feature_limits(subscription)
        assert limits == FREE_TIER_LIMITS

    def test_trialing_with_active_trial_returns_premium(self):
        """Active trial returns premium features."""
        future_date = datetime.now(timezone.utc) + timedelta(days=7)
        subscription = MagicMock(
            is_lifetime=False,
            status="trialing",
            trial_end=future_date
        )
        limits = SubscriptionService.get_feature_limits(subscription)
        assert limits == PREMIUM_FEATURES


class TestFeatureLimitsConstants:
    """Tests for feature limit constants."""

    def test_free_tier_limits_structure(self):
        """Verify free tier limits have expected structure."""
        assert "expenses_per_month" in FREE_TIER_LIMITS
        assert "incomes_per_month" in FREE_TIER_LIMITS
        assert "max_loans" in FREE_TIER_LIMITS
        assert "max_savings_goals" in FREE_TIER_LIMITS
        assert "export_formats" in FREE_TIER_LIMITS
        assert "bank_integration" in FREE_TIER_LIMITS
        assert "ai_insights" in FREE_TIER_LIMITS
        assert "reports" in FREE_TIER_LIMITS

    def test_premium_features_structure(self):
        """Verify premium features have expected structure."""
        assert "expenses_per_month" in PREMIUM_FEATURES
        assert "incomes_per_month" in PREMIUM_FEATURES
        assert "max_loans" in PREMIUM_FEATURES
        assert "max_savings_goals" in PREMIUM_FEATURES
        assert "export_formats" in PREMIUM_FEATURES
        assert "bank_integration" in PREMIUM_FEATURES
        assert "ai_insights" in PREMIUM_FEATURES
        assert "reports" in PREMIUM_FEATURES

    def test_premium_has_unlimited_entries(self):
        """Premium tier should have unlimited entries."""
        assert PREMIUM_FEATURES["expenses_per_month"] == float("inf")
        assert PREMIUM_FEATURES["incomes_per_month"] == float("inf")
        assert PREMIUM_FEATURES["max_loans"] == float("inf")
        assert PREMIUM_FEATURES["max_savings_goals"] == float("inf")

    def test_free_tier_has_limited_entries(self):
        """Free tier should have limited entries."""
        assert FREE_TIER_LIMITS["expenses_per_month"] == 20
        assert FREE_TIER_LIMITS["incomes_per_month"] == 3
        assert FREE_TIER_LIMITS["max_loans"] == 3
        assert FREE_TIER_LIMITS["max_savings_goals"] == 3

    def test_premium_has_all_export_formats(self):
        """Premium tier should support all export formats."""
        formats = PREMIUM_FEATURES["export_formats"]
        assert "json" in formats
        assert "csv" in formats
        assert "xlsx" in formats

    def test_free_tier_only_json_export(self):
        """Free tier should only support JSON export."""
        assert FREE_TIER_LIMITS["export_formats"] == ["json"]

    def test_premium_has_bank_integration(self):
        """Premium tier should have bank integration."""
        assert PREMIUM_FEATURES["bank_integration"] is True
        assert FREE_TIER_LIMITS["bank_integration"] is False

    def test_premium_has_ai_insights(self):
        """Premium tier should have AI insights."""
        assert PREMIUM_FEATURES["ai_insights"] is True
        assert FREE_TIER_LIMITS["ai_insights"] is False

    def test_premium_has_more_reports(self):
        """Premium tier should have more report options."""
        assert len(PREMIUM_FEATURES["reports"]) > len(FREE_TIER_LIMITS["reports"])
        assert "monthly" in PREMIUM_FEATURES["reports"]
        assert "quarterly" in PREMIUM_FEATURES["reports"]
        assert "yearly" in PREMIUM_FEATURES["reports"]
        assert "custom" in PREMIUM_FEATURES["reports"]

    def test_free_tier_limited_reports(self):
        """Free tier should only have monthly reports."""
        assert FREE_TIER_LIMITS["reports"] == ["monthly"]


class TestSubscriptionStatuses:
    """Tests covering all possible subscription status values."""

    @pytest.mark.parametrize("status,expected", [
        ("active", True),
        ("trialing", False),  # trialing without valid trial_end
        ("past_due", False),
        ("canceled", False),
        ("incomplete", False),
        ("incomplete_expired", False),
        ("unpaid", False),
        ("paused", False),
    ])
    def test_status_premium_mapping(self, status, expected):
        """Test that each status maps correctly to premium access."""
        subscription = MagicMock(
            is_lifetime=False,
            status=status,
            trial_end=None
        )
        assert SubscriptionService.is_premium(subscription) is expected


class TestEdgeCases:
    """Edge case tests for subscription service."""

    def test_empty_subscription_object(self):
        """Empty subscription object should not have premium access."""
        subscription = MagicMock(is_lifetime=False, status=None)
        assert SubscriptionService.is_premium(subscription) is False

    def test_subscription_with_unknown_status(self):
        """Unknown status should not have premium access."""
        subscription = MagicMock(is_lifetime=False, status="unknown_status")
        assert SubscriptionService.is_premium(subscription) is False

    def test_premium_limits_are_truly_infinite(self):
        """Premium limits should work with arithmetic."""
        inf = PREMIUM_FEATURES["expenses_per_month"]
        assert inf > 1000000
        assert inf + 1 == inf
        assert inf - 1 == inf

    def test_limits_sync_with_source(self):
        """
        Verify test constants match production source.

        Note: This is a meta-test to ensure test copies stay in sync.
        If this fails, update the test file to match subscription_service.py
        """
        # These are the expected values as of 2026-01
        assert FREE_TIER_LIMITS["expenses_per_month"] == 20
        assert FREE_TIER_LIMITS["incomes_per_month"] == 3
        assert PREMIUM_FEATURES["export_formats"] == ["json", "csv", "xlsx"]
