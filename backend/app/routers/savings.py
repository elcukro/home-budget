from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Optional
from datetime import datetime, date
import logging

from ..database import get_db
from ..models import User, Saving
from ..schemas.savings import SavingCreate, SavingUpdate, Saving as SavingSchema, SavingsSummary, SavingCategory
from ..dependencies import get_current_user

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
        db_saving = Saving(
            **saving.dict(),
            user_id=current_user.id
        )
        db.add(db_saving)
        db.commit()
        db.refresh(db_saving)
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
        
        # Calculate total deposits
        deposits = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'deposit'
        ).scalar() or 0.0
        
        # Calculate total withdrawals
        withdrawals = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'withdrawal'
        ).scalar() or 0.0
        
        total_savings = deposits - withdrawals
        
        # Calculate emergency fund total
        emergency_fund_deposits = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.category == SavingCategory.EMERGENCY_FUND,
            Saving.saving_type == 'deposit'
        ).scalar() or 0.0
        
        emergency_fund_withdrawals = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.category == SavingCategory.EMERGENCY_FUND,
            Saving.saving_type == 'withdrawal'
        ).scalar() or 0.0
        
        emergency_fund = emergency_fund_deposits - emergency_fund_withdrawals
        
        # Calculate monthly contribution (total deposits in the current month)
        month_start = datetime.now().date().replace(day=1)
        monthly_contribution = db.query(
            func.sum(Saving.amount)
        ).filter(
            Saving.user_id == current_user.id,
            Saving.saving_type == 'deposit',
            Saving.date >= month_start
        ).scalar() or 0.0
        
        # Calculate category totals
        category_totals = {}
        for category in SavingCategory:
            deposits = db.query(
                func.sum(Saving.amount)
            ).filter(
                Saving.user_id == current_user.id,
                Saving.category == category,
                Saving.saving_type == 'deposit'
            ).scalar() or 0.0
            
            withdrawals = db.query(
                func.sum(Saving.amount)
            ).filter(
                Saving.user_id == current_user.id,
                Saving.category == category,
                Saving.saving_type == 'withdrawal'
            ).scalar() or 0.0
            
            category_totals[category] = deposits - withdrawals
        
        # Get recent transactions
        recent_transactions = db.query(Saving).filter(
            Saving.user_id == current_user.id
        ).order_by(
            Saving.date.desc()
        ).limit(5).all()
        
        # Calculate emergency fund progress
        emergency_fund_target = 1000  # Baby step 1 target
        emergency_fund_progress = min((emergency_fund / emergency_fund_target) * 100, 100) if emergency_fund_target > 0 else 0
        
        summary = SavingsSummary(
            total_savings=total_savings,
            emergency_fund=emergency_fund,
            emergency_fund_target=emergency_fund_target,
            emergency_fund_progress=emergency_fund_progress,
            monthly_contribution=monthly_contribution,
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