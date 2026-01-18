"""
Unit tests for the SubscriptionService.

These tests verify the subscription logic without requiring a real database connection.
Tests use MagicMock for isolated unit tests and db_session fixtures for integration tests.
"""
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta

# Import the conftest models
from tests.conftest import Subscription


class TestIsPremium:
    """Tests for SubscriptionService.is_premium() using mocks."""

    def test_no_subscription_returns_false(self):
        """User with no subscription should not have premium access."""
        # Import the service with mocked dependencies
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            assert SubscriptionService.is_premium(None) is False

    def test_lifetime_returns_true(self):
        """Lifetime subscribers always have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            subscription = MagicMock(is_lifetime=True)
            assert SubscriptionService.is_premium(subscription) is True

    def test_active_status_returns_true(self):
        """Active subscription status should grant premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            subscription = MagicMock(is_lifetime=False, status="active")
            assert SubscriptionService.is_premium(subscription) is True

    def test_canceled_status_returns_false(self):
        """Canceled subscription should not have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            subscription = MagicMock(is_lifetime=False, status="canceled")
            assert SubscriptionService.is_premium(subscription) is False

    def test_past_due_status_returns_false(self):
        """Past due subscription should not have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            subscription = MagicMock(is_lifetime=False, status="past_due")
            assert SubscriptionService.is_premium(subscription) is False

    def test_active_trial_returns_true(self):
        """Active trial should have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            future_date = datetime.now(timezone.utc) + timedelta(days=7)
            subscription = MagicMock(
                is_lifetime=False,
                status="trialing",
                trial_end=future_date
            )
            assert SubscriptionService.is_premium(subscription) is True

    def test_expired_trial_returns_false(self):
        """Expired trial should not have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            past_date = datetime.now(timezone.utc) - timedelta(days=7)
            subscription = MagicMock(
                is_lifetime=False,
                status="trialing",
                trial_end=past_date
            )
            assert SubscriptionService.is_premium(subscription) is False

    def test_trial_without_end_date_returns_false(self):
        """Trial without an end date should not have premium access."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            subscription = MagicMock(
                is_lifetime=False,
                status="trialing",
                trial_end=None
            )
            assert SubscriptionService.is_premium(subscription) is False

    def test_trial_with_naive_datetime_returns_true(self):
        """Trial with naive datetime (no timezone) should still work."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import SubscriptionService
            # Naive datetime (no timezone info)
            future_date = datetime.now() + timedelta(days=7)
            subscription = MagicMock(
                is_lifetime=False,
                status="trialing",
                trial_end=future_date
            )
            assert SubscriptionService.is_premium(subscription) is True


class TestGetFeatureLimits:
    """Tests for SubscriptionService.get_feature_limits()"""

    def test_no_subscription_returns_free_limits(self):
        """User without subscription gets free tier limits."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import (
                SubscriptionService,
                FREE_TIER_LIMITS
            )
            limits = SubscriptionService.get_feature_limits(None)
            assert limits == FREE_TIER_LIMITS

    def test_premium_subscription_returns_premium_features(self):
        """Premium user gets premium features."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import (
                SubscriptionService,
                PREMIUM_FEATURES
            )
            subscription = MagicMock(is_lifetime=True)
            limits = SubscriptionService.get_feature_limits(subscription)
            assert limits == PREMIUM_FEATURES


class TestFeatureLimitsConstants:
    """Tests for feature limit constants."""

    def test_free_tier_limits_structure(self):
        """Verify free tier limits have expected structure."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import FREE_TIER_LIMITS
            assert "expenses_per_month" in FREE_TIER_LIMITS
            assert "incomes_per_month" in FREE_TIER_LIMITS
            assert "max_loans" in FREE_TIER_LIMITS
            assert "max_savings_goals" in FREE_TIER_LIMITS
            assert "export_formats" in FREE_TIER_LIMITS
            assert "bank_integration" in FREE_TIER_LIMITS
            assert "ai_insights" in FREE_TIER_LIMITS

    def test_premium_has_unlimited_entries(self):
        """Premium tier should have unlimited entries."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import PREMIUM_FEATURES
            assert PREMIUM_FEATURES["expenses_per_month"] == float("inf")
            assert PREMIUM_FEATURES["incomes_per_month"] == float("inf")
            assert PREMIUM_FEATURES["max_loans"] == float("inf")
            assert PREMIUM_FEATURES["max_savings_goals"] == float("inf")

    def test_premium_has_all_export_formats(self):
        """Premium tier should support all export formats."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import PREMIUM_FEATURES
            assert "json" in PREMIUM_FEATURES["export_formats"]
            assert "csv" in PREMIUM_FEATURES["export_formats"]
            assert "xlsx" in PREMIUM_FEATURES["export_formats"]

    def test_free_tier_only_json_export(self):
        """Free tier should only support JSON export."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import FREE_TIER_LIMITS
            assert FREE_TIER_LIMITS["export_formats"] == ["json"]

    def test_premium_has_bank_integration(self):
        """Premium tier should have bank integration."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import (
                PREMIUM_FEATURES,
                FREE_TIER_LIMITS
            )
            assert PREMIUM_FEATURES["bank_integration"] is True
            assert FREE_TIER_LIMITS["bank_integration"] is False

    def test_premium_has_ai_insights(self):
        """Premium tier should have AI insights."""
        with patch.dict('sys.modules', {
            'app.models': MagicMock(),
            'app.database': MagicMock()
        }):
            from app.services.subscription_service import (
                PREMIUM_FEATURES,
                FREE_TIER_LIMITS
            )
            assert PREMIUM_FEATURES["ai_insights"] is True
            assert FREE_TIER_LIMITS["ai_insights"] is False
