from pydantic import BaseModel, EmailStr
from datetime import date, datetime
from typing import Optional, List

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    pass

class User(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class IncomeBase(BaseModel):
    source: str
    amount: float
    is_recurring: bool = True
    date: date

class IncomeCreate(IncomeBase):
    pass

class Income(IncomeBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ExpenseBase(BaseModel):
    category: str
    description: str
    amount: float
    date: date
    is_recurring: bool = False

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class LoanBase(BaseModel):
    loan_type: str
    description: str
    principal_amount: float
    interest_rate: float
    start_date: date
    term_months: int
    monthly_payment: float
    remaining_balance: float

class LoanCreate(LoanBase):
    pass

class Loan(LoanBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True 