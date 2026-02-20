"""
Bank Transactions Router

Handles syncing, viewing, and converting bank transactions from Tink.

Rate Limits (per user):
- /sync: 50/day - calls Tink API, heavy operation
- /categorize: 100/hour - AI categorization, compute-intensive
- / (list): 120/minute - standard read
- /stats: 120/minute - standard read
- /pending: 120/minute - standard read
- /{id}/convert: 200/hour - transaction conversion
- /{id}/reject: 200/hour - transaction update
- /{id}/accept: 200/hour - transaction update
- /{id}/reset: 100/hour - undo action
- /bulk/reject: 30/hour - bulk operation
- /bulk/accept: 30/hour - bulk operation
- /bulk/convert: 30/hour - bulk operation
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
import os

# Rate limiting
from slowapi import Limiter

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkConnection, BankTransaction, BankingConnection, Expense, Income, Settings
from ..services.tink_service import tink_service, TinkAPIError, TinkAPIRetryExhausted
from ..services.gocardless_service import gocardless_service, GoCardlessAPIError
from ..services.categorization_service import categorize_in_batches
from ..services.audit_service import (
    audit_transactions_synced,
    audit_transaction_reviewed,
    audit_categorization_requested,
)
from ..logging_utils import get_secure_logger
from ..schemas.errors import (
    token_expired_error,
    rate_limited_error,
    bank_unavailable_error,
    auth_failed_error,
    network_error,
    internal_error,
)

logger = get_secure_logger(__name__)


# Import the limiter from main - we'll use a function to get it from app state
def get_limiter(request: Request) -> Limiter:
    """Get the limiter instance from app state."""
    return request.app.state.limiter

router = APIRouter(
    prefix="/banking/transactions",
    tags=["bank-transactions"],
    responses={404: {"description": "Not found"}},
)


# ============================================================================
# Pydantic Models
# ============================================================================

class TransactionStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    converted = "converted"
    ignored = "ignored"  # Used for confirmed duplicates


class ConvertType(str, Enum):
    expense = "expense"
    income = "income"


class BankTransactionResponse(BaseModel):
    id: int
    tink_transaction_id: str
    tink_account_id: str
    provider: Optional[str] = "tink"
    amount: float
    currency: str
    date: date
    description_display: str
    description_original: Optional[str] = None
    merchant_name: Optional[str] = None
    tink_category_name: Optional[str] = None
    suggested_type: Optional[str] = None
    suggested_category: Optional[str] = None
    confidence_score: Optional[float] = None
    status: str
    is_duplicate: bool
    duplicate_of: Optional[int] = None
    duplicate_confidence: Optional[float] = None
    duplicate_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    exact_duplicate_count: int  # Skipped due to same tink_transaction_id
    fuzzy_duplicate_count: int  # Flagged as potential duplicates for review
    total_fetched: int
    message: str


class ConvertRequest(BaseModel):
    type: ConvertType
    category: str
    description: Optional[str] = None  # Override bank description


class ConvertResponse(BaseModel):
    success: bool
    transaction_id: int
    converted_to_type: str
    converted_to_id: int
    message: str


class BulkActionRequest(BaseModel):
    transaction_ids: List[int]


class BulkConvertRequest(BaseModel):
    transaction_ids: List[int]
    type: ConvertType
    category: str


class BulkActionResponse(BaseModel):
    success: bool
    processed_count: int
    message: str


class TransactionStats(BaseModel):
    total: int
    pending: int
    accepted: int
    rejected: int
    converted: int
    ignored: int = 0  # Confirmed duplicates


class CategorizeResponse(BaseModel):
    success: bool
    categorized_count: int
    total_processed: int
    message: str


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/sync", response_model=SyncResponse)
async def sync_transactions(
    http_request: Request,
    days: int = Query(default=90, ge=1, le=365, description="Number of days to sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync transactions from Tink to local database.

    Fetches transactions from the connected bank account and stores them
    in bank_transactions table. Duplicates are detected by tink_transaction_id.

    Rate limit: 50/day per user (calls Tink API, heavy operation)
    """
    # Rate limit: 50 syncs per day per user (calls Tink API, heavy operation)
    limiter = get_limiter(http_request)
    await limiter.check("50/day", http_request)
    # Get active Tink connection
    connection = db.query(TinkConnection).filter(
        TinkConnection.user_id == current_user.household_id,
        TinkConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="No active bank connection. Please connect your bank first."
        )

    try:
        # Get valid access token
        access_token = await tink_service.get_valid_access_token(connection, db)

        # Fetch transactions from Tink
        from_date = datetime.now() - timedelta(days=days)
        transactions_response = await tink_service.fetch_transactions(
            access_token,
            from_date=from_date
        )

        transactions = transactions_response.get("transactions", [])
        total_fetched = len(transactions)
        synced_count = 0
        exact_duplicate_count = 0
        fuzzy_duplicate_count = 0

        for tx in transactions:
            tink_tx_id = tx.get("id")
            provider_tx_id = tx.get("identifiers", {}).get("providerTransactionId")

            # Step 1: Check for exact provider_transaction_id match (100% duplicate)
            # The bank's transaction ID is stable across Tink reconnections,
            # while Tink's internal ID may change (especially in sandbox)
            if provider_tx_id:
                existing = db.query(BankTransaction).filter(
                    BankTransaction.user_id == current_user.household_id,
                    BankTransaction.provider_transaction_id == provider_tx_id
                ).first()

                if existing:
                    exact_duplicate_count += 1
                    continue

            # Parse transaction data
            amount_data = tx.get("amount", {})
            amount_value = amount_data.get("value", {})
            # Tink uses unscaledValue and scale (e.g., -15000 with scale 2 = -150.00)
            scale = int(amount_value.get("scale", "2"))
            unscaled = float(amount_value.get("unscaledValue", "0"))
            amount = unscaled / (10 ** scale)

            currency = amount_data.get("currencyCode", "PLN")

            # Parse date
            dates = tx.get("dates", {})
            booked_date_str = dates.get("booked")
            if booked_date_str:
                tx_date = datetime.strptime(booked_date_str, "%Y-%m-%d").date()
            else:
                tx_date = datetime.now().date()

            # Parse descriptions
            descriptions = tx.get("descriptions", {})
            description_display = descriptions.get("display", "Unknown transaction")
            description_original = descriptions.get("original")
            description_detailed = descriptions.get("detailed")

            # Parse merchant info
            merchant_info = tx.get("merchantInformation", {})
            merchant_name = merchant_info.get("merchantName")
            merchant_category_code = merchant_info.get("merchantCategoryCode")

            # Parse Tink categories - check enriched_data first (enrichment API), fallback to categories (basic API)
            enriched_categories = tx.get("enrichedData", {}).get("categories", {}) or tx.get("enriched_data", {}).get("categories", {})
            basic_categories = tx.get("categories", {})

            # Prefer enriched data, fallback to basic
            pfm_category = enriched_categories.get("pfm", {}) or basic_categories.get("pfm", {})
            tink_category_id = pfm_category.get("id")
            tink_category_name = pfm_category.get("name")

            # Determine suggested type based on amount
            suggested_type = "income" if amount > 0 else "expense"

            # Map Tink category to our category (basic mapping)
            suggested_category = map_tink_category(tink_category_id, suggested_type)

            tink_account_id = tx.get("accountId", "")

            # Create bank transaction record
            bank_tx = BankTransaction(
                user_id=current_user.household_id,
                tink_transaction_id=tink_tx_id,
                tink_account_id=tink_account_id,
                provider_transaction_id=provider_tx_id,
                amount=amount,
                currency=currency,
                date=tx_date,
                description_display=description_display,
                description_original=description_original,
                description_detailed=description_detailed,
                merchant_name=merchant_name,
                merchant_category_code=merchant_category_code,
                tink_category_id=tink_category_id,
                tink_category_name=tink_category_name,
                suggested_type=suggested_type,
                suggested_category=suggested_category,
                status="pending",
                raw_data=tx,
            )

            db.add(bank_tx)
            synced_count += 1

        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()

        # Audit: Transactions synced (one summary entry, not per-transaction)
        audit_transactions_synced(
            db=db,
            user_id=current_user.household_id,
            connection_id=connection.id,
            synced_count=synced_count,
            exact_duplicate_count=exact_duplicate_count,
            fuzzy_duplicate_count=fuzzy_duplicate_count,
            total_fetched=total_fetched,
            date_range_days=days,
            result="success",
            request=http_request,
        )

        # Build message
        message_parts = [f"Synced {synced_count} new transactions"]
        if exact_duplicate_count > 0:
            message_parts.append(f"{exact_duplicate_count} exact duplicates skipped")
        if fuzzy_duplicate_count > 0:
            message_parts.append(f"{fuzzy_duplicate_count} potential duplicates flagged for review")

        return SyncResponse(
            success=True,
            synced_count=synced_count,
            exact_duplicate_count=exact_duplicate_count,
            fuzzy_duplicate_count=fuzzy_duplicate_count,
            total_fetched=total_fetched,
            message=", ".join(message_parts)
        )

    except TinkAPIRetryExhausted as e:
        logger.error(f"Tink API retry exhausted during sync: {str(e)}")
        # Audit sync failure
        audit_transactions_synced(
            db=db,
            user_id=current_user.household_id,
            connection_id=connection.id if connection else None,
            synced_count=0,
            exact_duplicate_count=0,
            fuzzy_duplicate_count=0,
            total_fetched=0,
            date_range_days=days,
            result="failure",
            request=http_request,
        )
        error = bank_unavailable_error("Tink")
        return JSONResponse(status_code=503, content=error.model_dump())
    except TinkAPIError as e:
        logger.error(f"Tink API error during sync: {str(e)}")
        # Audit sync failure
        audit_transactions_synced(
            db=db,
            user_id=current_user.household_id,
            connection_id=connection.id if connection else None,
            synced_count=0,
            exact_duplicate_count=0,
            fuzzy_duplicate_count=0,
            total_fetched=0,
            date_range_days=days,
            result="failure",
            request=http_request,
        )
        # Check if it's a 401 Unauthorized (token expired)
        if "401" in str(e) or "Unauthorized" in str(e):
            error = token_expired_error()
            return JSONResponse(status_code=401, content=error.model_dump())
        else:
            error = auth_failed_error()
            return JSONResponse(status_code=403, content=error.model_dump())
    except Exception as e:
        logger.error(f"Error syncing transactions: {str(e)}")
        # Audit sync failure
        audit_transactions_synced(
            db=db,
            user_id=current_user.household_id,
            connection_id=connection.id if connection else None,
            synced_count=0,
            exact_duplicate_count=0,
            fuzzy_duplicate_count=0,
            total_fetched=0,
            date_range_days=days,
            result="failure",
            request=http_request,
        )
        # Check if it's a token expiration error
        error_str = str(e).lower()
        if "token expired" in error_str or "refresh token" in error_str:
            error = token_expired_error()
            return JSONResponse(status_code=401, content=error.model_dump())
        else:
            error = internal_error(str(e))
            return JSONResponse(status_code=500, content=error.model_dump())


