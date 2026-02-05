"""
Tink Metrics Service

Provides metrics collection, error classification, and alerting for Tink API operations.
Designed to be non-blocking and fail silently to avoid impacting user requests.

Metrics are stored in the TinkAuditLog table with additional context for monitoring.
"""

import os
import time
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

try:
    import sentry_sdk
    SENTRY_AVAILABLE = True
except ImportError:
    SENTRY_AVAILABLE = False
    sentry_sdk = None

from ..models import TinkAuditLog, TinkConnection
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


# =============================================================================
# Error Classification
# =============================================================================

class TinkErrorType:
    """Classification of Tink API errors for metrics and alerting."""
    AUTH = "auth"           # 401, 403 - authentication/authorization issues
    RATE_LIMIT = "rate_limit"  # 429 - rate limiting
    SERVER = "server"       # 5xx - Tink server errors
    CLIENT = "client"       # 400, 404, 422 - client errors (our bugs)
    NETWORK = "network"     # Timeouts, connection errors
    UNKNOWN = "unknown"     # Unclassified errors


def classify_error(status_code: Optional[int], exception: Optional[Exception] = None) -> str:
    """
    Classify a Tink API error by type.

    Args:
        status_code: HTTP status code (may be None for network errors)
        exception: Exception if no status code available

    Returns:
        Error type string from TinkErrorType
    """
    if status_code is not None:
        if status_code in (401, 403):
            return TinkErrorType.AUTH
        elif status_code == 429:
            return TinkErrorType.RATE_LIMIT
        elif 500 <= status_code < 600:
            return TinkErrorType.SERVER
        elif 400 <= status_code < 500:
            return TinkErrorType.CLIENT

    if exception is not None:
        exception_name = type(exception).__name__.lower()
        if any(err in exception_name for err in ['timeout', 'connect', 'network']):
            return TinkErrorType.NETWORK

    return TinkErrorType.UNKNOWN


# =============================================================================
# Metrics Data Structures
# =============================================================================

@dataclass
class APICallMetric:
    """Represents a single API call metric."""
    endpoint: str
    method: str
    status_code: Optional[int]
    duration_ms: float
    success: bool
    error_type: Optional[str] = None
    retry_count: int = 0
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class MetricsWindow:
    """Aggregated metrics for a time window."""
    window_start: datetime
    window_duration_minutes: int = 5

    # Call counts
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0

    # Latency tracking (in milliseconds)
    latencies: List[float] = field(default_factory=list)

    # Error breakdown
    errors_by_type: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    # Endpoint breakdown
    calls_by_endpoint: Dict[str, int] = field(default_factory=lambda: defaultdict(int))

    # Rate limit tracking
    rate_limit_count: int = 0

    def add_metric(self, metric: APICallMetric):
        """Add a metric to this window."""
        self.total_calls += 1
        if metric.success:
            self.successful_calls += 1
        else:
            self.failed_calls += 1
            if metric.error_type:
                self.errors_by_type[metric.error_type] += 1
                if metric.error_type == TinkErrorType.RATE_LIMIT:
                    self.rate_limit_count += 1

        self.latencies.append(metric.duration_ms)
        self.calls_by_endpoint[metric.endpoint] += 1

    @property
    def error_rate(self) -> float:
        """Calculate error rate as percentage."""
        if self.total_calls == 0:
            return 0.0
        return (self.failed_calls / self.total_calls) * 100

    def get_latency_percentile(self, percentile: float) -> float:
        """Get latency at given percentile (0-100)."""
        if not self.latencies:
            return 0.0
        sorted_latencies = sorted(self.latencies)
        index = int(len(sorted_latencies) * (percentile / 100))
        index = min(index, len(sorted_latencies) - 1)
        return sorted_latencies[index]

    @property
    def p50_latency(self) -> float:
        return self.get_latency_percentile(50)

    @property
    def p95_latency(self) -> float:
        return self.get_latency_percentile(95)

    @property
    def p99_latency(self) -> float:
        return self.get_latency_percentile(99)

    @property
    def avg_latency(self) -> float:
        if not self.latencies:
            return 0.0
        return sum(self.latencies) / len(self.latencies)


# =============================================================================
# Alert Deduplication
# =============================================================================

