from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from .. import models, database
from ..schemas.budget import (
    BudgetYearCreate, BudgetYearResponse, MonthSummary,
    BudgetEntryCreate, BudgetEntryUpdate, BudgetEntryResponse,
    BudgetFromOnboardingRequest,
)
from ..dependencies import get_current_user as get_authenticated_user
from ..services.monthly_totals_service import MonthlyTotalsService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["budget"])


def _get_user_or_404(email: str, db: Session) -> models.User:
    """Look up user by email."""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _validate_access(user: models.User, current_user: models.User):
    """Validate authenticated user matches the requested user or is in same household."""
    if user.id != current_user.id and user.id != current_user.household_id:
        raise HTTPException(status_code=403, detail="Access denied: You can only access your own data")


def _get_budget_year(user_id: str, year: int, db: Session) -> models.BudgetYear:
    """Get budget year or raise 404."""
    budget_year = db.query(models.BudgetYear).filter(
        models.BudgetYear.user_id == user_id,
        models.BudgetYear.year == year
    ).first()
    if not budget_year:
        raise HTTPException(status_code=404, detail=f"Budget year {year} not found")
    return budget_year


def _compute_monthly_summaries(budget_year: models.BudgetYear, entries: list, db: Session) -> List[MonthSummary]:
    """
    Compute monthly summaries from budget entries + actual data from Expense/Income tables.

    Planned amounts come from BudgetEntry.planned_amount.
    Actual amounts are calculated using MonthlyTotalsService (combines bank + manual, excludes duplicates).
    """
    months = {}

    # Step 1: Aggregate planned amounts from budget entries
    for entry in entries:
        m = entry.month
        if m not in months:
            months[m] = MonthSummary(month=m)
        summary = months[m]
        summary.entry_count += 1

        if entry.entry_type == "income":
            summary.planned_income += entry.planned_amount or 0
        elif entry.entry_type == "expense":
            summary.planned_expenses += entry.planned_amount or 0
        elif entry.entry_type == "loan_payment":
            summary.planned_loan_payments += entry.planned_amount or 0

    # Step 2: Calculate ACTUAL amounts from Expense/Income tables using MonthlyTotalsService
    # This replaces the manual entry.actual_amount with real data from bank + manual sources
    for month_num in range(1, 13):
        if month_num not in months:
            months[month_num] = MonthSummary(month=month_num)

        # Get actual expenses for this month (bank + manual, deduplicated)
        expense_totals = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=budget_year.user_id,
            year=budget_year.year,
            month=month_num,
            db=db
        )

        # Get actual income for this month (bank + manual, deduplicated)
        income_totals = MonthlyTotalsService.calculate_monthly_income(
            user_id=budget_year.user_id,
            year=budget_year.year,
            month=month_num,
            db=db
        )

        months[month_num].actual_expenses = expense_totals["total"]
        months[month_num].actual_income = income_totals["total"]

        # TODO: Calculate actual_loan_payments from LoanPayment table
        # For now, leave at 0 (would require similar service method)

    return sorted(months.values(), key=lambda s: s.month)


# ============== Budget Year Endpoints ==============

