import logging
import traceback
from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, database
from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
import calendar
from fastapi.responses import JSONResponse, StreamingResponse
import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from .routers import users, auth, financial_freedom, savings, exchange_rates, banking, tink, stripe_billing
from .database import engine, Base
from .routers.users import User, UserBase, Settings, SettingsBase  # Import User, UserBase, Settings, and SettingsBase models from users router
import json
import re
import httpx
from .logging_utils import make_conditional_print
from .services.subscription_service import SubscriptionService

logger = logging.getLogger(__name__)
print = make_conditional_print(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create the database tables
Base.metadata.create_all(bind=engine)

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(financial_freedom.router)
app.include_router(savings.router)
app.include_router(exchange_rates.router)
app.include_router(banking.router)
app.include_router(tink.router)
app.include_router(stripe_billing.router)

# Loan models
VALID_LOAN_TYPES = ["mortgage", "car", "personal", "student", "other"]

class LoanBase(BaseModel):
    loan_type: str = Field(..., description="Type of loan")
    description: str = Field(..., min_length=1, max_length=100, description="Loan description")
    principal_amount: float = Field(..., gt=0, description="Original loan amount")
    remaining_balance: float = Field(..., ge=0, description="Current remaining balance")
    interest_rate: float = Field(..., ge=0, le=100, description="Annual interest rate as percentage")
    monthly_payment: float = Field(..., ge=0, description="Monthly payment amount")
    start_date: date = Field(..., description="Loan start date")
    term_months: int = Field(..., gt=0, description="Loan term in months")

    @model_validator(mode='after')
    def validate_loan(self):
        # Validate loan type
        if self.loan_type not in VALID_LOAN_TYPES:
            raise ValueError(f"Invalid loan type. Must be one of: {', '.join(VALID_LOAN_TYPES)}")

        # Validate remaining balance doesn't exceed principal
        if self.remaining_balance > self.principal_amount:
            raise ValueError("Remaining balance cannot exceed principal amount")

        # Validate monthly payment isn't greater than principal
        if self.monthly_payment > self.principal_amount:
            raise ValueError("Monthly payment cannot exceed principal amount")

        return self

class LoanCreate(LoanBase):
    pass

class Loan(LoanBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Expense models
class ExpenseBase(BaseModel):
    category: str
    description: str
    amount: float
    is_recurring: bool = False
    date: date  # Start date (for recurring) or occurrence date (for one-off)
    end_date: date | None = None  # Optional end date for recurring items (null = forever)

class ExpenseCreate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Income models
class IncomeBase(BaseModel):
    category: str
    description: str
    amount: float
    is_recurring: bool = False
    date: date  # Start date (for recurring) or occurrence date (for one-off)
    end_date: date | None = None  # Optional end date for recurring items (null = forever)

class IncomeCreate(IncomeBase):
    pass

class Income(IncomeBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Activity models
class ActivityBase(BaseModel):
    entity_type: str
    operation_type: str
    entity_id: int
    previous_values: Optional[dict] = None
    new_values: Optional[dict] = None

class ActivityCreate(ActivityBase):
    pass

class Activity(ActivityBase):
    id: int
    user_id: str
    timestamp: datetime


class ImportPayload(BaseModel):
    data: dict
    clear_existing: bool = False

# Monthly Budget Report models
class MonthlyBudgetData(BaseModel):
    incomes: List[Income]
    expenses: List[Expense]
    loan_payments: List[Loan]
    totals: dict

class YearlyBudgetReport(BaseModel):
    months: dict[str, MonthlyBudgetData]

# Insights models
class InsightMetric(BaseModel):
    label: str
    value: str
    trend: str  # "up" | "down" | "stable"

class Insight(BaseModel):
    type: str  # "observation" | "recommendation" | "alert" | "achievement"
    title: str
    description: str
    priority: str  # "high" | "medium" | "low"
    actionItems: list[str]
    metrics: list[InsightMetric]

class CategoryInsights(BaseModel):
    insights: list[Insight]
    status: str  # "good" | "can_be_improved" | "ok" | "bad"

class InsightsResponse(BaseModel):
    categories: dict[str, list[Insight]]
    status: dict[str, str]
    metadata: dict

class InsightsCache(BaseModel):
    id: int
    userId: str
    insights: InsightsResponse
    financialSnapshot: dict
    createdAt: datetime
    isStale: bool

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Define SettingsCreate model
class SettingsCreate(SettingsBase):
    pass

# User endpoints
@app.get("/users/me", response_model=User)
def get_current_user(user_id: str = Query(..., description="The ID of the user"), db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting user with ID: {user_id}")
        user = db.query(models.User).filter(models.User.id == user_id).first()
        
        if not user:
            print(f"[FastAPI] User not found with ID: {user_id}, creating new user")
            # Create new user
            user = models.User(
                id=user_id,
                email=user_id,  # Using ID as email since we use email as ID
                name=None
            )
            db.add(user)
            try:
                db.commit()
                db.refresh(user)
                print(f"[FastAPI] Created new user: {user}")
                
                # Create default settings for the new user
                settings = models.Settings(
                    user_id=user_id,
                    language="en",
                    currency="USD",
                    ai={"apiKey": None}
                )
                db.add(settings)
                db.commit()
                print(f"[FastAPI] Created default settings for new user")
            except Exception as e:
                db.rollback()
                print(f"[FastAPI] Error creating user: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")
        
        print(f"[FastAPI] Returning user: {user}")
        return user
    except Exception as e:
        print(f"[FastAPI] Error in get_current_user: {str(e)}")
        print(f"[FastAPI] Error type: {type(e)}")
        import traceback
        print(f"[FastAPI] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users", response_model=User)
def create_user(user: UserBase, db: Session = Depends(database.get_db)):
    print(f"[FastAPI] Creating user with email: {user.email}")
    
    # Check if user already exists by email
    existing_user = db.query(models.User).filter(
        (models.User.email == user.email) | (models.User.id == user.email)
    ).first()
    
    if existing_user:
        print(f"[FastAPI] User already exists with email: {user.email}")
        return existing_user
    
    # Create new user with email as ID
    db_user = models.User(
        id=user.email,  # Using email as ID
        email=user.email,
        name=user.name
    )
    
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Create default settings for the new user
        default_settings = models.Settings(
            user_id=db_user.id,
            language="en",
            currency="USD",
            ai={"apiKey": None}
        )
        db.add(default_settings)
        db.commit()
        
        print(f"[FastAPI] Created new user and settings: {db_user}")
        return db_user
    except Exception as e:
        db.rollback()
        print(f"[FastAPI] Error creating user: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Settings endpoints
@app.get("/users/{user_id}/settings", response_model=Settings)
def get_user_settings(user_id: str, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting settings for user: {user_id}")
        
        # First check if user exists
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            print(f"[FastAPI] User not found with ID: {user_id}, creating new user")
            # Create new user
            user = models.User(
                id=user_id,
                email=user_id,  # Using ID as email since we use email as ID
                name=None
            )
            db.add(user)
            try:
                db.commit()
                print(f"[FastAPI] Created new user: {user}")
            except Exception as e:
                db.rollback()
                print(f"[FastAPI] Error creating user: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating user: {str(e)}")
        
        # Now get or create settings
        settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
        
        if not settings:
            print(f"[FastAPI] No settings found for user: {user_id}, creating default settings")
            # Create default settings
            settings = models.Settings(
                user_id=user_id,
                language="en",
                currency="USD",
                ai={"apiKey": None}
            )
            db.add(settings)
            try:
                db.commit()
                db.refresh(settings)
                print(f"[FastAPI] Created default settings: {settings}")
            except Exception as e:
                db.rollback()
                print(f"[FastAPI] Error creating settings: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error creating settings: {str(e)}")
        
        print(f"[FastAPI] Returning settings: {settings}")
        return settings
    except Exception as e:
        print(f"[FastAPI] Error in get_user_settings: {str(e)}")
        import traceback
        print(f"[FastAPI] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/settings", response_model=Settings)
def update_user_settings(user_id: str, settings: SettingsCreate, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Updating settings for user: {user_id}")
        db_settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
        
        if not db_settings:
            print(f"[FastAPI] No settings found for user: {user_id}, creating new settings")
            db_settings = models.Settings(user_id=user_id)
            db.add(db_settings)
        
        for key, value in settings.model_dump().items():
            setattr(db_settings, key, value)
        
        db.commit()
        db.refresh(db_settings)
        print(f"[FastAPI] Updated settings: {db_settings}")
        return db_settings
    except Exception as e:
        print(f"[FastAPI] Error in update_user_settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Loan endpoints
@app.get("/loans", response_model=List[Loan])
def get_loans(user_id: str = Query(..., description="The ID of the user"), db: Session = Depends(database.get_db)):
    loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
    return loans

@app.post("/loans", response_model=Loan)
def create_loan(loan: LoanCreate, user_id: str = Query(..., description="The ID of the user"), db: Session = Depends(database.get_db)):
    # Check subscription limits
    can_add, message = SubscriptionService.can_add_loan(user_id, db)
    if not can_add:
        raise HTTPException(status_code=403, detail=message)

    # Check if user exists
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db_loan = models.Loan(
        user_id=user_id,
        loan_type=loan.loan_type,
        description=loan.description,
        principal_amount=loan.principal_amount,
        remaining_balance=loan.remaining_balance,
        interest_rate=loan.interest_rate,
        monthly_payment=loan.monthly_payment,
        start_date=loan.start_date,
        term_months=loan.term_months
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.put("/loans/{loan_id}", response_model=Loan)
def update_loan(loan_id: int, loan: LoanCreate, user_id: str = Query(..., description="The ID of the user"), db: Session = Depends(database.get_db)):
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == user_id
    ).first()
    
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    for key, value in loan.model_dump().items():
        setattr(db_loan, key, value)
    
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.delete("/users/{user_id}/loans/{loan_id}")
def delete_loan(user_id: str, loan_id: int, db: Session = Depends(database.get_db)):
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == user_id
    ).first()
    
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    db.delete(db_loan)
    db.commit()
    return {"message": "Loan deleted successfully"}

# Expense endpoints
@app.get("/users/{user_id}/expenses", response_model=List[Expense])
def get_user_expenses(user_id: str, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting expenses for user: {user_id}")
        expenses = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
        print(f"[FastAPI] Found {len(expenses)} expenses")
        return expenses
    except Exception as e:
        print(f"[FastAPI] Error in get_user_expenses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/expenses", response_model=Expense)
def create_expense(user_id: str, expense: ExpenseCreate, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Creating expense for user: {user_id}")
        # Check subscription limits
        can_add, message = SubscriptionService.can_add_expense(user_id, db)
        if not can_add:
            raise HTTPException(status_code=403, detail=message)

        # Check if user exists
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            print(f"[FastAPI] User not found with ID: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        db_expense = models.Expense(**expense.model_dump(), user_id=user_id)
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)
        print(f"[FastAPI] Created expense: {db_expense}")
        return db_expense
    except Exception as e:
        print(f"[FastAPI] Error in create_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/expenses/{expense_id}", response_model=Expense)
def update_expense(user_id: str, expense_id: int, expense: ExpenseCreate, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Updating expense {expense_id} for user: {user_id}")
        db_expense = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.user_id == user_id
        ).first()
        
        if not db_expense:
            print(f"[FastAPI] Expense not found with ID: {expense_id}")
            raise HTTPException(status_code=404, detail="Expense not found")
        
        for key, value in expense.model_dump().items():
            setattr(db_expense, key, value)
        
        db.commit()
        db.refresh(db_expense)
        print(f"[FastAPI] Updated expense: {db_expense}")
        return db_expense
    except Exception as e:
        print(f"[FastAPI] Error in update_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{user_id}/expenses/{expense_id}")
def delete_expense(user_id: str, expense_id: int, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Deleting expense {expense_id} for user: {user_id}")
        db_expense = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.user_id == user_id
        ).first()
        
        if not db_expense:
            print(f"[FastAPI] Expense not found with ID: {expense_id}")
            raise HTTPException(status_code=404, detail="Expense not found")
        
        db.delete(db_expense)
        db.commit()
        print(f"[FastAPI] Deleted expense: {db_expense}")
        return {"message": "Expense deleted successfully"}
    except Exception as e:
        print(f"[FastAPI] Error in delete_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Income endpoints
@app.get("/users/{user_id}/income", response_model=List[Income])
def get_user_income(user_id: str, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting income for user: {user_id}")
        income = db.query(models.Income).filter(models.Income.user_id == user_id).all()
        print(f"[FastAPI] Found {len(income)} income entries")
        return income
    except Exception as e:
        print(f"[FastAPI] Error in get_user_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/income", response_model=Income)
def create_income(user_id: str, income: IncomeCreate, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Creating income for user: {user_id}")
        # Check subscription limits
        can_add, message = SubscriptionService.can_add_income(user_id, db)
        if not can_add:
            raise HTTPException(status_code=403, detail=message)

        # Check if user exists
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            print(f"[FastAPI] User not found with ID: {user_id}")
            raise HTTPException(status_code=404, detail="User not found")

        db_income = models.Income(**income.model_dump(), user_id=user_id)
        db.add(db_income)
        db.commit()
        db.refresh(db_income)
        print(f"[FastAPI] Created income: {db_income}")
        return db_income
    except Exception as e:
        print(f"[FastAPI] Error in create_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/income/{income_id}", response_model=Income)
def update_income(user_id: str, income_id: int, income: IncomeCreate, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Updating income {income_id} for user: {user_id}")
        db_income = db.query(models.Income).filter(
            models.Income.id == income_id,
            models.Income.user_id == user_id
        ).first()
        
        if not db_income:
            print(f"[FastAPI] Income not found with ID: {income_id}")
            raise HTTPException(status_code=404, detail="Income not found")
        
        for key, value in income.model_dump().items():
            setattr(db_income, key, value)
        
        db.commit()
        db.refresh(db_income)
        print(f"[FastAPI] Updated income: {db_income}")
        return db_income
    except Exception as e:
        print(f"[FastAPI] Error in update_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{user_id}/income/{income_id}")
def delete_income(user_id: str, income_id: int, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Deleting income {income_id} for user: {user_id}")
        db_income = db.query(models.Income).filter(
            models.Income.id == income_id,
            models.Income.user_id == user_id
        ).first()
        
        if not db_income:
            print(f"[FastAPI] Income not found with ID: {income_id}")
            raise HTTPException(status_code=404, detail="Income not found")
        
        db.delete(db_income)
        db.commit()
        print(f"[FastAPI] Deleted income: {db_income}")
        return {"message": "Income deleted successfully"}
    except Exception as e:
        print(f"[FastAPI] Error in delete_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/summary")
async def get_user_summary(user_id: str, db: Session = Depends(database.get_db)):
    try:
        print(f"[FastAPI] Getting summary for user: {user_id}")
        # Get current month's start and end dates
        today = datetime.now()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        # Fetch monthly income (non-recurring, within current month)
        monthly_income_non_recurring = db.query(func.sum(models.Income.amount)).filter(
            models.Income.user_id == user_id,
            models.Income.date >= month_start,
            models.Income.date <= month_end,
            models.Income.is_recurring == False
        ).scalar() or 0

        # Fetch recurring income (regardless of date)
        monthly_income_recurring = db.query(func.sum(models.Income.amount)).filter(
            models.Income.user_id == user_id,
            models.Income.is_recurring == True
        ).scalar() or 0

        # Total monthly income
        monthly_income = monthly_income_non_recurring + monthly_income_recurring

        # Fetch monthly expenses (non-recurring, within current month)
        monthly_expenses_non_recurring = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= month_start,
            models.Expense.date <= month_end,
            models.Expense.is_recurring == False
        ).scalar() or 0

        # Fetch recurring expenses (regardless of date)
        monthly_expenses_recurring = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.is_recurring == True
        ).scalar() or 0

        # Total monthly expenses
        monthly_expenses = monthly_expenses_non_recurring + monthly_expenses_recurring

        # Fetch monthly loan payments
        monthly_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
            models.Loan.user_id == user_id,
            models.Loan.start_date <= month_end
        ).scalar() or 0

        # Fetch total loan balance
        total_loan_balance = db.query(func.sum(models.Loan.remaining_balance)).filter(
            models.Loan.user_id == user_id
        ).scalar() or 0

        # Calculate monthly balance
        monthly_balance = monthly_income - monthly_expenses - monthly_loan_payments

        # Calculate savings rate if income is not zero
        savings_rate = 0
        if monthly_income > 0:
            savings_rate = (monthly_income - monthly_expenses - monthly_loan_payments) / monthly_income

        # Calculate debt-to-income ratio if income is not zero
        debt_to_income = 0
        if monthly_income > 0:
            debt_to_income = monthly_loan_payments / monthly_income

        # Get income distribution by category
        income_distribution = []
        income_categories = db.query(
            models.Income.category,
            func.sum(models.Income.amount).label("total_amount")
        ).filter(
            models.Income.user_id == user_id
        ).group_by(
            models.Income.category
        ).all()

        total_income = sum(category.total_amount for category in income_categories)
        for category in income_categories:
            percentage = (category.total_amount / total_income * 100) if total_income > 0 else 0
            income_distribution.append({
                "category": category.category,
                "amount": float(category.total_amount),
                "percentage": float(percentage)
            })

        # Get expense distribution by category
        expense_distribution = []
        expense_categories = db.query(
            models.Expense.category,
            func.sum(models.Expense.amount).label("total_amount")
        ).filter(
            models.Expense.user_id == user_id
        ).group_by(
            models.Expense.category
        ).all()

        total_expenses = sum(category.total_amount for category in expense_categories)
        for category in expense_categories:
            percentage = (category.total_amount / total_expenses * 100) if total_expenses > 0 else 0
            expense_distribution.append({
                "category": category.category,
                "amount": float(category.total_amount),
                "percentage": float(percentage)
            })

        # Generate cash flow data for all months in the current year
        cash_flow = []
        current_year = today.year
        
        # Include all 12 months of the current year
        for month in range(1, 13):
            month_date = datetime(current_year, month, 1)
            month_start_date = month_date.replace(day=1)
            month_end_date = (month_start_date + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            month_str = f"{current_year}-{month:02d}"
            
            # For past and current months, use actual data
            if month <= today.month:
                # Non-recurring income for this month
                month_income_non_recurring = db.query(func.sum(models.Income.amount)).filter(
                    models.Income.user_id == user_id,
                    models.Income.date >= month_start_date,
                    models.Income.date <= month_end_date,
                    models.Income.is_recurring == False
                ).scalar() or 0
                
                # Include recurring income
                month_income = month_income_non_recurring + monthly_income_recurring
                
                # Non-recurring expenses for this month
                month_expenses_non_recurring = db.query(func.sum(models.Expense.amount)).filter(
                    models.Expense.user_id == user_id,
                    models.Expense.date >= month_start_date,
                    models.Expense.date <= month_end_date,
                    models.Expense.is_recurring == False
                ).scalar() or 0
                
                # Include recurring expenses
                month_expenses = month_expenses_non_recurring + monthly_expenses_recurring
                
                # Loan payments for this month
                month_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
                    models.Loan.user_id == user_id,
                    models.Loan.start_date <= month_end_date
                ).scalar() or 0
            else:
                # For future months, use projections based on recurring data
                month_income = monthly_income_recurring
                month_expenses = monthly_expenses_recurring
                
                # Loan payments for future months (assuming all current loans continue)
                month_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
                    models.Loan.user_id == user_id,
                    models.Loan.start_date <= today
                ).scalar() or 0
            
            # Calculate net flow
            net_flow = month_income - month_expenses - month_loan_payments
            
            cash_flow.append({
                "month": month_str,
                "income": float(month_income),
                "expenses": float(month_expenses),
                "loanPayments": float(month_loan_payments),
                "netFlow": float(net_flow),
                "year": current_year
            })

        # Fetch active loans for the user
        active_loans = db.query(models.Loan).filter(
            models.Loan.user_id == user_id
        ).all()
        
        # Format loans for the frontend
        loans_data = []
        for loan in active_loans:
            # Calculate progress (paid amount / total amount)
            total_amount = loan.principal_amount
            paid_amount = total_amount - loan.remaining_balance
            progress = paid_amount / total_amount if total_amount > 0 else 0
            
        loans_data.append({
            "id": str(loan.id),
            "description": loan.description,
            "balance": float(loan.remaining_balance),
            "monthlyPayment": float(loan.monthly_payment),
            "interestRate": float(loan.interest_rate),
            "progress": float(progress),
            "totalAmount": float(total_amount)
        })

        recent_activities = db.query(models.Activity).filter(
            models.Activity.user_id == user_id
        ).order_by(models.Activity.timestamp.desc()).limit(20).all()

        numeric_fields = {
            'amount',
            'principal_amount',
            'remaining_balance',
            'monthly_payment',
            'target_amount',
        }

        def build_changes(activity: models.Activity) -> List[dict]:
            changes: List[dict] = []
            previous = activity.previous_values or {}
            new = activity.new_values or {}

            if activity.operation_type == 'create':
                for key, value in new.items():
                    if key in {'created_at', 'updated_at'}:
                        continue
                    if key in numeric_fields or isinstance(value, (int, float, str)):
                        changes.append({
                            'field': key,
                            'oldValue': None,
                            'newValue': value,
                        })
            elif activity.operation_type == 'delete':
                for key, value in previous.items():
                    if key in {'created_at', 'updated_at'}:
                        continue
                    if key in numeric_fields or isinstance(value, (int, float, str)):
                        changes.append({
                            'field': key,
                            'oldValue': value,
                            'newValue': None,
                        })
            else:
                for key, old_value in previous.items():
                    if key in {'created_at', 'updated_at'}:
                        continue
                    new_value = new.get(key)
                    if old_value != new_value:
                        if key in numeric_fields or isinstance(old_value, (int, float, str)) or isinstance(new_value, (int, float, str)):
                            changes.append({
                                'field': key,
                                'oldValue': old_value,
                                'newValue': new_value,
                            })
            return changes

        def activity_amount(activity: models.Activity) -> float:
            source = activity.new_values or activity.previous_values or {}
            try:
                if activity.entity_type == 'Income':
                    return float(source.get('amount', 0) or 0)
                if activity.entity_type == 'Expense':
                    return -float(source.get('amount', 0) or 0)
                if activity.entity_type == 'Loan':
                    return -float(source.get('monthly_payment', 0) or 0)
                if activity.entity_type == 'Saving':
                    amount = float(source.get('amount', 0) or 0)
                    return amount if source.get('saving_type') != 'withdrawal' else -amount
            except (TypeError, ValueError):
                pass
            return 0.0

        activities_payload = []
        for activity in recent_activities:
            base = activity.new_values or activity.previous_values or {}
            activities_payload.append({
                "id": activity.id,
                "title": base.get('description') or activity.entity_type,
                "amount": activity_amount(activity),
                "type": activity.entity_type.lower(),
                "date": activity.timestamp.isoformat() if activity.timestamp else datetime.utcnow().isoformat(),
                "operation": activity.operation_type,
                "changes": build_changes(activity),
            })

        summary = {
            "total_monthly_income": float(monthly_income),
            "total_monthly_expenses": float(monthly_expenses),
            "total_monthly_loan_payments": float(monthly_loan_payments),
            "total_loan_balance": float(total_loan_balance),
            "monthly_balance": float(monthly_balance),
            "savings_rate": float(savings_rate),
            "debt_to_income": float(debt_to_income),
            "income_distribution": income_distribution,
            "expense_distribution": expense_distribution,
            "cash_flow": cash_flow,
            "loans": loans_data,
            "activities": activities_payload,
        }
        print(f"[FastAPI] Summary data: {summary}")
        return summary
    except Exception as e:
        print(f"[FastAPI] Error fetching summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Activity endpoints
@app.post("/users/{user_id}/activities", response_model=Activity)
def create_activity(
    user_id: str,
    activity: ActivityCreate,
    db: Session = Depends(database.get_db)
):
    try:
        print(f"[FastAPI] Creating activity for user: {user_id}")
        db_activity = models.Activity(
            user_id=user_id,
            entity_type=activity.entity_type,
            operation_type=activity.operation_type,
            entity_id=activity.entity_id,
            previous_values=activity.previous_values,
            new_values=activity.new_values
        )
        db.add(db_activity)
        db.commit()
        db.refresh(db_activity)
        print(f"[FastAPI] Created activity: {db_activity}")
        return db_activity
    except Exception as e:
        print(f"[FastAPI] Error in create_activity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/activities", response_model=List[Activity])
def get_user_activities(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(database.get_db)
):
    try:
        print(f"[FastAPI] Getting activities for user: {user_id}")
        activities = db.query(models.Activity)\
            .filter(models.Activity.user_id == user_id)\
            .order_by(models.Activity.timestamp.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        print(f"[FastAPI] Found {len(activities)} activities")
        return activities
    except Exception as e:
        print(f"[FastAPI] Error in get_user_activities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/yearly-budget")
def get_yearly_budget(
    start_date: str,
    end_date: str,
    user_id: str = Query(..., description="The ID of the user"),
    db: Session = Depends(database.get_db)
):
    try:
        print(f"[FastAPI] Getting budget for user: {user_id}, period: {start_date} to {end_date}")
        
        try:
            # Parse date strings to datetime objects
            start_datetime = datetime.strptime(start_date, "%Y-%m")
            end_datetime = datetime.strptime(end_date, "%Y-%m")
            
            # Get the last day of the end month
            end_datetime = end_datetime.replace(
                day=calendar.monthrange(end_datetime.year, end_datetime.month)[1],
                hour=23, minute=59, second=59
            )
            
            print(f"[FastAPI] Parsed dates - Start: {start_datetime}, End: {end_datetime}")
        except ValueError as e:
            print(f"[FastAPI] Error parsing dates: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Invalid date format: {str(e)}")
        
        # Get all non-recurring incomes for the period
        try:
            regular_incomes = db.query(models.Income).filter(
                models.Income.user_id == user_id,
                models.Income.date >= start_datetime,
                models.Income.date <= end_datetime,
                models.Income.is_recurring == False
            ).all()
            print(f"[FastAPI] Found {len(regular_incomes)} regular incomes")
        except Exception as e:
            print(f"[FastAPI] Error fetching regular incomes: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching regular incomes: {str(e)}")

        # Get recurring incomes
        try:
            recurring_incomes = db.query(models.Income).filter(
                models.Income.user_id == user_id,
                models.Income.is_recurring == True,
                models.Income.date <= end_datetime
            ).all()
            print(f"[FastAPI] Found {len(recurring_incomes)} recurring incomes")
        except Exception as e:
            print(f"[FastAPI] Error fetching recurring incomes: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching recurring incomes: {str(e)}")
        
        # Get all non-recurring expenses for the period
        try:
            regular_expenses = db.query(models.Expense).filter(
                models.Expense.user_id == user_id,
                models.Expense.date >= start_datetime,
                models.Expense.date <= end_datetime,
                models.Expense.is_recurring == False
            ).all()
            print(f"[FastAPI] Found {len(regular_expenses)} regular expenses")
        except Exception as e:
            print(f"[FastAPI] Error fetching regular expenses: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching regular expenses: {str(e)}")

        # Get recurring expenses
        try:
            recurring_expenses = db.query(models.Expense).filter(
                models.Expense.user_id == user_id,
                models.Expense.is_recurring == True,
                models.Expense.date <= end_datetime
            ).all()
            print(f"[FastAPI] Found {len(recurring_expenses)} recurring expenses")
        except Exception as e:
            print(f"[FastAPI] Error fetching recurring expenses: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching recurring expenses: {str(e)}")
        
        # Get all loans that could be active during this period
        try:
            loans = db.query(models.Loan).filter(
                models.Loan.user_id == user_id,
                models.Loan.start_date <= end_datetime
            ).all()
            print(f"[FastAPI] Found {len(loans)} loans")
            for loan in loans:
                print(f"[FastAPI] Loan: id={loan.id}, monthly_payment={loan.monthly_payment}, start_date={loan.start_date}, term_months={loan.term_months}")
        except Exception as e:
            print(f"[FastAPI] Error fetching loans: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching loans: {str(e)}")
        
        # Initialize monthly data
        monthly_data = {}
        
        # Generate a list of all months in the range
        current_date = start_datetime
        while current_date <= end_datetime:
            try:
                month_name = current_date.strftime("%B")
                month_idx = current_date.month
                year = current_date.year

                print(f"[FastAPI] Processing month: {month_name} year: {year}")
                
                # Regular incomes for this month
                monthly_regular_incomes = [
                    {
                        "id": inc.id,
                        "title": inc.description,
                        "amount": float(inc.amount),
                        "category": inc.category,
                        "date": inc.date.isoformat()
                    }
                    for inc in regular_incomes 
                    if inc.date.year == year and inc.date.month == month_idx
                ]
                
                # Add recurring incomes if they started before or during this month
                monthly_recurring_incomes = [
                    {
                        "id": inc.id,
                        "title": inc.description,
                        "amount": float(inc.amount),
                        "category": inc.category,
                        "date": inc.date.isoformat()
                    }
                    for inc in recurring_incomes 
                    if inc.date <= current_date.date()
                ]
                
                # Regular expenses for this month
                monthly_regular_expenses = [
                    {
                        "id": exp.id,
                        "title": exp.description,
                        "amount": float(exp.amount),
                        "category": exp.category,
                        "date": exp.date.isoformat()
                    }
                    for exp in regular_expenses 
                    if exp.date.year == year and exp.date.month == month_idx
                ]
                
                # Add recurring expenses if they started before or during this month
                monthly_recurring_expenses = [
                    {
                        "id": exp.id,
                        "title": exp.description,
                        "amount": float(exp.amount),
                        "category": exp.category,
                        "date": exp.date.isoformat()
                    }
                    for exp in recurring_expenses 
                    if exp.date <= current_date.date()
                ]
                
                # Convert current_date to date for comparison
                current_date_only = current_date.date()

                # Get active loans for this month
                monthly_loans = []
                monthly_loan_payments_total = 0.0
                
                for loan in loans:
                    try:
                        # Convert loan.start_date to datetime for comparison
                        loan_start = datetime.combine(loan.start_date, datetime.min.time())

                        # Calculate loan end date based on start date and term
                        loan_end_date = loan_start + timedelta(days=30 * loan.term_months)
                        
                        # Check if loan is active in this month
                        if loan_start.date() <= current_date_only and loan_end_date.date() >= current_date_only:
                            loan_payment = float(loan.monthly_payment) if loan.monthly_payment is not None else 0.0
                            monthly_loan_payments_total += loan_payment
                            
                            monthly_loans.append({
                                "id": loan.id,
                                "loan_type": loan.loan_type,
                                "description": loan.description,
                                "principal_amount": float(loan.principal_amount) if loan.principal_amount is not None else 0.0,
                                "remaining_balance": float(loan.remaining_balance) if loan.remaining_balance is not None else 0.0,
                                "interest_rate": float(loan.interest_rate) if loan.interest_rate is not None else 0.0,
                                "monthly_payment": loan_payment,
                                "start_date": loan.start_date.isoformat(),
                                "term_months": loan.term_months
                            })
                    except (ValueError, TypeError, AttributeError) as e:
                        print(f"[FastAPI] Error processing loan {loan.id}: {str(e)}")
                        continue
                
                # Calculate totals
                total_regular_income = sum(inc["amount"] for inc in monthly_regular_incomes)
                total_recurring_income = sum(inc["amount"] for inc in monthly_recurring_incomes)
                total_regular_expenses = sum(exp["amount"] for exp in monthly_regular_expenses)
                total_recurring_expenses = sum(exp["amount"] for exp in monthly_recurring_expenses)
                
                total_income = float(total_regular_income + total_recurring_income)
                total_expenses = float(total_regular_expenses + total_recurring_expenses)
                
                print(f"[FastAPI] {month_name} {year} - Income: {total_income}, Expenses: {total_expenses}, Loan Payments: {monthly_loan_payments_total}")
                
                monthly_data[f"{month_name} {year}"] = {
                    "incomes": monthly_regular_incomes + monthly_recurring_incomes,
                    "expenses": monthly_regular_expenses + monthly_recurring_expenses,
                    "loanPayments": monthly_loans,
                    "totals": {
                        "income": total_income,
                        "expenses": total_expenses,
                        "loanPayments": monthly_loan_payments_total,
                        "balance": total_income - total_expenses - monthly_loan_payments_total
                    }
                }
                
                # Move to next month
                if month_idx == 12:
                    current_date = current_date.replace(year=year + 1, month=1)
                else:
                    current_date = current_date.replace(month=month_idx + 1)
                    
            except Exception as e:
                print(f"[FastAPI] Error processing month {month_name} {year}: {str(e)}")
                continue
        
        print(f"[FastAPI] Successfully generated budget data for period")
        return monthly_data
        
    except Exception as e:
        print(f"[FastAPI] Error in get_yearly_budget: {str(e)}")
        import traceback
        print(f"[FastAPI] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/export")
async def export_user_data(
    user_id: str,
    format: str = Query(..., description="Export format: 'json', 'csv', or 'xlsx'"),
    db: Session = Depends(database.get_db)
):
    try:
        # Check subscription for export format
        can_export, message = SubscriptionService.can_export_format(user_id, format, db)
        if not can_export:
            raise HTTPException(status_code=403, detail=message)

        # Fetch all user data
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
        expenses = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
        incomes = db.query(models.Income).filter(models.Income.user_id == user_id).all()
        loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
        savings = db.query(models.Saving).filter(models.Saving.user_id == user_id).all()

        # Prepare data structure for JSON
        data = {
            "settings": {
                "language": settings.language if settings else "en",
                "currency": settings.currency if settings else "USD",
                "emergency_fund_target": settings.emergency_fund_target if settings else 1000,
                "emergency_fund_months": settings.emergency_fund_months if settings else 3
            },
            "expenses": [
                {
                    "category": expense.category,
                    "description": expense.description,
                    "amount": expense.amount,
                    "date": expense.date.isoformat(),
                    "is_recurring": expense.is_recurring
                }
                for expense in expenses
            ],
            "incomes": [
                {
                    "category": income.category,
                    "description": income.description,
                    "amount": income.amount,
                    "date": income.date.isoformat(),
                    "is_recurring": income.is_recurring
                }
                for income in incomes
            ],
            "loans": [
                {
                    "loan_type": loan.loan_type,
                    "description": loan.description,
                    "principal_amount": loan.principal_amount,
                    "remaining_balance": loan.remaining_balance,
                    "interest_rate": loan.interest_rate,
                    "monthly_payment": loan.monthly_payment,
                    "term_months": loan.term_months,
                    "start_date": loan.start_date.isoformat()
                }
                for loan in loans
            ],
            "savings": [
                {
                    "category": saving.category,
                    "description": saving.description,
                    "amount": saving.amount,
                    "date": saving.date.isoformat(),
                    "is_recurring": saving.is_recurring,
                    "target_amount": saving.target_amount,
                    "saving_type": saving.saving_type
                }
                for saving in savings
            ]
        }

        if format.lower() == 'json':
            return JSONResponse(content=data)
        elif format.lower() == 'csv':
            # Create CSV buffer
            output = io.StringIO()
            writer = csv.writer(output)

            # Write headers
            writer.writerow(['Type', 'Category/Loan Type', 'Description', 'Amount/Principal', 'Date/Start Date', 'Is Recurring/Interest Rate', 'Target Amount/Remaining Balance', 'Monthly Payment/Saving Type', 'Term Months'])

            # Write settings
            writer.writerow(['Settings', 'language', settings.language if settings else "en", '', '', '', '', '', ''])
            writer.writerow(['Settings', 'currency', settings.currency if settings else "USD", '', '', '', '', '', ''])
            writer.writerow(['Settings', 'emergency_fund_target', settings.emergency_fund_target if settings else 1000, '', '', '', '', '', ''])
            writer.writerow(['Settings', 'emergency_fund_months', settings.emergency_fund_months if settings else 3, '', '', '', '', '', ''])

            # Write expenses
            for expense in expenses:
                writer.writerow([
                    'Expense',
                    expense.category,
                    expense.description,
                    expense.amount,
                    expense.date.isoformat(),
                    expense.is_recurring,
                    '', '', ''
                ])

            # Write incomes
            for income in incomes:
                writer.writerow([
                    'Income',
                    income.category,
                    income.description,
                    income.amount,
                    income.date.isoformat(),
                    income.is_recurring,
                    '', '', ''
                ])

            # Write loans
            for loan in loans:
                writer.writerow([
                    'Loan',
                    loan.loan_type,
                    loan.description,
                    loan.principal_amount,
                    loan.start_date.isoformat(),
                    loan.interest_rate,
                    loan.remaining_balance,
                    loan.monthly_payment,
                    loan.term_months
                ])
                
            # Write savings
            for saving in savings:
                writer.writerow([
                    'Saving',
                    saving.category,
                    saving.description,
                    saving.amount,
                    saving.date.isoformat(),
                    saving.is_recurring,
                    saving.target_amount or '',
                    saving.saving_type,
                    ''
                ])

            # Prepare the response
            output.seek(0)
            return StreamingResponse(
                iter([output.getvalue()]),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=home_budget_export_{user_id}.csv"
                }
            )
        elif format.lower() == 'xlsx':
            # Create Excel workbook
            wb = Workbook()
            
            # Create styles
            header_font = Font(bold=True)
            header_fill = PatternFill(start_color='CCE5FF', end_color='CCE5FF', fill_type='solid')

            def style_header_row(worksheet):
                for cell in worksheet[1]:
                    cell.font = header_font
                    cell.fill = header_fill

            # Settings sheet
            settings_sheet = wb.active
            settings_sheet.title = 'Settings'
            settings_sheet.append(['Setting', 'Value'])
            settings_sheet.append(['Language', settings.language if settings else "en"])
            settings_sheet.append(['Currency', settings.currency if settings else "USD"])
            settings_sheet.append(['Emergency Fund Target', settings.emergency_fund_target if settings else 1000])
            settings_sheet.append(['Emergency Fund Months', settings.emergency_fund_months if settings else 3])
            style_header_row(settings_sheet)
            
            # Expenses sheet
            expenses_sheet = wb.create_sheet('Expenses')
            expenses_sheet.append(['Category', 'Description', 'Amount', 'Date', 'Is Recurring'])
            for expense in expenses:
                expenses_sheet.append([
                    expense.category,
                    expense.description,
                    expense.amount,
                    expense.date.isoformat(),
                    expense.is_recurring
                ])
            style_header_row(expenses_sheet)

            # Income sheet
            income_sheet = wb.create_sheet('Income')
            income_sheet.append(['Category', 'Description', 'Amount', 'Date', 'Is Recurring'])
            for income in incomes:
                income_sheet.append([
                    income.category,
                    income.description,
                    income.amount,
                    income.date.isoformat(),
                    income.is_recurring
                ])
            style_header_row(income_sheet)

            # Loans sheet
            loans_sheet = wb.create_sheet('Loans')
            loans_sheet.append([
                'Type', 'Description', 'Principal Amount', 'Remaining Balance',
                'Interest Rate', 'Monthly Payment', 'Term Months', 'Start Date'
            ])
            for loan in loans:
                loans_sheet.append([
                    loan.loan_type,
                    loan.description,
                    loan.principal_amount,
                    loan.remaining_balance,
                    loan.interest_rate,
                    loan.monthly_payment,
                    loan.term_months,
                    loan.start_date.isoformat()
                ])
            style_header_row(loans_sheet)
            
            # Savings sheet
            savings_sheet = wb.create_sheet('Savings')
            savings_sheet.append([
                'Category', 'Description', 'Amount', 'Date', 'Is Recurring',
                'Target Amount', 'Saving Type'
            ])
            for saving in savings:
                savings_sheet.append([
                    saving.category,
                    saving.description,
                    saving.amount,
                    saving.date.isoformat(),
                    saving.is_recurring,
                    saving.target_amount,
                    saving.saving_type
                ])
            style_header_row(savings_sheet)

            # Adjust column widths
            for sheet in wb.sheetnames:
                ws = wb[sheet]
                for column in ws.columns:
                    max_length = 0
                    column = list(column)
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = (max_length + 2)
                    ws.column_dimensions[column[0].column_letter].width = adjusted_width

            # Save to buffer
            excel_buffer = io.BytesIO()
            wb.save(excel_buffer)
            excel_buffer.seek(0)

            # Return the Excel file
            return StreamingResponse(
                iter([excel_buffer.getvalue()]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=home_budget_export_{user_id}.xlsx"
                }
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'json', 'csv', or 'xlsx'")

    except Exception as e:
        print(f"[FastAPI] Error in export_user_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/import")
async def import_user_data(
    user_id: str,
    payload: ImportPayload,
    db: Session = Depends(database.get_db)
):
    try:
        data = payload.data
        clear_existing = payload.clear_existing
        def serialize_expense(expense: models.Expense) -> dict:
            return {
                "category": expense.category,
                "description": expense.description,
                "amount": expense.amount,
                "is_recurring": expense.is_recurring,
                "date": expense.date.isoformat() if expense.date else None,
            }

        def serialize_income(income: models.Income) -> dict:
            return {
                "category": income.category,
                "description": income.description,
                "amount": income.amount,
                "is_recurring": income.is_recurring,
                "date": income.date.isoformat() if income.date else None,
            }

        def serialize_loan(loan: models.Loan) -> dict:
            return {
                "loan_type": loan.loan_type,
                "description": loan.description,
                "principal_amount": loan.principal_amount,
                "remaining_balance": loan.remaining_balance,
                "interest_rate": loan.interest_rate,
                "monthly_payment": loan.monthly_payment,
                "term_months": loan.term_months,
                "start_date": loan.start_date.isoformat() if loan.start_date else None,
            }

        def serialize_saving(saving: models.Saving) -> dict:
            return {
                "category": saving.category,
                "description": saving.description,
                "amount": saving.amount,
                "is_recurring": saving.is_recurring,
                "date": saving.date.isoformat() if saving.date else None,
                "target_amount": saving.target_amount,
                "saving_type": saving.saving_type,
            }

        def add_activity(
            entity_type: str,
            operation: str,
            entity_id: int,
            previous_values: Optional[dict] = None,
            new_values: Optional[dict] = None,
        ):
            activity = models.Activity(
                user_id=user_id,
                entity_type=entity_type,
                operation_type=operation,
                entity_id=entity_id,
                previous_values=previous_values,
                new_values=new_values,
            )
            db.add(activity)

        # Verify user exists
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Clear existing data if requested
        if clear_existing:
            existing_expenses = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
            for expense in existing_expenses:
                add_activity(
                    entity_type="Expense",
                    operation="delete",
                    entity_id=expense.id,
                    previous_values=serialize_expense(expense),
                )
                db.delete(expense)

            existing_incomes = db.query(models.Income).filter(models.Income.user_id == user_id).all()
            for income in existing_incomes:
                add_activity(
                    entity_type="Income",
                    operation="delete",
                    entity_id=income.id,
                    previous_values=serialize_income(income),
                )
                db.delete(income)

            existing_loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
            for loan in existing_loans:
                add_activity(
                    entity_type="Loan",
                    operation="delete",
                    entity_id=loan.id,
                    previous_values=serialize_loan(loan),
                )
                db.delete(loan)

            existing_savings = db.query(models.Saving).filter(models.Saving.user_id == user_id).all()
            for saving in existing_savings:
                add_activity(
                    entity_type="Saving",
                    operation="delete",
                    entity_id=saving.id,
                    previous_values=serialize_saving(saving),
                )
                db.delete(saving)

            db.commit()
            print(f"[FastAPI] Cleared existing data for user: {user_id}")

        # Import settings
        if "settings" in data:
            settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
            if settings:
                settings.language = data["settings"].get("language", settings.language)
                settings.currency = data["settings"].get("currency", settings.currency)
                settings.ai = data["settings"].get("ai", settings.ai)
                settings.emergency_fund_target = data["settings"].get("emergency_fund_target", settings.emergency_fund_target)
                settings.emergency_fund_months = data["settings"].get("emergency_fund_months", settings.emergency_fund_months)
                db.commit()

        # Import expenses
        if "expenses" in data:
            for expense_data in data["expenses"]:
                expense = models.Expense(
                    user_id=user_id,
                    category=expense_data["category"],
                    description=expense_data["description"],
                    amount=expense_data["amount"],
                    date=datetime.fromisoformat(expense_data["date"].replace("Z", "+00:00")),
                    is_recurring=expense_data.get("is_recurring", False)
                )
                db.add(expense)
                db.flush()
                add_activity(
                    entity_type="Expense",
                    operation="create",
                    entity_id=expense.id,
                    new_values=serialize_expense(expense),
                )

        # Import incomes
        if "incomes" in data:
            for income_data in data["incomes"]:
                income = models.Income(
                    user_id=user_id,
                    category=income_data["category"],
                    description=income_data["description"],
                    amount=income_data["amount"],
                    date=datetime.fromisoformat(income_data["date"].replace("Z", "+00:00")),
                    is_recurring=income_data.get("is_recurring", False)
                )
                db.add(income)
                db.flush()
                add_activity(
                    entity_type="Income",
                    operation="create",
                    entity_id=income.id,
                    new_values=serialize_income(income),
                )

        # Import loans
        if "loans" in data:
            for loan_data in data["loans"]:
                loan = models.Loan(
                    user_id=user_id,
                    loan_type=loan_data["loan_type"],
                    description=loan_data["description"],
                    principal_amount=loan_data["principal_amount"],
                    remaining_balance=loan_data["remaining_balance"],
                    interest_rate=loan_data["interest_rate"],
                    monthly_payment=loan_data["monthly_payment"],
                    term_months=loan_data["term_months"],
                    start_date=datetime.fromisoformat(loan_data["start_date"].replace("Z", "+00:00"))
                )
                db.add(loan)
                db.flush()
                add_activity(
                    entity_type="Loan",
                    operation="create",
                    entity_id=loan.id,
                    new_values=serialize_loan(loan),
                )
                
        # Import savings
        if "savings" in data:
            for saving_data in data["savings"]:
                saving = models.Saving(
                    user_id=user_id,
                    category=saving_data["category"],
                    description=saving_data["description"],
                    amount=saving_data["amount"],
                    date=datetime.fromisoformat(saving_data["date"].replace("Z", "+00:00")),
                    is_recurring=saving_data.get("is_recurring", False),
                    target_amount=saving_data.get("target_amount"),
                    saving_type=saving_data["saving_type"]
                )
                db.add(saving)
                db.flush()
                add_activity(
                    entity_type="Saving",
                    operation="create",
                    entity_id=saving.id,
                    new_values=serialize_saving(saving),
                )

        db.commit()
        return {"message": "Data imported successfully"}

    except Exception as e:
        db.rollback()
        print(f"[FastAPI] Error in import_user_data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Insights endpoints
@app.get("/users/{user_id}/insights", response_model=InsightsResponse)
async def get_user_insights(
    user_id: str,
    refresh: bool = False,  # Changed default to False
    db: Session = Depends(database.get_db)
):
    try:
        # Get user settings for AI API key
        settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
        if not settings or not settings.ai or not settings.ai.get("apiKey"):
            raise HTTPException(status_code=400, detail="AI API key not found")

        # If manual refresh requested, bypass cache
        if refresh:
            return await refresh_user_insights(user_id, db)
        
        # Get current financial data
        current_data = await get_user_financial_data(user_id, db)
        
        # Get user's language preference
        language = current_data.get("settings", {}).get("language", "en")
        
        # Calculate current totals
        current_income = sum(income["amount"] for income in current_data["incomes"])
        current_expenses = sum(expense["amount"] for expense in current_data["expenses"])
        current_loans = sum(loan["remaining_balance"] for loan in current_data["loans"])
        
        # Check for valid cache for the current language
        cache = db.query(models.InsightsCache).filter(
            models.InsightsCache.user_id == user_id,
            models.InsightsCache.language == language,
            models.InsightsCache.is_stale == False
        ).order_by(models.InsightsCache.created_at.desc()).first()

        if cache:
            # Check time-based expiration (7 days)
            days_since_refresh = (datetime.now() - cache.last_refresh_date).days
            if days_since_refresh >= 7:
                print(f"[Insights] Cache expired due to time (7+ days old)")
                return await refresh_user_insights(user_id, db)
            
            # Check data change threshold (10%)
            cached_income = cache.total_income
            cached_expenses = cache.total_expenses
            cached_loans = cache.total_loans
            
            income_change = abs((current_income - cached_income) / cached_income) if cached_income else 1
            expenses_change = abs((current_expenses - cached_expenses) / cached_expenses) if cached_expenses else 1
            loans_change = abs((current_loans - cached_loans) / cached_loans) if cached_loans else 1
            
            # If any metric changed by more than 10%, refresh
            if income_change > 0.1 or expenses_change > 0.1 or loans_change > 0.1:
                print(f"[Insights] Cache invalidated due to data changes: income={income_change:.2f}, expenses={expenses_change:.2f}, loans={loans_change:.2f}")
                return await refresh_user_insights(user_id, db)
            
            # Cache is valid, return it with metadata
            return {
                **cache.insights,
                "metadata": {
                    "isCached": True,
                    "createdAt": cache.created_at.isoformat(),
                    "lastRefreshDate": cache.last_refresh_date.isoformat(),
                    "language": language,
                    "validityReason": "Using cached insights",
                    "dataChanges": {
                        "income": f"{income_change:.2%}",
                        "expenses": f"{expenses_change:.2%}",
                        "loans": f"{loans_change:.2%}"
                    }
                }
            }

        # No valid cache exists for this language, generate new insights
        return await refresh_user_insights(user_id, db)
    except Exception as e:
        print(f"[FastAPI] Error in get_user_insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/insights/refresh", response_model=InsightsResponse)
async def refresh_user_insights(
    user_id: str,
    db: Session = Depends(database.get_db)
):
    try:
        # Get user settings for AI API key
        settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
        if not settings or not settings.ai or not settings.ai.get("apiKey"):
            raise HTTPException(status_code=400, detail="AI API key not found")
            
        # Get user's financial data
        user_data = await get_user_financial_data(user_id, db)
        
        # Get user's language preference
        language = user_data.get("settings", {}).get("language", "en")
        
        # Calculate totals for cache comparison
        total_income = sum(income["amount"] for income in user_data["incomes"])
        total_expenses = sum(expense["amount"] for expense in user_data["expenses"])
        total_loans = sum(loan["remaining_balance"] for loan in user_data["loans"])
        
        # Generate new insights
        insights = await generate_insights(user_data, settings.ai["apiKey"])
        
        # Mark existing cache entries as stale for this language
        db.query(models.InsightsCache).filter(
            models.InsightsCache.user_id == user_id,
            models.InsightsCache.language == language,
            models.InsightsCache.is_stale == False
        ).update({"is_stale": True})
        
        # Save to cache with financial totals and language
        cache = models.InsightsCache(
            user_id=user_id,
            language=language,
            insights=insights,
            financial_snapshot=user_data,
            is_stale=False,
            last_refresh_date=datetime.now(),
            total_income=total_income,
            total_expenses=total_expenses,
            total_loans=total_loans
        )
        
        db.add(cache)
        db.commit()
        
        return {
            **insights,
            "metadata": {
                "isCached": False,
                "createdAt": cache.created_at.isoformat(),
                "lastRefreshDate": cache.last_refresh_date.isoformat(),
                "language": language,
                "validityReason": "Generated new insights",
                "financialTotals": {
                    "income": total_income,
                    "expenses": total_expenses,
                    "loans": total_loans
                }
            }
        }
    except Exception as e:
        print(f"[FastAPI] Error in refresh_user_insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_user_financial_data(user_id: str, db: Session):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    incomes = db.query(models.Income).filter(models.Income.user_id == user_id).all()
    expenses = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
    loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
    settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()

    return {
        "settings": {
            "language": settings.language if settings else "en",
            "currency": settings.currency if settings else "USD"
        },
        "incomes": [
            {
                "date": income.date.isoformat(),
                "amount": income.amount,
                "category": income.category,
                "description": income.description,
                "is_recurring": income.is_recurring
            }
            for income in incomes
        ],
        "expenses": [
            {
                "date": expense.date.isoformat(),
                "amount": expense.amount,
                "category": expense.category,
                "description": expense.description,
                "is_recurring": expense.is_recurring
            }
            for expense in expenses
        ],
        "loans": [
            {
                "loan_type": loan.loan_type,
                "description": loan.description,
                "principal_amount": loan.principal_amount,
                "remaining_balance": loan.remaining_balance,
                "interest_rate": loan.interest_rate,
                "monthly_payment": loan.monthly_payment,
                "term_months": loan.term_months,
                "start_date": loan.start_date.isoformat()
            }
            for loan in loans
        ]
    }

async def generate_insights(user_data: dict, api_key: str):
    """
    Generate financial insights using the OpenAI API.

    Args:
        user_data: Dictionary containing user's financial data (incomes, expenses, loans)
        api_key: OpenAI API key from user settings

    Returns:
        InsightsResponse object with AI-generated insights
    """
    try:
        # Calculate some basic financial metrics to include in the prompt
        incomes = user_data.get("incomes", [])
        expenses = user_data.get("expenses", [])
        loans = user_data.get("loans", [])
        currency = user_data.get("settings", {}).get("currency", "USD")
        language = user_data.get("settings", {}).get("language", "en")
        
        # Calculate total income, expenses, and loan payments
        total_income = sum(income["amount"] for income in incomes)
        total_expenses = sum(expense["amount"] for expense in expenses)
        total_loan_payments = sum(loan["monthly_payment"] for loan in loans)
        total_loan_balance = sum(loan["remaining_balance"] for loan in loans)
        
        # Calculate monthly balance
        monthly_balance = total_income - total_expenses - total_loan_payments
        
        # Calculate savings rate if income is not zero
        savings_rate = 0
        if total_income > 0:
            savings_rate = (monthly_balance / total_income) * 100
            
        # Calculate debt-to-income ratio if income is not zero
        debt_to_income = 0
        if total_income > 0:
            debt_to_income = (total_loan_payments / total_income) * 100
            
        # Group expenses by category
        expense_categories = {}
        for expense in expenses:
            category = expense["category"]
            if category not in expense_categories:
                expense_categories[category] = 0
            expense_categories[category] += expense["amount"]
            
        # Group incomes by category
        income_categories = {}
        for income in incomes:
            category = income["category"]
            if category not in income_categories:
                income_categories[category] = 0
            income_categories[category] += income["amount"]
        
        # Map language codes to full language names for OpenAI prompt formatting
        language_names = {
            "en": "English",
            "pl": "Polish",
            "es": "Spanish",
            "fr": "French"
        }
        
        # Get the full language name, default to English if not found
        language_name = language_names.get(language, "English")
        
        # Create the prompt for GPT
        prompt = f"""
You are a financial advisor analyzing a user's financial data. Based on the data provided, generate insights in the following categories:
1. Overall Financial Health
2. Spending Patterns
3. Savings Strategy
4. Debt Management
5. Budget Optimization

For each category, provide 1-3 specific insights. Each insight should include:
- A clear title
- A detailed description
- Priority level (high, medium, or low)
- 1-3 actionable recommendations
- Relevant metrics with values and trends

IMPORTANT: Please provide your entire response in {language_name}. The user's preferred language is {language_name}.

Here's the user's financial data:

Currency: {currency}

SUMMARY METRICS:
- Total Monthly Income: {total_income} {currency}
- Total Monthly Expenses: {total_expenses} {currency}
- Total Monthly Loan Payments: {total_loan_payments} {currency}
- Total Loan Balance: {total_loan_balance} {currency}
- Monthly Balance (Income - Expenses - Loan Payments): {monthly_balance} {currency}
- Savings Rate: {savings_rate:.2f}%
- Debt-to-Income Ratio: {debt_to_income:.2f}%

INCOME BREAKDOWN BY CATEGORY:
{json.dumps(income_categories, indent=2)}

EXPENSE BREAKDOWN BY CATEGORY:
{json.dumps(expense_categories, indent=2)}

LOANS:
{json.dumps(loans, indent=2)}

DETAILED INCOME TRANSACTIONS:
{json.dumps(incomes, indent=2)}

DETAILED EXPENSE TRANSACTIONS:
{json.dumps(expenses, indent=2)}

Respond with a JSON object that follows this exact structure:
{{
  "categories": {{
    "health": [
      {{
        "type": "observation|recommendation|alert|achievement",
        "title": "Insight title",
        "description": "Detailed description",
        "priority": "high|medium|low",
        "actionItems": ["Action 1", "Action 2"],
        "metrics": [
          {{
            "label": "Metric name",
            "value": "Metric value",
            "trend": "up|down|stable"
          }}
        ]
      }}
    ],
    "spending": [...],
    "savings": [...],
    "debt": [...],
    "budget": [...]
  }},
  "status": {{
    "health": "good|ok|can_be_improved|bad",
    "spending": "good|ok|can_be_improved|bad",
    "savings": "good|ok|can_be_improved|bad",
    "debt": "good|ok|can_be_improved|bad",
    "budget": "good|ok|can_be_improved|bad"
  }}
}}

Ensure your response is valid JSON and follows the exact structure above. Do not include any explanations or text outside the JSON object.
Remember to write all text content (titles, descriptions, action items, etc.) in {language_name}.
"""

        # Make the API call to OpenAI Responses endpoint (supports project-scoped keys)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2",
                },
                json={
                    "model": "gpt-4o-mini",
                    "temperature": 0.2,
                    "input": [
                        {
                            "role": "system",
                            "content": "You are a seasoned financial advisor who provides concise, actionable insights."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                },
            )
        
        # Check if the request was successful
        if response.status_code != 200:
            print(f"[OpenAI API] Error: {response.status_code} - {response.text}")
            
            # Provide more specific error messages based on status code
            if response.status_code == 529:
                raise Exception(f"OpenAI API error: 529 - Service overloaded. The OpenAI API is currently experiencing high demand. Please try again later.")
            elif response.status_code == 401:
                raise Exception(f"OpenAI API error: 401 - Invalid API key. Please check your OpenAI API key in settings.")
            elif response.status_code == 403:
                raise Exception(f"OpenAI API error: 403 - Forbidden. Your API key may not have permission to use this model.")
            elif response.status_code == 429:
                raise Exception(f"OpenAI API error: 429 - Rate limit exceeded. Please try again later.")
            else:
                raise Exception(f"OpenAI API error: {response.status_code}")
            
        # Parse the response
        openai_response = response.json()
        output = openai_response.get("output", [])

        if not output:
            raise Exception("Empty response from OpenAI API")

        # Responses API returns a list of content blocks; extract text segments
        content_blocks = output[0].get("content", [])
        text_segments = [
            block.get("text", "")
            for block in content_blocks
            if block.get("type") in {"output_text", "text"}
        ]
        text_content = "\n".join(filter(None, text_segments)).strip()
        
        # Try to parse the JSON response
        try:
            # Find JSON in the response (it might be wrapped in markdown code blocks)
            json_match = re.search(r'```json\s*([\s\S]*?)\s*```|({[\s\S]*})', text_content)
            if json_match:
                json_str = json_match.group(1) or json_match.group(2)
                insights_data = json.loads(json_str)
            else:
                insights_data = json.loads(text_content)
                
            # Add metadata
            insights_data["metadata"] = {
                "generatedAt": datetime.now().isoformat(),
                "source": "gpt-4o-mini"
            }
            
            return insights_data
            
        except json.JSONDecodeError as e:
            print(f"[OpenAI API] JSON parse error: {e}")
            print(f"[OpenAI API] Response content: {text_content}")
            raise Exception(f"Failed to parse OpenAI API response: {e}")
            
    except Exception as e:
        print(f"[OpenAI API] Error generating insights: {str(e)}")
        
        # Return a fallback response in case of error
        sample_insight = {
            "type": "observation",
            "title": "API Error",
            "description": f"We encountered an error while generating insights: {str(e)}. Please try again later.",
            "priority": "medium",
            "actionItems": ["Check your OpenAI API key", "Try again later"],
            "metrics": [
                {
                    "label": "Error",
                    "value": "API call failed",
                    "trend": "stable"
                }
            ]
        }
        
        return {
            "categories": {
                "health": [sample_insight],
                "spending": [sample_insight],
                "savings": [sample_insight],
                "debt": [sample_insight],
                "budget": [sample_insight]
            },
            "status": {
                "health": "ok",
                "spending": "ok",
                "savings": "ok",
                "debt": "ok",
                "budget": "ok"
            },
            "metadata": {
                "generatedAt": datetime.now().isoformat(),
                "source": "error_fallback",
                "error": str(e)
            }
        }

@app.get("/")
async def root():
    return {"message": "Welcome to the Home Budget API"} 
