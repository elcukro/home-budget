from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, or_, and_
from typing import List, Optional
from datetime import datetime, date, timedelta
import logging

from ..database import get_db
from ..models import User, Saving, Settings, SavingsGoal, Income
from ..schemas.savings import (
    SavingCreate, SavingUpdate, Saving as SavingSchema, SavingsSummary,
    SavingCategory, AccountType, EntryType, RetirementAccountLimit, RetirementLimitsResponse,
    SavingsGoalCreate, SavingsGoalUpdate, SavingsGoal as SavingsGoalSchema,
    SavingsGoalWithSavings, GoalStatus
)
from ..dependencies import get_current_user
from ..services.gamification_service import GamificationService

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/savings",
    tags=["savings"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=List[SavingSchema])
async def get_savings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    category: Optional[SavingCategory] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get user's savings with optional filtering."""
    try:
        logger.info(f"Getting savings for user: {current_user.id}")
        query = db.query(Saving).filter(Saving.user_id == current_user.id)
        
        if category:
            query = query.filter(Saving.category == category)
        if start_date:
            query = query.filter(Saving.date >= start_date)
        if end_date:
            query = query.filter(Saving.date <= end_date)
            
        savings = query.order_by(Saving.date.desc()).offset(skip).limit(limit).all()
        logger.info(f"Found {len(savings)} savings entries")
        return savings
    except Exception as e:
        logger.error(f"Error in get_savings: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching savings: {str(e)}"
        )

@router.post("", response_model=SavingSchema)
async def create_saving(
    saving: SavingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new saving entry."""
    try:
        logger.info(f"Creating saving for user: {current_user.id}")

        # Validate: only ONE opening_balance entry per account/year
        if saving.entry_type == EntryType.OPENING_BALANCE:
            current_year = saving.date.year
            existing = db.query(Saving).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == saving.account_type.value,
                Saving.entry_type == EntryType.OPENING_BALANCE.value,
                extract('year', Saving.date) == current_year
            ).first()

            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Opening balance for {saving.account_type.value.upper()} {current_year} already exists. Delete the existing entry first or update it."
                )

        db_saving = Saving(
            **saving.dict(),
            user_id=current_user.id
        )
        db.add(db_saving)
        db.commit()
        db.refresh(db_saving)

        # Trigger gamification for deposits (not withdrawals)
        if saving.saving_type == "deposit":
            try:
                GamificationService.on_saving_deposit(
                    current_user.id,
                    db_saving.id,
                    saving.category,
                    db
                )
            except Exception as gam_error:
                logger.warning(f"Gamification error (non-blocking): {gam_error}")

        logger.info(f"Created saving with ID: {db_saving.id}")
        return db_saving
    except Exception as e:
        logger.error(f"Error in create_saving: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating saving: {str(e)}"
        )

@router.put("/{saving_id}", response_model=SavingSchema)
async def update_saving(
    saving_id: int,
    saving: SavingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a saving entry."""
    try:
        logger.info(f"Updating saving {saving_id} for user: {current_user.id}")
        db_saving = db.query(Saving).filter(
            Saving.id == saving_id,
            Saving.user_id == current_user.id
        ).first()
        
        if not db_saving:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Saving not found"
            )
        
        for key, value in saving.dict().items():
            setattr(db_saving, key, value)
            
        db.commit()
        db.refresh(db_saving)
        logger.info(f"Updated saving {saving_id}")
        return db_saving
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_saving: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating saving: {str(e)}"
        )

