"""
Enable Banking Router

Handles PSD2 bank connections via Enable Banking API.
Provides auth flow, connection management, and transaction sync.

Rate Limits (per user):
- /aspsps: 60/minute - bank list query
- /auth: 10/hour - auth flow initiation
- /callback: 10/hour - auth callback
- /connections: 60/minute - list connections
- /connections/{id}: 30/hour - delete connection
- /sync: 50/day - transaction sync (heavy)
"""

import secrets
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from slowapi import Limiter

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, EnableBankingConnection, BankTransaction
from ..services.enable_banking_service import enable_banking_service, EnableBankingAPIError

logger = logging.getLogger(__name__)


def get_limiter(request: Request) -> Limiter:
    """Get the limiter instance from app state."""
    return request.app.state.limiter


def _detect_internal_transfer(tx: dict) -> bool:
    """Detect internal transfers from Enable Banking raw transaction data.

    Catches: ING Smart Saver, own-account transfers, savings account transfers,
    and same-bank same-person transfers.
    """
    remittance = tx.get("remittance_information", [])
    remittance_text = " ".join(remittance) if isinstance(remittance, list) else str(remittance or "")
    remittance_lower = remittance_text.lower()

    # Pattern 1: ING Smart Saver auto-savings
    if "smart saver" in remittance_lower:
        return True

    # Pattern 2: Own-account transfer ("Przelew własny")
    if "przelew własny" in remittance_lower:
        return True

    # Pattern 3: Savings account transfer
    if "konto oszczędnościowe" in remittance_lower:
        return True

    # Pattern 4: Same bank, same person (debtor_agent BIC == creditor_agent BIC)
    debtor_agent = tx.get("debtor_agent") or {}
    creditor_agent = tx.get("creditor_agent") or {}
    if (debtor_agent.get("bic_fi") and
            debtor_agent.get("bic_fi") == creditor_agent.get("bic_fi")):
        debtor_addr = (tx.get("debtor") or {}).get("postal_address") or {}
        creditor_addr = (tx.get("creditor") or {}).get("postal_address") or {}
        debtor_lines = debtor_addr.get("address_line") or []
        creditor_lines = creditor_addr.get("address_line") or []
        if debtor_lines and creditor_lines and debtor_lines[0] == creditor_lines[0]:
            return True

    return False


router = APIRouter(
    prefix="/banking/enablebanking",
    tags=["enable-banking"],
    responses={404: {"description": "Not found"}},
)


# ============================================================================
# Pydantic Models
# ============================================================================

class ASPSPResponse(BaseModel):
    name: str
    country: str
    logo: Optional[str] = None
    bic: Optional[str] = None
    transaction_total_days: Optional[str] = None
    payment_auth_methods: Optional[list] = None


class AuthRequest(BaseModel):
    aspsp_name: str
    aspsp_country: str = "PL"
    redirect_url: str


class AuthResponse(BaseModel):
    url: str
    state: str


class CallbackRequest(BaseModel):
    code: str
    state: str


class ConnectionResponse(BaseModel):
    id: int
    aspsp_name: str
    aspsp_country: str
    valid_until: str
    accounts: Optional[list] = None
    is_active: bool
    last_sync_at: Optional[str] = None
    created_at: str


class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    exact_duplicate_count: int
    total_fetched: int
    message: str


# ============================================================================
# In-memory pending auth state (expires after 15 minutes)
# For production, consider moving to DB like TinkPendingAuth
# ============================================================================

_PENDING_AUTH: dict = {}  # state_token → {user_id, aspsp_name, aspsp_country, expires_at}


