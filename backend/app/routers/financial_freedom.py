from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from typing import List, Optional
from datetime import datetime
import logging

from ..database import get_db
from ..models import User, FinancialFreedom, Settings, Saving, Loan, Expense
from ..schemas.savings import SavingCategory
from ..schemas.financial_freedom import FinancialFreedomCreate, FinancialFreedomResponse, FinancialFreedomUpdate
from ..dependencies import get_current_user
from ..services.gamification_service import GamificationService

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/financial-freedom",
    tags=["financial-freedom"],
    responses={404: {"description": "Not found"}},
)

@router.get("", response_model=FinancialFreedomResponse)
async def get_financial_freedom(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the financial freedom data for the current user."""
    try:
        logger.info(f"Getting financial freedom data for user: {current_user.household_id}")
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.household_id
        ).first()
        
        if not financial_freedom:
            logger.info(f"No existing data found for user {current_user.household_id}, retrieving settings and creating default data")
            
            # Get user settings for financial freedom configuration
            user_settings = db.query(Settings).filter(Settings.user_id == current_user.household_id).first()
            
            # Default values if settings don't exist
            emergency_fund_target = 1000
            emergency_fund_months = 3
            
            # Use user settings if they exist
            if user_settings:
                emergency_fund_target = user_settings.emergency_fund_target
                emergency_fund_months = user_settings.emergency_fund_months
            
            logger.info(f"Using settings: emergency_fund_target={emergency_fund_target}, emergency_fund_months={emergency_fund_months}")
            
            return FinancialFreedomResponse(
                userId=current_user.household_id,
                steps=[
                    {
                        "id": 1,
                        "titleKey": "financialFreedom.steps.step1.title",
                        "descriptionKey": "financialFreedom.steps.step1.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": emergency_fund_target,
                        "currentAmount": 0,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 2,
                        "titleKey": "financialFreedom.steps.step2.title",
                        "descriptionKey": "financialFreedom.steps.step2.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 3,
                        "titleKey": "financialFreedom.steps.step3.title",
                        "descriptionKey": "financialFreedom.steps.step3.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": 0,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 4,
                        "titleKey": "financialFreedom.steps.step4.title",
                        "descriptionKey": "financialFreedom.steps.step4.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 5,
                        "titleKey": "financialFreedom.steps.step5.title",
                        "descriptionKey": "financialFreedom.steps.step5.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 6,
                        "titleKey": "financialFreedom.steps.step6.title",
                        "descriptionKey": "financialFreedom.steps.step6.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    },
                    {
                        "id": 7,
                        "titleKey": "financialFreedom.steps.step7.title",
                        "descriptionKey": "financialFreedom.steps.step7.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    }
                ],
                startDate=datetime.now(),
                lastUpdated=datetime.now()
            )
        
        logger.info(f"Found existing data for user {current_user.household_id}")
        return financial_freedom
    except Exception as e:
        logger.error(f"Error in get_financial_freedom: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching financial freedom data: {str(e)}"
        )


@router.get("/calculated", response_model=FinancialFreedomResponse)
async def get_financial_freedom_calculated(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the financial freedom data with auto-calculated values for steps 1-3 and 6.
    This endpoint calculates progress based on actual financial data (savings, loans, expenses).
    """
    try:
        logger.info(f"Getting calculated financial freedom data for user: {current_user.household_id}")

        # Get base financial freedom data (or defaults)
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.household_id
        ).first()

        # Get user settings
        user_settings = db.query(Settings).filter(Settings.user_id == current_user.household_id).first()
        emergency_fund_target = user_settings.emergency_fund_target if user_settings else 3000
        emergency_fund_months = user_settings.emergency_fund_months if user_settings else 3

        today = datetime.now().date()

        # ============== Calculate Savings Data ==============
        def active_savings_filter(query, saving_type: str):
            """Filter for active savings (non-recurring or active recurring)"""
            return query.filter(
                Saving.user_id == current_user.household_id,
                Saving.saving_type == saving_type,
                Saving.date <= today,
                or_(
                    Saving.is_recurring == False,
                    and_(
                        Saving.is_recurring == True,
                        or_(
                            Saving.end_date == None,
                            Saving.end_date >= today
                        )
                    )
                )
            )

        # Emergency fund savings (category-specific)
        ef_deposits = active_savings_filter(
            db.query(func.sum(Saving.amount)).filter(Saving.category == SavingCategory.EMERGENCY_FUND),
            'deposit'
        ).scalar() or 0.0
        ef_withdrawals = active_savings_filter(
            db.query(func.sum(Saving.amount)).filter(Saving.category == SavingCategory.EMERGENCY_FUND),
            'withdrawal'
        ).scalar() or 0.0
        emergency_fund_savings = ef_deposits - ef_withdrawals

        # Liquid savings for full emergency fund (emergency_fund + six_month_fund + general)
        liquid_categories = [SavingCategory.EMERGENCY_FUND, SavingCategory.SIX_MONTH_FUND, SavingCategory.GENERAL]
        liquid_deposits = active_savings_filter(
            db.query(func.sum(Saving.amount)).filter(Saving.category.in_(liquid_categories)),
            'deposit'
        ).scalar() or 0.0
        liquid_withdrawals = active_savings_filter(
            db.query(func.sum(Saving.amount)).filter(Saving.category.in_(liquid_categories)),
            'withdrawal'
        ).scalar() or 0.0
        liquid_savings = liquid_deposits - liquid_withdrawals

        # ============== Calculate Loan Data ==============
        # Non-mortgage loans (Baby Step 2 debts - exclude mortgage and leasing)
        non_mortgage_debt = db.query(func.sum(Loan.remaining_balance)).filter(
            Loan.user_id == current_user.household_id,
            ~Loan.loan_type.in_(['mortgage', 'leasing'])
        ).scalar() or 0.0

        non_mortgage_principal = db.query(func.sum(Loan.principal_amount)).filter(
            Loan.user_id == current_user.household_id,
            ~Loan.loan_type.in_(['mortgage', 'leasing'])
        ).scalar() or 0.0

        # Mortgage data (Baby Step 6)
        mortgage = db.query(Loan).filter(
            Loan.user_id == current_user.household_id,
            Loan.loan_type == 'mortgage'
        ).first()

        has_mortgage = mortgage is not None
        mortgage_balance = float(mortgage.remaining_balance) if mortgage else 0.0
        mortgage_principal = float(mortgage.principal_amount) if mortgage else 0.0

        # ============== Calculate Monthly Expenses ==============
        # Get current month's recurring and non-recurring expenses
        month_start = today.replace(day=1)

        # Non-recurring expenses this month
        monthly_expenses_non_recurring = db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == current_user.household_id,
            Expense.date >= month_start,
            Expense.date <= today,
            Expense.is_recurring == False
        ).scalar() or 0.0

        # Active recurring expenses
        monthly_expenses_recurring = db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == current_user.household_id,
            Expense.is_recurring == True,
            Expense.date <= today,
            or_(
                Expense.end_date == None,
                Expense.end_date >= today
            )
        ).scalar() or 0.0

        monthly_expenses = monthly_expenses_non_recurring + monthly_expenses_recurring
        if monthly_expenses == 0:
            monthly_expenses = 8000  # Default fallback

        # ============== Calculate Progress Percentages ==============
        # Step 1: Starter Emergency Fund (3000 zł)
        step1_progress = min(100, round((emergency_fund_savings / emergency_fund_target) * 100)) if emergency_fund_target > 0 else 0
        step1_completed = step1_progress >= 100

        # Step 2: Pay off all non-mortgage debt
        if non_mortgage_principal > 0:
            step2_progress = round((1 - (non_mortgage_debt / non_mortgage_principal)) * 100)
            step2_progress = max(0, min(100, step2_progress))
        else:
            # No loans = 100% complete
            step2_progress = 100
        step2_completed = step2_progress >= 100

        # Step 3: Full Emergency Fund (3-6 months expenses)
        full_emergency_target = monthly_expenses * emergency_fund_months
        if full_emergency_target > 0:
            step3_progress = min(100, round((liquid_savings / full_emergency_target) * 100))
        else:
            step3_progress = 100
        step3_completed = step3_progress >= 100

        # Step 6: Pay off mortgage
        if has_mortgage and mortgage_principal > 0:
            step6_progress = round((1 - (mortgage_balance / mortgage_principal)) * 100)
            step6_progress = max(0, min(100, step6_progress))
        else:
            step6_progress = 0  # No mortgage = 0% (not applicable)
        step6_completed = step6_progress >= 100

        # ============== Build Response ==============
        # Get base steps (either from database or defaults)
        if financial_freedom:
            base_steps = financial_freedom.steps
            start_date = financial_freedom.startDate
        else:
            base_steps = None
            start_date = datetime.now()

        # Create updated steps with calculated values
        updated_steps = []
        for step_id in range(1, 8):
            # Find existing step or create default
            if base_steps:
                existing_step = next((s for s in base_steps if s.get("id") == step_id), None)
            else:
                existing_step = None

            if step_id == 1:
                updated_steps.append({
                    "id": 1,
                    "titleKey": "financialFreedom.steps.step1.title",
                    "descriptionKey": "financialFreedom.steps.step1.description",
                    "isCompleted": step1_completed,
                    "progress": step1_progress,
                    "targetAmount": emergency_fund_target,
                    "currentAmount": emergency_fund_savings,
                    "completionDate": existing_step.get("completionDate") if existing_step and step1_completed else None,
                    "notes": existing_step.get("notes", "") if existing_step else ""
                })
            elif step_id == 2:
                updated_steps.append({
                    "id": 2,
                    "titleKey": "financialFreedom.steps.step2.title",
                    "descriptionKey": "financialFreedom.steps.step2.description",
                    "isCompleted": step2_completed,
                    "progress": step2_progress,
                    "targetAmount": non_mortgage_principal if non_mortgage_principal > 0 else None,
                    "currentAmount": non_mortgage_debt if non_mortgage_principal > 0 else None,
                    "completionDate": existing_step.get("completionDate") if existing_step and step2_completed else None,
                    "notes": existing_step.get("notes", "") if existing_step else ""
                })
            elif step_id == 3:
                updated_steps.append({
                    "id": 3,
                    "titleKey": "financialFreedom.steps.step3.title",
                    "descriptionKey": "financialFreedom.steps.step3.description",
                    "isCompleted": step3_completed,
                    "progress": step3_progress,
                    "targetAmount": full_emergency_target,
                    "currentAmount": liquid_savings,
                    "completionDate": existing_step.get("completionDate") if existing_step and step3_completed else None,
                    "notes": existing_step.get("notes", "") if existing_step else ""
                })
            elif step_id == 6:
                updated_steps.append({
                    "id": 6,
                    "titleKey": "financialFreedom.steps.step6.title",
                    "descriptionKey": "financialFreedom.steps.step6.description",
                    "isCompleted": step6_completed,
                    "progress": step6_progress,
                    "targetAmount": mortgage_principal if has_mortgage else None,
                    "currentAmount": mortgage_balance if has_mortgage else None,
                    "completionDate": existing_step.get("completionDate") if existing_step and step6_completed else None,
                    "notes": existing_step.get("notes", "") if existing_step else ""
                })
            else:
                # Steps 4, 5, 7 - use existing data or defaults (manual tracking)
                if existing_step:
                    updated_steps.append(existing_step)
                else:
                    updated_steps.append({
                        "id": step_id,
                        "titleKey": f"financialFreedom.steps.step{step_id}.title",
                        "descriptionKey": f"financialFreedom.steps.step{step_id}.description",
                        "isCompleted": False,
                        "progress": 0,
                        "targetAmount": None,
                        "currentAmount": None,
                        "completionDate": None,
                        "notes": ""
                    })

        return FinancialFreedomResponse(
            userId=current_user.household_id,
            steps=updated_steps,
            startDate=start_date,
            lastUpdated=datetime.now()
        )

    except Exception as e:
        logger.error(f"Error in get_financial_freedom_calculated: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching calculated financial freedom data: {str(e)}"
        )


