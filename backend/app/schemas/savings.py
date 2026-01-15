from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import date, datetime
from enum import Enum

class SavingCategory(str, Enum):
    EMERGENCY_FUND = "emergency_fund"
    SIX_MONTH_FUND = "six_month_fund"
    RETIREMENT = "retirement"
    COLLEGE = "college"
    GENERAL = "general"
    INVESTMENT = "investment"
    REAL_ESTATE = "real_estate"
    OTHER = "other"

class SavingType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"

class SavingBase(BaseModel):
    category: SavingCategory
    description: str
    amount: float = Field(gt=0)  # Amount must be positive
    date: date
    end_date: Optional[date] = None  # Optional end date for recurring items
    is_recurring: bool = False
    target_amount: Optional[float] = None
    saving_type: SavingType

    @validator('target_amount')
    def target_amount_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Target amount must be positive')
        return v

    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if v is not None and 'date' in values and v < values['date']:
            raise ValueError('End date must be after start date')
        return v

class SavingCreate(SavingBase):
    pass

class SavingUpdate(SavingBase):
    pass

class Saving(SavingBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SavingsSummary(BaseModel):
    total_savings: float
    emergency_fund: float
    emergency_fund_target: float = 1000  # Default target for baby step 1
    emergency_fund_progress: float
    monthly_contribution: float
    category_totals: dict[SavingCategory, float]
    recent_transactions: List[Saving]

    class Config:
        from_attributes = True 