@router.delete("/{saving_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_saving(
    saving_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saving entry."""
    try:
        logger.info(f"Deleting saving {saving_id} for user: {current_user.id}")
        db_saving = db.query(Saving).filter(
            Saving.id == saving_id,
            Saving.user_id == current_user.id
        ).first()
        
        if not db_saving:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Saving not found"
            )
            
        db.delete(db_saving)
        db.commit()
        logger.info(f"Deleted saving {saving_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_saving: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting saving: {str(e)}"
        )

@router.get("/summary", response_model=SavingsSummary)
async def get_savings_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a summary of user's savings."""
    try:
        logger.info(f"Getting savings summary for user: {current_user.id}")

        today = datetime.now().date()

        # Helper function to add active recurring filter
        # Non-recurring items are always counted
        # Recurring items only count if: date <= today AND (end_date IS NULL OR end_date >= today)
        def active_savings_filter(query, saving_type: str):
            return query.filter(
                Saving.user_id == current_user.id,
                Saving.saving_type == saving_type,
                Saving.date <= today,  # Must have started
                or_(
                    Saving.is_recurring == False,  # Non-recurring always count
                    and_(
                        Saving.is_recurring == True,
                        or_(
                            Saving.end_date == None,  # No end date (ongoing)
                            Saving.end_date >= today  # Or still active
                        )
                    )
                )
            )

        # Calculate total deposits (only active items)
        deposits_query = db.query(func.sum(Saving.amount))
        deposits = active_savings_filter(deposits_query, 'deposit').scalar() or 0.0

        # Calculate total withdrawals (only active items)
        withdrawals_query = db.query(func.sum(Saving.amount))
        withdrawals = active_savings_filter(withdrawals_query, 'withdrawal').scalar() or 0.0

        total_savings = deposits - withdrawals

        # Calculate emergency fund total (only active items)
        ef_deposits_query = db.query(func.sum(Saving.amount)).filter(
            Saving.category == SavingCategory.EMERGENCY_FUND
        )
        emergency_fund_deposits = active_savings_filter(ef_deposits_query, 'deposit').scalar() or 0.0

        ef_withdrawals_query = db.query(func.sum(Saving.amount)).filter(
            Saving.category == SavingCategory.EMERGENCY_FUND
        )
        emergency_fund_withdrawals = active_savings_filter(ef_withdrawals_query, 'withdrawal').scalar() or 0.0

        emergency_fund = emergency_fund_deposits - emergency_fund_withdrawals

        # Calculate PPK balance separately (only active items)
        ppk_deposits_query = db.query(func.sum(Saving.amount)).filter(
            Saving.account_type == AccountType.PPK
        )
        ppk_deposits = active_savings_filter(ppk_deposits_query, 'deposit').scalar() or 0.0

        ppk_withdrawals_query = db.query(func.sum(Saving.amount)).filter(
            Saving.account_type == AccountType.PPK
        )
        ppk_withdrawals = active_savings_filter(ppk_withdrawals_query, 'withdrawal').scalar() or 0.0

        ppk_balance = ppk_deposits - ppk_withdrawals

        # Calculate monthly contribution (net: deposits - withdrawals for current month)
        month_start = today.replace(day=1)
        month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)

        # Non-recurring deposits in current month
        monthly_non_recurring_deposits = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'deposit',
            Saving.is_recurring == False,
            Saving.date >= month_start,
            Saving.date <= month_end
        ).scalar() or 0.0

        # Non-recurring withdrawals in current month
        monthly_non_recurring_withdrawals = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'withdrawal',
            Saving.is_recurring == False,
            Saving.date >= month_start,
            Saving.date <= month_end
        ).scalar() or 0.0

        # Recurring deposits active in current month
        monthly_recurring = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'deposit',
            Saving.is_recurring == True,
            Saving.date <= month_end,  # Started before or during this month
            or_(
                Saving.end_date == None,  # No end date (ongoing)
                Saving.end_date >= month_start  # Or end_date is this month or later
            )
        ).scalar() or 0.0

        monthly_contribution = (monthly_non_recurring_deposits - monthly_non_recurring_withdrawals) + monthly_recurring

        # Calculate category totals (only active items)
        category_totals = {}
        for category in SavingCategory:
            cat_deposits_query = db.query(func.sum(Saving.amount)).filter(
                Saving.category == category
            )
            cat_deposits = active_savings_filter(cat_deposits_query, 'deposit').scalar() or 0.0

            cat_withdrawals_query = db.query(func.sum(Saving.amount)).filter(
                Saving.category == category
            )
            cat_withdrawals = active_savings_filter(cat_withdrawals_query, 'withdrawal').scalar() or 0.0

            category_totals[category] = cat_deposits - cat_withdrawals
        
        # Get recent transactions
        recent_transactions = db.query(Saving).filter(
            Saving.user_id == current_user.id
        ).order_by(
            Saving.date.desc()
        ).limit(5).all()
        
        # Get user settings for emergency fund target
        user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()
        emergency_fund_target = 3000  # Default Baby Step 1 target
        if user_settings and hasattr(user_settings, 'emergency_fund_target') and user_settings.emergency_fund_target:
            emergency_fund_target = user_settings.emergency_fund_target

        # Calculate emergency fund progress
        emergency_fund_progress = min((emergency_fund / emergency_fund_target) * 100, 100) if emergency_fund_target > 0 else 0
        
        summary = SavingsSummary(
            total_savings=total_savings,
            emergency_fund=emergency_fund,
            emergency_fund_target=emergency_fund_target,
            emergency_fund_progress=emergency_fund_progress,
            monthly_contribution=monthly_contribution,
            ppk_balance=ppk_balance,
            category_totals=category_totals,
            recent_transactions=recent_transactions
        )
        
        logger.info(f"Generated savings summary for user {current_user.id}")
        return summary
    except Exception as e:
        logger.error(f"Error in get_savings_summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating savings summary: {str(e)}"
        )


