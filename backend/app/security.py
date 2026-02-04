"""
Security utilities for the FiredUp API.

Provides:
- Secure error handling (prevents information disclosure)
- PII masking utilities
- Environment validation
- Webhook idempotency
"""

import os
import re
import logging
import hashlib
from typing import Optional, Any, Dict
from functools import wraps
from datetime import datetime, timedelta

import sentry_sdk
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# =============================================================================
# Environment Configuration & Validation
# =============================================================================

class SecurityConfig:
    """Security configuration loaded from environment."""

    # Environment
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    IS_PRODUCTION = ENVIRONMENT == "production"

    # Required secrets (checked at startup)
    REQUIRED_SECRETS = [
        "JWT_SECRET",
        "INTERNAL_SERVICE_SECRET",
        "NEXTAUTH_SECRET",
    ]

    # Secrets required only in production
    PRODUCTION_REQUIRED_SECRETS = [
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
    ]

    # Sentry DSN (should be in env, not hardcoded)
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    @classmethod
    def validate_startup(cls) -> None:
        """Validate required configuration at startup. Raises ValueError if invalid."""
        missing = []

        for secret in cls.REQUIRED_SECRETS:
            if not os.getenv(secret):
                missing.append(secret)

        if cls.IS_PRODUCTION:
            for secret in cls.PRODUCTION_REQUIRED_SECRETS:
                if not os.getenv(secret):
                    missing.append(secret)

        if missing:
            raise ValueError(
                f"SECURITY ERROR: Missing required secrets: {', '.join(missing)}. "
                f"These must be set via environment variables."
            )

        # Warn about weak JWT secret
        jwt_secret = os.getenv("JWT_SECRET", "")
        if len(jwt_secret) < 32:
            if cls.IS_PRODUCTION:
                raise ValueError(
                    "SECURITY ERROR: JWT_SECRET must be at least 32 characters in production. "
                    "Generate with: openssl rand -base64 32"
                )
            else:
                logger.warning(
                    "JWT_SECRET is shorter than 32 characters. "
                    "This is acceptable in development but must be fixed for production."
                )


# =============================================================================
# Error Handling
# =============================================================================

# Generic error messages for different error types
ERROR_MESSAGES = {
    "database": "A database error occurred. Please try again.",
    "validation": "Invalid request data.",
    "authentication": "Authentication failed.",
    "authorization": "You don't have permission to perform this action.",
    "not_found": "The requested resource was not found.",
    "external_service": "An external service is temporarily unavailable.",
    "internal": "An internal error occurred. Please try again.",
    "rate_limit": "Too many requests. Please slow down.",
    "configuration": "Service configuration error. Please contact support.",
}


class SecureHTTPException(HTTPException):
    """HTTPException that logs full error to Sentry but returns generic message to client."""

    def __init__(
        self,
        status_code: int,
        error_type: str = "internal",
        detail: Optional[str] = None,
        internal_message: Optional[str] = None,
        exception: Optional[Exception] = None,
    ):
        # Use generic message unless a safe detail is explicitly provided
        user_message = detail or ERROR_MESSAGES.get(error_type, ERROR_MESSAGES["internal"])

        # Log full error internally
        if internal_message or exception:
            log_message = internal_message or str(exception)
            logger.error(f"SecureHTTPException: {log_message}", exc_info=exception)

            # Send to Sentry with full context
            if exception:
                sentry_sdk.capture_exception(exception)
            else:
                sentry_sdk.capture_message(log_message, level="error")

        super().__init__(status_code=status_code, detail=user_message)