@router.post("/sync-gocardless", response_model=SyncResponse)
async def sync_gocardless_transactions(
    http_request: Request,
    days: int = Query(default=90, ge=1, le=365, description="Number of days to sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync transactions from GoCardless (PSD2 Open Banking) to local database.

    Fetches transactions from all accounts in the user's active BankingConnection
    and stores them in bank_transactions table. Duplicates detected by
    internalTransactionId (provider_transaction_id).

    Rate limit: 50/day per user (calls GoCardless API, heavy operation)
    """
    limiter = get_limiter(http_request)
    await limiter.check("50/day", http_request)

    # Get active GoCardless BankingConnection for user
    connection = db.query(BankingConnection).filter(
        BankingConnection.user_id == current_user.household_id,
        BankingConnection.is_active == True
    ).first()

    if not connection:
        raise HTTPException(
            status_code=404,
            detail="No active GoCardless banking connection. Please connect your bank first."
        )

    if not connection.accounts:
        raise HTTPException(
            status_code=400,
            detail="Banking connection has no linked accounts."
        )

    try:
        from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        total_fetched = 0
        synced_count = 0
        exact_duplicate_count = 0
        # Track IDs added in this batch to catch cross-account duplicates
        # (e.g., ING internal transfers share the same internalTransactionId on both sides)
        seen_tx_ids = set()

        for account_id in connection.accounts:
            try:
                transactions = await gocardless_service.fetch_transactions(
                    account_id, from_date=from_date
                )
            except GoCardlessAPIError as e:
                logger.warning(f"Failed to fetch transactions for account {account_id}: {e}")
                continue

            total_fetched += len(transactions)

            for tx in transactions:
                # Dedup key: internalTransactionId is stable across reconnections
                internal_tx_id = tx.get("internalTransactionId")
                gc_transaction_id = tx.get("transactionId", "")

                # Use internalTransactionId for dedup if available, fall back to transactionId
                dedup_id = internal_tx_id or gc_transaction_id

                if not dedup_id:
                    logger.warning(f"Transaction missing both internalTransactionId and transactionId, skipping")
                    continue

                # Check for exact duplicate by provider_transaction_id
                if internal_tx_id:
                    existing = db.query(BankTransaction).filter(
                        BankTransaction.user_id == current_user.household_id,
                        BankTransaction.provider_transaction_id == internal_tx_id
                    ).first()

                    if existing:
                        exact_duplicate_count += 1
                        continue

                # Build a globally unique tink_transaction_id for GoCardless:
                # internalTransactionId is a unique hash, but transactionId is per-account sequential
                # (e.g., ING uses "D202602190000002" which repeats across accounts)
                unique_tx_id = internal_tx_id or f"gc:{account_id}:{gc_transaction_id}"

                # In-batch dedup: ING internal transfers share the same internalTransactionId
                # across both sides of the transfer (debit on account A, credit on account B)
                if unique_tx_id in seen_tx_ids:
                    exact_duplicate_count += 1
                    continue
                seen_tx_ids.add(unique_tx_id)

                # Check DB for existing record
                existing_by_tx_id = db.query(BankTransaction).filter(
                    BankTransaction.tink_transaction_id == unique_tx_id
                ).first()

                if existing_by_tx_id:
                    exact_duplicate_count += 1
                    continue

                # Parse amount: GoCardless sends string like "-95.35"
                amount_data = tx.get("transactionAmount", {})
                try:
                    amount = float(amount_data.get("amount", "0"))
                except (ValueError, TypeError):
                    amount = 0.0

                currency = amount_data.get("currency", "PLN")

                # Parse date
                booking_date_str = tx.get("bookingDate")
                if booking_date_str:
                    try:
                        tx_date = datetime.strptime(booking_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        tx_date = datetime.now().date()
                else:
                    tx_date = datetime.now().date()

                # Extract merchant/description
                creditor_name = tx.get("creditorName")
                debtor_name = tx.get("debtorName")
                remittance_info = tx.get("remittanceInformationUnstructured", "")

                # For expenses (negative amount), creditor is the merchant
                # For income (positive amount), debtor is the source
                if amount < 0:
                    merchant_name = creditor_name
                    description_display = creditor_name or remittance_info or "Unknown transaction"
                else:
                    merchant_name = debtor_name
                    description_display = debtor_name or remittance_info or "Unknown transaction"

                suggested_type = "income" if amount > 0 else "expense"

                # proprietaryBankTransactionCode e.g. "PURCHASE", "TRANSFER"
                bank_tx_code = tx.get("proprietaryBankTransactionCode", "")

                bank_tx = BankTransaction(
                    user_id=current_user.household_id,
                    tink_transaction_id=unique_tx_id,
                    tink_account_id=account_id,
                    provider_transaction_id=internal_tx_id,
                    provider="gocardless",
                    amount=amount,
                    currency=currency,
                    date=tx_date,
                    description_display=description_display,
                    description_original=remittance_info,
                    description_detailed=remittance_info,
                    merchant_name=merchant_name,
                    merchant_category_code=bank_tx_code,
                    tink_category_id=None,
                    tink_category_name=None,
                    suggested_type=suggested_type,
                    suggested_category=None,
                    status="pending",
                    raw_data=tx,
                )

                db.add(bank_tx)
                synced_count += 1

        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()

        message_parts = [f"Synced {synced_count} new transactions from GoCardless"]
        if exact_duplicate_count > 0:
            message_parts.append(f"{exact_duplicate_count} duplicates skipped")

        return SyncResponse(
            success=True,
            synced_count=synced_count,
            exact_duplicate_count=exact_duplicate_count,
            fuzzy_duplicate_count=0,
            total_fetched=total_fetched,
            message=", ".join(message_parts)
        )

    except GoCardlessAPIError as e:
        logger.error(f"GoCardless API error during sync: {str(e)}")
        raise HTTPException(
            status_code=e.status_code,
            detail=f"GoCardless API error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Error syncing GoCardless transactions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error syncing transactions: {str(e)}"
        )


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transactions(
    http_request: Request,
    force: bool = Query(default=False, description="Re-categorize already categorized transactions"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Categorize bank transactions using AI (Claude Haiku).

    Uses the Anthropic API to intelligently categorize transactions into
    expense/income categories. Results are stored in suggested_type,
    suggested_category, and confidence_score fields.

    Args:
        force: If True, re-categorize all transactions. If False, only uncategorized ones.

    Rate limit: 100/hour per user (AI categorization, compute-intensive)
    """
    # Rate limit: 100 categorizations per hour per user (AI categorization, compute-intensive)
    limiter = get_limiter(http_request)
    await limiter.check("100/hour", http_request)

    # Get API key from user settings, fallback to environment variable
    settings = db.query(Settings).filter(Settings.user_id == current_user.household_id).first()
    api_key = None

    # Priority 1: User's own API key from settings
    if settings and settings.ai and settings.ai.get("apiKey"):
        api_key = settings.ai["apiKey"]
        logger.info(f"Using user-configured API key for categorization (user {current_user.household_id})")

    # Priority 2: Environment variable (for sandbox/development)
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            logger.info(f"Using environment OPENAI_API_KEY for categorization (user {current_user.household_id})")

    # If still no API key, raise error
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI API key not configured. Please add your OpenAI API key in Settings or configure OPENAI_API_KEY environment variable."
        )

    # Get transactions to categorize
    query = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.household_id
    )

    # Skip internal transfers — they're noise (Smart Saver, own-account, etc.)
    query = query.filter(
        (BankTransaction.is_internal_transfer == False) |
        (BankTransaction.is_internal_transfer == None)
    )

    if not force:
        # Only uncategorized (confidence_score = 0 or None)
        query = query.filter(
            (BankTransaction.confidence_score == None) |
            (BankTransaction.confidence_score == 0)
        )

    # Limit to 50 transactions per request to avoid gateway timeout (504)
    # Users can call multiple times if they have more uncategorized transactions
    transactions = query.order_by(BankTransaction.date.desc()).limit(50).all()

    if not transactions:
        return CategorizeResponse(
            success=True,
            categorized_count=0,
            total_processed=0,
            message="No transactions to categorize"
        )

    # Prepare data for AI
    tx_data = [
        {
            "id": tx.id,
            "description": tx.description_display,
            "merchant_name": tx.merchant_name,
            "amount": tx.amount,
            "tink_category": tx.tink_category_name,
        }
        for tx in transactions
    ]

    logger.info(f"Categorizing {len(tx_data)} transactions for user {current_user.household_id}")

    # Call AI service
    try:
        results = await categorize_in_batches(tx_data, batch_size=30, api_key=api_key)
    except Exception as e:
        logger.error(f"AI categorization error: {e}")
        raise HTTPException(status_code=500, detail=f"AI categorization failed: {str(e)}")

    # Create lookup map
    results_map = {r["id"]: r for r in results}

    # Update transactions
    categorized_count = 0
    for tx in transactions:
        if tx.id in results_map:
            result = results_map[tx.id]
            tx.suggested_type = result.get("type")
            tx.suggested_category = result.get("category")
            tx.confidence_score = result.get("confidence", 0.5)
            categorized_count += 1

    db.commit()

    # Auto-convert categorized transactions to Expense/Income records
    converted_count = 0
    for tx in transactions:
        if tx.id in results_map and tx.suggested_type and tx.suggested_category:
            # Skip if already converted
            if tx.status == "converted":
                continue

            # Skip if transaction already has a linked income/expense record
            # This handles the case where transaction was reset but linked record still exists
            if tx.linked_expense_id is not None or tx.linked_income_id is not None:
                logger.warning(f"Skipping auto-convert for transaction {tx.id} - already has linked record")
                continue

            result = results_map[tx.id]
            amount = abs(tx.amount)

            try:
                if result.get("type") == "expense":
                    # Create expense record
                    new_expense = Expense(
                        user_id=current_user.household_id,
                        category=result.get("category"),
                        description=tx.description_display,
                        amount=amount,
                        date=tx.date,
                        is_recurring=False,
                        source="bank_import",
                        bank_transaction_id=tx.id,
                        reconciliation_status="bank_backed"
                    )
                    db.add(new_expense)
                    db.flush()

                    tx.status = "converted"
                    tx.linked_expense_id = new_expense.id
                    tx.reviewed_at = datetime.now()
                    converted_count += 1

                elif result.get("type") == "income":
                    # Create income record
                    new_income = Income(
                        user_id=current_user.household_id,
                        category=result.get("category"),
                        description=tx.description_display,
                        amount=amount,
                        date=tx.date,
                        is_recurring=False,
                        source="bank_import",
                        bank_transaction_id=tx.id,
                        reconciliation_status="bank_backed"
                    )
                    db.add(new_income)
                    db.flush()

                    tx.status = "converted"
                    tx.linked_income_id = new_income.id
                    tx.reviewed_at = datetime.now()
                    converted_count += 1

            except Exception as e:
                logger.error(f"Failed to auto-convert transaction {tx.id}: {e}")
                # Continue with other transactions even if one fails
                continue

    db.commit()

    logger.info(f"Categorized {categorized_count}/{len(transactions)} transactions, auto-converted {converted_count} to Expense/Income")

    # Audit: AI categorization requested
    audit_categorization_requested(
        db=db,
        user_id=current_user.household_id,
        transaction_count=len(transactions),
        categorized_count=categorized_count,
        request=http_request,
    )

    return CategorizeResponse(
        success=True,
        categorized_count=categorized_count,
        total_processed=len(transactions),
        message=f"Categorized {categorized_count} transactions using AI"
    )


