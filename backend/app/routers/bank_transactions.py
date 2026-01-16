"""
Bank Transactions Router

Handles syncing, viewing, and converting bank transactions from Tink.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, date
from typing import List, Optional
from pydantic import BaseModel
from enum import Enum
import logging

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkConnection, BankTransaction, Expense, Income, Settings
from ..services.tink_service import tink_service
from ..services.categorization_service import categorize_in_batches

logger = logging.getLogger(__name__)

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
    created_at: datetime

    class Config:
        from_attributes = True


class SyncResponse(BaseModel):
    success: bool
    synced_count: int
    duplicate_count: int
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
    days: int = Query(default=90, ge=1, le=365, description="Number of days to sync"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync transactions from Tink to local database.

    Fetches transactions from the connected bank account and stores them
    in bank_transactions table. Duplicates are detected by tink_transaction_id.
    """
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
        duplicate_count = 0

        for tx in transactions:
            tink_tx_id = tx.get("id")

            # Check for existing transaction
            existing = db.query(BankTransaction).filter(
                BankTransaction.tink_transaction_id == tink_tx_id
            ).first()

            if existing:
                duplicate_count += 1
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

            # Parse Tink categories
            categories = tx.get("categories", {})
            pfm_category = categories.get("pfm", {})
            tink_category_id = pfm_category.get("id")
            tink_category_name = pfm_category.get("name")

            # Determine suggested type based on amount
            suggested_type = "income" if amount > 0 else "expense"

            # Map Tink category to our category (basic mapping)
            suggested_category = map_tink_category(tink_category_id, suggested_type)

            # Create bank transaction record
            bank_tx = BankTransaction(
                user_id=current_user.id,
                tink_transaction_id=tink_tx_id,
                tink_account_id=tx.get("accountId", ""),
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
            )

            db.add(bank_tx)
            synced_count += 1

        # Update connection sync timestamp
        connection.last_sync_at = datetime.now()
        db.commit()

        return SyncResponse(
            success=True,
            synced_count=synced_count,
            duplicate_count=duplicate_count,
            total_fetched=total_fetched,
            message=f"Synced {synced_count} new transactions ({duplicate_count} duplicates skipped)"
        )

    except Exception as e:
        logger.error(f"Error syncing transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error syncing transactions: {str(e)}")


@router.post("/categorize", response_model=CategorizeResponse)
async def categorize_transactions(
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
    """
    # Get API key from user settings
    settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
    if not settings or not settings.ai or not settings.ai.get("apiKey"):
        raise HTTPException(
            status_code=400,
            detail="AI API key not configured. Please add your Anthropic API key in Settings."
        )

    api_key = settings.ai["apiKey"]

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

    return CategorizeResponse(
        success=True,
        categorized_count=categorized_count,
        total_processed=len(transactions),
        message=f"Categorized {categorized_count} transactions using AI"
    )


@router.get("", response_model=List[BankTransactionResponse])
async def get_transactions(
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
    """
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get transaction statistics by status.
    """
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
    }

    for status, count in stats:
        if status in result:
            result[status] = count
        result["total"] += count

    return TransactionStats(**result)


@router.get("/pending", response_model=List[BankTransactionResponse])
async def get_pending_transactions(
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get only pending transactions (shortcut endpoint).
    """
    transactions = db.query(BankTransaction).filter(
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).order_by(
        BankTransaction.date.desc()
    ).limit(limit).all()

    return transactions


@router.post("/{transaction_id}/convert", response_model=ConvertResponse)
async def convert_transaction(
    transaction_id: int,
    request: ConvertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert a bank transaction to an expense or income.

    Creates a new expense/income record linked to this bank transaction.
    """
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

    return ConvertResponse(
        success=True,
        transaction_id=transaction_id,
        converted_to_type=request.type.value,
        converted_to_id=converted_to_id,
        message=f"Transaction converted to {request.type.value}"
    )


@router.post("/{transaction_id}/reject")
async def reject_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject a bank transaction (mark as not relevant).
    """
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "rejected"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    return {"success": True, "message": "Transaction rejected"}


@router.post("/{transaction_id}/accept")
async def accept_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept a bank transaction as already processed manually.

    Use this when you've already entered this transaction manually
    and want to mark the bank transaction as reviewed.
    """
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == transaction_id,
        BankTransaction.user_id == current_user.id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    bank_tx.status = "accepted"
    bank_tx.reviewed_at = datetime.now()
    db.commit()

    return {"success": True, "message": "Transaction accepted"}


@router.post("/{transaction_id}/reset")
async def reset_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset a transaction back to pending status.

    Note: If the transaction was converted, the linked expense/income
    will NOT be deleted - you need to delete it manually if needed.
    """
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
# Bulk Actions
# ============================================================================

@router.post("/bulk/reject", response_model=BulkActionResponse)
async def bulk_reject_transactions(
    request: BulkActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reject multiple transactions at once.
    """
    updated = db.query(BankTransaction).filter(
        BankTransaction.id.in_(request.transaction_ids),
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "rejected", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    return BulkActionResponse(
        success=True,
        processed_count=updated,
        message=f"Rejected {updated} transactions"
    )


@router.post("/bulk/accept", response_model=BulkActionResponse)
async def bulk_accept_transactions(
    request: BulkActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Accept multiple transactions at once.
    """
    updated = db.query(BankTransaction).filter(
        BankTransaction.id.in_(request.transaction_ids),
        BankTransaction.user_id == current_user.id,
        BankTransaction.status == "pending"
    ).update(
        {"status": "accepted", "reviewed_at": datetime.now()},
        synchronize_session=False
    )

    db.commit()

    return BulkActionResponse(
        success=True,
        processed_count=updated,
        message=f"Accepted {updated} transactions"
    )


@router.post("/bulk/convert", response_model=BulkActionResponse)
async def bulk_convert_transactions(
    request: BulkConvertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Convert multiple transactions to expense or income with the same category.
    """
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
