"""
Unit tests for TinkMetricsService class.

Tests cover:
1. Error classification
2. Metrics recording
3. Alert deduplication
4. Health status generation
5. Analytics queries
"""

import pytest
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
import sys
import os

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["NEXTAUTH_SECRET"] = "test-signing-key-for-tests"
os.environ["TINK_CLIENT_ID"] = "test-client-id"
os.environ["TINK_CLIENT_SECRET"] = "test-client-secret"
os.environ["TESTING"] = "true"

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

# Mock sentry_sdk before importing the module
mock_sentry = MagicMock()
sys.modules['sentry_sdk'] = mock_sentry

from app.services.tink_metrics_service import (
    TinkMetricsService,
    TinkAnalyticsService,
    TinkErrorType,
    classify_error,
    APICallMetric,
    MetricsWindow,
    AlertDeduplicator,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def metrics_service():
    """Create a fresh TinkMetricsService instance for testing."""
    service = TinkMetricsService()
    # Reset internal state
    service._current_window = None
    service._consecutive_failures.clear()
    service._last_successful_call = None
    service._deduplicator.clear()
    return service


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return MagicMock()


# =============================================================================
# Error Classification Tests
# =============================================================================

class TestErrorClassification:
    """Tests for error classification logic."""

    def test_classify_auth_errors(self):
        """Test that 401/403 are classified as auth errors."""
        assert classify_error(401) == TinkErrorType.AUTH
        assert classify_error(403) == TinkErrorType.AUTH

    def test_classify_rate_limit_errors(self):
        """Test that 429 is classified as rate_limit."""
        assert classify_error(429) == TinkErrorType.RATE_LIMIT

    def test_classify_server_errors(self):
        """Test that 5xx are classified as server errors."""
        assert classify_error(500) == TinkErrorType.SERVER
        assert classify_error(502) == TinkErrorType.SERVER
        assert classify_error(503) == TinkErrorType.SERVER
        assert classify_error(504) == TinkErrorType.SERVER

    def test_classify_client_errors(self):
        """Test that other 4xx are classified as client errors."""
        assert classify_error(400) == TinkErrorType.CLIENT
        assert classify_error(404) == TinkErrorType.CLIENT
        assert classify_error(422) == TinkErrorType.CLIENT

    def test_classify_network_errors_from_exception(self):
        """Test that network exceptions are classified correctly."""
        import httpx

        timeout_exception = httpx.TimeoutException("timeout")
        connect_exception = httpx.ConnectError("connection failed")

        assert classify_error(None, timeout_exception) == TinkErrorType.NETWORK
        assert classify_error(None, connect_exception) == TinkErrorType.NETWORK

    def test_classify_unknown_errors(self):
        """Test that unknown errors return unknown type."""
        assert classify_error(None) == TinkErrorType.UNKNOWN
        assert classify_error(None, Exception("generic error")) == TinkErrorType.UNKNOWN


# =============================================================================
# Metrics Window Tests
# =============================================================================

class TestMetricsWindow:
    """Tests for MetricsWindow class."""

    def test_add_metric_increments_counts(self):
        """Test that adding metrics increments counters."""
        window = MetricsWindow(window_start=datetime.utcnow())

        metric = APICallMetric(
            endpoint="/test",
            method="GET",
            status_code=200,
            duration_ms=100,
            success=True,
        )
        window.add_metric(metric)

        assert window.total_calls == 1
        assert window.successful_calls == 1
        assert window.failed_calls == 0

    def test_add_failed_metric_increments_error_counts(self):
        """Test that failed metrics update error counters."""
        window = MetricsWindow(window_start=datetime.utcnow())

        metric = APICallMetric(
            endpoint="/test",
            method="GET",
            status_code=429,
            duration_ms=100,
            success=False,
            error_type=TinkErrorType.RATE_LIMIT,
        )
        window.add_metric(metric)

        assert window.total_calls == 1
        assert window.successful_calls == 0
        assert window.failed_calls == 1
        assert window.errors_by_type[TinkErrorType.RATE_LIMIT] == 1
        assert window.rate_limit_count == 1

    def test_error_rate_calculation(self):
        """Test error rate percentage calculation."""
        window = MetricsWindow(window_start=datetime.utcnow())

        # Add 7 successful and 3 failed
        for _ in range(7):
            window.add_metric(APICallMetric(
                endpoint="/test", method="GET", status_code=200,
                duration_ms=100, success=True
            ))
        for _ in range(3):
            window.add_metric(APICallMetric(
                endpoint="/test", method="GET", status_code=500,
                duration_ms=100, success=False, error_type=TinkErrorType.SERVER
            ))

        assert window.error_rate == pytest.approx(30.0)

    def test_latency_percentiles(self):
        """Test latency percentile calculations."""
        window = MetricsWindow(window_start=datetime.utcnow())

        # Add metrics with predictable latencies
        latencies = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
        for lat in latencies:
            window.add_metric(APICallMetric(
                endpoint="/test", method="GET", status_code=200,
                duration_ms=lat, success=True
            ))

        # P50 should be around 500-550 (median)
        assert 450 <= window.p50_latency <= 600

        # P95 should be around 950
        assert 850 <= window.p95_latency <= 1000

    def test_avg_latency(self):
        """Test average latency calculation."""
        window = MetricsWindow(window_start=datetime.utcnow())

        window.add_metric(APICallMetric(
            endpoint="/test", method="GET", status_code=200,
            duration_ms=100, success=True
        ))
        window.add_metric(APICallMetric(
            endpoint="/test", method="GET", status_code=200,
            duration_ms=200, success=True
        ))
        window.add_metric(APICallMetric(
            endpoint="/test", method="GET", status_code=200,
            duration_ms=300, success=True
        ))

        assert window.avg_latency == pytest.approx(200.0)

    def test_empty_window_returns_zero_rates(self):
        """Test that empty window returns zero for calculated metrics."""
        window = MetricsWindow(window_start=datetime.utcnow())

        assert window.error_rate == 0.0
        assert window.avg_latency == 0.0
        assert window.p50_latency == 0.0
        assert window.p95_latency == 0.0


# =============================================================================
# Alert Deduplication Tests
# =============================================================================

class TestAlertDeduplication:
    """Tests for AlertDeduplicator class."""

    def test_first_alert_always_fires(self):
        """Test that first alert for a key always fires."""
        deduplicator = AlertDeduplicator(window_minutes=15)

        assert deduplicator.should_alert("test_alert") is True

    def test_duplicate_alert_is_blocked(self):
        """Test that same alert within window is blocked."""
        deduplicator = AlertDeduplicator(window_minutes=15)

        assert deduplicator.should_alert("test_alert") is True
        assert deduplicator.should_alert("test_alert") is False
        assert deduplicator.should_alert("test_alert") is False

    def test_different_alert_keys_independent(self):
        """Test that different alert keys are independent."""
        deduplicator = AlertDeduplicator(window_minutes=15)

        assert deduplicator.should_alert("alert_a") is True
        assert deduplicator.should_alert("alert_b") is True
        assert deduplicator.should_alert("alert_a") is False
        assert deduplicator.should_alert("alert_b") is False

    def test_alert_fires_after_window_expires(self):
        """Test that alert fires again after window expires."""
        # Use very short window for testing
        deduplicator = AlertDeduplicator(window_minutes=0)  # Immediate expiry

        assert deduplicator.should_alert("test_alert") is True

        # Wait a tiny bit
        time.sleep(0.01)

        # Should fire again because window is 0 minutes
        assert deduplicator.should_alert("test_alert") is True

    def test_clear_resets_state(self):
        """Test that clear() resets deduplication state."""
        deduplicator = AlertDeduplicator(window_minutes=15)

        deduplicator.should_alert("alert_a")
        deduplicator.should_alert("alert_b")

        deduplicator.clear()

        # Should both fire again
        assert deduplicator.should_alert("alert_a") is True
        assert deduplicator.should_alert("alert_b") is True


# =============================================================================
# TinkMetricsService Tests
# =============================================================================

class TestTinkMetricsService:
    """Tests for TinkMetricsService class."""

    def test_record_api_call_success(self, metrics_service):
        """Test recording a successful API call."""
        metrics_service.record_api_call(
            endpoint="/test",
            method="GET",
            status_code=200,
            duration_ms=150,
            success=True,
        )

        metrics = metrics_service.get_current_metrics()

        assert metrics["total_calls"] == 1
        assert metrics["successful_calls"] == 1
        assert metrics["failed_calls"] == 0

    def test_record_api_call_failure(self, metrics_service):
        """Test recording a failed API call."""
        with patch('app.services.tink_metrics_service.sentry_sdk'):
            metrics_service.record_api_call(
                endpoint="/test",
                method="GET",
                status_code=500,
                duration_ms=150,
                success=False,
            )

        metrics = metrics_service.get_current_metrics()

        assert metrics["total_calls"] == 1
        assert metrics["successful_calls"] == 0
        assert metrics["failed_calls"] == 1
        assert metrics["errors_by_type"]["server"] == 1

    def test_record_api_call_tracks_last_successful(self, metrics_service):
        """Test that last successful call is tracked."""
        assert metrics_service._last_successful_call is None

        metrics_service.record_api_call(
            endpoint="/test",
            method="GET",
            status_code=200,
            duration_ms=100,
            success=True,
        )

        assert metrics_service._last_successful_call is not None

    def test_record_api_call_tracks_consecutive_failures(self, metrics_service):
        """Test that consecutive failures per user are tracked."""
        with patch('app.services.tink_metrics_service.sentry_sdk'):
            for _ in range(3):
                metrics_service.record_api_call(
                    endpoint="/test",
                    method="GET",
                    status_code=500,
                    duration_ms=100,
                    success=False,
                    user_id="user123",
                )

        assert metrics_service._consecutive_failures["user123"] == 3

    def test_successful_call_resets_consecutive_failures(self, metrics_service):
        """Test that successful call resets consecutive failure count."""
        with patch('app.services.tink_metrics_service.sentry_sdk'):
            metrics_service.record_api_call(
                endpoint="/test",
                method="GET",
                status_code=500,
                duration_ms=100,
                success=False,
                user_id="user123",
            )

        assert metrics_service._consecutive_failures["user123"] == 1

        metrics_service.record_api_call(
            endpoint="/test",
            method="GET",
            status_code=200,
            duration_ms=100,
            success=True,
            user_id="user123",
        )

        assert metrics_service._consecutive_failures["user123"] == 0

    def test_record_token_refresh_success(self, metrics_service):
        """Test recording successful token refresh."""
        metrics_service.record_token_refresh(
            user_id="user123",
            connection_id=1,
            success=True,
            duration_ms=500,
        )

        metrics = metrics_service.get_current_metrics()

        assert metrics["total_calls"] == 1
        assert metrics["successful_calls"] == 1

    def test_record_token_refresh_failure(self, metrics_service):
        """Test recording failed token refresh."""
        with patch('app.services.tink_metrics_service.sentry_sdk'):
            metrics_service.record_token_refresh(
                user_id="user123",
                connection_id=1,
                success=False,
                duration_ms=500,
            )

        metrics = metrics_service.get_current_metrics()

        assert metrics["total_calls"] == 1
        assert metrics["failed_calls"] == 1

    def test_get_current_metrics_format(self, metrics_service):
        """Test that get_current_metrics returns expected format."""
        metrics = metrics_service.get_current_metrics()

        assert "window_start" in metrics
        assert "total_calls" in metrics
        assert "successful_calls" in metrics
        assert "failed_calls" in metrics
        assert "error_rate" in metrics
        assert "latency" in metrics
        assert "avg_ms" in metrics["latency"]
        assert "p50_ms" in metrics["latency"]
        assert "p95_ms" in metrics["latency"]
        assert "p99_ms" in metrics["latency"]
        assert "errors_by_type" in metrics
        assert "calls_by_endpoint" in metrics
        assert "rate_limit_count" in metrics

    def test_get_health_status(self, metrics_service, mock_db_session):
        """Test health status generation."""
        # More complete mock setup for complex queries
        from datetime import datetime

        # Mock for total_connections query
        mock_db_session.query.return_value.scalar.return_value = 5

        # Mock for filter chains
        mock_filter = MagicMock()
        mock_filter.scalar.return_value = 3  # active_connections
        mock_db_session.query.return_value.filter.return_value = mock_filter

        health = metrics_service.get_health_status(mock_db_session)

        assert "status" in health
        assert health["status"] in ["healthy", "degraded", "unhealthy", "unknown"]
        assert "timestamp" in health

    def test_health_status_returns_unknown_on_db_error(self, metrics_service, mock_db_session):
        """Test that status is unknown when DB errors occur."""
        mock_db_session.query.side_effect = Exception("DB connection error")

        health = metrics_service.get_health_status(mock_db_session)

        assert health["status"] == "unknown"
        assert "error" in health


# =============================================================================
# Sentry Integration Tests
# =============================================================================

class TestSentryIntegration:
    """Tests for Sentry error reporting."""

    def test_failed_call_reports_to_sentry(self, metrics_service):
        """Test that failed calls are reported to Sentry with tags."""
        with patch('app.services.tink_metrics_service.sentry_sdk') as mock_sentry:
            metrics_service.record_api_call(
                endpoint="/api/test",
                method="POST",
                status_code=500,
                duration_ms=100,
                success=False,
                user_id="user123",
                connection_id=42,
            )

            # Check Sentry tags were set
            mock_sentry.set_tag.assert_any_call("tink.endpoint", "/api/test")
            mock_sentry.set_tag.assert_any_call("tink.error_type", "server")
            mock_sentry.set_tag.assert_any_call("tink.status_code", "500")

    def test_exception_is_captured_to_sentry(self, metrics_service):
        """Test that exceptions are captured to Sentry."""
        import httpx

        with patch('app.services.tink_metrics_service.sentry_sdk') as mock_sentry:
            exception = httpx.TimeoutException("timeout")

            metrics_service.record_api_call(
                endpoint="/api/test",
                method="GET",
                status_code=None,
                duration_ms=30000,
                success=False,
                exception=exception,
            )

            mock_sentry.capture_exception.assert_called_once_with(exception)


# =============================================================================
# Alert Triggering Tests
# =============================================================================

class TestAlertTriggering:
    """Tests for alert triggering conditions."""

    def test_high_error_rate_triggers_alert(self, metrics_service):
        """Test that high error rate triggers alert."""
        with patch('app.services.tink_metrics_service.sentry_sdk') as mock_sentry:
            # Add 5 successful and 5 failed (50% error rate > 5% threshold)
            for _ in range(5):
                metrics_service.record_api_call(
                    endpoint="/test", method="GET", status_code=200,
                    duration_ms=100, success=True
                )
            for _ in range(5):
                metrics_service.record_api_call(
                    endpoint="/test", method="GET", status_code=500,
                    duration_ms=100, success=False
                )

            # Alert should have been captured
            assert mock_sentry.capture_message.called

    def test_consecutive_failures_triggers_alert(self, metrics_service):
        """Test that consecutive failures for a user triggers alert."""
        with patch('app.services.tink_metrics_service.sentry_sdk') as mock_sentry:
            # Exceed consecutive failure threshold (default 3)
            for _ in range(4):
                metrics_service.record_api_call(
                    endpoint="/test", method="GET", status_code=500,
                    duration_ms=100, success=False, user_id="user123"
                )

            assert mock_sentry.capture_message.called


# =============================================================================
# Analytics Service Tests
# =============================================================================

class TestTinkAnalyticsService:
    """Tests for TinkAnalyticsService class."""

    def test_get_daily_stats_returns_list(self, mock_db_session):
        """Test that get_daily_stats returns a list."""
        mock_db_session.query.return_value.filter.return_value.group_by.return_value.order_by.return_value.all.return_value = []

        result = TinkAnalyticsService.get_daily_stats(mock_db_session, days=7)

        assert isinstance(result, list)

    def test_get_error_breakdown_returns_dict(self, mock_db_session):
        """Test that get_error_breakdown returns a dict."""
        mock_db_session.query.return_value.filter.return_value.group_by.return_value.all.return_value = []

        result = TinkAnalyticsService.get_error_breakdown(mock_db_session, days=7)

        assert isinstance(result, dict)
        assert "period_days" in result

    def test_get_sync_performance_returns_dict(self, mock_db_session):
        """Test that get_sync_performance returns a dict."""
        mock_db_session.query.return_value.filter.return_value.all.return_value = []

        result = TinkAnalyticsService.get_sync_performance(mock_db_session, days=7)

        assert isinstance(result, dict)
        assert "total_syncs" in result

    def test_get_user_engagement_returns_dict(self, mock_db_session):
        """Test that get_user_engagement returns a dict."""
        mock_db_session.query.return_value.filter.return_value.scalar.return_value = 0

        result = TinkAnalyticsService.get_user_engagement(mock_db_session, days=30)

        assert isinstance(result, dict)
        assert "period_days" in result
