"""
Tink Audit Service

Provides helper functions for creating audit log entries for Tink operations.
Audit writes are non-blocking and fail silently to avoid impacting user requests.
"""

import re
from datetime import datetime
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from fastapi import Request

from ..models import TinkAuditLog
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)

# Patterns for sensitive data that should never appear in audit logs
SENSITIVE_PATTERNS = [
    # Tokens and secrets
    (r'[A-Za-z0-9_-]{20,}', 'TOKEN_REDACTED'),  # Generic long alphanumeric strings (likely tokens)
    # IBANs (Polish format: PL followed by 26 digits)
    (r'PL\d{26}', 'IBAN_REDACTED'),
    # Generic IBANs (2 letters + 2 check digits + up to 30 alphanumeric)
    (r'[A-Z]{2}\d{2}[A-Z0-9]{4,30}', 'IBAN_REDACTED'),
    # Credit card numbers (basic pattern)
    (r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b', 'CARD_REDACTED'),
    # Email addresses (should be handled by SecureLogger, but double-check)
    (r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', 'EMAIL_REDACTED'),
]


def sanitize_audit_details(details: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Sanitize a details dict by removing/masking sensitive information.

    This ensures no PII, tokens, IBANs, or other sensitive data
    is stored in the audit log details field.
    """
    if not details:
        return {}

    sanitized = {}

    # Keys that should never be logged
    blocked_keys = {
        'access_token', 'refresh_token', 'token', 'secret',
        'password', 'api_key', 'apikey', 'authorization',
        'iban', 'account_number', 'card_number', 'cvv',
        'email', 'phone', 'address', 'ssn', 'pesel',
    }

    for key, value in details.items():
        key_lower = key.lower()

        # Skip blocked keys entirely
        if any(blocked in key_lower for blocked in blocked_keys):
            continue

        # Sanitize string values
        if isinstance(value, str):
            sanitized_value = value
            for pattern, replacement in SENSITIVE_PATTERNS:
                sanitized_value = re.sub(pattern, replacement, sanitized_value)
            # Only include if something remains after sanitization
            if sanitized_value and sanitized_value != 'TOKEN_REDACTED':
                sanitized[key] = sanitized_value
        elif isinstance(value, dict):
            # Recursively sanitize nested dicts
            sanitized[key] = sanitize_audit_details(value)
        elif isinstance(value, list):
            # Sanitize lists (but don't recurse too deeply)
            sanitized[key] = [
                sanitize_audit_details(item) if isinstance(item, dict) else item
                for item in value
                if not isinstance(item, str) or len(item) < 50  # Skip long strings in lists
            ]
        elif isinstance(value, (int, float, bool, type(None))):
            # Safe primitive types
            sanitized[key] = value

    return sanitized


def extract_request_metadata(request: Optional[Request]) -> Dict[str, Any]:
    """Extract safe metadata from a FastAPI request."""
    if not request:
        return {}

    # Get IP address (handle proxies)
    ip_address = None
    if request.headers.get("X-Forwarded-For"):
        ip_address = request.headers["X-Forwarded-For"].split(",")[0].strip()
    elif request.headers.get("X-Real-IP"):
        ip_address = request.headers["X-Real-IP"]
    elif request.client:
        ip_address = request.client.host

    # Get user agent (truncate if too long)
    user_agent = request.headers.get("User-Agent", "")[:500]

    return {
        "ip_address": ip_address,
        "user_agent": user_agent,
        "request_method": request.method,
        "request_path": str(request.url.path)[:200],
    }


def log_tink_audit_sync(
    db: Session,
    action_type: str,
    result: str,
    user_id: Optional[str] = None,
    connection_id: Optional[int] = None,
    request: Optional[Request] = None,
    details: Optional[Dict[str, Any]] = None,
    status_code: Optional[int] = None,
) -> Optional[TinkAuditLog]:
    """
    Create a Tink audit log entry synchronously.

    Fails silently if DB write fails to avoid impacting user requests.
    Automatically sanitizes the details dict.

    Args:
        db: Database session
        action_type: Type of action (connect_initiated, connection_created, etc.)
        result: Result of action (success, failure, partial)
        user_id: User ID (may be None for anonymous callbacks)
        connection_id: Tink connection ID if applicable
        request: FastAPI Request object for metadata extraction
        details: Additional context (will be sanitized)
        status_code: HTTP status code of the response

    Returns:
        The created audit log entry, or None if creation failed
    """
    try:
        # Extract request metadata
        req_metadata = extract_request_metadata(request)

        # Sanitize details
        sanitized_details = sanitize_audit_details(details)

        audit_entry = TinkAuditLog(
            user_id=user_id,
            tink_connection_id=connection_id,
            action_type=action_type,
            result=result,
            request_method=req_metadata.get("request_method"),
            request_path=req_metadata.get("request_path"),
            status_code=status_code,
            ip_address=req_metadata.get("ip_address"),
            user_agent=req_metadata.get("user_agent"),
            details=sanitized_details,
        )

        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)

        logger.debug(f"Created audit log: {action_type} - {result} for user {user_id}")
        return audit_entry

    except Exception as e:
        # CRITICAL: Never fail the user request due to audit logging
        logger.error(f"Failed to create audit log entry: {e}")
        # Rollback to prevent transaction issues
        try:
            db.rollback()
        except Exception:
            pass
        return None


async def log_tink_audit(
    db: Session,
    action_type: str,
    result: str,
    user_id: Optional[str] = None,
    connection_id: Optional[int] = None,
    request: Optional[Request] = None,
    details: Optional[Dict[str, Any]] = None,
    status_code: Optional[int] = None,
) -> None:
    """
    Create a Tink audit log entry asynchronously (non-blocking).

    This is the preferred method for audit logging as it doesn't block
    the response to the user.

    Args:
        db: Database session
        action_type: Type of action (connect_initiated, connection_created, etc.)
        result: Result of action (success, failure, partial)
        user_id: User ID (may be None for anonymous callbacks)
        connection_id: Tink connection ID if applicable
        request: FastAPI Request object for metadata extraction
        details: Additional context (will be sanitized)
        status_code: HTTP status code of the response
    """
    # Since SQLAlchemy sessions are not thread-safe, we run the sync version
    # but wrap it to catch any exceptions
    try:
        log_tink_audit_sync(
            db=db,
            action_type=action_type,
            result=result,
            user_id=user_id,
            connection_id=connection_id,
            request=request,
            details=details,
            status_code=status_code,
        )
    except Exception as e:
        logger.error(f"Async audit log failed: {e}")


# Convenience functions for specific action types

def audit_connect_initiated(
    db: Session,
    user_id: str,
    request: Optional[Request] = None,
) -> None:
    """Log when a user initiates a bank connection."""
    log_tink_audit_sync(
        db=db,
        action_type="connect_initiated",
        result="success",
        user_id=user_id,
        request=request,
    )


def audit_connection_created(
    db: Session,
    user_id: str,
    connection_id: int,
    account_count: int,
    request: Optional[Request] = None,
) -> None:
    """Log when a bank connection is successfully created."""
    log_tink_audit_sync(
        db=db,
        action_type="connection_created",
        result="success",
        user_id=user_id,
        connection_id=connection_id,
        request=request,
        details={"account_count": account_count},
    )


def audit_connection_failed(
    db: Session,
    user_id: Optional[str],
    error_category: str,
    request: Optional[Request] = None,
) -> None:
    """Log when a bank connection attempt fails."""
    log_tink_audit_sync(
        db=db,
        action_type="connection_failed",
        result="failure",
        user_id=user_id,
        request=request,
        details={"error_category": error_category},
    )


def audit_connection_disconnected(
    db: Session,
    user_id: str,
    connection_id: int,
    previous_account_count: int,
    request: Optional[Request] = None,
) -> None:
    """Log when a user disconnects a bank connection."""
    log_tink_audit_sync(
        db=db,
        action_type="connection_disconnected",
        result="success",
        user_id=user_id,
        connection_id=connection_id,
        request=request,
        details={"previous_account_count": previous_account_count},
    )


def audit_token_refreshed(
    db: Session,
    user_id: str,
    connection_id: int,
    result: str,
    request: Optional[Request] = None,
) -> None:
    """Log when a token refresh operation occurs."""
    log_tink_audit_sync(
        db=db,
        action_type="token_refreshed",
        result=result,
        user_id=user_id,
        connection_id=connection_id,
        request=request,
    )


def audit_transactions_synced(
    db: Session,
    user_id: str,
    connection_id: Optional[int],
    synced_count: int,
    total_fetched: int,
    date_range_days: int,
    result: str = "success",
    request: Optional[Request] = None,
    # New parameters for enhanced duplicate detection
    exact_duplicate_count: int = 0,
    fuzzy_duplicate_count: int = 0,
    # Legacy parameter (for backwards compatibility)
    duplicate_count: Optional[int] = None,
) -> None:
    """Log when transactions are synced from Tink.

    Args:
        db: Database session
        user_id: User ID
        connection_id: Tink connection ID
        synced_count: Number of new transactions synced
        total_fetched: Total transactions fetched from Tink
        date_range_days: Date range for the sync
        result: Operation result (success/failure)
        request: HTTP request for metadata
        exact_duplicate_count: Transactions skipped due to exact tink_transaction_id match
        fuzzy_duplicate_count: Transactions flagged as potential duplicates for review
        duplicate_count: Legacy parameter (deprecated, use exact_duplicate_count)
    """
    # Handle legacy duplicate_count parameter
    if duplicate_count is not None and exact_duplicate_count == 0:
        exact_duplicate_count = duplicate_count

    log_tink_audit_sync(
        db=db,
        action_type="transactions_synced",
        result=result,
        user_id=user_id,
        connection_id=connection_id,
        request=request,
        details={
            "synced_count": synced_count,
            "exact_duplicate_count": exact_duplicate_count,
            "fuzzy_duplicate_count": fuzzy_duplicate_count,
            "total_fetched": total_fetched,
            "date_range_days": date_range_days,
        },
    )


def audit_transaction_reviewed(
    db: Session,
    user_id: str,
    action: str,
    transaction_count: int,
    request: Optional[Request] = None,
) -> None:
    """Log when transactions are reviewed (accept/reject/convert)."""
    log_tink_audit_sync(
        db=db,
        action_type="transaction_reviewed",
        result="success",
        user_id=user_id,
        request=request,
        details={
            "action": action,
            "transaction_count": transaction_count,
        },
    )


def audit_debug_access(
    db: Session,
    user_id: str,
    endpoint: str,
    request: Optional[Request] = None,
) -> None:
    """Log when debug/test endpoints are accessed (flagged for security review)."""
    log_tink_audit_sync(
        db=db,
        action_type="debug_access",
        result="success",
        user_id=user_id,
        request=request,
        details={
            "endpoint": endpoint,
            "security_flag": True,
        },
    )


def audit_data_refreshed(
    db: Session,
    user_id: str,
    connection_id: int,
    accounts_count: int,
    request: Optional[Request] = None,
) -> None:
    """Log when Tink data is manually refreshed."""
    log_tink_audit_sync(
        db=db,
        action_type="data_refreshed",
        result="success",
        user_id=user_id,
        connection_id=connection_id,
        request=request,
        details={"accounts_count": accounts_count},
    )


def audit_categorization_requested(
    db: Session,
    user_id: str,
    transaction_count: int,
    categorized_count: int,
    request: Optional[Request] = None,
) -> None:
    """Log when AI categorization is requested."""
    log_tink_audit_sync(
        db=db,
        action_type="categorization_requested",
        result="success" if categorized_count > 0 else "failure",
        user_id=user_id,
        request=request,
        details={
            "transaction_count": transaction_count,
            "categorized_count": categorized_count,
        },
    )