def safe_error_response(
    status_code: int = 500,
    error_type: str = "internal",
    internal_message: Optional[str] = None,
    exception: Optional[Exception] = None,
) -> HTTPException:
    """
    Create a safe HTTP error response that doesn't leak internal details.

    Args:
        status_code: HTTP status code
        error_type: Type of error (maps to generic message)
        internal_message: Full error message for logging (not returned to client)
        exception: The actual exception (logged, not returned)

    Returns:
        HTTPException with sanitized error message
    """
    # Log the real error
    if exception:
        logger.error(f"Error [{error_type}]: {str(exception)}", exc_info=True)
        sentry_sdk.capture_exception(exception)
    elif internal_message:
        logger.error(f"Error [{error_type}]: {internal_message}")

    # Return generic message
    return HTTPException(
        status_code=status_code,
        detail=ERROR_MESSAGES.get(error_type, ERROR_MESSAGES["internal"])
    )


def handle_exception(error_type: str = "internal"):
    """
    Decorator for endpoint functions to catch and handle exceptions safely.

    Usage:
        @router.get("/endpoint")
        @handle_exception("database")
        async def my_endpoint():
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                # Re-raise HTTP exceptions as-is (already safe)
                raise
            except Exception as e:
                raise safe_error_response(
                    status_code=500,
                    error_type=error_type,
                    exception=e
                )
        return wrapper
    return decorator


# =============================================================================
# PII Masking Utilities
# =============================================================================

def mask_email(email: str) -> str:
    """
    Mask an email address for safe logging.

    Example: john.doe@example.com -> j***e@e***e.com
    """
    if not email or '@' not in email:
        return '***'

    local, domain = email.rsplit('@', 1)

    # Mask local part
    if len(local) <= 2:
        masked_local = local[0] + '*' * (len(local) - 1)
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]

    # Mask domain
    domain_parts = domain.split('.')
    masked_domain_parts = []
    for part in domain_parts:
        if len(part) <= 2:
            masked_domain_parts.append(part[0] + '*' * (len(part) - 1))
        else:
            masked_domain_parts.append(part[0] + '*' * (len(part) - 2) + part[-1])

    return f"{masked_local}@{'.'.join(masked_domain_parts)}"


def mask_phone(phone: str) -> str:
    """
    Mask a phone number for safe logging.

    Example: +48 123 456 789 -> +48 *** *** *89
    """
    if not phone:
        return '***'

    # Keep only digits and +
    digits = re.sub(r'[^\d+]', '', phone)

    if len(digits) <= 4:
        return '***'

    # Show first 3 chars (country code) and last 2 digits
    return digits[:3] + '*' * (len(digits) - 5) + digits[-2:]


def mask_iban(iban: str) -> str:
    """
    Mask an IBAN for safe logging.

    Example: PL12345678901234567890123456 -> PL12****3456
    """
    if not iban:
        return '***'

    # Remove spaces
    iban = iban.replace(' ', '')

    if len(iban) <= 8:
        return iban[:4] + '****'

    return iban[:4] + '*' * (len(iban) - 8) + iban[-4:]


def mask_token(token: str) -> str:
    """
    Mask a token for safe logging.

    Example: eyJhbGciOiJIUzI1NiIs... -> eyJh****NiIs
    """
    if not token:
        return '***'

    if len(token) <= 8:
        return token[:4] + '****'

    return token[:4] + '****' + token[-4:]


def sanitize_log_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize a dictionary of data for safe logging.
    Automatically detects and masks sensitive fields.
    """
    sensitive_patterns = {
        'email': mask_email,
        'phone': mask_phone,
        'iban': mask_iban,
        'token': mask_token,
        'access_token': mask_token,
        'refresh_token': mask_token,
        'id_token': mask_token,
        'password': lambda x: '***',
        'secret': lambda x: '***',
        'key': lambda x: '***',
        'authorization': mask_token,
    }

    sanitized = {}
    for key, value in data.items():
        key_lower = key.lower()

        # Check if this key should be masked
        for pattern, masker in sensitive_patterns.items():
            if pattern in key_lower:
                sanitized[key] = masker(str(value)) if value else None
                break
        else:
            # No pattern matched, include value as-is
            sanitized[key] = value

    return sanitized


# =============================================================================
# Webhook Idempotency
# =============================================================================