@router.get("", response_model=List[BankTransactionResponse])
async def get_transactions(
    http_request: Request,
    status: Optional[TransactionStatus] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get bank transactions with optional filtering.

    Rate limit: 120/minute per user (standard read)
    """
    # Rate limit: 120 requests per minute per user (standard read)
    limiter = get_limiter(http_request)
    await limiter.check("120/minute", http_request)
    query = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.household_id
    )

    # Apply filters
    if status:
        query = query.filter(BankTransaction.status == status.value)

    if from_date:
        query = query.filter(BankTransaction.date >= from_date)

    if to_date:
        query = query.filter(BankTransaction.date <= to_date)

    if min_amount is not None:
        query = query.filter(BankTransaction.amount >= min_amount)

    if max_amount is not None:
        query = query.filter(BankTransaction.amount <= max_amount)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (BankTransaction.description_display.ilike(search_term)) |
            (BankTransaction.merchant_name.ilike(search_term)) |
            (BankTransaction.description_original.ilike(search_term))
        )

    # Order by date descending (newest first)
    query = query.order_by(BankTransaction.date.desc(), BankTransaction.id.desc())

    # Apply pagination
    transactions = query.offset(offset).limit(limit).all()

    return transactions


@router.get("/stats", response_model=TransactionStats)
async def get_transaction_stats(
    http_request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transaction statistics by status.

    Rate limit: 120/minute per user (standard read)
    """
    # Rate limit: 120 requests per minute per user (standard read)
    limiter = get_limiter(http_request)
    await limiter.check("120/minute", http_request)
    from sqlalchemy import func

    stats = db.query(
        BankTransaction.status,
        func.count(BankTransaction.id).label("count")
    ).filter(
        BankTransaction.user_id == current_user.household_id
    ).group_by(BankTransaction.status).all()

    result = {
        "total": 0,
        "pending": 0,
        "accepted": 0,
        "rejected": 0,
        "converted": 0,
        "ignored": 0,
    }

    for status, count in stats:
        if status in result:
            result[status] = count
        result["total"] += count

    return TransactionStats(**result)


@router.get("/pending", response_model=List[BankTransactionResponse])
async def get_pending_transactions(
    http_request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get only pending transactions (shortcut endpoint).

    Rate limit: 120/minute per user (standard read)
    """
    # Rate limit: 120 requests per minute per user (standard read)
    limiter = get_limiter(http_request)
    await limiter.check("120/minute", http_request)
    transactions = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.household_id,
        BankTransaction.status == "pending"
    ).order_by(
        BankTransaction.date.desc()
    ).limit(limit).all()

    return transactions


@router.post("/{transaction_id}/convert", response_model=ConvertResponse)
async def convert_transaction(
    http_request: Request,
    transaction_id: int,
    request: ConvertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert a bank transaction to an expense or income.

    Creates a new expense/income record linked to this bank transaction.

    Rate limit: 200/hour per user (transaction conversion)
    """
    # Rate limit: 200 conversions per hour per user (transaction conversion)
    limiter = get_limiter(http_request)
    await limiter.check("200/hour", http_request)
    # Get the bank transaction
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if bank_tx.status == "converted":
        raise HTTPException(status_code=400, detail="Transaction already converted")

    # Check if transaction has already been linked to an income/expense record
    # This handles the case where transaction was reset but linked record still exists
    if bank_tx.linked_expense_id is not None or bank_tx.linked_income_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Transaction already has a linked income/expense record. Delete the existing record first if you want to re-convert."
        )

    # Use provided description or fall back to bank description
    description = request.description or bank_tx.description_display

    # Create expense or income
    if request.type == ConvertType.expense:
        # For expenses, amount should be positive (we store absolute values)
        amount = abs(bank_tx.amount)

        new_record = Expense(
            user_id=current_user.household_id,
            category=request.category,
            description=description,
            amount=amount,
            date=bank_tx.date,
            is_recurring=False,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
        )
        db.add(new_record)
        db.flush()  # Get the ID

        bank_tx.status = "converted"
        bank_tx.linked_expense_id = new_record.id
        bank_tx.reviewed_at = datetime.now()

        converted_to_id = new_record.id

    else:  # income
        # For income, amount should be positive
        amount = abs(bank_tx.amount)

        new_record = Income(
            user_id=current_user.household_id,
            category=request.category,
            description=description,
            amount=amount,
            date=bank_tx.date,
            is_recurring=False,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
        )
        db.add(new_record)
        db.flush()  # Get the ID

        bank_tx.status = "converted"
        bank_tx.linked_income_id = new_record.id
        bank_tx.reviewed_at = datetime.now()

        converted_to_id = new_record.id

    db.commit()

    # Audit: Transaction reviewed (convert)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action=f"convert_to_{request.type.value}",
        transaction_count=1,
        request=http_request,
    )

    return ConvertResponse(
        success=True,
        transaction_id=transaction_id,
        converted_to_type=request.type.value,
        converted_to_id=converted_to_id,
        message=f"Transaction converted to {request.type.value}"
    )