def _cleanup_expired_auth():
    """Remove expired pending auth entries."""
    now = datetime.now()
    expired = [k for k, v in _PENDING_AUTH.items() if v["expires_at"] < now]
    for k in expired:
        del _PENDING_AUTH[k]


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/aspsps")
async def list_aspsps(
    http_request: Request,
    country: str = Query(default="PL", description="ISO country code"),
    current_user: User = Depends(get_current_user),
):
    """List available banks (ASPSPs) for a country."""
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    try:
        aspsps = await enable_banking_service.get_aspsps(country)
        return {"aspsps": aspsps}
    except EnableBankingAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.post("/auth", response_model=AuthResponse)
async def start_auth(
    http_request: Request,
    body: AuthRequest,
    current_user: User = Depends(get_current_user),
):
    """Start bank authorization flow. Returns URL to redirect user to."""
    limiter = get_limiter(http_request)
    await limiter.check("10/hour", http_request)

    _cleanup_expired_auth()

    # Generate CSRF-safe state token
    state = secrets.token_urlsafe(32)

    try:
        result = await enable_banking_service.start_auth(
            aspsp_name=body.aspsp_name,
            aspsp_country=body.aspsp_country,
            redirect_url=body.redirect_url,
            state=state,
        )

        # Store pending auth for callback validation
        _PENDING_AUTH[state] = {
            "user_id": current_user.household_id,
            "aspsp_name": body.aspsp_name,
            "aspsp_country": body.aspsp_country,
            "authorization_id": result.get("authorization_id"),
            "expires_at": datetime.now() + timedelta(minutes=15),
        }

        return AuthResponse(url=result["url"], state=state)
    except EnableBankingAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.post("/callback", response_model=ConnectionResponse)
