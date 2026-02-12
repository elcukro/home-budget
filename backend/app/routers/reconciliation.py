"""
Reconciliation Router - Endpoints for managing bank/manual transaction reconciliation.

This router provides endpoints for:
1. Getting duplicate suggestions (fuzzy matching)
2. Marking manual entries as duplicates of bank transactions
3. Confirming manual entries as separate (not duplicates)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..models import Expense, Income, BankTransaction, User
from ..dependencies import get_current_user as get_authenticated_user
from ..services.monthly_totals_service import MonthlyTotalsService


router = APIRouter(prefix="/users/{email}/reconciliation", tags=["reconciliation"])


# ==================== Request/Response Models ====================

class MarkDuplicateRequest(BaseModel):
    """Request to mark a manual entry as duplicate of a bank transaction."""
    bank_transaction_id: int
    note: Optional[str] = None


class ReconciliationSuggestion(BaseModel):
    """A suggested duplicate match between manual entry and bank transaction."""
    manual_entry_id: int
    entry_type: str  # "expense" or "income"
    bank_transaction_id: int
    match_score: float
    match_reasons: List[str]

    # Manual entry details
    manual_amount: float
    manual_date: str
    manual_description: str
    manual_category: str

    # Bank transaction details
    bank_amount: float
    bank_date: str
    bank_description: str
    bank_merchant: Optional[str] = None


# ==================== Endpoints ====================

@router.get("/suggestions", response_model=List[ReconciliationSuggestion])
async def get_reconciliation_suggestions(
    email: str,
    month: Optional[int] = None,  # Optional: filter by month (1-12)
    limit: int = 50,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Get suggested duplicate matches between manual entries and bank transactions.

    Returns a list of potential duplicates sorted by match confidence (highest first).
    Uses fuzzy matching: date ±3 days, amount ±2%, description similarity.

    Args:
        email: User email
        month: Optional month filter (1-12)
        limit: Maximum number of suggestions (default 50)

    Returns:
        List of ReconciliationSuggestion objects
    """
    # Verify user owns this data
    if current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get suggestions from service
    suggestions = MonthlyTotalsService.suggest_duplicates(
        user_id=current_user.household_id,
        limit=limit,
        db=db
    )

    # Filter by month if specified
    if month is not None:
        suggestions = [
            s for s in suggestions
            if s["manual_entry"].date.month == month
        ]

    # Convert to response models
    response = []
    for suggestion in suggestions:
        manual_entry = suggestion["manual_entry"]
        bank_tx = suggestion["bank_transaction"]

        response.append(ReconciliationSuggestion(
            manual_entry_id=manual_entry.id,
            entry_type=suggestion["entry_type"],
            bank_transaction_id=bank_tx.id,
            match_score=suggestion["match_score"],
            match_reasons=suggestion["match_reasons"],
            # Manual entry details
            manual_amount=manual_entry.amount,
            manual_date=manual_entry.date.isoformat(),
            manual_description=manual_entry.description,
            manual_category=manual_entry.category,
            # Bank transaction details
            bank_amount=bank_tx.amount,
            bank_date=bank_tx.date.isoformat(),
            bank_description=bank_tx.description_display,
            bank_merchant=bank_tx.merchant_name
        ))

    return response


@router.post("/expenses/{expense_id}/mark-duplicate")
async def mark_expense_as_duplicate(
    email: str,
    expense_id: int,
    request: MarkDuplicateRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Mark a manual expense as duplicate of a bank transaction.

    This will:
    1. Set reconciliation_status = 'duplicate_of_bank'
    2. Link to the bank transaction via duplicate_bank_transaction_id
    3. Exclude this expense from monthly totals

    Args:
        email: User email
        expense_id: Expense ID to mark as duplicate
        request: Contains bank_transaction_id and optional note
    """
    # Verify user owns this data
    if current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get expense
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.household_id
    ).first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Verify it's a manual entry
    if expense.bank_transaction_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Cannot mark bank-backed expense as duplicate"
        )

    # Verify bank transaction exists and belongs to user
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == request.bank_transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Bank transaction not found")

    # Mark as duplicate
    expense.reconciliation_status = "duplicate_of_bank"
    expense.duplicate_bank_transaction_id = request.bank_transaction_id
    expense.reconciliation_note = request.note
    expense.reconciliation_reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(expense)

    return {
        "success": True,
        "message": "Expense marked as duplicate",
        "expense_id": expense.id,
        "bank_transaction_id": request.bank_transaction_id
    }


@router.post("/expenses/{expense_id}/confirm-separate")
async def confirm_expense_separate(
    email: str,
    expense_id: int,
    note: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    User confirms this manual expense is NOT a duplicate.

    This will:
    1. Set reconciliation_status = 'manual_confirmed'
    2. Include this expense in monthly totals
    3. Stop suggesting it as a duplicate

    Args:
        email: User email
        expense_id: Expense ID to confirm as separate
        note: Optional note explaining why it's separate
    """
    # Verify user owns this data
    if current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get expense
    expense = db.query(Expense).filter(
        Expense.id == expense_id,
        Expense.user_id == current_user.household_id
    ).first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    # Verify it's a manual entry
    if expense.bank_transaction_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Cannot confirm bank-backed expense as separate"
        )

    # Mark as confirmed separate
    expense.reconciliation_status = "manual_confirmed"
    expense.reconciliation_note = note
    expense.reconciliation_reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(expense)

    return {
        "success": True,
        "message": "Expense confirmed as separate",
        "expense_id": expense.id
    }


@router.post("/income/{income_id}/mark-duplicate")
async def mark_income_as_duplicate(
    email: str,
    income_id: int,
    request: MarkDuplicateRequest,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    Mark a manual income entry as duplicate of a bank transaction.

    Same logic as mark_expense_as_duplicate but for income.
    """
    # Verify user owns this data
    if current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get income
    income = db.query(Income).filter(
        Income.id == income_id,
        Income.user_id == current_user.household_id
    ).first()

    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    # Verify it's a manual entry
    if income.bank_transaction_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Cannot mark bank-backed income as duplicate"
        )

    # Verify bank transaction exists and belongs to user
    bank_tx = db.query(BankTransaction).filter(
        BankTransaction.id == request.bank_transaction_id,
        BankTransaction.user_id == current_user.household_id
    ).first()

    if not bank_tx:
        raise HTTPException(status_code=404, detail="Bank transaction not found")

    # Mark as duplicate
    income.reconciliation_status = "duplicate_of_bank"
    income.duplicate_bank_transaction_id = request.bank_transaction_id
    income.reconciliation_note = request.note
    income.reconciliation_reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(income)

    return {
        "success": True,
        "message": "Income marked as duplicate",
        "income_id": income.id,
        "bank_transaction_id": request.bank_transaction_id
    }


@router.post("/income/{income_id}/confirm-separate")
async def confirm_income_separate(
    email: str,
    income_id: int,
    note: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db)
):
    """
    User confirms this manual income is NOT a duplicate.

    Same logic as confirm_expense_separate but for income.
    """
    # Verify user owns this data
    if current_user.email != email:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get income
    income = db.query(Income).filter(
        Income.id == income_id,
        Income.user_id == current_user.household_id
    ).first()

    if not income:
        raise HTTPException(status_code=404, detail="Income not found")

    # Verify it's a manual entry
    if income.bank_transaction_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Cannot confirm bank-backed income as separate"
        )

    # Mark as confirmed separate
    income.reconciliation_status = "manual_confirmed"
    income.reconciliation_note = note
    income.reconciliation_reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(income)

    return {
        "success": True,
        "message": "Income confirmed as separate",
        "income_id": income.id
    }