class AlertDeduplicator:
    """
    Prevents alert storms by deduplicating alerts.

    Implements a simple time-based deduplication: same alert type
    won't fire more than once per deduplication window.
    """

    def __init__(self, window_minutes: int = 15):
        self.window_minutes = window_minutes
        self._last_alerts: Dict[str, datetime] = {}
        self._lock = threading.Lock()

    def should_alert(self, alert_key: str) -> bool:
        """
        Check if an alert should be fired.

        Args:
            alert_key: Unique key identifying the alert type

        Returns:
            True if alert should fire, False if deduplicated
        """
        now = datetime.utcnow()

        with self._lock:
            last_alert = self._last_alerts.get(alert_key)

            if last_alert is None:
                self._last_alerts[alert_key] = now
                return True

            elapsed = (now - last_alert).total_seconds() / 60
            if elapsed >= self.window_minutes:
                self._last_alerts[alert_key] = now
                return True

            return False

    def clear(self):
        """Clear all deduplication state (for testing)."""
        with self._lock:
            self._last_alerts.clear()


# =============================================================================
# Tink Metrics Service
# =============================================================================

class TinkMetricsService:
    """
    Central service for Tink API metrics, monitoring, and alerting.

    Features:
    - Non-blocking metrics collection
    - Error classification
    - Alert deduplication
    - Sentry integration with custom tags
    - Health check aggregation
    """

    # Alert thresholds (configurable via env vars)
    ERROR_RATE_THRESHOLD = float(os.getenv("TINK_ERROR_RATE_THRESHOLD", "5.0"))  # %
    TOKEN_REFRESH_FAILURE_THRESHOLD = float(os.getenv("TINK_TOKEN_REFRESH_FAILURE_THRESHOLD", "10.0"))  # %
    AVG_LATENCY_THRESHOLD = float(os.getenv("TINK_AVG_LATENCY_THRESHOLD", "5000"))  # ms
    RATE_LIMIT_HOURLY_THRESHOLD = int(os.getenv("TINK_RATE_LIMIT_HOURLY_THRESHOLD", "10"))
    CONSECUTIVE_FAILURE_THRESHOLD = int(os.getenv("TINK_CONSECUTIVE_FAILURE_THRESHOLD", "3"))
    INACTIVITY_MINUTES_THRESHOLD = int(os.getenv("TINK_INACTIVITY_MINUTES_THRESHOLD", "30"))

    def __init__(self):
        self._current_window: Optional[MetricsWindow] = None
        self._window_lock = threading.Lock()
        self._deduplicator = AlertDeduplicator()
        self._consecutive_failures: Dict[str, int] = defaultdict(int)  # user_id -> count
        self._last_successful_call: Optional[datetime] = None

    def _get_or_create_window(self) -> MetricsWindow:
        """Get current metrics window, creating new one if needed."""
        now = datetime.utcnow()

        with self._window_lock:
            if self._current_window is None:
                self._current_window = MetricsWindow(window_start=now)
            else:
                # Check if window has expired (5 minutes)
                elapsed = (now - self._current_window.window_start).total_seconds() / 60
                if elapsed >= self._current_window.window_duration_minutes:
                    # Archive old window metrics could be done here
                    self._current_window = MetricsWindow(window_start=now)

            return self._current_window

    def record_api_call(
        self,
        endpoint: str,
        method: str,
        status_code: Optional[int],
        duration_ms: float,
        success: bool,
        retry_count: int = 0,
        user_id: Optional[str] = None,
        connection_id: Optional[int] = None,
        exception: Optional[Exception] = None,
    ) -> None:
        """
        Record an API call metric.

        This method is non-blocking and fail-safe.
        """
        try:
            error_type = None if success else classify_error(status_code, exception)

            metric = APICallMetric(
                endpoint=endpoint,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                success=success,
                error_type=error_type,
                retry_count=retry_count,
            )

            # Add to current window
            window = self._get_or_create_window()
            window.add_metric(metric)

            # Track successful calls for availability monitoring
            if success:
                self._last_successful_call = datetime.utcnow()
                # Reset consecutive failures for user
                if user_id:
                    self._consecutive_failures[user_id] = 0
            else:
                # Increment consecutive failures
                if user_id:
                    self._consecutive_failures[user_id] += 1

                # Report to Sentry with tags
                self._report_to_sentry(
                    endpoint=endpoint,
                    status_code=status_code,
                    error_type=error_type,
                    retry_count=retry_count,
                    user_id=user_id,
                    connection_id=connection_id,
                    exception=exception,
                )

            # Check alert conditions
            self._check_alerts(window, user_id)

        except Exception as e:
            # Never fail the caller
            logger.error(f"Failed to record API call metric: {e}")

    def _report_to_sentry(
        self,
        endpoint: str,
        status_code: Optional[int],
        error_type: Optional[str],
        retry_count: int,
        user_id: Optional[str],
        connection_id: Optional[int],
        exception: Optional[Exception],
    ) -> None:
        """Report Tink error to Sentry with custom tags."""
        if not SENTRY_AVAILABLE:
            return

        try:
            # Set Sentry context
            sentry_sdk.set_tag("tink.endpoint", endpoint)
            sentry_sdk.set_tag("tink.error_type", error_type or "unknown")
            sentry_sdk.set_tag("tink.retry_count", str(retry_count))

            if status_code:
                sentry_sdk.set_tag("tink.status_code", str(status_code))

            if user_id:
                # Set user context (sanitized)
                sentry_sdk.set_user({"id": user_id[:8] + "..."})

            if connection_id:
                sentry_sdk.set_tag("tink.connection_id", str(connection_id))

            # Capture the exception or message
            if exception:
                sentry_sdk.capture_exception(exception)
            else:
                sentry_sdk.capture_message(
                    f"Tink API error: {endpoint} returned {status_code}",
                    level="error" if error_type in (TinkErrorType.SERVER, TinkErrorType.AUTH) else "warning"
                )
        except Exception as e:
            logger.error(f"Failed to report to Sentry: {e}")

    def _check_alerts(self, window: MetricsWindow, user_id: Optional[str] = None) -> None:
        """Check if any alert conditions are met."""
        try:
            # Check error rate threshold
            if window.total_calls >= 10 and window.error_rate > self.ERROR_RATE_THRESHOLD:
                if self._deduplicator.should_alert("high_error_rate"):
                    self._fire_alert(
                        "tink_high_error_rate",
                        f"Tink API error rate exceeded {self.ERROR_RATE_THRESHOLD}%: {window.error_rate:.1f}%",
                        {"error_rate": window.error_rate, "total_calls": window.total_calls}
                    )

            # Check latency threshold
            if window.total_calls >= 5 and window.avg_latency > self.AVG_LATENCY_THRESHOLD:
                if self._deduplicator.should_alert("high_latency"):
                    self._fire_alert(
                        "tink_high_latency",
                        f"Tink API average latency exceeded {self.AVG_LATENCY_THRESHOLD}ms: {window.avg_latency:.0f}ms",
                        {"avg_latency_ms": window.avg_latency, "p95_latency_ms": window.p95_latency}
                    )

            # Check rate limit threshold
            if window.rate_limit_count >= self.RATE_LIMIT_HOURLY_THRESHOLD:
                if self._deduplicator.should_alert("rate_limit_exceeded"):
                    self._fire_alert(
                        "tink_rate_limit_exceeded",
                        f"Tink rate limit events exceeded threshold: {window.rate_limit_count}",
                        {"rate_limit_count": window.rate_limit_count}
                    )

            # Check consecutive failures per user
            if user_id and self._consecutive_failures.get(user_id, 0) >= self.CONSECUTIVE_FAILURE_THRESHOLD:
                if self._deduplicator.should_alert(f"consecutive_failure_{user_id[:8]}"):
                    self._fire_alert(
                        "tink_consecutive_failures",
                        f"Consecutive Tink failures for user reached {self.CONSECUTIVE_FAILURE_THRESHOLD}",
                        {"consecutive_failures": self._consecutive_failures[user_id]}
                    )

            # Check availability (no successful calls)
            if self._last_successful_call:
                minutes_since_success = (datetime.utcnow() - self._last_successful_call).total_seconds() / 60
                if minutes_since_success >= self.INACTIVITY_MINUTES_THRESHOLD:
                    if self._deduplicator.should_alert("inactivity"):
                        self._fire_alert(
                            "tink_inactivity",
                            f"No successful Tink API calls in {self.INACTIVITY_MINUTES_THRESHOLD} minutes",
                            {"minutes_since_success": minutes_since_success}
                        )
        except Exception as e:
            logger.error(f"Failed to check alerts: {e}")

    def _fire_alert(self, alert_type: str, message: str, context: Dict[str, Any]) -> None:
        """Fire an alert via Sentry."""
        try:
            logger.warning(f"ALERT [{alert_type}]: {message} | {context}")

            if SENTRY_AVAILABLE:
                sentry_sdk.set_context("tink_alert", context)
                sentry_sdk.set_tag("alert_type", alert_type)
                sentry_sdk.capture_message(message, level="warning")
        except Exception as e:
            logger.error(f"Failed to fire alert: {e}")

    def record_token_refresh(
        self,
        user_id: str,
        connection_id: int,
        success: bool,
        duration_ms: float,
    ) -> None:
        """Record a token refresh operation."""
        self.record_api_call(
            endpoint="/api/v1/oauth/token (refresh)",
            method="POST",
            status_code=200 if success else 401,
            duration_ms=duration_ms,
            success=success,
            user_id=user_id,
            connection_id=connection_id,
        )

    def get_current_metrics(self) -> Dict[str, Any]:
        """Get current metrics window data."""
        window = self._get_or_create_window()

        return {
            "window_start": window.window_start.isoformat(),
            "total_calls": window.total_calls,
            "successful_calls": window.successful_calls,
            "failed_calls": window.failed_calls,
            "error_rate": round(window.error_rate, 2),
            "latency": {
                "avg_ms": round(window.avg_latency, 2),
                "p50_ms": round(window.p50_latency, 2),
                "p95_ms": round(window.p95_latency, 2),
                "p99_ms": round(window.p99_latency, 2),
            },
            "errors_by_type": dict(window.errors_by_type),
            "calls_by_endpoint": dict(window.calls_by_endpoint),
            "rate_limit_count": window.rate_limit_count,
        }

    def get_health_status(self, db: Session) -> Dict[str, Any]:
        """
        Get comprehensive Tink health status.

        Includes:
        - Current metrics
        - Connection pool status
        - Recent error counts
        - Last successful sync
        """
        try:
            # Current metrics
            metrics = self.get_current_metrics()

            # Connection stats from DB
            total_connections = db.query(func.count(TinkConnection.id)).scalar() or 0
            active_connections = db.query(func.count(TinkConnection.id)).filter(
                TinkConnection.is_active == True
            ).scalar() or 0

            # Last successful sync
            last_sync = db.query(func.max(TinkConnection.last_sync_at)).filter(
                TinkConnection.is_active == True
            ).scalar()

            # Recent errors from audit log (last hour)
            one_hour_ago = datetime.utcnow() - timedelta(hours=1)
            recent_errors = db.query(func.count(TinkAuditLog.id)).filter(
                and_(
                    TinkAuditLog.result == "failure",
                    TinkAuditLog.created_at >= one_hour_ago
                )
            ).scalar() or 0

            recent_successes = db.query(func.count(TinkAuditLog.id)).filter(
                and_(
                    TinkAuditLog.result == "success",
                    TinkAuditLog.created_at >= one_hour_ago
                )
            ).scalar() or 0

            # Determine overall status
            status = "healthy"
            if metrics["error_rate"] > 5.0 or recent_errors > 10:
                status = "degraded"
            if metrics["error_rate"] > 20.0 or active_connections == 0:
                status = "unhealthy"

            return {
                "status": status,
                "timestamp": datetime.utcnow().isoformat(),
                "metrics": metrics,
                "connections": {
                    "total": total_connections,
                    "active": active_connections,
                },
                "last_sync_at": last_sync.isoformat() if last_sync else None,
                "last_successful_call": self._last_successful_call.isoformat() if self._last_successful_call else None,
                "recent_activity": {
                    "errors_last_hour": recent_errors,
                    "successes_last_hour": recent_successes,
                },
            }
        except Exception as e:
            logger.error(f"Failed to get health status: {e}")
            return {
                "status": "unknown",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }


# =============================================================================
# Analytics Queries
# =============================================================================

class TinkAnalyticsService:
    """
    Provides analytics queries for Tink operations.
    Used by admin endpoints for monitoring dashboards.
    """

    @staticmethod
    def get_daily_stats(
        db: Session,
        days: int = 30,
    ) -> List[Dict[str, Any]]:
        """
        Get daily aggregated stats for the last N days.

        Returns list of daily summaries with:
        - Date
        - Total operations
        - Success/failure counts
        - Unique users
        """
        try:
            from_date = datetime.utcnow() - timedelta(days=days)

            results = db.query(
                func.date(TinkAuditLog.created_at).label("date"),
                func.count(TinkAuditLog.id).label("total"),
                func.sum(func.cast(TinkAuditLog.result == "success", db.bind.dialect.type_descriptor(type(1)))).label("successes"),
                func.sum(func.cast(TinkAuditLog.result == "failure", db.bind.dialect.type_descriptor(type(1)))).label("failures"),
                func.count(func.distinct(TinkAuditLog.user_id)).label("unique_users"),
            ).filter(
                TinkAuditLog.created_at >= from_date
            ).group_by(
                func.date(TinkAuditLog.created_at)
            ).order_by(
                func.date(TinkAuditLog.created_at).desc()
            ).all()

            return [
                {
                    "date": str(row.date),
                    "total": row.total,
                    "successes": int(row.successes or 0),
                    "failures": int(row.failures or 0),
                    "unique_users": row.unique_users,
                }
                for row in results
            ]
        except Exception as e:
            logger.error(f"Failed to get daily stats: {e}")
            return []

    @staticmethod
    def get_error_breakdown(
        db: Session,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        Get breakdown of errors by category for the last N days.
        """
        try:
            from_date = datetime.utcnow() - timedelta(days=days)

            # Get action types with failure counts
            results = db.query(
                TinkAuditLog.action_type,
                func.count(TinkAuditLog.id).label("count"),
            ).filter(
                and_(
                    TinkAuditLog.result == "failure",
                    TinkAuditLog.created_at >= from_date
                )
            ).group_by(
                TinkAuditLog.action_type
            ).all()

            return {
                "period_days": days,
                "errors_by_action": {row.action_type: row.count for row in results},
                "total_errors": sum(row.count for row in results),
            }
        except Exception as e:
            logger.error(f"Failed to get error breakdown: {e}")
            return {"error": str(e)}

    @staticmethod
    def get_sync_performance(
        db: Session,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        Get transaction sync performance metrics.
        """
        try:
            from_date = datetime.utcnow() - timedelta(days=days)

            # Get sync operations with counts from details
            syncs = db.query(TinkAuditLog).filter(
                and_(
                    TinkAuditLog.action_type == "transactions_synced",
                    TinkAuditLog.created_at >= from_date
                )
            ).all()

            total_syncs = len(syncs)
            total_synced = 0
            total_duplicates = 0

            for sync in syncs:
                if sync.details:
                    total_synced += sync.details.get("synced_count", 0)
                    total_duplicates += sync.details.get("exact_duplicate_count", 0)
                    total_duplicates += sync.details.get("fuzzy_duplicate_count", 0)

            return {
                "period_days": days,
                "total_syncs": total_syncs,
                "total_transactions_synced": total_synced,
                "total_duplicates_detected": total_duplicates,
                "avg_transactions_per_sync": round(total_synced / total_syncs, 2) if total_syncs > 0 else 0,
            }
        except Exception as e:
            logger.error(f"Failed to get sync performance: {e}")
            return {"error": str(e)}

    @staticmethod
    def get_user_engagement(
        db: Session,
        days: int = 30,
    ) -> Dict[str, Any]:
        """
        Get user engagement metrics with bank sync feature.
        """
        try:
            from_date = datetime.utcnow() - timedelta(days=days)

            # Users who connected banks
            connected_users = db.query(
                func.count(func.distinct(TinkConnection.user_id))
            ).filter(
                TinkConnection.created_at >= from_date
            ).scalar() or 0

            # Users who synced transactions
            syncing_users = db.query(
                func.count(func.distinct(TinkAuditLog.user_id))
            ).filter(
                and_(
                    TinkAuditLog.action_type == "transactions_synced",
                    TinkAuditLog.created_at >= from_date
                )
            ).scalar() or 0

            # Active connections
            active_connections = db.query(
                func.count(TinkConnection.id)
            ).filter(
                TinkConnection.is_active == True
            ).scalar() or 0

            return {
                "period_days": days,
                "new_connections": connected_users,
                "active_syncing_users": syncing_users,
                "total_active_connections": active_connections,
            }
        except Exception as e:
            logger.error(f"Failed to get user engagement: {e}")
            return {"error": str(e)}


# =============================================================================
# Singleton Instance
# =============================================================================

tink_metrics_service = TinkMetricsService()
tink_analytics_service = TinkAnalyticsService()