@router.put("", response_model=FinancialFreedomResponse)
async def update_financial_freedom(
    financial_freedom_data: FinancialFreedomUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the financial freedom data for the current user."""
    try:
        logger.info(f"Updating financial freedom data for user: {current_user.household_id}")
        
        # Get existing financial freedom data to compare with updates
        existing_ff = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.household_id
        ).first()
        
        # Get user settings for steps 1-3 reference values
        user_settings = db.query(Settings).filter(Settings.user_id == current_user.household_id).first()
        
        # Prevent manual updates to steps 1-3 which are auto-calculated
        # We'll preserve the steps from the database when they're available
        if existing_ff:
            existing_steps = existing_ff.steps
            updated_steps = []
            
            for step in financial_freedom_data.steps:
                # For steps 1-3, we never accept client-side updates as they're fully automated
                if step.id <= 3 and existing_steps:
                    # Find the matching existing step and preserve it
                    existing_step = next((s for s in existing_steps if s["id"] == step.id), None)
                    if existing_step:
                        # Keep existing step data without changes
                        updated_steps.append(existing_step)
                    else:
                        # If the step doesn't exist in the database (unlikely), use the default
                        logger.warning(f"Step {step.id} not found in existing data, using client data")
                        updated_steps.append(step.dict())
                else:
                    # For steps 4-7, allow all updates
                    updated_steps.append(step.dict())
            
            # Create or update the financial freedom record
            if not existing_ff:
                logger.info(f"Creating new financial freedom record for user {current_user.household_id}")
                financial_freedom = FinancialFreedom(
                    userId=current_user.household_id,
                    steps=updated_steps,
                    startDate=financial_freedom_data.startDate or datetime.now(),
                    lastUpdated=datetime.now()
                )
                db.add(financial_freedom)
            else:
                logger.info(f"Updating existing record for user {current_user.household_id}")
                existing_ff.steps = updated_steps
                existing_ff.lastUpdated = datetime.now()
                financial_freedom = existing_ff
            
            db.commit()
            db.refresh(financial_freedom)
            logger.info(f"Successfully updated data for user {current_user.household_id}")

            # Check for FIRE-related achievements
            try:
                GamificationService.check_fire_badges(current_user.id, db)
            except Exception as gam_error:
                logger.warning(f"Gamification error (non-blocking): {gam_error}")

            return financial_freedom
        else:
            # If no existing record, create a new one (should be rare since GET creates a default)
            logger.info(f"Creating new financial freedom record for user {current_user.household_id}")
            financial_freedom = FinancialFreedom(
                userId=current_user.household_id,
                steps=[step.dict() for step in financial_freedom_data.steps],
                startDate=financial_freedom_data.startDate or datetime.now(),
                lastUpdated=datetime.now()
            )
            db.add(financial_freedom)
            db.commit()
            db.refresh(financial_freedom)
            return financial_freedom
    except Exception as e:
        logger.error(f"Error in update_financial_freedom: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating financial freedom data: {str(e)}"
        )

@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def reset_financial_freedom(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reset the financial freedom data for the current user."""
    try:
        logger.info(f"Resetting financial freedom data for user: {current_user.household_id}")
        financial_freedom = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == current_user.household_id
        ).first()
        
        if financial_freedom:
            db.delete(financial_freedom)
            db.commit()
            logger.info(f"Successfully reset data for user {current_user.household_id}")
        else:
            logger.info(f"No data found to reset for user {current_user.household_id}")
        
        return None
    except Exception as e:
        logger.error(f"Error in reset_financial_freedom: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting financial freedom data: {str(e)}"
        ) 