# Polish III Pillar limits for 2026
# These are updated annually by the government
RETIREMENT_LIMITS_2026 = {
    AccountType.IKE: 28260.0,       # IKE 2026 limit (no capital gains tax)
    AccountType.IKZE: 11304.0,      # IKZE 2026 standard limit (tax deductible)
    AccountType.IKZE: 16956.0,      # IKZE 2026 self-employed (JDG) limit
    AccountType.PPK: None,          # PPK has no annual limit (employer-employee matching)
    AccountType.OIPE: 28260.0,      # OIPE - same as IKE
}


@router.get("/retirement-limits", response_model=RetirementLimitsResponse)
async def get_retirement_limits(
    year: Optional[int] = None,
    is_self_employed: bool = False,
    owner: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get retirement account contribution limits and current usage.

    Tracks Polish III Pillar accounts (IKE, IKZE, PPK, OIPE) against
    annual limits set by the Polish government.

    Args:
        year: Year to check (defaults to current year)
        is_self_employed: If true, uses higher IKZE limit for self-employed (JDG)
    """
    try:
        target_year = year or datetime.now().year
        year_start = date(target_year, 1, 1)
        year_end = date(target_year, 12, 31)

        logger.info(f"Getting retirement limits for user {current_user.id}, year {target_year}, owner={owner}")

        # Build owner filter (null/"self" = user's own accounts, "partner" = partner's)
        if owner == 'partner':
            owner_filter = Saving.owner == 'partner'
        else:
            owner_filter = or_(Saving.owner == None, Saving.owner == 'self')

        # Polish 2026 limits
        ike_limit = 28260.0
        ikze_limit = 16956.0 if is_self_employed else 11304.0
        oipe_limit = 28260.0  # Same as IKE

        accounts = []
        total_contributions = 0.0

        # Calculate contributions for each retirement account type with multi-year tracking
        for account_type in [AccountType.IKE, AccountType.IKZE, AccountType.PPK, AccountType.OIPE]:
            # === STEP 1: Calculate OPENING BALANCE (historical balance from previous years) ===

            # Historical deposits from all years BEFORE target year (excluding opening_balance entries)
            historical_deposits = db.query(func.sum(Saving.amount)).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == account_type.value,
                Saving.saving_type == 'deposit',
                Saving.entry_type != EntryType.OPENING_BALANCE.value,
                Saving.date < year_start,
                owner_filter
            ).scalar() or 0.0

            # Historical withdrawals from all years BEFORE target year
            historical_withdrawals = db.query(func.sum(Saving.amount)).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == account_type.value,
                Saving.saving_type == 'withdrawal',
                Saving.entry_type != EntryType.OPENING_BALANCE.value,
                Saving.date < year_start,
                owner_filter
            ).scalar() or 0.0

            # Add any manual opening balance entry FOR this year
            manual_opening = db.query(func.sum(Saving.amount)).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == account_type.value,
                Saving.entry_type == EntryType.OPENING_BALANCE.value,
                extract('year', Saving.date) == target_year,
                owner_filter
            ).scalar() or 0.0

            opening_balance = (historical_deposits - historical_withdrawals) + manual_opening

            # === STEP 2: Calculate CURRENT YEAR CONTRIBUTIONS (only 'contribution' type entries) ===

            # Current year deposits (only contribution type - for limit calculation)
            current_year_deposits = db.query(func.sum(Saving.amount)).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == account_type.value,
                Saving.saving_type == 'deposit',
                Saving.entry_type == EntryType.CONTRIBUTION.value,
                Saving.date >= year_start,
                Saving.date <= year_end,
                owner_filter
            ).scalar() or 0.0

            # Current year withdrawals (only contribution type)
            current_year_withdrawals = db.query(func.sum(Saving.amount)).filter(
                Saving.user_id == current_user.id,
                Saving.account_type == account_type.value,
                Saving.saving_type == 'withdrawal',
                Saving.entry_type == EntryType.CONTRIBUTION.value,
                Saving.date >= year_start,
                Saving.date <= year_end,
                owner_filter
            ).scalar() or 0.0

            # Net contributions for limit calculation (only deposits count, withdrawals reduce it)
            current_contributions = max(0, current_year_deposits - current_year_withdrawals)
            total_contributions += current_contributions

            # Total balance = opening balance + current year net movement
            total_balance = opening_balance + (current_year_deposits - current_year_withdrawals)

            # === STEP 3: Calculate LIMITS and PERCENTAGES ===

            # Determine annual limit based on account type
            if account_type == AccountType.IKE:
                annual_limit = ike_limit
            elif account_type == AccountType.IKZE:
                annual_limit = ikze_limit
            elif account_type == AccountType.OIPE:
                annual_limit = oipe_limit
            else:  # PPK has no annual limit
                annual_limit = 0

            remaining = max(0, annual_limit - current_contributions) if annual_limit > 0 else 0
            percentage = (current_contributions / annual_limit * 100) if annual_limit > 0 else 0

            # === STEP 4: PPK-specific manual baseline and monthly contribution ===
            last_manual_balance = None
            last_manual_update = None
            monthly_contribution = 0.0

            if account_type == AccountType.PPK:
                # Find most recent opening_balance entry for PPK
                manual_correction = db.query(Saving).filter(
                    Saving.user_id == current_user.id,
                    Saving.account_type == AccountType.PPK.value,
                    Saving.entry_type == EntryType.OPENING_BALANCE.value,
                    owner_filter
                ).order_by(Saving.date.desc()).first()

                if manual_correction:
                    last_manual_balance = manual_correction.amount
                    last_manual_update = manual_correction.created_at

                # Calculate current monthly PPK contribution
                user_settings = db.query(Settings).filter(Settings.user_id == current_user.id).first()

                # Use partner-specific PPK settings when owner=partner
                if owner == 'partner' and user_settings:
                    ppk_employee_rate = user_settings.partner_ppk_employee_rate
                    ppk_employer_rate = user_settings.partner_ppk_employer_rate
                    is_ppk_relevant = (user_settings.partner_employment_status == 'uop')
                else:
                    ppk_employee_rate = user_settings.ppk_employee_rate if user_settings else None
                    ppk_employer_rate = user_settings.ppk_employer_rate if user_settings else None
                    is_ppk_relevant = True  # Self PPK eligibility checked on frontend

                if ppk_employee_rate and ppk_employer_rate and is_ppk_relevant:
                    # Get most recent recurring salary, filtered by owner
                    income_owner_filter = (
                        Income.owner == 'partner'
                        if owner == 'partner'
                        else or_(Income.owner == None, Income.owner == 'self')
                    )
                    recent_salary = db.query(Income).filter(
                        Income.user_id == current_user.id,
                        Income.is_recurring == True,
                        Income.employment_type == 'uop',
                        or_(Income.end_date == None, Income.end_date >= date.today()),
                        income_owner_filter
                    ).order_by(Income.date.desc()).first()

                    if recent_salary and recent_salary.gross_amount:
                        total_ppk_rate = (ppk_employee_rate or 0) + (ppk_employer_rate or 0)
                        monthly_contribution = recent_salary.gross_amount * total_ppk_rate / 100

            accounts.append(RetirementAccountLimit(
                account_type=account_type,
                year=target_year,
                annual_limit=annual_limit,
                opening_balance=opening_balance,
                current_contributions=current_contributions,
                total_balance=total_balance,
                remaining_limit=remaining,
                percentage_used=round(percentage, 1),
                is_over_limit=current_contributions > annual_limit if annual_limit > 0 else False,
                last_manual_balance=last_manual_balance,
                last_manual_update=last_manual_update,
                monthly_contribution=monthly_contribution
            ))

        return RetirementLimitsResponse(
            year=target_year,
            accounts=accounts,
            total_retirement_contributions=total_contributions,
            ike_limit=ike_limit,
            ikze_limit_standard=11304.0,
            ikze_limit_jdg=16956.0
        )

    except Exception as e:
        logger.error(f"Error in get_retirement_limits: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching retirement limits: {str(e)}"
        )


# ============== Savings Goals Endpoints ==============

def _calculate_goal_stats(goal: SavingsGoal, db: Session) -> dict:
    """Calculate computed fields for a savings goal."""
    # Sum deposits minus withdrawals for this goal
    deposits = db.query(func.sum(Saving.amount)).filter(
        Saving.goal_id == goal.id,
        Saving.saving_type == 'deposit'
    ).scalar() or 0.0

    withdrawals = db.query(func.sum(Saving.amount)).filter(
        Saving.goal_id == goal.id,
        Saving.saving_type == 'withdrawal'
    ).scalar() or 0.0

    current_amount = max(0, deposits - withdrawals)
    remaining = max(0, goal.target_amount - current_amount)
    progress = (current_amount / goal.target_amount * 100) if goal.target_amount > 0 else 0

    # Calculate if on track based on deadline
    is_on_track = None
    monthly_needed = None

    if goal.deadline and goal.status == 'active':
        today = date.today()
        if goal.deadline > today:
            months_remaining = (goal.deadline.year - today.year) * 12 + (goal.deadline.month - today.month)
            if months_remaining > 0:
                monthly_needed = remaining / months_remaining
                # Check if they're on track (linear projection)
                total_months = (goal.deadline.year - goal.created_at.year) * 12 + (goal.deadline.month - goal.created_at.month)
                if total_months > 0:
                    expected_progress = ((total_months - months_remaining) / total_months) * 100
                    is_on_track = progress >= expected_progress * 0.9  # 10% tolerance

    return {
        'current_amount': current_amount,
        'progress_percent': round(progress, 1),
        'remaining_amount': remaining,
        'is_on_track': is_on_track,
        'monthly_needed': round(monthly_needed, 2) if monthly_needed else None
    }


def _goal_to_schema(goal: SavingsGoal, db: Session) -> SavingsGoalSchema:
    """Convert a SavingsGoal model to schema with computed fields."""
    stats = _calculate_goal_stats(goal, db)

    return SavingsGoalSchema(
        id=goal.id,
        user_id=goal.user_id,
        name=goal.name,
        category=goal.category,
        target_amount=goal.target_amount,
        current_amount=stats['current_amount'],
        deadline=goal.deadline,
        icon=goal.icon,
        color=goal.color,
        status=goal.status or GoalStatus.ACTIVE,
        priority=goal.priority or 0,
        notes=goal.notes,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
        completed_at=goal.completed_at,
        progress_percent=stats['progress_percent'],
        remaining_amount=stats['remaining_amount'],
        is_on_track=stats['is_on_track'],
        monthly_needed=stats['monthly_needed']
    )


@router.get("/goals", response_model=List[SavingsGoalSchema])
async def get_savings_goals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    status: Optional[GoalStatus] = None,
    category: Optional[SavingCategory] = None
):
    """Get all savings goals for the current user."""
    try:
        logger.info(f"Getting savings goals for user: {current_user.id}")
        query = db.query(SavingsGoal).filter(SavingsGoal.user_id == current_user.id)

        if status:
            query = query.filter(SavingsGoal.status == status.value)
        if category:
            query = query.filter(SavingsGoal.category == category.value)

        goals = query.order_by(SavingsGoal.priority.desc(), SavingsGoal.created_at.desc()).all()

        return [_goal_to_schema(goal, db) for goal in goals]
    except Exception as e:
        logger.error(f"Error in get_savings_goals: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching savings goals: {str(e)}"
        )


@router.get("/goals/{goal_id}", response_model=SavingsGoalWithSavings)
async def get_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific savings goal with its linked savings entries."""
    try:
        logger.info(f"Getting savings goal {goal_id} for user: {current_user.id}")
        goal = db.query(SavingsGoal).filter(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == current_user.id
        ).first()

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found"
            )

        # Get linked savings
        savings = db.query(Saving).filter(
            Saving.goal_id == goal_id
        ).order_by(Saving.date.desc()).all()

        goal_schema = _goal_to_schema(goal, db)

        return SavingsGoalWithSavings(
            **goal_schema.dict(),
            savings=savings
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_savings_goal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching savings goal: {str(e)}"
        )