@router.post("/{transaction_id}/reject")
async def reject_transaction(
    http_request: Request,
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a bank transaction (mark as not relevant).

    Rate limit: 200/hour per user (transaction update)
    """
    # Rate limit: 200 rejects per hour per user (transaction update)
    limiter = get_limiter(http_request)
    await limiter.check("200/hour", http_request)
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "rejected"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    # Audit: Transaction reviewed (reject)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="reject",
        transaction_count=1,
        request=http_request,
    )

    return {"success": True, "message": "Transaction rejected"}


@router.post("/{transaction_id}/accept")
async def accept_transaction(
    http_request: Request,
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept a bank transaction as already processed manually.

    Use this when you've already entered this transaction manually
    and want to mark the bank transaction as reviewed.

    Rate limit: 200/hour per user (transaction update)
    """
    # Rate limit: 200 accepts per hour per user (transaction update)
    limiter = get_limiter(http_request)
    await limiter.check("200/hour", http_request)
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "accepted"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    # Audit: Transaction reviewed (accept)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="accept",
        transaction_count=1,
        request=http_request,
    )

    return {"success": True, "message": "Transaction accepted"}


@router.post("/{transaction_id}/reset")
async def reset_transaction(
    http_request: Request,
    transaction_id: int,
    delete_linked: bool = Query(default=False, description="Delete linked income/expense when resetting"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset a transaction back to pending status.

    By default, linked expense/income records are NOT deleted.
    Set delete_linked=true to also delete the linked record when resetting.

    Rate limit: 100/hour per user (undo action)
    """
    # Rate limit: 100 resets per hour per user (undo action)
    limiter = get_limiter(http_request)
    await limiter.check("100/hour", http_request)
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Optionally delete linked income/expense record
    if delete_linked:
        if bank_tx.linked_expense_id:
            linked_expense = db.query(Expense).filter(
                Expense.id == bank_tx.linked_expense_id,
                Expense.user_id == current_user.household_id
            ).first()
            if linked_expense:
                db.delete(linked_expense)
                logger.info(f"Deleted linked expense {bank_tx.linked_expense_id} for transaction {transaction_id}")
            bank_tx.linked_expense_id = None

        if bank_tx.linked_income_id:
            linked_income = db.query(Income).filter(
                Income.id == bank_tx.linked_income_id,
                Income.user_id == current_user.household_id
            ).first()
            if linked_income:
                db.delete(linked_income)
                logger.info(f"Deleted linked income {bank_tx.linked_income_id} for transaction {transaction_id}")
            bank_tx.linked_income_id = None

    bank_tx.status = "pending"
    bank_tx.reviewed_at = None
    db.commit()

    message = "Transaction reset to pending"
    if delete_linked:
        message += " and linked record deleted"

    return {"success": True, "message": message}


# ============================================================================
# Duplicate Handling Endpoints
# ============================================================================

@router.post("/{transaction_id}/confirm-duplicate")
async def confirm_duplicate(
    http_request: Request,
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Confirm a flagged transaction is indeed a duplicate.

    When user confirms a fuzzy duplicate, the transaction is marked as 'ignored'
    and the is_duplicate flag remains True.

    Rate limit: 200/hour per user (transaction update)
    """
    # Rate limit: 200 per hour per user
    limiter = get_limiter(http_request)
    await limiter.check("200/hour", http_request)

    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not bank_tx.is_duplicate:
        raise HTTPException(
            status_code=400,
            detail="Transaction is not flagged as a potential duplicate"
        )

    # Mark as ignored (confirmed duplicate)
    bank_tx.status = "ignored"
    bank_tx.reviewed_at = datetime.now()
    # Keep is_duplicate=True and duplicate_of intact
    db.commit()

    # Audit: Transaction reviewed (confirm duplicate)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="confirm_duplicate",
        transaction_count=1,
        request=http_request,
    )

    return {
        "success": True,
        "message": "Transaction confirmed as duplicate and marked as ignored",
        "duplicate_of": bank_tx.duplicate_of
    }


@router.post("/{transaction_id}/not-duplicate")
async def mark_not_duplicate(
    http_request: Request,
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark a flagged transaction as NOT a duplicate.

    When user indicates a transaction is not a duplicate, clear the duplicate
    flags and treat it as a normal pending transaction.

    Rate limit: 200/hour per user (transaction update)
    """
    # Rate limit: 200 per hour per user
    limiter = get_limiter(http_request)
    await limiter.check("200/hour", http_request)

    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if not bank_tx.is_duplicate:
        raise HTTPException(
            status_code=400,
            detail="Transaction is not flagged as a potential duplicate"
        )

    # Clear duplicate flags
    bank_tx.is_duplicate = False
    bank_tx.duplicate_of = None
    bank_tx.duplicate_confidence = None
    bank_tx.duplicate_reason = None
    bank_tx.reviewed_at = datetime.now()
    # Keep status as "pending" so user can still convert/accept/reject
    db.commit()

    # Audit: Transaction reviewed (not duplicate)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="mark_not_duplicate",
        transaction_count=1,
        request=http_request,
    )

    return {
        "success": True,
        "message": "Transaction marked as not a duplicate, now pending review"
    }


@router.get("/duplicates", response_model=List[BankTransactionResponse])
async def get_potential_duplicates(
    http_request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all transactions flagged as potential duplicates.

    Returns transactions where is_duplicate=True and status="pending".

    Rate limit: 120/minute per user (standard read)
    """
    # Rate limit: 120 requests per minute per user
    limiter = get_limiter(http_request)
    await limiter.check("120/minute", http_request)

    transactions = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.household_id,
        BankTransaction.is_duplicate == True,
        BankTransaction.status == "pending"
    ).order_by(
        BankTransaction.date.desc()
    ).limit(limit).all()

    return transactions


# ============================================================================
# Bulk Actions
# ============================================================================

@router.post("/bulk/reject", response_model=BulkActionResponse)
async def bulk_reject_transactions(
    http_request: Request,
    request: BulkActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject multiple transactions at once.

    Rate limit: 30/hour per user (bulk operation)
    """
    # Rate limit: 30 bulk rejects per hour per user (bulk operation)
    limiter = get_limiter(http_request)
    await limiter.check("30/hour", http_request)
    updated = db.query(BankTransaction).filter(
        BankTransaction.id.in_(request.transaction_ids),
        BankTransaction.user_id == current_user.household_id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "rejected", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    # Audit: Bulk transaction review (reject)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="bulk_reject",
        transaction_count=updated,
        request=http_request,
    )

    return BulkActionResponse(
        success=True,
        processed_count=updated,
        message=f"Rejected {updated} transactions"
    )


@router.post("/bulk/accept", response_model=BulkActionResponse)
async def bulk_accept_transactions(
    http_request: Request,
    request: BulkActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept multiple transactions at once.

    Rate limit: 30/hour per user (bulk operation)
    """
    # Rate limit: 30 bulk accepts per hour per user (bulk operation)
    limiter = get_limiter(http_request)
    await limiter.check("30/hour", http_request)
    updated = db.query(BankTransaction).filter(
        BankTransaction.id.in_(request.transaction_ids),
        BankTransaction.user_id == current_user.household_id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "accepted", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    # Audit: Bulk transaction review (accept)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action="bulk_accept",
        transaction_count=updated,
        request=http_request,
    )

    return BulkActionResponse(
        success=True,
        processed_count=updated,
        message=f"Accepted {updated} transactions"
    )


@router.post("/bulk/convert", response_model=BulkActionResponse)
async def bulk_convert_transactions(
    http_request: Request,
    request: BulkConvertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert multiple transactions to expense or income with the same category.

    Rate limit: 30/hour per user (bulk operation)
    """
    # Rate limit: 30 bulk converts per hour per user (bulk operation)
    limiter = get_limiter(http_request)
    await limiter.check("30/hour", http_request)
    transactions = db.query(BankTransaction).filter(
        BankTransaction.id.in_(request.transaction_ids),
        BankTransaction.user_id == current_user.household_id,
        BankTransaction.status == "pending"
    ).all()

    converted_count = 0

    for bank_tx in transactions:
        # Skip if transaction already has a linked income/expense record
        # This handles the case where transaction was reset but linked record still exists
        if bank_tx.linked_expense_id is not None or bank_tx.linked_income_id is not None:
            logger.warning(f"Skipping transaction {bank_tx.id} - already has linked record")
            continue

        description = bank_tx.description_display
        amount = abs(bank_tx.amount)

        if request.type == ConvertType.expense:
            new_record = Expense(
                user_id=current_user.household_id,
                category=request.category,
                description=description,
                amount=amount,
                date=bank_tx.date,
                is_recurring=False,
                source="bank_import",
                bank_transaction_id=bank_tx.id,
            )
            db.add(new_record)
            db.flush()
            bank_tx.linked_expense_id = new_record.id
        else:
            new_record = Income(
                user_id=current_user.household_id,
                category=request.category,
                description=description,
                amount=amount,
                date=bank_tx.date,
                is_recurring=False,
                source="bank_import",
                bank_transaction_id=bank_tx.id,
            )
            db.add(new_record)
            db.flush()
            bank_tx.linked_income_id = new_record.id

        bank_tx.status = "converted"
        bank_tx.reviewed_at = datetime.now()
        converted_count += 1

    db.commit()

    # Audit: Bulk transaction review (convert)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.household_id,
        action=f"bulk_convert_to_{request.type.value}",
        transaction_count=converted_count,
        request=http_request,
    )

    return BulkActionResponse(
        success=True,
        processed_count=converted_count,
        message=f"Converted {converted_count} transactions to {request.type.value}"
    )


# ============================================================================
# Helper Functions
# ============================================================================

def map_tink_category(tink_category_id: Optional[str], tx_type: str) -> Optional[str]:
    """
    Map Tink category ID to our app category.

    Tink categories look like: "expenses:food.groceries", "income:salary"
    """
    if not tink_category_id:
        return None

    # Basic mapping - can be expanded
    category_map = {
        # Expenses
        "expenses:food.groceries": "Jedzenie",
        "expenses:food.restaurants": "Restauracje",
        "expenses:food.coffee": "Restauracje",
        "expenses:transport.fuel": "Transport",
        "expenses:transport.public": "Transport",
        "expenses:transport.taxi": "Transport",
        "expenses:transport.parking": "Transport",
        "expenses:housing.rent": "Mieszkanie",
        "expenses:housing.mortgage": "Mieszkanie",
        "expenses:housing.utilities": "Rachunki",
        "expenses:housing.insurance": "Ubezpieczenia",
        "expenses:shopping.clothes": "Ubrania",
        "expenses:shopping.electronics": "Elektronika",
        "expenses:shopping.groceries": "Jedzenie",
        "expenses:entertainment.movies": "Rozrywka",
        "expenses:entertainment.games": "Rozrywka",
        "expenses:entertainment.streaming": "Subskrypcje",
        "expenses:health.pharmacy": "Zdrowie",
        "expenses:health.doctor": "Zdrowie",
        "expenses:health.gym": "Zdrowie",
        "expenses:education": "Edukacja",
        "expenses:misc": "Inne",

        # Income
        "income:salary": "Wynagrodzenie",
        "income:benefits": "Świadczenia",
        "income:pension": "Emerytura",
        "income:refund": "Zwroty",
        "income:investment": "Inwestycje",
        "income:gift": "Prezenty",
        "income:other": "Inne",

        # Transfers (usually ignored)
        "transfers:internal": None,
        "transfers:savings": None,
    }

    # Try exact match first
    if tink_category_id in category_map:
        return category_map[tink_category_id]

    # Try prefix match
    for prefix, category in category_map.items():
        if tink_category_id.startswith(prefix.split(".")[0]):
            return category

    # Default based on type
    return "Inne" if tx_type == "expense" else "Inne"