async def handle_callback(
    http_request: Request,
    body: CallbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exchange authorization code for session and save connection."""
    limiter = get_limiter(http_request)
    await limiter.check("10/hour", http_request)

    _cleanup_expired_auth()

    # Validate state token
    pending = _PENDING_AUTH.pop(body.state, None)
    if not pending:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired state token. Please restart the bank connection flow."
        )

    if pending["user_id"] != current_user.household_id:
        raise HTTPException(status_code=403, detail="State token user mismatch.")

    try:
        # Exchange code for session
        session_data = await enable_banking_service.create_session(body.code)

        session_id = session_data.get("session_id")
        if not session_id:
            raise HTTPException(status_code=500, detail="No session_id in Enable Banking response.")

        # Extract account info
        accounts_raw = session_data.get("accounts", [])
        accounts = []
        for acc in accounts_raw:
            account_id = acc.get("account_id") or {}
            accounts.append({
                "uid": acc.get("uid"),
                "iban": account_id.get("iban", ""),
                "name": account_id.get("other", acc.get("uid", "")),
                "currency": acc.get("currency", "PLN"),
            })

        # Parse consent validity
        access_info = session_data.get("access", {})
        valid_until_str = access_info.get("valid_until", "")
        if valid_until_str:
            try:
                valid_until = datetime.fromisoformat(valid_until_str.replace("Z", "+00:00"))
            except ValueError:
                valid_until = datetime.now() + timedelta(days=90)
        else:
            valid_until = datetime.now() + timedelta(days=90)

        # Check for existing connection and deactivate
        existing = db.query(EnableBankingConnection).filter(
            EnableBankingConnection.user_id == current_user.household_id,
            EnableBankingConnection.aspsp_name == pending["aspsp_name"],
            EnableBankingConnection.is_active == True,
        ).first()

        if existing:
            existing.is_active = False
            try:
                await enable_banking_service.delete_session(existing.session_id)
            except EnableBankingAPIError:
                logger.warning(f"Failed to delete old EB session {existing.session_id}")

        # Create new connection
        connection = EnableBankingConnection(
            user_id=current_user.household_id,
            session_id=session_id,
            aspsp_name=pending["aspsp_name"],
            aspsp_country=pending["aspsp_country"],
            valid_until=valid_until,
            accounts=accounts,
            is_active=True,
        )
        db.add(connection)
        db.commit()
        db.refresh(connection)

        return ConnectionResponse(
            id=connection.id,
            aspsp_name=connection.aspsp_name,
            aspsp_country=connection.aspsp_country,
            valid_until=connection.valid_until.isoformat(),
            accounts=connection.accounts,
            is_active=connection.is_active,
            last_sync_at=None,
            created_at=connection.created_at.isoformat(),
        )

    except EnableBankingAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))


@router.get("/connections")
async def list_connections(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List active Enable Banking connections for current user."""
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    connections = db.query(EnableBankingConnection).filter(
        EnableBankingConnection.user_id == current_user.household_id,
        EnableBankingConnection.is_active == True,
    ).all()

    return [
        ConnectionResponse(
            id=c.id,
            aspsp_name=c.aspsp_name,
            aspsp_country=c.aspsp_country,
            valid_until=c.valid_until.isoformat() if c.valid_until else "",
            accounts=c.accounts,
            is_active=c.is_active,
            last_sync_at=c.last_sync_at.isoformat() if c.last_sync_at else None,
            created_at=c.created_at.isoformat() if c.created_at else "",
        )
        for c in connections
    ]


@router.delete("/connections/{connection_id}")
async def delete_connection(
    http_request: Request,
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate an Enable Banking connection and revoke the session."""
    limiter = get_limiter(http_request)
    await limiter.check("30/hour", http_request)

    connection = db.query(EnableBankingConnection).filter(
        EnableBankingConnection.id == connection_id,
        EnableBankingConnection.user_id == current_user.household_id,
    ).first()

    if not connection:
        raise HTTPException(status_code=404, detail="Connection not found.")

    # Revoke the session on Enable Banking's side
    try:
        await enable_banking_service.delete_session(connection.session_id)
    except EnableBankingAPIError as e:
        logger.warning(f"Failed to revoke EB session {connection.session_id}: {e}")

    connection.is_active = False
    db.commit()

    return {"success": True, "message": "Connection disconnected."}


@router.post("/sync", response_model=SyncResponse)
async def sync_transactions(
    http_request: Request,
    days: int = Query(default=30, ge=1, le=730, description="Number of days to sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sync transactions from Enable Banking to local database.

    Fetches transactions from all accounts in the user's active EB connection
    and stores them in bank_transactions table with provider="enablebanking".
    Dedup by entry_reference or generated unique ID.
    """
    limiter = get_limiter(http_request)
    await limiter.check("50/day", http_request)

    connection = db.query(EnableBankingConnection).filter(
        EnableBankingConnection.user_id == current_user.household_id,
        EnableBankingConnection.is_active == True,
    ).first()

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="No active Enable Banking connection. Please connect your bank first."
        )

    if not connection.accounts:
        raise HTTPException(
            status_code=400,
            detail="Connection has no linked accounts."
        )

    try:
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        total_fetched = 0
        synced_count = 0
        exact_duplicate_count = 0
        seen_tx_ids = set()

        for account in connection.accounts:
            account_uid = account.get("uid")
            if not account_uid:
                continue

            try:
                transactions = await enable_banking_service.get_transactions(
                    account_uid, date_from=from_date
                )
            except EnableBankingAPIError as e:
                logger.warning(f"Failed to fetch EB transactions for {account_uid}: {e}")
                continue

            total_fetched += len(transactions)

            for tx in transactions:
                # Dedup key: entry_reference is the stable bank ID
                entry_ref = tx.get("entry_reference", "")
                tx_id = tx.get("transaction_id", "")

                dedup_id = entry_ref or tx_id
                if not dedup_id:
                    logger.warning("EB transaction missing entry_reference and transaction_id, skipping")
                    continue

                # Build unique ID for tink_transaction_id column
                unique_tx_id = entry_ref or f"eb:{account_uid}:{tx_id}"

                # In-batch dedup
                if unique_tx_id in seen_tx_ids:
                    exact_duplicate_count += 1
                    continue
                seen_tx_ids.add(unique_tx_id)

                # Check for existing by provider_transaction_id
                if entry_ref:
                    existing = db.query(BankTransaction).filter(
                        BankTransaction.user_id == current_user.household_id,
                        BankTransaction.provider_transaction_id == entry_ref,
                    ).first()
                    if existing:
                        exact_duplicate_count += 1
                        continue

                # Check by tink_transaction_id
                existing_by_id = db.query(BankTransaction).filter(
                    BankTransaction.tink_transaction_id == unique_tx_id,
                ).first()
                if existing_by_id:
                    exact_duplicate_count += 1
                    continue

                # Parse amount
                amount_data = tx.get("transaction_amount", {})
                try:
                    amount = float(amount_data.get("amount", "0"))
                except (ValueError, TypeError):
                    amount = 0.0
                currency = amount_data.get("currency", "PLN")

                # Parse date
                booking_date_str = tx.get("booking_date", "")
                if booking_date_str:
                    try:
                        tx_date = datetime.strptime(booking_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        tx_date = datetime.now().date()
                else:
                    tx_date = datetime.now().date()

                # Parse booked datetime
                booked_dt = None
                if booking_date_str:
                    try:
                        booked_dt = datetime.strptime(booking_date_str, "%Y-%m-%d")
                    except ValueError:
                        pass

                # Extract merchant/description
                creditor = tx.get("creditor", {}) or {}
                debtor = tx.get("debtor", {}) or {}
                creditor_name = creditor.get("name")
                debtor_name = debtor.get("name")
                remittance_info = tx.get("remittance_information", [])
                remittance_text = " ".join(remittance_info) if isinstance(remittance_info, list) else str(remittance_info or "")

                # credit_debit_indicator: CRDT (income) or DBIT (expense)
                cdi = tx.get("credit_debit_indicator", "")

                if cdi == "DBIT" or amount < 0:
                    merchant_name = creditor_name
                    description_display = creditor_name or remittance_text or "Unknown transaction"
                    suggested_type = "expense"
                else:
                    merchant_name = debtor_name
                    description_display = debtor_name or remittance_text or "Unknown transaction"
                    suggested_type = "income"

                mcc = tx.get("merchant_category_code", "")

                bank_tx = BankTransaction(
                    user_id=current_user.household_id,
                    tink_transaction_id=unique_tx_id,
                    tink_account_id=account_uid,
                    provider_transaction_id=entry_ref or None,
                    provider="enablebanking",
                    amount=amount,
                    currency=currency,
                    date=tx_date,
                    booked_datetime=booked_dt,
                    description_display=description_display,
                    description_original=remittance_info[0] if isinstance(remittance_info, list) and remittance_info else remittance_text,
                    description_detailed=remittance_text,
                    merchant_name=merchant_name,
                    merchant_category_code=mcc if mcc else None,
                    tink_category_id=None,
                    tink_category_name=None,
                    suggested_type=suggested_type,
                    suggested_category=None,
                    status="pending",
                    is_internal_transfer=_detect_internal_transfer(tx),
                    raw_data=tx,
                )
                db.add(bank_tx)
                synced_count += 1

        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()

        message_parts = [f"Synced {synced_count} new transactions from Enable Banking"]
        if exact_duplicate_count > 0:
            message_parts.append(f"{exact_duplicate_count} duplicates skipped")

        return SyncResponse(
            success=True,
            synced_count=synced_count,
            exact_duplicate_count=exact_duplicate_count,
            total_fetched=total_fetched,
            message=", ".join(message_parts),
        )

    except EnableBankingAPIError as e:
        logger.error(f"Enable Banking API error during sync: {str(e)}")
        raise HTTPException(
            status_code=e.status_code,
            detail=f"Enable Banking API error: {str(e)}",
        )
    except Exception as e:
        logger.error(f"Error syncing Enable Banking transactions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error syncing transactions: {str(e)}",
        )