@router.post("/goals", response_model=SavingsGoalSchema)
async def create_savings_goal(
    goal: SavingsGoalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new savings goal."""
    try:
        logger.info(f"Creating savings goal for user: {current_user.id}")
        db_goal = SavingsGoal(
            **goal.dict(),
            user_id=current_user.id,
            status='active',
            current_amount=0
        )
        db.add(db_goal)
        db.commit()
        db.refresh(db_goal)

        logger.info(f"Created savings goal with ID: {db_goal.id}")
        return _goal_to_schema(db_goal, db)
    except Exception as e:
        logger.error(f"Error in create_savings_goal: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating savings goal: {str(e)}"
        )


@router.put("/goals/{goal_id}", response_model=SavingsGoalSchema)
async def update_savings_goal(
    goal_id: int,
    goal_update: SavingsGoalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a savings goal."""
    try:
        logger.info(f"Updating savings goal {goal_id} for user: {current_user.id}")
        db_goal = db.query(SavingsGoal).filter(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == current_user.id
        ).first()

        if not db_goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found"
            )

        # Update only provided fields
        update_data = goal_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(db_goal, key, value.value if hasattr(value, 'value') else value)

        # Mark completed_at if status changed to completed
        if goal_update.status == GoalStatus.COMPLETED and db_goal.completed_at is None:
            db_goal.completed_at = datetime.now()

        db.commit()
        db.refresh(db_goal)

        logger.info(f"Updated savings goal {goal_id}")
        return _goal_to_schema(db_goal, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_savings_goal: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating savings goal: {str(e)}"
        )


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_savings_goal(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a savings goal. Linked savings entries will have their goal_id set to NULL."""
    try:
        logger.info(f"Deleting savings goal {goal_id} for user: {current_user.id}")
        db_goal = db.query(SavingsGoal).filter(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == current_user.id
        ).first()

        if not db_goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found"
            )

        db.delete(db_goal)
        db.commit()

        logger.info(f"Deleted savings goal {goal_id}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in delete_savings_goal: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting savings goal: {str(e)}"
        )


@router.post("/goals/{goal_id}/complete", response_model=SavingsGoalSchema)
async def mark_goal_complete(
    goal_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a savings goal as complete."""
    try:
        logger.info(f"Marking goal {goal_id} as complete for user: {current_user.id}")
        db_goal = db.query(SavingsGoal).filter(
            SavingsGoal.id == goal_id,
            SavingsGoal.user_id == current_user.id
        ).first()

        if not db_goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Goal not found"
            )

        db_goal.status = 'completed'
        db_goal.completed_at = datetime.now()
        db.commit()
        db.refresh(db_goal)

        return _goal_to_schema(db_goal, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking goal complete: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error completing goal: {str(e)}"
        )