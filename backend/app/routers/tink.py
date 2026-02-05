"""
Tink API Router

Handles Tink OAuth flow and bank connection management.

Rate Limits (per user):
- /connect: 10/hour - prevents connection abuse
- /callback (POST): 20/hour - callback abuse prevention
- /callback (GET): 20/hour - callback abuse prevention
- /connections: 60/minute - read-only, reasonable access
- /connections/{id} DELETE: 10/hour - destructive action
- /test: 10/minute - debug endpoint
- /providers: 30/minute - provider list fetch
- /refresh-data: 100/day - Tink API quota protection
- /debug-data: 10/minute - debug endpoint, heavy payload
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import logging

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkConnection, BankTransaction
from ..services.tink_service import tink_service
from ..services.subscription_service import SubscriptionService
from ..security import require_debug_mode, is_debug_enabled

# Rate limiting
from slowapi import Limiter

logger = logging.getLogger(__name__)

# Import the limiter from main - we'll use a function to get it from app state
def get_limiter(request: Request) -> Limiter:
    """Get the limiter instance from app state."""
    return request.app.state.limiter

router = APIRouter(
    prefix="/banking/tink",
    tags=["tink"],
    responses={404: {"description": "Not found"}},
)


# Pydantic models
class ConnectRequest(BaseModel):
    locale: str = "en_US"


class ConnectResponse(BaseModel):
    tink_link_url: str
    state: str


class CallbackRequest(BaseModel):
    state: str  # State token for CSRF protection
    code: Optional[str] = None  # Authorization code from Tink Link (for one-time flow)
    credentials_id: Optional[str] = None  # Credentials ID from Tink Link callback


class AccountDetail(BaseModel):
    id: str
    name: Optional[str] = None
    iban: Optional[str] = None
    currency: Optional[str] = None
    type: Optional[str] = None


class TinkConnectionResponse(BaseModel):
    id: int
    is_active: bool
    last_sync_at: Optional[datetime] = None
    created_at: datetime
    accounts: List[AccountDetail] = []

    class Config:
        from_attributes = True


class CallbackResponse(BaseModel):
    success: bool
    connection_id: int
    accounts: List[AccountDetail]
    message: str


class DisconnectResponse(BaseModel):
    success: bool
    message: str


# Endpoints

@router.post("/connect", response_model=ConnectResponse)
async def initiate_connection(
    request: ConnectRequest,
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initiate Tink Link flow to connect user's bank account.

    Returns a URL to redirect the user to Tink Link.

    Rate limit: 10/hour per user
    """
    # Rate limit: 10 connections per hour per user
    limiter = get_limiter(http_request)
    await limiter.check("10/hour", http_request)
    # Check subscription - bank integration requires premium
    can_use, message = SubscriptionService.can_use_bank_integration(current_user.id, db)
    if not can_use:
        raise HTTPException(status_code=403, detail=message)

    try:
        # Use simple one-time flow (recommended for testing)
        tink_link_url, state = await tink_service.generate_simple_connect_url(
            user_id=current_user.id,
            db=db,
            locale=request.locale
        )

        return ConnectResponse(
            tink_link_url=tink_link_url,
            state=state
        )

    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error(f"Error initiating Tink connection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error initiating connection: {str(e)}")


