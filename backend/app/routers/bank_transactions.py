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
from ..models import User, TinkConnection, BankTransaction, Expense, Income, Settings
from ..services.tink_service import tink_service
from ..services.categorization_service import categorize_in_batches
from ..services.audit_service import (
    audit_transactions_synced,
    audit_transaction_reviewed,
    audit_categorization_requested,
)
from ..services.duplicate_detection_service import (
    detect_duplicate_for_new_transaction,
    check_pending_to_booked_update,
    create_fingerprint,
)
from ..logging_utils import get_secure_logger

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
        TinkConnection.user_id == current_user.id,
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

            # Step 1: Check for exact tink_transaction_id match (100% duplicate)
            existing = db.query(BankTransaction).filter(
                BankTransaction.tink_transaction_id == tink_tx_id
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

            # Step 2: Check for pending → booked update scenario
            tink_account_id = tx.get("accountId", "")
            fingerprint = create_fingerprint(
                amount=amount,
                currency=currency,
                tx_date=tx_date,
                description=description_display,
                merchant_category_code=merchant_category_code,
                tink_account_id=tink_account_id,
            )

            # Check if this is a booked version of a pending transaction
            pending_tx_id = check_pending_to_booked_update(
                db=db,
                user_id=current_user.id,
                fingerprint=fingerprint,
                raw_data=tx,
            )

            if pending_tx_id:
                # Update existing pending transaction instead of creating new one
                pending_tx = db.query(BankTransaction).filter(
                    BankTransaction.id == pending_tx_id
                ).first()
                if pending_tx:
                    pending_tx.tink_transaction_id = tink_tx_id
                    pending_tx.raw_data = tx
                    # Don't count as synced or duplicate
                    logger.info(f"Updated pending transaction {pending_tx_id} to booked status")
                    continue

            # Step 3: Check for fuzzy duplicates (fingerprint matching)
            is_fuzzy_duplicate = False
            duplicate_of_id = None
            duplicate_confidence = None
            duplicate_reason = None

            fuzzy_match = detect_duplicate_for_new_transaction(
                db=db,
                user_id=current_user.id,
                tink_transaction_id=tink_tx_id,
                amount=amount,
                currency=currency,
                tx_date=tx_date,
                description=description_display,
                merchant_category_code=merchant_category_code,
                tink_account_id=tink_account_id,
            )

            if fuzzy_match:
                # Skip exact matches that somehow weren't caught above
                if fuzzy_match.confidence >= 1.0:
                    exact_duplicate_count += 1
                    continue

                # Flag as fuzzy duplicate for user review
                is_fuzzy_duplicate = True
                duplicate_of_id = fuzzy_match.original_transaction_id
                duplicate_confidence = fuzzy_match.confidence
                duplicate_reason = fuzzy_match.match_reason
                fuzzy_duplicate_count += 1

            # Create bank transaction record
            bank_tx = BankTransaction(
                user_id=current_user.id,
                tink_transaction_id=tink_tx_id,
                tink_account_id=tink_account_id,
                provider_transaction_id=tx.get("identifiers", {}).get("providerTransactionId"),
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
                # Duplicate detection fields
                is_duplicate=is_fuzzy_duplicate,
                duplicate_of=duplicate_of_id,
                duplicate_confidence=duplicate_confidence,
                duplicate_reason=duplicate_reason,
            )

            db.add(bank_tx)
            synced_count += 1

        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()

        # Audit: Transactions synced (one summary entry, not per-transaction)
        audit_transactions_synced(
            db=db,
            user_id=current_user.id,
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

    except Exception as e:
        logger.error(f"Error syncing transactions: {str(e)}")
        # Audit sync failure
        audit_transactions_synced(
            db=db,
            user_id=current_user.id,
            connection_id=connection.id if connection else None,
            synced_count=0,
            exact_duplicate_count=0,
            fuzzy_duplicate_count=0,
            total_fetched=0,
            date_range_days=days,
            result="failure",
            request=http_request,
        )
        raise HTTPException(status_code=500, detail=f"Error syncing transactions: {str(e)}")


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
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    api_key = None

    # Priority 1: User's own API key from settings
    if settings and settings.ai and settings.ai.get("apiKey"):
        api_key = settings.ai["apiKey"]
        logger.info(f"Using user-configured API key for categorization (user {current_user.id})")

    # Priority 2: Environment variable (for sandbox/development)
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            logger.info(f"Using environment OPENAI_API_KEY for categorization (user {current_user.id})")

    # If still no API key, raise error
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="AI API key not configured. Please add your OpenAI API key in Settings or configure OPENAI_API_KEY environment variable."
        )

    # Get transactions to categorize
    query = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.id
    )

    if not force:
        # Only uncategorized (confidence_score = 0 or None)
        query = query.filter(
            (BankTransaction.confidence_score == None) |
            (BankTransaction.confidence_score == 0)
        )

    transactions = query.order_by(BankTransaction.date.desc()).limit(200).all()

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

    logger.info(f"Categorizing {len(tx_data)} transactions for user {current_user.id}")

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

    logger.info(f"Categorized {categorized_count}/{len(transactions)} transactions")

    # Audit: AI categorization requested
    audit_categorization_requested(
        db=db,
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id
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
        BankTransaction.user_id == current_user.id
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
        BankTransaction.user_id == current_user.id,
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
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if bank_tx.status == "converted":
        raise HTTPException(status_code=400, detail="Transaction already converted")

    # Use provided description or fall back to bank description
    description = request.description or bank_tx.description_display

    # Create expense or income
    if request.type == ConvertType.expense:
        # For expenses, amount should be positive (we store absolute values)
        amount = abs(bank_tx.amount)

        new_record = Expense(
            user_id=current_user.id,
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
            user_id=current_user.id,
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
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "rejected"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    # Audit: Transaction reviewed (reject)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "accepted"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    # Audit: Transaction reviewed (accept)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.id,
        action="accept",
        transaction_count=1,
        request=http_request,
    )

    return {"success": True, "message": "Transaction accepted"}


@router.post("/{transaction_id}/reset")
async def reset_transaction(
    http_request: Request,
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset a transaction back to pending status.

    Note: If the transaction was converted, the linked expense/income
    will NOT be deleted - you need to delete it manually if needed.

    Rate limit: 100/hour per user (undo action)
    """
    # Rate limit: 100 resets per hour per user (undo action)
    limiter = get_limiter(http_request)
    await limiter.check("100/hour", http_request)
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "pending"
    bank_tx.reviewed_at = None
    # Don't clear linked_expense_id/linked_income_id to maintain history
    db.commit()

    return {"success": True, "message": "Transaction reset to pending"}


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
        BankTransaction.user_id == current_user.id
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
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id
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
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id,
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
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "rejected", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    # Audit: Bulk transaction review (reject)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "accepted", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    # Audit: Bulk transaction review (accept)
    audit_transaction_reviewed(
        db=db,
        user_id=current_user.id,
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
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).all()

    converted_count = 0

    for bank_tx in transactions:
        description = bank_tx.description_display
        amount = abs(bank_tx.amount)

        if request.type == ConvertType.expense:
            new_record = Expense(
                user_id=current_user.id,
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
                user_id=current_user.id,
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
        user_id=current_user.id,
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
