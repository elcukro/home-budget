from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.savings import Saving, SavingCategory
from app.schemas.savings import SavingCreate, SavingUpdate

def get_savings(
    db: Session,
    user_id: int,
    category: Optional[SavingCategory] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100
) -> List[Saving]:
    query = db.query(Saving).filter(Saving.user_id == user_id)
    
    if category:
        query = query.filter(Saving.category == category)
    if start_date:
        query = query.filter(Saving.date >= start_date)
    if end_date:
        query = query.filter(Saving.date <= end_date)
    
    return query.order_by(Saving.date.desc()).offset(skip).limit(limit).all()

def get_saving(db: Session, saving_id: int, user_id: int) -> Optional[Saving]:
    return db.query(Saving).filter(
        and_(Saving.id == saving_id, Saving.user_id == user_id)
    ).first()

def create_saving(db: Session, saving: SavingCreate, user_id: int) -> Saving:
    db_saving = Saving(
        user_id=user_id,
        **saving.dict()
    )
    db.add(db_saving)
    db.commit()
    db.refresh(db_saving)
    return db_saving

def update_saving(
    db: Session,
    saving: Saving,
    saving_update: SavingUpdate
) -> Saving:
    update_data = saving_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(saving, field, value)
    
    saving.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(saving)
    return saving

def delete_saving(db: Session, saving: Saving) -> None:
    db.delete(saving)
    db.commit()

def get_savings_summary(db: Session, user_id: int) -> dict:
    # Calculate total savings (deposits - withdrawals)
    deposits = db.query(func.sum(Saving.amount)).filter(
        and_(
            Saving.user_id == user_id,
            Saving.saving_type == "deposit"
        )
    ).scalar() or 0.0
    
    withdrawals = db.query(func.sum(Saving.amount)).filter(
        and_(
            Saving.user_id == user_id,
            Saving.saving_type == "withdrawal"
        )
    ).scalar() or 0.0
    
    # Calculate totals by category
    category_totals = {}
    for category in SavingCategory:
        category_deposits = db.query(func.sum(Saving.amount)).filter(
            and_(
                Saving.user_id == user_id,
                Saving.category == category,
                Saving.saving_type == "deposit"
            )
        ).scalar() or 0.0
        
        category_withdrawals = db.query(func.sum(Saving.amount)).filter(
            and_(
                Saving.user_id == user_id,
                Saving.category == category,
                Saving.saving_type == "withdrawal"
            )
        ).scalar() or 0.0
        
        category_totals[category] = category_deposits - category_withdrawals
    
    # Get recent transactions
    recent_transactions = get_savings(
        db=db,
        user_id=user_id,
        limit=5
    )
    
    # Calculate monthly contribution (average of deposits in the last month)
    month_ago = datetime.utcnow().replace(day=1)
    monthly_deposits = db.query(func.sum(Saving.amount)).filter(
        and_(
            Saving.user_id == user_id,
            Saving.saving_type == "deposit",
            Saving.date >= month_ago
        )
    ).scalar() or 0.0
    
    return {
        "total_savings": deposits - withdrawals,
        "category_totals": category_totals,
        "monthly_contribution": monthly_deposits,
        "recent_transactions": recent_transactions
    } 