@router.post("/callback", response_model=CallbackResponse)
async def handle_callback(
    http_request: Request,
    request: CallbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Handle OAuth callback from Tink after user authorization.

    Exchanges the authorization code for tokens and creates the connection.

    Rate limit: 20/hour per user
    """
    # Rate limit: 20 callbacks per hour per user
    limiter = get_limiter(http_request)
    await limiter.check("20/hour", http_request)
    try:
        # Verify state token
        stored_user_id = tink_service.verify_state_token(request.state)
        if not stored_user_id:
            raise HTTPException(status_code=400, detail="Invalid or expired state token")

        if stored_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="State token does not match current user")

        # Create connection - for one-time flow, use code from callback
        connection = await tink_service.create_connection_from_callback(
            db=db,
            user_id=current_user.id,
            state=request.state,
            code=request.code,
            credentials_id=request.credentials_id,
        )

        # Format account details for response
        accounts = []
        if connection.account_details:
            for acc_id, details in connection.account_details.items():
                accounts.append(AccountDetail(
                    id=acc_id,
                    name=details.get("name"),
                    iban=details.get("iban"),
                    currency=details.get("currency"),
                    type=details.get("type"),
                ))

        return CallbackResponse(
            success=True,
            connection_id=connection.id,
            accounts=accounts,
            message="Bank account connected successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling Tink callback: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error connecting bank account: {str(e)}")


@router.get("/callback")
async def handle_callback_redirect(
    http_request: Request,
    code: str = Query(..., description="Authorization code from Tink"),
    state: str = Query(..., description="State token for CSRF protection"),
):
    """
    Handle GET callback redirect from Tink Link.

    This endpoint is called by Tink Link after user authorization.
    The frontend should catch this redirect and call POST /callback with the code.

    Rate limit: 20/hour (per IP, since unauthenticated)
    """
    # Rate limit: 20 callbacks per hour (IP-based since no auth)
    limiter = get_limiter(http_request)
    await limiter.check("20/hour", http_request)

    # This is just a placeholder - the frontend handles the redirect
    # and calls POST /callback with proper authentication
    return {
        "message": "Callback received. Frontend should handle this.",
        "code": code[:10] + "...",  # Don't expose full code
        "state": state[:10] + "..."
    }


@router.get("/connections", response_model=List[TinkConnectionResponse])
async def get_connections(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all Tink connections for the current user.

    Rate limit: 60/minute per user
    """
    # Rate limit: 60 requests per minute per user (read-only, reasonable access)
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)
    try:
        connections = db.query(TinkConnection).filter(
            TinkConnection.user_id == current_user.id,
            TinkConnection.is_active == True
        ).all()

        result = []
        for conn in connections:
            accounts = []
            if conn.account_details:
                for acc_id, details in conn.account_details.items():
                    accounts.append(AccountDetail(
                        id=acc_id,
                        name=details.get("name"),
                        iban=details.get("iban"),
                        currency=details.get("currency"),
                        type=details.get("type"),
                    ))

            result.append(TinkConnectionResponse(
                id=conn.id,
                is_active=conn.is_active,
                last_sync_at=conn.last_sync_at,
                created_at=conn.created_at,
                accounts=accounts
            ))

        return result

    except Exception as e:
        logger.error(f"Error fetching Tink connections: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching connections: {str(e)}")


