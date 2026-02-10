"""
Tink Sync Service

Reusable sync logic for Tink connections.

This service provides the core sync functionality that can be used by:
- API endpoints (user-initiated sync)
- Background jobs (automatic sync)
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from fastapi import Request

from ..models import TinkConnection
from ..services.tink_service import tink_service
from ..services.audit_service import audit_data_refreshed
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


async def sync_tink_connection(
    connection: TinkConnection,
    db: Session,
    http_request: Optional[Request] = None
) -> Dict[str, Any]:
    """
    Sync a Tink connection - re-fetches accounts and updates stored data.

    This function can be called from:
    - The /refresh-data endpoint (user-initiated sync)
    - Background job scheduler (automatic sync)

    Args:
        connection: TinkConnection instance to sync
        db: Database session
        http_request: Optional HTTP request (for audit logging)

    Returns:
        dict: Result with success status, message, and account count

    Raises:
        Exception: If sync fails
    """
    try:
        # Get valid access token (refreshes if expired)
        access_token = await tink_service.get_valid_access_token(connection, db)

        # Refresh accounts data from Tink API
        accounts = await tink_service.fetch_accounts(access_token)

        # Update stored account data
        account_ids = [acc["id"] for acc in accounts]
        account_details = {
            acc["id"]: {
                "name": acc.get("name", "Unknown Account"),
                "iban": acc.get("identifiers", {}).get("iban", {}).get("iban"),
                "currency": acc.get("balances", {}).get("booked", {}).get("amount", {}).get("currencyCode", "PLN"),
                "type": acc.get("type"),
            }
            for acc in accounts
        }

        connection.accounts = account_ids
        connection.account_details = account_details
        connection.last_sync_at = datetime.now()
        db.commit()

        # Audit: Data refreshed (only if called from endpoint with http_request)
        if http_request:
            audit_data_refreshed(
                db,
                connection.user_id,
                connection.id,
                len(accounts),
                http_request
            )

        return {
            "success": True,
            "message": "Data refreshed successfully",
            "accounts_count": len(accounts),
            "connection_id": connection.id,
            "user_id": connection.user_id,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error syncing Tink connection {connection.id}: {str(e)}")
        raise
