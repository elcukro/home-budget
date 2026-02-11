from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BudgetEntryBase(BaseModel):
    month: int = Field(..., ge=1, le=12)
    entry_type: str  # income, expense, loan_payment
    category: str
    description: str
    planned_amount: float
    is_recurring: bool = False
    source_onboarding_id: Optional[str] = None


class BudgetEntryCreate(BudgetEntryBase):
    budget_year_id: Optional[int] = None  # Set server-side for bulk


class BudgetEntryUpdate(BaseModel):
    planned_amount: Optional[float] = None
    actual_amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None


class BudgetEntryResponse(BudgetEntryBase):
    id: int
    budget_year_id: int
    user_id: str
    actual_amount: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BudgetYearCreate(BaseModel):
    year: int
    source: str = "manual"
    template_data: Optional[dict] = None


class MonthSummary(BaseModel):
    month: int
    planned_income: float = 0
    planned_expenses: float = 0
    planned_loan_payments: float = 0
    actual_income: float = 0
    actual_expenses: float = 0
    actual_loan_payments: float = 0
    entry_count: int = 0


class BudgetYearResponse(BaseModel):
    id: int
    user_id: str
    year: int
    status: str
    source: str
    template_data: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    monthly_summaries: Optional[List[MonthSummary]] = None

    class Config:
        from_attributes = True


class BudgetFromOnboardingRequest(BaseModel):
    year: int
    income_entries: List[BudgetEntryBase]
    expense_entries: List[BudgetEntryBase]
    loan_entries: List[BudgetEntryBase] = []
