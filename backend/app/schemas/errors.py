"""
Structured Error Response Models

Provides consistent error responses with error codes, user-friendly messages,
and actionable guidance for the frontend.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel


class ErrorCode(str, Enum):
    """Error codes for structured error responses."""

    # Authentication & Authorization
    TOKEN_EXPIRED = "TOKEN_EXPIRED"
    AUTH_FAILED = "AUTH_FAILED"
    SUBSCRIPTION_REQUIRED = "SUBSCRIPTION_REQUIRED"

    # Rate Limiting
    RATE_LIMITED = "RATE_LIMITED"

    # Bank/API Availability
    BANK_UNAVAILABLE = "BANK_UNAVAILABLE"
    TINK_API_ERROR = "TINK_API_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"

    # Data Issues
    INVALID_REQUEST = "INVALID_REQUEST"
    NOT_FOUND = "NOT_FOUND"
    DUPLICATE_DATA = "DUPLICATE_DATA"

    # System Errors
    INTERNAL_ERROR = "INTERNAL_ERROR"
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"


class ErrorAction(str, Enum):
    """Suggested actions for the user to resolve the error."""

    RECONNECT = "reconnect"  # Reconnect bank account
    RETRY = "retry"  # Retry the operation
    RETRY_LATER = "retry_later"  # Wait and retry later
    UPGRADE = "upgrade"  # Upgrade subscription
    CONTACT_SUPPORT = "contact_support"  # Contact support
    GO_TO_SETTINGS = "go_to_settings"  # Go to settings page
    NONE = "none"  # No action available


class StructuredErrorResponse(BaseModel):
    """
    Structured error response model.

    Provides error code, message, and optional action guidance for the frontend.
    """

    error_code: ErrorCode
    message: str  # Technical message for logging
    user_message: Optional[str] = None  # User-friendly message (if different from message)
    action: Optional[ErrorAction] = None  # Suggested action
    retry_after: Optional[int] = None  # Seconds to wait before retry (for rate limiting)
    details: Optional[dict] = None  # Additional context


# Helper functions for creating common error responses

def token_expired_error(retry_after: Optional[int] = None) -> StructuredErrorResponse:
    """Create a TOKEN_EXPIRED error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.TOKEN_EXPIRED,
        message="Bank access token has expired",
        user_message="Your bank connection has expired. Please reconnect your bank account.",
        action=ErrorAction.RECONNECT,
        retry_after=retry_after
    )


def rate_limited_error(retry_after: int) -> StructuredErrorResponse:
    """Create a RATE_LIMITED error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.RATE_LIMITED,
        message="Rate limit exceeded",
        user_message=f"Too many requests. Please wait {retry_after} seconds and try again.",
        action=ErrorAction.RETRY_LATER,
        retry_after=retry_after
    )


def bank_unavailable_error(bank_name: Optional[str] = None) -> StructuredErrorResponse:
    """Create a BANK_UNAVAILABLE error response."""
    bank_msg = f" ({bank_name})" if bank_name else ""
    return StructuredErrorResponse(
        error_code=ErrorCode.BANK_UNAVAILABLE,
        message=f"Bank service is temporarily unavailable{bank_msg}",
        user_message=f"Your bank{bank_msg} is temporarily unavailable. Please try again in a few minutes.",
        action=ErrorAction.RETRY_LATER,
        retry_after=300  # 5 minutes
    )


def auth_failed_error() -> StructuredErrorResponse:
    """Create an AUTH_FAILED error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.AUTH_FAILED,
        message="Bank authentication failed",
        user_message="We couldn't connect to your bank. Please try connecting again.",
        action=ErrorAction.RECONNECT
    )


def subscription_required_error(feature: str = "this feature") -> StructuredErrorResponse:
    """Create a SUBSCRIPTION_REQUIRED error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.SUBSCRIPTION_REQUIRED,
        message=f"Premium subscription required for {feature}",
        user_message=f"Premium subscription required to use {feature}.",
        action=ErrorAction.UPGRADE
    )


def network_error() -> StructuredErrorResponse:
    """Create a NETWORK_ERROR error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.NETWORK_ERROR,
        message="Network connection error",
        user_message="Network connection error. Please check your internet and try again.",
        action=ErrorAction.RETRY
    )


def internal_error(details: Optional[str] = None) -> StructuredErrorResponse:
    """Create an INTERNAL_ERROR error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.INTERNAL_ERROR,
        message="Internal server error",
        user_message="Something went wrong on our end. Please try again later.",
        action=ErrorAction.CONTACT_SUPPORT,
        details={"error": details} if details else None
    )


def configuration_error(component: str) -> StructuredErrorResponse:
    """Create a CONFIGURATION_ERROR error response."""
    return StructuredErrorResponse(
        error_code=ErrorCode.CONFIGURATION_ERROR,
        message=f"Configuration error: {component}",
        user_message="Service configuration error. Please contact support.",
        action=ErrorAction.CONTACT_SUPPORT
    )