@router.post("/users/{email}/budget/years", response_model=BudgetYearResponse)
async def create_budget_year(
    email: str,
    data: BudgetYearCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Create a new budget year."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    hid = current_user.household_id

    # Check for duplicate
    existing = db.query(models.BudgetYear).filter(
        models.BudgetYear.user_id == hid,
        models.BudgetYear.year == data.year
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Budget year {data.year} already exists")

    budget_year = models.BudgetYear(
        user_id=hid,
        year=data.year,
        source=data.source,
        template_data=data.template_data,
        status="active",
    )
    db.add(budget_year)
    db.commit()
    db.refresh(budget_year)
    logger.info(f"Created budget year {data.year} for user {hid}")
    return budget_year


@router.get("/users/{email}/budget/years", response_model=List[BudgetYearResponse])
async def list_budget_years(
    email: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """List all budget years for a user (without monthly summaries)."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    years = db.query(models.BudgetYear).filter(
        models.BudgetYear.user_id == current_user.household_id
    ).order_by(models.BudgetYear.year.desc()).all()
    return years


@router.get("/users/{email}/budget/years/{year}", response_model=BudgetYearResponse)
async def get_budget_year(
    email: str,
    year: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Get a budget year with monthly summaries."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    budget_year = _get_budget_year(current_user.household_id, year, db)

    entries = db.query(models.BudgetEntry).filter(
        models.BudgetEntry.budget_year_id == budget_year.id
    ).all()

    response = BudgetYearResponse.model_validate(budget_year)
    response.monthly_summaries = _compute_monthly_summaries(budget_year, entries, db)
    return response


@router.get("/users/{email}/budget/years/{year}/months/{month}", response_model=List[BudgetEntryResponse])
async def get_month_entries(
    email: str,
    year: int,
    month: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Get all budget entries for a specific month."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    budget_year = _get_budget_year(current_user.household_id, year, db)

    entries = db.query(models.BudgetEntry).filter(
        models.BudgetEntry.budget_year_id == budget_year.id,
        models.BudgetEntry.month == month,
    ).order_by(
        models.BudgetEntry.entry_type, models.BudgetEntry.category
    ).all()
    return entries


# ============== Budget Entry Endpoints ==============

@router.post("/users/{email}/budget/entries", response_model=BudgetEntryResponse)
async def create_budget_entry(
    email: str,
    entry: BudgetEntryCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Create a single budget entry (budget_year_id required in body)."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)
    hid = current_user.household_id

    if not entry.budget_year_id:
        raise HTTPException(status_code=400, detail="budget_year_id is required")

    # Verify budget year belongs to user
    budget_year = db.query(models.BudgetYear).filter(
        models.BudgetYear.id == entry.budget_year_id,
        models.BudgetYear.user_id == hid,
    ).first()
    if not budget_year:
        raise HTTPException(status_code=404, detail="Budget year not found")

    db_entry = models.BudgetEntry(
        budget_year_id=entry.budget_year_id,
        user_id=hid,
        month=entry.month,
        entry_type=entry.entry_type,
        category=entry.category,
        description=entry.description,
        planned_amount=entry.planned_amount,
        is_recurring=entry.is_recurring,
        source_onboarding_id=entry.source_onboarding_id,
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    logger.info(f"Created budget entry {db_entry.id} for year {budget_year.year}")
    return db_entry


@router.put("/users/{email}/budget/entries/{entry_id}", response_model=BudgetEntryResponse)
async def update_budget_entry(
    email: str,
    entry_id: int,
    update: BudgetEntryUpdate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Update a budget entry."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    db_entry = db.query(models.BudgetEntry).filter(
        models.BudgetEntry.id == entry_id,
        models.BudgetEntry.user_id == current_user.household_id,
    ).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Budget entry not found")

    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(db_entry, key, value)

    db.commit()
    db.refresh(db_entry)
    logger.info(f"Updated budget entry {entry_id}")
    return db_entry


@router.delete("/users/{email}/budget/entries/{entry_id}", status_code=204)
async def delete_budget_entry(
    email: str,
    entry_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """Delete a budget entry."""
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)

    db_entry = db.query(models.BudgetEntry).filter(
        models.BudgetEntry.id == entry_id,
        models.BudgetEntry.user_id == current_user.household_id,
    ).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Budget entry not found")

    db.delete(db_entry)
    db.commit()
    logger.info(f"Deleted budget entry {entry_id}")
    return None


# ============== Bulk Onboarding Endpoint ==============

@router.post("/users/{email}/budget/years/from-onboarding")
async def create_budget_from_onboarding(
    email: str,
    data: BudgetFromOnboardingRequest,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db),
):
    """
    Bulk create a budget year with entries from onboarding wizard.
    If a budget year already exists, deletes old entries first (idempotent re-run).
    """
    user = _get_user_or_404(email, db)
    _validate_access(user, current_user)
    hid = current_user.household_id

    # Get or create budget year
    existing = db.query(models.BudgetYear).filter(
        models.BudgetYear.user_id == hid,
        models.BudgetYear.year == data.year,
    ).first()

    if existing:
        # Delete old entries for idempotent re-run
        db.query(models.BudgetEntry).filter(
            models.BudgetEntry.budget_year_id == existing.id
        ).delete()
        existing.source = "onboarding"
        existing.status = "active"
        existing.closed_at = None
        budget_year = existing
        logger.info(f"Replacing budget year {data.year} entries for user {hid}")
    else:
        budget_year = models.BudgetYear(
            user_id=hid,
            year=data.year,
            source="onboarding",
            status="active",
        )
        db.add(budget_year)
        db.flush()  # Get the ID

    # Combine all entry lists
    all_entries = []
    for entry_data in data.income_entries + data.expense_entries + data.loan_entries:
        all_entries.append(models.BudgetEntry(
            budget_year_id=budget_year.id,
            user_id=hid,
            month=entry_data.month,
            entry_type=entry_data.entry_type,
            category=entry_data.category,
            description=entry_data.description,
            planned_amount=entry_data.planned_amount,
            is_recurring=entry_data.is_recurring,
            source_onboarding_id=entry_data.source_onboarding_id,
        ))

    db.add_all(all_entries)
    db.commit()
    db.refresh(budget_year)

    logger.info(f"Created budget from onboarding: year={data.year}, entries={len(all_entries)} for user {hid}")

    return {
        "budget_year_id": budget_year.id,
        "entries_created": len(all_entries),
    }