class WebhookIdempotency:
    """
    Handles webhook idempotency to prevent duplicate processing.

    Uses a database table to track processed webhook event IDs.
    """

    # Model should be imported from models to avoid circular imports
    # This is a placeholder for the actual implementation

    @staticmethod
    def is_processed(db: Session, event_id: str, provider: str = "stripe") -> bool:
        """
        Check if a webhook event has already been processed.

        Args:
            db: Database session
            event_id: The unique event ID from the webhook provider
            provider: The webhook provider (e.g., "stripe", "tink")

        Returns:
            True if already processed, False otherwise
        """
        from . import models

        existing = db.query(models.ProcessedWebhookEvent).filter(
            models.ProcessedWebhookEvent.event_id == event_id,
            models.ProcessedWebhookEvent.provider == provider
        ).first()

        return existing is not None

    @staticmethod
    def mark_processed(
        db: Session,
        event_id: str,
        provider: str = "stripe",
        event_type: Optional[str] = None
    ) -> None:
        """
        Mark a webhook event as processed.

        Args:
            db: Database session
            event_id: The unique event ID from the webhook provider
            provider: The webhook provider
            event_type: Optional event type for logging
        """
        from . import models

        processed = models.ProcessedWebhookEvent(
            event_id=event_id,
            provider=provider,
            event_type=event_type,
            processed_at=datetime.utcnow()
        )
        db.add(processed)
        db.commit()

        logger.info(f"Marked webhook event as processed: {provider}/{event_id}")

    @staticmethod
    def cleanup_old_events(db: Session, days: int = 30) -> int:
        """
        Clean up old processed webhook events.

        Args:
            db: Database session
            days: Number of days to keep events

        Returns:
            Number of events deleted
        """
        from . import models

        cutoff = datetime.utcnow() - timedelta(days=days)
        deleted = db.query(models.ProcessedWebhookEvent).filter(
            models.ProcessedWebhookEvent.processed_at < cutoff
        ).delete()
        db.commit()

        if deleted:
            logger.info(f"Cleaned up {deleted} old webhook events")

        return deleted


# =============================================================================
# Rate Limiting Helpers
# =============================================================================

def get_user_rate_limit_key(user_id: str) -> str:
    """
    Get a rate limit key for a specific user.
    Used for per-user rate limiting on authenticated requests.
    """
    return f"user:{hashlib.sha256(user_id.encode()).hexdigest()[:16]}"


# =============================================================================
# CORS Helper
# =============================================================================

def get_allowed_origins() -> list[str]:
    """
    Get allowed CORS origins based on environment.
    In production, localhost origins are excluded.
    """
    environment = os.getenv("ENVIRONMENT", "development")
    cors_origins = os.getenv("CORS_ORIGINS", "").split(",")

    # Production origins are always allowed
    allowed = [
        "https://firedup.app",
        "https://www.firedup.app",
    ]

    # Add configured origins, filtering localhost in production
    for origin in cors_origins:
        origin = origin.strip()
        if not origin:
            continue

        if environment == "production":
            # Exclude localhost in production
            if "localhost" in origin or "127.0.0.1" in origin:
                logger.warning(f"Excluding localhost origin in production: {origin}")
                continue

        allowed.append(origin)

    # Remove duplicates while preserving order
    seen = set()
    unique = []
    for origin in allowed:
        if origin not in seen:
            seen.add(origin)
            unique.append(origin)

    return unique


# =============================================================================
# Debug Endpoint Protection
# =============================================================================

def is_debug_enabled() -> bool:
    """Check if debug endpoints should be enabled."""
    environment = os.getenv("ENVIRONMENT", "development")
    debug_enabled = os.getenv("DEBUG_ENDPOINTS_ENABLED", "false").lower() == "true"

    # Never enable in production unless explicitly forced
    if environment == "production" and not debug_enabled:
        return False

    return True


def require_debug_mode():
    """
    Dependency that checks if debug mode is enabled.
    Use on debug endpoints to protect them in production.
    """
    if not is_debug_enabled():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found"
        )