@router.delete("/connections/{connection_id}", response_model=DisconnectResponse)
async def disconnect(
    http_request: Request,
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect a Tink connection (soft delete).

    Rate limit: 10/hour per user (destructive action)
    """
    # Rate limit: 10 disconnects per hour per user (destructive action)
    limiter = get_limiter(http_request)
    await limiter.check("10/hour", http_request)
    try:
        connection = db.query(TinkConnection).filter(
            TinkConnection.id == connection_id,
            TinkConnection.user_id == current_user.id
        ).first()

        if not connection:
            raise HTTPException(status_code=404, detail="Connection not found")

        # Soft delete
        connection.is_active = False
        db.commit()

        return DisconnectResponse(
            success=True,
            message="Bank connection disconnected successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error disconnecting Tink connection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error disconnecting: {str(e)}")


@router.get("/test")
async def test_tink_api(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    _debug: None = Depends(require_debug_mode),  # SECURITY: Only available in debug mode
):
    """
    Test if the Tink API router is working.
    SECURITY: This endpoint is protected and only available in non-production environments.

    Rate limit: 10/minute per user
    """
    # Rate limit: 10 requests per minute per user (debug endpoint)
    limiter = get_limiter(http_request)
    await limiter.check("10/minute", http_request)
    return {
        "status": "ok",
        "message": "Tink API is configured",
        "client_id_set": bool(tink_service.client_id),
        "client_secret_set": bool(tink_service.client_secret),
        # SECURITY: Don't expose redirect_uri in test endpoint
        "timestamp": datetime.now().isoformat()
    }


@router.get("/providers")
async def get_providers(
    http_request: Request,
    market: str = "PL",
    current_user: User = Depends(get_current_user),
):
    """
    Get list of available bank providers for a market with their logos.

    Returns provider data including:
    - displayName: Bank display name
    - financialInstitutionId: UUID for the bank
    - images: { icon: "https://cdn.tink.se/...", banner: null }

    Rate limit: 30/minute per user
    """
    # Rate limit: 30 requests per minute per user (provider list fetch)
    limiter = get_limiter(http_request)
    await limiter.check("30/minute", http_request)
    try:
        providers = await tink_service.fetch_providers(market)

        # Extract relevant data for frontend
        result = []
        for provider in providers:
            result.append({
                "name": provider.get("displayName"),
                "financialInstitutionId": provider.get("financialInstitutionId"),
                "accessType": provider.get("accessType"),
                "images": provider.get("images", {}),
            })

        return {
            "market": market,
            "count": len(result),
            "providers": result,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error fetching providers: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching providers: {str(e)}")


@router.post("/refresh-data")
async def refresh_tink_data(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Refresh data from Tink - re-fetches accounts and updates stored data.

    Rate limit: 100/day per user (Tink API quota protection)
    """
    # Rate limit: 100 syncs per day per user (Tink API quota protection)
    limiter = get_limiter(http_request)
    await limiter.check("100/day", http_request)
    try:
        connection = db.query(TinkConnection).filter(
            TinkConnection.user_id == current_user.id,
            TinkConnection.is_active == True
        ).first()

        if not connection:
            return {"error": "No active Tink connection found", "success": False}

        # Get valid access token
        access_token = await tink_service.get_valid_access_token(connection, db)

        # Refresh accounts data
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

        return {
            "success": True,
            "message": "Data refreshed successfully",
            "accounts_count": len(accounts),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error refreshing Tink data: {str(e)}")
        return {"error": str(e), "success": False}


@router.get("/debug-data")
async def get_debug_data(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    _debug: None = Depends(require_debug_mode),  # SECURITY: Only available in debug mode
):
    """
    Fetch all available data from Tink for debugging/testing.
    Returns accounts, transactions, balances, and raw API responses.

    SECURITY: This endpoint is protected and only available in non-production environments.

    Rate limit: 10/minute per user (debug endpoint, heavy payload)
    """
    # Rate limit: 10 requests per minute per user (debug endpoint, heavy payload)
    limiter = get_limiter(http_request)
    await limiter.check("10/minute", http_request)
    try:
        # Get user's active Tink connection
        connection = db.query(TinkConnection).filter(
            TinkConnection.user_id == current_user.id,
            TinkConnection.is_active == True
        ).first()

        if not connection:
            return {
                "error": "No active Tink connection found",
                "has_connection": False
            }

        # Get valid access token (refresh if needed)
        access_token = await tink_service.get_valid_access_token(connection, db)

        # Fetch accounts
        accounts_raw = await tink_service.fetch_accounts(access_token)

        # Fetch transactions (last 90 days)
        from_date = datetime.now() - timedelta(days=90)
        transactions_response = await tink_service.fetch_transactions(
            access_token,
            from_date=from_date
        )

        # Fetch balances for each account (included in accounts data)
        # Parse and organize data
        accounts_processed = []
        for acc in accounts_raw:
            account_data = {
                "id": acc.get("id"),
                "name": acc.get("name"),
                "type": acc.get("type"),
                "identifiers": acc.get("identifiers", {}),
                "balances": acc.get("balances", {}),
                "dates": acc.get("dates", {}),
                "financialInstitutionId": acc.get("financialInstitutionId"),
                "customerSegment": acc.get("customerSegment"),
            }
            accounts_processed.append(account_data)

        transactions_processed = []
        for tx in transactions_response.get("transactions", []):
            tx_data = {
                "id": tx.get("id"),
                "accountId": tx.get("accountId"),
                "amount": tx.get("amount", {}),
                "descriptions": tx.get("descriptions", {}),
                "dates": tx.get("dates", {}),
                "identifiers": tx.get("identifiers", {}),
                "types": tx.get("types", {}),
                "status": tx.get("status"),
                "providerMutability": tx.get("providerMutability"),
                "merchantInformation": tx.get("merchantInformation", {}),
                "categories": tx.get("categories", {}),
            }
            transactions_processed.append(tx_data)

        return {
            "has_connection": True,
            "connection_info": {
                "id": connection.id,
                "created_at": connection.created_at.isoformat() if connection.created_at else None,
                "last_sync_at": connection.last_sync_at.isoformat() if connection.last_sync_at else None,
                "token_expires_at": connection.token_expires_at.isoformat() if connection.token_expires_at else None,
                "scopes": connection.scopes,
                "stored_accounts": connection.accounts,
                "stored_account_details": connection.account_details,
            },
            "accounts": {
                "count": len(accounts_processed),
                "data": accounts_processed,
                "raw": accounts_raw,
            },
            "transactions": {
                "count": len(transactions_processed),
                "period": f"Last 90 days (from {from_date.strftime('%Y-%m-%d')})",
                "next_page_token": transactions_response.get("nextPageToken"),
                "data": transactions_processed,
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Error fetching Tink debug data: {str(e)}")
        return {
            "error": str(e),
            "has_connection": True,
            "timestamp": datetime.now().isoformat()
        }
