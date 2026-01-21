import logging
import os
import traceback
from fastapi import FastAPI, Depends, HTTPException, Query, Header, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, database
from pydantic import BaseModel, Field, model_validator
from datetime import date, datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, case, or_, text
import calendar
from fastapi.responses import JSONResponse, StreamingResponse
import csv
import io
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from .routers import users, auth, financial_freedom, savings, exchange_rates, banking, tink, stripe_billing, bank_transactions, gamification
from .database import engine, Base
from .routers.users import User, UserBase, Settings, SettingsBase  # Import User, UserBase, Settings, and SettingsBase models from users router
import json
import re
import httpx
from .logging_utils import make_conditional_print
from .services.subscription_service import SubscriptionService
from .services.gamification_service import GamificationService
from .dependencies import get_current_user as get_authenticated_user

# Rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Sentry for error tracking
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

# Initialize Sentry
sentry_sdk.init(
    dsn="https://49db97f131e54426066081af30c141b7@o4510725745868800.ingest.de.sentry.io/4510725761204304",
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        SqlalchemyIntegration(),
    ],
    traces_sample_rate=0.1,  # 10% of transactions for performance monitoring
    profiles_sample_rate=0.1,
    environment=os.getenv("ENVIRONMENT", "production"),
)

# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

logger = logging.getLogger(__name__)


print = make_conditional_print(__name__)


def validate_user_access(user_id_from_path: str, authenticated_user: models.User) -> None:
    """Validate that the authenticated user matches the user_id in the path."""
    if user_id_from_path != authenticated_user.id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: You can only access your own data"
        )

app = FastAPI(
    title="FiredUp API",
    description="Personal finance management API",
    version="1.0.0",
)

# Add rate limiter to app state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS - restrict in production
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
# Always allow these origins in addition to env config
allowed_origins = [
    "https://firedup.app",
    "https://www.firedup.app",
    *cors_origins
]
# Remove duplicates and empty strings
allowed_origins = list(set(filter(None, allowed_origins)))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-User-ID", "X-Requested-With"],
)

# Create the database tables
Base.metadata.create_all(bind=engine)


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check(db: Session = Depends(database.get_db)):
    """
    Health check endpoint for monitoring.
    Verifies database connectivity.
    """
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ok" if db_status == "healthy" else "degraded",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
    }

# Include routers
app.include_router(auth.router)
app.include_router(users.router)
# Financial freedom with two prefixes:
# - /financial-freedom for web (goes through Next.js API proxy)
# - /internal-api/financial-freedom for mobile (direct backend access)
app.include_router(financial_freedom.router)
app.include_router(financial_freedom.router, prefix="/internal-api")
app.include_router(savings.router)
app.include_router(exchange_rates.router)
app.include_router(banking.router)
app.include_router(tink.router)
app.include_router(bank_transactions.router)
app.include_router(stripe_billing.router)
# Mobile billing access (direct backend, bypasses Next.js routing)
app.include_router(stripe_billing.router, prefix="/internal-api")
# Gamification system
app.include_router(gamification.router)
app.include_router(gamification.router, prefix="/internal-api")

# Loan models
VALID_LOAN_TYPES = ["mortgage", "car", "personal", "student", "credit_card", "cash_loan", "installment", "leasing", "overdraft", "other"]

class LoanBase(BaseModel):
    loan_type: str = Field(..., description="Type of loan")
    description: str = Field(..., min_length=1, max_length=100, description="Loan description")
    principal_amount: float = Field(..., gt=0, description="Original loan amount")
    remaining_balance: float = Field(..., ge=0, description="Current remaining balance")
    interest_rate: float = Field(..., ge=0, le=100, description="Annual interest rate as percentage")
    monthly_payment: float = Field(..., ge=0, description="Monthly payment amount")
    start_date: date = Field(..., description="Loan start date")
    term_months: int = Field(..., gt=0, description="Loan term in months")
    due_day: int | None = Field(default=1, ge=1, le=31, description="Day of month when payment is due (1-31)")
    # Polish prepayment regulations (since 2022, banks cannot charge fees for first 3 years)
    overpayment_fee_percent: float | None = Field(default=0, ge=0, le=10, description="Prepayment fee percentage (0-10%)")
    overpayment_fee_waived_until: date | None = Field(default=None, description="Date until prepayment fees are waived")

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


# Loan Payment models
VALID_PAYMENT_TYPES = ["regular", "overpayment"]

class LoanPaymentBase(BaseModel):
    amount: float = Field(..., gt=0, description="Payment amount")
    payment_date: date = Field(..., description="Date of payment")
    payment_type: str = Field(..., description="Type: 'regular' or 'overpayment'")
    covers_month: int | None = Field(default=None, ge=1, le=12, description="Month this payment covers (1-12)")
    covers_year: int | None = Field(default=None, ge=2000, le=2100, description="Year this payment covers")
    notes: str | None = Field(default=None, max_length=500, description="Optional notes")

    @model_validator(mode='after')
    def validate_payment(self):
        if self.payment_type not in VALID_PAYMENT_TYPES:
            raise ValueError(f"Invalid payment type. Must be one of: {', '.join(VALID_PAYMENT_TYPES)}")
        # Regular payments should have covers_month and covers_year
        if self.payment_type == "regular" and (self.covers_month is None or self.covers_year is None):
            raise ValueError("Regular payments must specify covers_month and covers_year")
        return self

class LoanPaymentCreate(LoanPaymentBase):
    pass

class LoanPayment(LoanPaymentBase):
    id: int
    loan_id: int
    user_id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class LoanPaymentResponse(BaseModel):
    """Extended response for loan payment that includes celebration data."""
    payment: LoanPayment
    new_balance: float
    loan_paid_off: bool = False
    celebration: dict | None = None
    xp_earned: int = 0


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
# Employment types for Polish tax calculation
EMPLOYMENT_TYPES = ["uop", "b2b", "zlecenie", "dzielo", "other"]

class IncomeBase(BaseModel):
    category: str
    description: str
    amount: float  # Net amount (netto) - what you receive after tax
    is_recurring: bool = False
    date: date  # Start date (for recurring) or occurrence date (for one-off)
    end_date: date | None = None  # Optional end date for recurring items (null = forever)
    # Polish employment type for tax calculation
    employment_type: str | None = Field(default=None, description="Employment type: uop (umowa o pracę), b2b, zlecenie, dzielo, other")
    gross_amount: float | None = Field(default=None, ge=0, description="Gross amount (brutto) before tax")
    is_gross: bool = Field(default=False, description="Whether the entered amount was gross (true) or net (false)")

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
def get_or_create_current_user(
    x_user_id: str = Header(..., alias="X-User-ID", description="Authenticated user ID from session"),
    db: Session = Depends(database.get_db)
):
    """Get or create current user. Uses X-User-ID header from authenticated session."""
    try:
        print(f"[FastAPI] Getting user with ID: {x_user_id}")
        user = db.query(models.User).filter(models.User.id == x_user_id).first()

        if not user:
            print(f"[FastAPI] User not found with ID: {x_user_id}, creating new user")
            # Create new user
            user = models.User(
                id=x_user_id,
                email=x_user_id,  # Using ID as email since we use email as ID
                name=None
            )
            db.add(user)
            try:
                db.commit()
                db.refresh(user)
                print(f"[FastAPI] Created new user: {user}")

                # Create default settings for the new user
                settings = models.Settings(
                    user_id=x_user_id,
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
        print(f"[FastAPI] Error in get_or_create_current_user: {str(e)}")
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
def get_user_settings(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get settings for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting settings for user: {current_user.id}")

        # Get or create settings
        settings = db.query(models.Settings).filter(models.Settings.user_id == current_user.id).first()

        if not settings:
            print(f"[FastAPI] No settings found for user: {current_user.id}, creating default settings")
            # Create default settings
            settings = models.Settings(
                user_id=current_user.id,
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_user_settings: {str(e)}")
        import traceback
        print(f"[FastAPI] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/settings", response_model=Settings)
def update_user_settings(
    user_id: str,
    settings: SettingsCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Update settings for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Updating settings for user: {current_user.id}")
        db_settings = db.query(models.Settings).filter(models.Settings.user_id == current_user.id).first()

        if not db_settings:
            print(f"[FastAPI] No settings found for user: {current_user.id}, creating new settings")
            db_settings = models.Settings(user_id=current_user.id)
            db.add(db_settings)

        for key, value in settings.model_dump().items():
            setattr(db_settings, key, value)

        db.commit()
        db.refresh(db_settings)
        print(f"[FastAPI] Updated settings: {db_settings}")
        return db_settings
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in update_user_settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Loan endpoints
@app.get("/loans", response_model=List[Loan])
def get_loans(
    include_archived: bool = False,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get all loans for the authenticated user. Excludes archived loans by default."""
    query = db.query(models.Loan).filter(models.Loan.user_id == current_user.id)
    if not include_archived:
        query = query.filter(
            (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
        )
    loans = query.all()
    return loans


@app.post("/loans/{loan_id}/archive")
def archive_loan(
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Archive a paid-off loan."""
    loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Only allow archiving paid-off loans
    if loan.remaining_balance > 0:
        raise HTTPException(status_code=400, detail="Only paid-off loans can be archived")

    loan.is_archived = True
    db.commit()
    return {"success": True, "message": "Loan archived successfully"}

@app.get("/loans/{loan_id}", response_model=Loan)
def get_loan(
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get a specific loan by ID for the authenticated user."""
    loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan

@app.post("/loans", response_model=Loan)
def create_loan(
    loan: LoanCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create a new loan for the authenticated user."""
    # Check subscription limits
    can_add, message = SubscriptionService.can_add_loan(current_user.id, db)
    if not can_add:
        raise HTTPException(status_code=403, detail=message)

    db_loan = models.Loan(
        user_id=current_user.id,
        loan_type=loan.loan_type,
        description=loan.description,
        principal_amount=loan.principal_amount,
        remaining_balance=loan.remaining_balance,
        interest_rate=loan.interest_rate,
        monthly_payment=loan.monthly_payment,
        start_date=loan.start_date,
        term_months=loan.term_months,
        due_day=loan.due_day
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.put("/loans/{loan_id}", response_model=Loan)
def update_loan(
    loan_id: int,
    loan: LoanCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Update a loan owned by the authenticated user."""
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()

    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    for key, value in loan.model_dump().items():
        setattr(db_loan, key, value)

    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.delete("/users/{user_id}/loans/{loan_id}")
def delete_loan(
    user_id: str,
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Delete a loan owned by the authenticated user."""
    validate_user_access(user_id, current_user)

    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()

    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    db.delete(db_loan)
    db.commit()
    return {"message": "Loan deleted successfully"}


# Loan Payment endpoints
@app.get("/users/{user_id}/loans/{loan_id}/payments", response_model=List[LoanPayment])
def get_loan_payments(
    user_id: str,
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get all payments for a specific loan."""
    validate_user_access(user_id, current_user)

    # Verify loan exists and belongs to user
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    payments = db.query(models.LoanPayment).filter(
        models.LoanPayment.loan_id == loan_id
    ).order_by(models.LoanPayment.payment_date.desc()).all()
    return payments


@app.post("/users/{user_id}/loans/{loan_id}/payments", response_model=LoanPaymentResponse)
def create_loan_payment(
    user_id: str,
    loan_id: int,
    payment: LoanPaymentCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create a payment for a loan and update remaining balance."""
    validate_user_access(user_id, current_user)

    # Verify loan exists and belongs to user
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # For regular payments, check if payment already exists for this month
    if payment.payment_type == "regular":
        existing = db.query(models.LoanPayment).filter(
            models.LoanPayment.loan_id == loan_id,
            models.LoanPayment.payment_type == "regular",
            models.LoanPayment.covers_month == payment.covers_month,
            models.LoanPayment.covers_year == payment.covers_year
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Payment for {payment.covers_month}/{payment.covers_year} already exists"
            )

    # Create payment record
    db_payment = models.LoanPayment(
        **payment.model_dump(),
        loan_id=loan_id,
        user_id=current_user.id
    )
    db.add(db_payment)

    # Update loan remaining balance
    db_loan.remaining_balance = max(0, db_loan.remaining_balance - payment.amount)

    db.commit()
    db.refresh(db_payment)
    db.refresh(db_loan)

    # Trigger gamification - award XP for loan payment
    xp_earned = 0
    celebration = None
    try:
        is_overpayment = payment.payment_type == "overpayment"
        xp_earned, _, celebration = GamificationService.on_loan_payment(
            current_user.id, db_payment.id, loan_id, is_overpayment, db
        )
    except Exception as gam_error:
        print(f"[FastAPI] Gamification error (non-blocking): {gam_error}")

    # Return extended response with celebration data
    return LoanPaymentResponse(
        payment=LoanPayment.model_validate(db_payment),
        new_balance=db_loan.remaining_balance,
        loan_paid_off=db_loan.remaining_balance <= 0,
        celebration=celebration,
        xp_earned=xp_earned,
    )


@app.delete("/users/{user_id}/loans/{loan_id}/payments/{payment_id}")
def delete_loan_payment(
    user_id: str,
    loan_id: int,
    payment_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Delete (undo) a loan payment and restore the balance."""
    validate_user_access(user_id, current_user)

    # Verify loan exists and belongs to user
    db_loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    # Find the payment
    db_payment = db.query(models.LoanPayment).filter(
        models.LoanPayment.id == payment_id,
        models.LoanPayment.loan_id == loan_id
    ).first()
    if not db_payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Restore the balance
    db_loan.remaining_balance = db_loan.remaining_balance + db_payment.amount

    # Delete the payment
    db.delete(db_payment)
    db.commit()

    return {"message": "Payment deleted and balance restored"}


# Mobile API - Loan endpoints with /internal-api prefix (bypasses Next.js routing)
@app.get("/internal-api/loans", response_model=List[Loan])
def get_loans_internal(
    include_archived: bool = False,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get all loans for the authenticated user (mobile API)."""
    query = db.query(models.Loan).filter(models.Loan.user_id == current_user.id)
    if not include_archived:
        query = query.filter(
            (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
        )
    loans = query.all()
    return loans


@app.post("/internal-api/loans", response_model=Loan)
def create_loan_internal(
    loan: LoanCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create a new loan for the authenticated user (mobile API)."""
    can_add, message = SubscriptionService.can_add_loan(current_user.id, db)
    if not can_add:
        raise HTTPException(status_code=403, detail=message)

    db_loan = models.Loan(
        user_id=current_user.id,
        loan_type=loan.loan_type,
        description=loan.description,
        principal_amount=loan.principal_amount,
        remaining_balance=loan.remaining_balance,
        interest_rate=loan.interest_rate,
        monthly_payment=loan.monthly_payment,
        start_date=loan.start_date,
        term_months=loan.term_months,
        due_day=loan.due_day
    )
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan


@app.get("/internal-api/loans/{loan_id}", response_model=Loan)
def get_loan_internal(
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get a specific loan by ID (mobile API)."""
    loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return loan


@app.post("/internal-api/loans/{loan_id}/archive")
def archive_loan_internal(
    loan_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Archive a paid-off loan (mobile API)."""
    loan = db.query(models.Loan).filter(
        models.Loan.id == loan_id,
        models.Loan.user_id == current_user.id
    ).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.remaining_balance > 0:
        raise HTTPException(status_code=400, detail="Only paid-off loans can be archived")

    loan.is_archived = True
    db.commit()
    return {"success": True, "message": "Loan archived successfully"}


# Expense endpoints
@app.get("/users/{user_id}/expenses", response_model=List[Expense])
def get_user_expenses(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get all expenses for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting expenses for user: {current_user.id}")
        expenses = db.query(models.Expense).filter(models.Expense.user_id == current_user.id).all()
        print(f"[FastAPI] Found {len(expenses)} expenses")
        return expenses
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_user_expenses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/expenses", response_model=Expense)
def create_expense(
    user_id: str,
    expense: ExpenseCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create an expense for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Creating expense for user: {current_user.id}")
        # Check subscription limits
        can_add, message = SubscriptionService.can_add_expense(current_user.id, db)
        if not can_add:
            raise HTTPException(status_code=403, detail=message)

        db_expense = models.Expense(**expense.model_dump(), user_id=current_user.id)
        db.add(db_expense)
        db.commit()
        db.refresh(db_expense)

        # Trigger gamification - award XP for logging expense
        try:
            GamificationService.on_expense_logged(current_user.id, db_expense.id, db)
        except Exception as gam_error:
            print(f"[FastAPI] Gamification error (non-blocking): {gam_error}")

        print(f"[FastAPI] Created expense: {db_expense}")
        return db_expense
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in create_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/expenses/{expense_id}", response_model=Expense)
def update_expense(
    user_id: str,
    expense_id: int,
    expense: ExpenseCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Update an expense for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Updating expense {expense_id} for user: {current_user.id}")
        db_expense = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.user_id == current_user.id
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in update_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{user_id}/expenses/{expense_id}")
def delete_expense(
    user_id: str,
    expense_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Delete an expense for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Deleting expense {expense_id} for user: {current_user.id}")
        db_expense = db.query(models.Expense).filter(
            models.Expense.id == expense_id,
            models.Expense.user_id == current_user.id
        ).first()

        if not db_expense:
            print(f"[FastAPI] Expense not found with ID: {expense_id}")
            raise HTTPException(status_code=404, detail="Expense not found")

        db.delete(db_expense)
        db.commit()
        print(f"[FastAPI] Deleted expense: {db_expense}")
        return {"message": "Expense deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in delete_expense: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/expenses/monthly")
def get_monthly_expenses(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get total monthly recurring expenses for the authenticated user (for Baby Step 3 calculation)."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting monthly expenses for user: {current_user.id}")
        today = datetime.now()
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        # Non-recurring expenses in current month
        non_recurring = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == current_user.id,
            models.Expense.is_recurring == False,
            models.Expense.date >= month_start,
            models.Expense.date <= month_end
        ).scalar() or 0

        # Recurring expenses active in current month
        recurring = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == current_user.id,
            models.Expense.is_recurring == True,
            models.Expense.date <= month_end,  # Started before or during this month
            or_(
                models.Expense.end_date == None,  # No end date (ongoing)
                models.Expense.end_date >= month_start  # Or end_date is this month or later
            )
        ).scalar() or 0

        total_monthly = non_recurring + recurring
        print(f"[FastAPI] Monthly expenses: non_recurring={non_recurring}, recurring={recurring}, total={total_monthly}")

        return {
            "total": float(total_monthly),
            "non_recurring": float(non_recurring),
            "recurring": float(recurring),
            "month": month_start.strftime("%Y-%m")
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_monthly_expenses: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Income endpoints
@app.get("/users/{user_id}/income", response_model=List[Income])
def get_user_income(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get all income entries for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting income for user: {current_user.id}")
        income = db.query(models.Income).filter(models.Income.user_id == current_user.id).all()
        print(f"[FastAPI] Found {len(income)} income entries")
        return income
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_user_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/income", response_model=Income)
def create_income(
    user_id: str,
    income: IncomeCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create an income entry for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Creating income for user: {current_user.id}")
        # Check subscription limits
        can_add, message = SubscriptionService.can_add_income(current_user.id, db)
        if not can_add:
            raise HTTPException(status_code=403, detail=message)

        db_income = models.Income(**income.model_dump(), user_id=current_user.id)
        db.add(db_income)
        db.commit()
        db.refresh(db_income)

        # Trigger gamification - award XP for logging income
        try:
            GamificationService.on_income_logged(current_user.id, db_income.id, db)
        except Exception as gam_error:
            print(f"[FastAPI] Gamification error (non-blocking): {gam_error}")

        print(f"[FastAPI] Created income: {db_income}")
        return db_income
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in create_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/users/{user_id}/income/{income_id}", response_model=Income)
def update_income(
    user_id: str,
    income_id: int,
    income: IncomeCreate,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Update an income entry for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Updating income {income_id} for user: {current_user.id}")
        db_income = db.query(models.Income).filter(
            models.Income.id == income_id,
            models.Income.user_id == current_user.id
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in update_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/users/{user_id}/income/{income_id}")
def delete_income(
    user_id: str,
    income_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Delete an income entry for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Deleting income {income_id} for user: {current_user.id}")
        db_income = db.query(models.Income).filter(
            models.Income.id == income_id,
            models.Income.user_id == current_user.id
        ).first()

        if not db_income:
            print(f"[FastAPI] Income not found with ID: {income_id}")
            raise HTTPException(status_code=404, detail="Income not found")

        db.delete(db_income)
        db.commit()
        print(f"[FastAPI] Deleted income: {db_income}")
        return {"message": "Income deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in delete_income: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/summary")
async def get_user_summary(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get financial summary for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting summary for user: {current_user.id}")
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

        # Fetch recurring income (active in current month)
        # Must have started before/during this month AND not ended before this month
        monthly_income_recurring = db.query(func.sum(models.Income.amount)).filter(
            models.Income.user_id == user_id,
            models.Income.is_recurring == True,
            models.Income.date <= month_end,  # Started before or during this month
            or_(
                models.Income.end_date == None,  # No end date (ongoing)
                models.Income.end_date >= month_start  # Or end_date is this month or later
            )
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

        # Fetch recurring expenses (active in current month)
        # Must have started before/during this month AND not ended before this month
        monthly_expenses_recurring = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.is_recurring == True,
            models.Expense.date <= month_end,  # Started before or during this month
            or_(
                models.Expense.end_date == None,  # No end date (ongoing)
                models.Expense.end_date >= month_start  # Or end_date is this month or later
            )
        ).scalar() or 0

        # Total monthly expenses
        monthly_expenses = monthly_expenses_non_recurring + monthly_expenses_recurring

        # Fetch monthly loan payments (exclude archived loans)
        monthly_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
            models.Loan.user_id == user_id,
            models.Loan.start_date <= month_end,
            (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
        ).scalar() or 0

        # Fetch total loan balance (exclude archived loans)
        total_loan_balance = db.query(func.sum(models.Loan.remaining_balance)).filter(
            models.Loan.user_id == user_id,
            (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
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

        # Get income distribution by category (current month only)
        income_distribution = []

        # Non-recurring income in current month
        income_non_recurring_by_cat = db.query(
            models.Income.category,
            func.sum(models.Income.amount).label("total_amount")
        ).filter(
            models.Income.user_id == user_id,
            models.Income.is_recurring == False,
            models.Income.date >= month_start,
            models.Income.date <= month_end
        ).group_by(models.Income.category).all()

        # Recurring income (active in current month)
        income_recurring_by_cat = db.query(
            models.Income.category,
            func.sum(models.Income.amount).label("total_amount")
        ).filter(
            models.Income.user_id == user_id,
            models.Income.is_recurring == True,
            models.Income.date <= month_end,  # Started before or during this month
            or_(
                models.Income.end_date == None,  # No end date (ongoing)
                models.Income.end_date >= month_start  # Or end_date is this month or later
            )
        ).group_by(models.Income.category).all()

        # Combine income by category
        income_by_category = {}
        for cat in income_non_recurring_by_cat:
            income_by_category[cat.category] = cat.total_amount
        for cat in income_recurring_by_cat:
            income_by_category[cat.category] = income_by_category.get(cat.category, 0) + cat.total_amount

        total_income_dist = sum(income_by_category.values())
        for category, amount in income_by_category.items():
            percentage = (amount / total_income_dist * 100) if total_income_dist > 0 else 0
            income_distribution.append({
                "category": category,
                "amount": float(amount),
                "percentage": float(percentage)
            })

        # Get expense distribution by category (current month only)
        expense_distribution = []

        # Non-recurring expenses in current month
        expense_non_recurring_by_cat = db.query(
            models.Expense.category,
            func.sum(models.Expense.amount).label("total_amount")
        ).filter(
            models.Expense.user_id == user_id,
            models.Expense.is_recurring == False,
            models.Expense.date >= month_start,
            models.Expense.date <= month_end
        ).group_by(models.Expense.category).all()

        # Recurring expenses (active in current month)
        expense_recurring_by_cat = db.query(
            models.Expense.category,
            func.sum(models.Expense.amount).label("total_amount")
        ).filter(
            models.Expense.user_id == user_id,
            models.Expense.is_recurring == True,
            models.Expense.date <= month_end,  # Started before or during this month
            or_(
                models.Expense.end_date == None,  # No end date (ongoing)
                models.Expense.end_date >= month_start  # Or end_date is this month or later
            )
        ).group_by(models.Expense.category).all()

        # Combine expenses by category
        expense_by_category = {}
        for cat in expense_non_recurring_by_cat:
            expense_by_category[cat.category] = cat.total_amount
        for cat in expense_recurring_by_cat:
            expense_by_category[cat.category] = expense_by_category.get(cat.category, 0) + cat.total_amount

        total_expense_dist = sum(expense_by_category.values())
        for category, amount in expense_by_category.items():
            percentage = (amount / total_expense_dist * 100) if total_expense_dist > 0 else 0
            expense_distribution.append({
                "category": category,
                "amount": float(amount),
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
            
            # Calculate recurring income for THIS specific month
            month_income_recurring = db.query(func.sum(models.Income.amount)).filter(
                models.Income.user_id == user_id,
                models.Income.is_recurring == True,
                models.Income.date <= month_end_date,  # Started before or during this month
                or_(
                    models.Income.end_date == None,  # No end date (ongoing)
                    models.Income.end_date >= month_start_date  # Or end_date is this month or later
                )
            ).scalar() or 0

            # Calculate recurring expenses for THIS specific month
            month_expenses_recurring = db.query(func.sum(models.Expense.amount)).filter(
                models.Expense.user_id == user_id,
                models.Expense.is_recurring == True,
                models.Expense.date <= month_end_date,  # Started before or during this month
                or_(
                    models.Expense.end_date == None,  # No end date (ongoing)
                    models.Expense.end_date >= month_start_date  # Or end_date is this month or later
                )
            ).scalar() or 0

            # For past and current months, use actual data
            if month <= today.month:
                # Non-recurring income for this month
                month_income_non_recurring = db.query(func.sum(models.Income.amount)).filter(
                    models.Income.user_id == user_id,
                    models.Income.date >= month_start_date,
                    models.Income.date <= month_end_date,
                    models.Income.is_recurring == False
                ).scalar() or 0

                # Include recurring income for this specific month
                month_income = month_income_non_recurring + month_income_recurring

                # Non-recurring expenses for this month
                month_expenses_non_recurring = db.query(func.sum(models.Expense.amount)).filter(
                    models.Expense.user_id == user_id,
                    models.Expense.date >= month_start_date,
                    models.Expense.date <= month_end_date,
                    models.Expense.is_recurring == False
                ).scalar() or 0

                # Include recurring expenses for this specific month
                month_expenses = month_expenses_non_recurring + month_expenses_recurring

                # Loan payments for this month (exclude archived)
                month_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
                    models.Loan.user_id == user_id,
                    models.Loan.start_date <= month_end_date,
                    (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
                ).scalar() or 0
            else:
                # For future months, use projections based on recurring data for this specific month
                month_income = month_income_recurring
                month_expenses = month_expenses_recurring

                # Loan payments for future months (assuming all current loans continue, exclude archived)
                month_loan_payments = db.query(func.sum(models.Loan.monthly_payment)).filter(
                    models.Loan.user_id == user_id,
                    models.Loan.start_date <= today,
                    (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
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

        # Fetch active loans for the user (exclude archived)
        active_loans = db.query(models.Loan).filter(
            models.Loan.user_id == user_id,
            (models.Loan.is_archived == False) | (models.Loan.is_archived == None)
        ).all()
        
        # Format loans for the frontend
        loans_data = []
        for loan in active_loans:
            # Calculate progress as percentage (0-100)
            total_amount = loan.principal_amount
            paid_amount = total_amount - loan.remaining_balance
            progress = (paid_amount / total_amount * 100) if total_amount > 0 else 0

            loans_data.append({
                "id": str(loan.id),
                "description": loan.description,
                "balance": float(loan.remaining_balance),
                "monthlyPayment": float(loan.monthly_payment),
                "interestRate": float(loan.interest_rate),
                "progress": float(progress),
                "totalAmount": float(total_amount)
            })

        # Fetch savings data for the user
        # Total savings balance (all time deposits - withdrawals)
        total_deposits = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'deposit'
        ).scalar() or 0

        total_withdrawals = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'withdrawal'
        ).scalar() or 0

        total_savings_balance = total_deposits - total_withdrawals

        # Monthly savings (current month non-recurring + all recurring deposits/withdrawals)
        monthly_deposits_non_recurring = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'deposit',
            models.Saving.is_recurring == False,
            models.Saving.date >= month_start,
            models.Saving.date <= month_end
        ).scalar() or 0

        monthly_deposits_recurring = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'deposit',
            models.Saving.is_recurring == True,
            models.Saving.date <= month_end,  # Started before or during this month
            or_(
                models.Saving.end_date == None,  # No end date (ongoing)
                models.Saving.end_date >= month_start  # Or end_date is this month or later
            )
        ).scalar() or 0

        monthly_withdrawals_non_recurring = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'withdrawal',
            models.Saving.is_recurring == False,
            models.Saving.date >= month_start,
            models.Saving.date <= month_end
        ).scalar() or 0

        monthly_withdrawals_recurring = db.query(func.sum(models.Saving.amount)).filter(
            models.Saving.user_id == user_id,
            models.Saving.saving_type == 'withdrawal',
            models.Saving.is_recurring == True,
            models.Saving.date <= month_end,  # Started before or during this month
            or_(
                models.Saving.end_date == None,  # No end date (ongoing)
                models.Saving.end_date >= month_start  # Or end_date is this month or later
            )
        ).scalar() or 0

        monthly_savings = (monthly_deposits_non_recurring + monthly_deposits_recurring) - \
                          (monthly_withdrawals_non_recurring + monthly_withdrawals_recurring)

        # Savings goals (group by category with targets)
        savings_goals = []
        savings_by_category = db.query(
            models.Saving.category,
            func.sum(
                case(
                    (models.Saving.saving_type == 'deposit', models.Saving.amount),
                    else_=-models.Saving.amount
                )
            ).label('current_amount'),
            func.max(models.Saving.target_amount).label('target_amount')
        ).filter(
            models.Saving.user_id == user_id
        ).group_by(models.Saving.category).all()

        for goal in savings_by_category:
            target = goal.target_amount or 0
            current = float(goal.current_amount or 0)
            progress = (current / target * 100) if target > 0 else 0
            savings_goals.append({
                "category": goal.category,
                "currentAmount": current,
                "targetAmount": float(target),
                "progress": min(float(progress), 100)  # Cap at 100%
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
            "total_savings_balance": float(total_savings_balance),
            "monthly_savings": float(monthly_savings),
            "savings_goals": savings_goals,
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
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Create an activity log for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Creating activity for user: {current_user.id}")
        db_activity = models.Activity(
            user_id=current_user.id,
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in create_activity: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/activities", response_model=List[Activity])
def get_user_activities(
    user_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get activity log for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        print(f"[FastAPI] Getting activities for user: {current_user.id}")
        activities = db.query(models.Activity)\
            .filter(models.Activity.user_id == current_user.id)\
            .order_by(models.Activity.timestamp.desc())\
            .offset(skip)\
            .limit(limit)\
            .all()
        print(f"[FastAPI] Found {len(activities)} activities")
        return activities
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_user_activities: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/reports/yearly-budget")
def get_yearly_budget(
    start_date: str,
    end_date: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get yearly budget report for the authenticated user."""
    try:
        print(f"[FastAPI] Getting budget for user: {current_user.id}, period: {start_date} to {end_date}")
        
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
                models.Income.user_id == current_user.id,
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
                models.Income.user_id == current_user.id,
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
                models.Expense.user_id == current_user.id,
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
                models.Expense.user_id == current_user.id,
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
                models.Loan.user_id == current_user.id,
                models.Loan.start_date <= end_datetime
            ).all()
            print(f"[FastAPI] Found {len(loans)} loans")
            for loan in loans:
                print(f"[FastAPI] Loan: id={loan.id}, monthly_payment={loan.monthly_payment}, start_date={loan.start_date}, term_months={loan.term_months}")
        except Exception as e:
            print(f"[FastAPI] Error fetching loans: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching loans: {str(e)}")

        # Get all non-recurring savings for the period
        try:
            regular_savings = db.query(models.Saving).filter(
                models.Saving.user_id == current_user.id,
                models.Saving.date >= start_datetime,
                models.Saving.date <= end_datetime,
                models.Saving.is_recurring == False
            ).all()
            print(f"[FastAPI] Found {len(regular_savings)} regular savings")
        except Exception as e:
            print(f"[FastAPI] Error fetching regular savings: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching regular savings: {str(e)}")

        # Get recurring savings
        try:
            recurring_savings = db.query(models.Saving).filter(
                models.Saving.user_id == current_user.id,
                models.Saving.is_recurring == True,
                models.Saving.date <= end_datetime
            ).all()
            print(f"[FastAPI] Found {len(recurring_savings)} recurring savings")
        except Exception as e:
            print(f"[FastAPI] Error fetching recurring savings: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching recurring savings: {str(e)}")

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

                # Convert current_date to date for comparison
                current_date_only = current_date.date()

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
                # and haven't ended yet (end_date is None or >= current month)
                monthly_recurring_incomes = [
                    {
                        "id": inc.id,
                        "title": inc.description,
                        "amount": float(inc.amount),
                        "category": inc.category,
                        "date": inc.date.isoformat()
                    }
                    for inc in recurring_incomes
                    if inc.date <= current_date.date() and (
                        inc.end_date is None or inc.end_date >= current_date_only
                    )
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
                # and haven't ended yet (end_date is None or >= current month)
                monthly_recurring_expenses = [
                    {
                        "id": exp.id,
                        "title": exp.description,
                        "amount": float(exp.amount),
                        "category": exp.category,
                        "date": exp.date.isoformat()
                    }
                    for exp in recurring_expenses
                    if exp.date <= current_date.date() and (
                        exp.end_date is None or exp.end_date >= current_date_only
                    )
                ]

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

                # Regular savings for this month
                monthly_regular_savings = [
                    {
                        "id": sav.id,
                        "title": sav.description,
                        "amount": float(sav.amount),
                        "category": sav.category,
                        "saving_type": sav.saving_type,
                        "date": sav.date.isoformat()
                    }
                    for sav in regular_savings
                    if sav.date.year == year and sav.date.month == month_idx
                ]

                # Add recurring savings if they started before or during this month
                # and haven't ended yet (end_date is None or >= current month)
                monthly_recurring_savings = [
                    {
                        "id": sav.id,
                        "title": sav.description,
                        "amount": float(sav.amount),
                        "category": sav.category,
                        "saving_type": sav.saving_type,
                        "date": sav.date.isoformat()
                    }
                    for sav in recurring_savings
                    if sav.date <= current_date.date() and (
                        sav.end_date is None or sav.end_date >= current_date_only
                    )
                ]

                # Combine all savings for this month
                all_monthly_savings = monthly_regular_savings + monthly_recurring_savings

                # Calculate savings totals (deposits - withdrawals)
                total_deposits = sum(
                    sav["amount"] for sav in all_monthly_savings
                    if sav["saving_type"] == "deposit"
                )
                total_withdrawals = sum(
                    sav["amount"] for sav in all_monthly_savings
                    if sav["saving_type"] == "withdrawal"
                )
                net_savings = float(total_deposits - total_withdrawals)

                # Calculate totals
                total_regular_income = sum(inc["amount"] for inc in monthly_regular_incomes)
                total_recurring_income = sum(inc["amount"] for inc in monthly_recurring_incomes)
                total_regular_expenses = sum(exp["amount"] for exp in monthly_regular_expenses)
                total_recurring_expenses = sum(exp["amount"] for exp in monthly_recurring_expenses)
                
                total_income = float(total_regular_income + total_recurring_income)
                total_expenses = float(total_regular_expenses + total_recurring_expenses)
                
                print(f"[FastAPI] {month_name} {year} - Income: {total_income}, Expenses: {total_expenses}, Loan Payments: {monthly_loan_payments_total}, Savings: {net_savings}")

                monthly_data[f"{month_name} {year}"] = {
                    "incomes": monthly_regular_incomes + monthly_recurring_incomes,
                    "expenses": monthly_regular_expenses + monthly_recurring_expenses,
                    "loanPayments": monthly_loans,
                    "savings": all_monthly_savings,
                    "totals": {
                        "income": total_income,
                        "expenses": total_expenses,
                        "loanPayments": monthly_loan_payments_total,
                        "savings": net_savings,
                        "deposits": float(total_deposits),
                        "withdrawals": float(total_withdrawals),
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
    save_backup: bool = Query(False, description="Whether to save a backup on the server (JSON only)"),
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Export user data in various formats for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        # Check subscription for export format
        can_export, message = SubscriptionService.can_export_format(current_user.id, format, db)
        if not can_export:
            raise HTTPException(status_code=403, detail=message)

        # Fetch all user data
        settings = db.query(models.Settings).filter(models.Settings.user_id == current_user.id).first()
        expenses = db.query(models.Expense).filter(models.Expense.user_id == current_user.id).all()
        incomes = db.query(models.Income).filter(models.Income.user_id == current_user.id).all()
        loans = db.query(models.Loan).filter(models.Loan.user_id == current_user.id).all()
        savings = db.query(models.Saving).filter(models.Saving.user_id == current_user.id).all()

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
            # Save backup to database if requested
            if save_backup:
                import json
                data_json = json.dumps(data)
                filename = f"home_budget_export_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
                backup = models.DataExportBackup(
                    user_id=current_user.id,
                    data=data,
                    format="json",
                    filename=filename,
                    size_bytes=len(data_json.encode('utf-8'))
                )
                db.add(backup)
                db.commit()
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


@app.get("/users/{user_id}/export-backups")
async def list_export_backups(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """List all export backups for the authenticated user."""
    validate_user_access(user_id, current_user)

    backups = db.query(models.DataExportBackup).filter(
        models.DataExportBackup.user_id == current_user.id
    ).order_by(models.DataExportBackup.created_at.desc()).all()

    return [
        {
            "id": backup.id,
            "filename": backup.filename,
            "format": backup.format,
            "size_bytes": backup.size_bytes,
            "created_at": backup.created_at.isoformat() if backup.created_at else None
        }
        for backup in backups
    ]


@app.get("/users/{user_id}/export-backups/{backup_id}")
async def download_export_backup(
    user_id: str,
    backup_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Download a specific export backup."""
    validate_user_access(user_id, current_user)

    backup = db.query(models.DataExportBackup).filter(
        models.DataExportBackup.id == backup_id,
        models.DataExportBackup.user_id == current_user.id
    ).first()

    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    return JSONResponse(
        content=backup.data,
        headers={
            "Content-Disposition": f"attachment; filename={backup.filename}"
        }
    )


@app.delete("/users/{user_id}/export-backups/{backup_id}")
async def delete_export_backup(
    user_id: str,
    backup_id: int,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Delete a specific export backup."""
    validate_user_access(user_id, current_user)

    backup = db.query(models.DataExportBackup).filter(
        models.DataExportBackup.id == backup_id,
        models.DataExportBackup.user_id == current_user.id
    ).first()

    if not backup:
        raise HTTPException(status_code=404, detail="Backup not found")

    db.delete(backup)
    db.commit()

    return {"message": "Backup deleted successfully"}


@app.post("/users/{user_id}/import")
async def import_user_data(
    user_id: str,
    payload: ImportPayload,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Import user data for the authenticated user."""
    validate_user_access(user_id, current_user)

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
                user_id=current_user.id,
                entity_type=entity_type,
                operation_type=operation,
                entity_id=entity_id,
                previous_values=previous_values,
                new_values=new_values,
            )
            db.add(activity)

        # Clear existing data if requested
        if clear_existing:
            existing_expenses = db.query(models.Expense).filter(models.Expense.user_id == current_user.id).all()
            for expense in existing_expenses:
                add_activity(
                    entity_type="Expense",
                    operation="delete",
                    entity_id=expense.id,
                    previous_values=serialize_expense(expense),
                )
                db.delete(expense)

            existing_incomes = db.query(models.Income).filter(models.Income.user_id == current_user.id).all()
            for income in existing_incomes:
                add_activity(
                    entity_type="Income",
                    operation="delete",
                    entity_id=income.id,
                    previous_values=serialize_income(income),
                )
                db.delete(income)

            existing_loans = db.query(models.Loan).filter(models.Loan.user_id == current_user.id).all()
            for loan in existing_loans:
                add_activity(
                    entity_type="Loan",
                    operation="delete",
                    entity_id=loan.id,
                    previous_values=serialize_loan(loan),
                )
                db.delete(loan)

            existing_savings = db.query(models.Saving).filter(models.Saving.user_id == current_user.id).all()
            for saving in existing_savings:
                add_activity(
                    entity_type="Saving",
                    operation="delete",
                    entity_id=saving.id,
                    previous_values=serialize_saving(saving),
                )
                db.delete(saving)

            db.commit()
            print(f"[FastAPI] Cleared existing data for user: {current_user.id}")

        # Import settings
        if "settings" in data:
            settings = db.query(models.Settings).filter(models.Settings.user_id == current_user.id).first()
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
                    user_id=current_user.id,
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
                    user_id=current_user.id,
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
                    user_id=current_user.id,
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
                    user_id=current_user.id,
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
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Get AI insights for the authenticated user."""
    validate_user_access(user_id, current_user)

    try:
        # Get user settings for AI API key
        settings = db.query(models.Settings).filter(models.Settings.user_id == current_user.id).first()
        if not settings or not settings.ai or not settings.ai.get("apiKey"):
            raise HTTPException(status_code=400, detail="AI API key not found")

        # If manual refresh requested, bypass cache
        if refresh:
            return await _refresh_insights_internal(current_user.id, db)

        # Get current financial data
        current_data = await get_user_financial_data(current_user.id, db)

        # Get user's language preference
        language = current_data.get("settings", {}).get("language", "en")

        # Calculate current totals
        current_income = sum(income["amount"] for income in current_data["incomes"])
        current_expenses = sum(expense["amount"] for expense in current_data["expenses"])
        current_loans = sum(loan["remaining_balance"] for loan in current_data["loans"])

        # Check for valid cache for the current language
        cache = db.query(models.InsightsCache).filter(
            models.InsightsCache.user_id == current_user.id,
            models.InsightsCache.language == language,
            models.InsightsCache.is_stale == False
        ).order_by(models.InsightsCache.created_at.desc()).first()

        if cache:
            # Check time-based expiration (7 days)
            days_since_refresh = (datetime.now() - cache.last_refresh_date).days
            if days_since_refresh >= 7:
                print(f"[Insights] Cache expired due to time (7+ days old)")
                return await _refresh_insights_internal(current_user.id, db)

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
                return await _refresh_insights_internal(current_user.id, db)

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
        return await _refresh_insights_internal(current_user.id, db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in get_user_insights: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users/{user_id}/insights/refresh", response_model=InsightsResponse)
async def refresh_user_insights(
    user_id: str,
    current_user: models.User = Depends(get_authenticated_user),
    db: Session = Depends(database.get_db)
):
    """Refresh AI insights for the authenticated user."""
    validate_user_access(user_id, current_user)

    return await _refresh_insights_internal(current_user.id, db)


async def _refresh_insights_internal(user_id: str, db: Session):
    """Internal function to refresh insights for a user."""
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
    except HTTPException:
        raise
    except Exception as e:
        print(f"[FastAPI] Error in _refresh_insights_internal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_user_financial_data(user_id: str, db: Session):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    incomes = db.query(models.Income).filter(models.Income.user_id == user_id).all()
    expenses = db.query(models.Expense).filter(models.Expense.user_id == user_id).all()
    loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
    savings = db.query(models.Saving).filter(models.Saving.user_id == user_id).all()
    savings_goals = db.query(models.SavingsGoal).filter(models.SavingsGoal.user_id == user_id).all()
    financial_freedom = db.query(models.FinancialFreedom).filter(models.FinancialFreedom.userId == user_id).first()
    settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()

    # Calculate current year for age-based tax benefits
    current_year = datetime.now().year
    user_age = current_year - settings.birth_year if settings and settings.birth_year else None

    return {
        "settings": {
            "language": settings.language if settings else "en",
            "currency": settings.currency if settings else "PLN",
            # Emergency fund settings
            "emergency_fund_target": settings.emergency_fund_target if settings else 1000,
            "emergency_fund_months": settings.emergency_fund_months if settings else 3,
            # Polish tax settings
            "employment_status": settings.employment_status if settings else None,
            "tax_form": settings.tax_form if settings else None,
            "birth_year": settings.birth_year if settings else None,
            "user_age": user_age,
            "use_authors_costs": settings.use_authors_costs if settings else False,
            # PPK settings
            "ppk_enrolled": settings.ppk_enrolled if settings else None,
            "ppk_employee_rate": settings.ppk_employee_rate if settings else None,
            "ppk_employer_rate": settings.ppk_employer_rate if settings else None,
            "children_count": settings.children_count if settings else 0,
        },
        "incomes": [
            {
                "date": income.date.isoformat(),
                "amount": income.amount,
                "category": income.category,
                "description": income.description,
                "is_recurring": income.is_recurring,
                "employment_type": income.employment_type,
                "gross_amount": income.gross_amount,
                "is_gross": income.is_gross,
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
                "start_date": loan.start_date.isoformat() if loan.start_date else None,
                "overpayment_fee_percent": loan.overpayment_fee_percent,
                "overpayment_fee_waived_until": loan.overpayment_fee_waived_until.isoformat() if loan.overpayment_fee_waived_until else None,
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
                "saving_type": saving.saving_type,
                "account_type": saving.account_type,
                "annual_return_rate": saving.annual_return_rate,
                "goal_id": saving.goal_id,
            }
            for saving in savings
        ],
        "savings_goals": [
            {
                "name": goal.name,
                "category": goal.category,
                "target_amount": goal.target_amount,
                "current_amount": goal.current_amount,
                "deadline": goal.deadline.isoformat() if goal.deadline else None,
                "status": goal.status,
                "priority": goal.priority,
            }
            for goal in savings_goals
        ],
        "financial_freedom": {
            "steps": financial_freedom.steps if financial_freedom else None,
            "start_date": financial_freedom.startDate.isoformat() if financial_freedom and financial_freedom.startDate else None,
        } if financial_freedom else None,
    }

async def generate_insights(user_data: dict, api_key: str):
    """
    Generate financial insights using the Anthropic Claude API.
    Aligned with FIRE (Financial Independence, Retire Early) philosophy
    and Dave Ramsey's Baby Steps methodology.

    Args:
        user_data: Dictionary containing user's complete financial data
        api_key: Anthropic API key from user settings

    Returns:
        InsightsResponse object with AI-generated insights
    """
    try:
        # Extract all data
        settings = user_data.get("settings", {})
        incomes = user_data.get("incomes", [])
        expenses = user_data.get("expenses", [])
        loans = user_data.get("loans", [])
        savings = user_data.get("savings", [])
        savings_goals = user_data.get("savings_goals", [])
        financial_freedom = user_data.get("financial_freedom", {})

        currency = settings.get("currency", "PLN")
        language = settings.get("language", "en")

        # Calculate basic financial metrics
        total_income = sum(income["amount"] for income in incomes)
        total_expenses = sum(expense["amount"] for expense in expenses)
        total_loan_payments = sum(loan["monthly_payment"] for loan in loans)
        total_loan_balance = sum(loan["remaining_balance"] for loan in loans)

        # Calculate monthly balance
        monthly_balance = total_income - total_expenses - total_loan_payments

        # Calculate savings rate
        savings_rate = (monthly_balance / total_income * 100) if total_income > 0 else 0

        # Calculate debt-to-income ratio
        debt_to_income = (total_loan_payments / total_income * 100) if total_income > 0 else 0

        # Group expenses by category
        expense_categories = {}
        for expense in expenses:
            category = expense["category"]
            expense_categories[category] = expense_categories.get(category, 0) + expense["amount"]

        # Group incomes by category and employment type
        income_categories = {}
        income_by_employment = {}
        for income in incomes:
            category = income["category"]
            income_categories[category] = income_categories.get(category, 0) + income["amount"]
            emp_type = income.get("employment_type") or "unknown"
            income_by_employment[emp_type] = income_by_employment.get(emp_type, 0) + income["amount"]

        # Calculate savings totals by category and account type
        savings_by_category = {}
        savings_by_account_type = {}
        total_savings_deposits = 0
        for saving in savings:
            if saving.get("saving_type") == "deposit":
                total_savings_deposits += saving["amount"]
                cat = saving["category"]
                savings_by_category[cat] = savings_by_category.get(cat, 0) + saving["amount"]
                acc_type = saving.get("account_type") or "standard"
                savings_by_account_type[acc_type] = savings_by_account_type.get(acc_type, 0) + saving["amount"]

        # Calculate emergency fund status
        emergency_fund_target = settings.get("emergency_fund_target", 1000)
        emergency_fund_months = settings.get("emergency_fund_months", 3)
        emergency_fund_current = savings_by_category.get("emergency_fund", 0)
        full_emergency_target = total_expenses * emergency_fund_months if total_expenses > 0 else emergency_fund_target * emergency_fund_months

        # Pre-calculate emergency fund difference to avoid AI math errors
        emergency_fund_difference = emergency_fund_current - full_emergency_target
        emergency_fund_status = "surplus" if emergency_fund_difference > 0 else "deficit" if emergency_fund_difference < 0 else "exact"
        baby_step_1_complete = emergency_fund_current >= emergency_fund_target
        baby_step_3_complete = emergency_fund_current >= full_emergency_target

        # Determine current Baby Step
        baby_steps = financial_freedom.get("steps", []) if financial_freedom else []
        current_baby_step = 0
        baby_steps_summary = []
        for step in baby_steps:
            step_num = step.get("id", 0)
            is_completed = step.get("isCompleted", False)
            progress = step.get("progress", 0)
            baby_steps_summary.append({
                "step": step_num,
                "completed": is_completed,
                "progress": progress,
                "target": step.get("targetAmount"),
                "current": step.get("currentAmount"),
            })
            if not is_completed and current_baby_step == 0:
                current_baby_step = step_num

        # Sort loans by balance for debt snowball analysis
        loans_sorted_by_balance = sorted(loans, key=lambda x: x.get("remaining_balance", 0))
        # Sort loans by interest rate for debt avalanche analysis
        loans_sorted_by_rate = sorted(loans, key=lambda x: x.get("interest_rate", 0), reverse=True)

        # Polish tax context
        user_age = settings.get("user_age")
        employment_status = settings.get("employment_status")
        tax_form = settings.get("tax_form")
        ppk_enrolled = settings.get("ppk_enrolled")
        use_authors_costs = settings.get("use_authors_costs")
        children_count = settings.get("children_count", 0)

        # IKE/IKZE limits for 2026 (Poland)
        ike_limit_2026 = 28260  # PLN
        ikze_limit_2026 = 11304  # PLN (16956 for self-employed)
        ikze_limit_b2b = 16956  # PLN

        # Calculate FIRE number (25x annual expenses = 4% withdrawal rate)
        annual_expenses = total_expenses * 12
        fire_number = annual_expenses * 25 if annual_expenses > 0 else 0

        # Map language codes
        language_names = {"en": "English", "pl": "Polish", "es": "Spanish"}
        language_name = language_names.get(language, "English")

        # Categorize loans for proper Baby Steps handling
        mortgage_loans = [l for l in loans if l.get("loan_type") == "mortgage"]
        leasing_loans = [l for l in loans if l.get("loan_type") == "leasing"]
        baby_step_2_debts = [l for l in loans if l.get("loan_type") not in ("mortgage", "leasing")]
        high_interest_loans = [l for l in loans if l.get("interest_rate", 0) >= 5 and l.get("loan_type") not in ("mortgage", "leasing")]

        # Calculate debt totals by category
        baby_step_2_debt_total = sum(l.get("remaining_balance", 0) for l in baby_step_2_debts)
        mortgage_debt_total = sum(l.get("remaining_balance", 0) for l in mortgage_loans)
        leasing_debt_total = sum(l.get("remaining_balance", 0) for l in leasing_loans)

        # Build comprehensive prompt
        prompt = f"""You are a FIRE (Financial Independence, Retire Early) coach and financial advisor specializing in Dave Ramsey's Baby Steps methodology, with expertise in Polish financial regulations.

PHILOSOPHY:
- Focus on building wealth through intentional living, not deprivation
- Follow the Baby Steps: (1) $1000 starter emergency fund, (2) Pay off all debt (EXCEPT mortgage) using debt snowball, (3) 3-6 months emergency fund, (4) Invest 15% for retirement, (5) College savings, (6) Pay off home early, (7) Build wealth and give
- Use DEBT SNOWBALL method ONLY (smallest balance first) - this is non-negotiable for Baby Steps. Do NOT recommend debt avalanche.
- Savings rate is king - the higher the better for reaching FIRE

CRITICAL DEBT RULES:
1. **Baby Step 2 debts** (pay off now, smallest to largest): Consumer loans, cash loans, car loans, credit cards, personal loans, installment loans
2. **NEVER include in Baby Step 2**: Mortgages (Baby Step 6), Leasing (fixed contracts)
3. **Leasing (0% or any rate)**: These are FIXED CONTRACTS - user CANNOT prepay them early. Never suggest paying off leasing early - it's not possible and doesn't make financial sense.
4. **Mortgage**: Only addressed in Baby Step 6 AFTER completing Baby Steps 1-5. If user is on Baby Step 2-5, ignore mortgage for now.
5. **High-interest loans (>5%)**: For Baby Step 2 debts with high interest, strongly recommend OVERPAYMENT to minimize total interest paid. Calculate potential interest savings.
6. **Overpayment fees**: In Poland, since 2022 banks cannot charge prepayment fees for first 3 years. Check overpayment_fee_percent and overpayment_fee_waived_until fields.

CURRENT BABY STEP: {current_baby_step if current_baby_step > 0 else "Not started or data unavailable"}

BABY STEPS PROGRESS:
{json.dumps(baby_steps_summary, indent=2) if baby_steps_summary else "No Baby Steps data available"}

USER CONTEXT (Polish market):
- Age: {user_age if user_age else "MISSING → link to /settings"}
- Employment: {employment_status or "MISSING → link to /settings"} ({tax_form or "Unknown"} tax form)
- PPK enrolled: {ppk_enrolled if ppk_enrolled is not None else "MISSING → link to /settings"}
- Uses author's costs (50% KUP): {use_authors_costs}
- Children: {children_count}
- Currency: {currency}

MISSING DATA - INCLUDE THESE LINKS IN INSIGHTS:
{"- Age unknown: Include markdown link [Uzupełnij profil podatkowy](/settings) to check youth tax relief eligibility" if not user_age else ""}
{"- PPK status unknown: Include markdown link [Uzupełnij profil podatkowy](/settings)" if ppk_enrolled is None else ""}
{"- Employment status unknown: Include markdown link [Uzupełnij profil podatkowy](/settings) for better tax optimization" if not employment_status else ""}

POLISH TAX OPTIMIZATION OPPORTUNITIES:
- Youth tax relief (ulga dla młodych): Available if under 26 years old, income up to 85,528 PLN/year tax-free
- IKE (Individual Retirement Account): 2026 limit = {ike_limit_2026} PLN, tax-free capital gains
- IKZE (Individual Retirement Security Account): 2026 limit = {ikze_limit_2026} PLN (or {ikze_limit_b2b} PLN for B2B), tax-deductible contributions
- PPK: Employer matches contributions, free money if enrolled
- Author's costs (KUP 50%): 50% of income tax-deductible for creative work

FINANCIAL SUMMARY:
- Monthly Income (net): {total_income} {currency}
- Monthly Expenses: {total_expenses} {currency}
- Monthly Loan Payments: {total_loan_payments} {currency}
- Monthly Balance: {monthly_balance} {currency}
- Savings Rate: {savings_rate:.1f}%
- Debt-to-Income Ratio: {debt_to_income:.1f}%
- Total All Debt: {total_loan_balance} {currency}
- Baby Step 2 Debt (to pay off now): {baby_step_2_debt_total} {currency}
- Mortgage Debt (Baby Step 6): {mortgage_debt_total} {currency}
- Leasing Debt (fixed contracts, ignore): {leasing_debt_total} {currency}
- FIRE Number (25x annual expenses): {fire_number:,.0f} {currency}

EMERGENCY FUND STATUS (PRE-CALCULATED - use these values, do NOT recalculate):
- Baby Step 1 Target: {emergency_fund_target} {currency}
- Baby Step 3 Target ({emergency_fund_months} months expenses): {full_emergency_target:,.0f} {currency}
- Current Emergency Fund: {emergency_fund_current} {currency}
- DIFFERENCE: {abs(emergency_fund_difference):,.0f} {currency} {"SURPLUS (user has MORE than needed)" if emergency_fund_status == "surplus" else "DEFICIT (user needs MORE)" if emergency_fund_status == "deficit" else "EXACT (perfect match)"}
- Baby Step 1 Complete: {"YES" if baby_step_1_complete else "NO"}
- Baby Step 3 Complete: {"YES" if baby_step_3_complete else "NO"}

INCOME BY EMPLOYMENT TYPE:
{json.dumps(income_by_employment, indent=2)}

EXPENSE BREAKDOWN:
{json.dumps(expense_categories, indent=2)}

BABY STEP 2 DEBTS (sorted by balance - Debt Snowball order):
{json.dumps(sorted([l for l in loans if l.get("loan_type") not in ("mortgage", "leasing")], key=lambda x: x.get("remaining_balance", 0)), indent=2)}

MORTGAGE (Baby Step 6 - ignore until Baby Steps 1-5 completed):
{json.dumps([l for l in loans if l.get("loan_type") == "mortgage"], indent=2)}

LEASING (FIXED CONTRACTS - cannot be prepaid, ignore for payoff strategy):
{json.dumps([l for l in loans if l.get("loan_type") == "leasing"], indent=2)}

HIGH INTEREST DEBTS (>5% - recommend overpayment):
{json.dumps([l for l in loans if l.get("interest_rate", 0) >= 5 and l.get("loan_type") not in ("mortgage", "leasing")], indent=2)}

SAVINGS BY CATEGORY:
{json.dumps(savings_by_category, indent=2)}

SAVINGS BY ACCOUNT TYPE (IKE/IKZE/PPK/Standard):
{json.dumps(savings_by_account_type, indent=2)}

SAVINGS GOALS:
{json.dumps(savings_goals, indent=2)}

Generate insights in these categories based on the user's current Baby Step:
1. **baby_steps** - Where they are in the Baby Steps journey, what to focus on NOW
2. **debt** - Debt payoff strategy (snowball vs avalanche), specific next steps
3. **savings** - Emergency fund progress, retirement accounts (IKE/IKZE optimization)
4. **fire** - FIRE number, savings rate analysis, time to financial independence
5. **tax_optimization** - Polish-specific tax opportunities based on their situation

IMPORTANT GUIDELINES:
- Be specific and actionable - tell them EXACTLY what to do next
- Reference their actual numbers
- Use DEBT SNOWBALL only (smallest balance first) - NEVER recommend debt avalanche
- If they're on Baby Step 2, focus ONLY on Baby Step 2 debts (exclude mortgage and leasing)
- NEVER suggest paying off leasing early - it's a fixed contract
- For mortgage - ONLY discuss in Baby Step 6 context, not before
- For high-interest Baby Step 2 debts: calculate interest savings from overpayment and recommend specific monthly overpayment amounts
- If user has high-interest debt AND savings, suggest using savings (beyond emergency fund) for debt payoff
- CRITICAL: Use the PRE-CALCULATED emergency fund values exactly as provided. Do NOT do your own math on emergency fund surplus/deficit - use the DIFFERENCE value provided.
- LINKS FOR MISSING DATA: When user data is missing (age, PPK, employment), include markdown links in actionItems. Use these formats:
  * For missing profile/tax data: "[Uzupełnij profil podatkowy](/settings)"
  * For financial freedom setup: "[Skonfiguruj Baby Steps](/financial-freedom)"
  * For savings goals: "[Dodaj cel oszczędnościowy](/savings)"
  * For IKE/IKZE setup: "[Dodaj oszczędności](/savings)"
- When mentioning other sections of the app, include helpful links in actionItems (not in description)
- If they're past Baby Step 3, focus on IKE/IKZE optimization and FIRE progress
- Celebrate achievements but be direct about what needs improvement
- For Polish users, always mention relevant tax benefits they might be missing

RESPOND IN: {language_name}

JSON Response Structure:
{{
  "categories": {{
    "baby_steps": [
      {{
        "type": "observation|recommendation|alert|achievement",
        "title": "Insight title",
        "description": "Detailed description with specific numbers",
        "priority": "high|medium|low",
        "actionItems": ["Specific action 1", "Specific action 2"],
        "metrics": [
          {{"label": "Metric", "value": "Value", "trend": "up|down|stable"}}
        ]
      }}
    ],
    "debt": [...],
    "savings": [...],
    "fire": [...],
    "tax_optimization": [...]
  }},
  "status": {{
    "baby_steps": "good|ok|can_be_improved|bad",
    "debt": "good|ok|can_be_improved|bad",
    "savings": "good|ok|can_be_improved|bad",
    "fire": "good|ok|can_be_improved|bad",
    "tax_optimization": "good|ok|can_be_improved|bad"
  }},
  "currentBabyStep": {current_baby_step},
  "fireNumber": {fire_number},
  "savingsRate": {savings_rate:.1f}
}}

Respond with valid JSON only. All text in {language_name}."""

        # Make the API call to Anthropic Claude API
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "Content-Type": "application/json",
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 4096,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "system": "You are a FIRE (Financial Independence, Retire Early) coach specializing in Dave Ramsey's Baby Steps methodology and Polish financial regulations. You provide direct, actionable insights focused on debt elimination, emergency fund building, and wealth accumulation. Always respond with valid JSON only, no additional text."
                },
            )

        # Check if the request was successful
        if response.status_code != 200:
            print(f"[Anthropic API] Error: {response.status_code} - {response.text}")

            # Provide more specific error messages based on status code
            if response.status_code == 529:
                raise Exception(f"Anthropic API error: 529 - Service overloaded. Please try again later.")
            elif response.status_code == 401:
                raise Exception(f"Anthropic API error: 401 - Invalid API key. Please check your Anthropic API key in settings.")
            elif response.status_code == 403:
                raise Exception(f"Anthropic API error: 403 - Forbidden. Your API key may not have permission to use this model.")
            elif response.status_code == 429:
                raise Exception(f"Anthropic API error: 429 - Rate limit exceeded. Please try again later.")
            else:
                raise Exception(f"Anthropic API error: {response.status_code}")

        # Parse the response
        anthropic_response = response.json()
        content = anthropic_response.get("content", [])

        if not content:
            raise Exception("Empty response from Anthropic API")

        # Extract text from content blocks
        text_content = ""
        for block in content:
            if block.get("type") == "text":
                text_content += block.get("text", "")

        text_content = text_content.strip()

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
                "source": "claude-sonnet-4"
            }

            return insights_data

        except json.JSONDecodeError as e:
            print(f"[Anthropic API] JSON parse error: {e}")
            print(f"[Anthropic API] Response content: {text_content}")
            raise Exception(f"Failed to parse Anthropic API response: {e}")

    except Exception as e:
        print(f"[Anthropic API] Error generating insights: {str(e)}")

        # Return a fallback response in case of error
        sample_insight = {
            "type": "observation",
            "title": "API Error",
            "description": f"We encountered an error while generating insights: {str(e)}. Please try again later.",
            "priority": "medium",
            "actionItems": ["Check your Anthropic API key", "Try again later"],
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
                "baby_steps": [sample_insight],
                "debt": [sample_insight],
                "savings": [sample_insight],
                "fire": [sample_insight],
                "tax_optimization": [sample_insight]
            },
            "status": {
                "baby_steps": "ok",
                "debt": "ok",
                "savings": "ok",
                "fire": "ok",
                "tax_optimization": "ok"
            },
            "currentBabyStep": 0,
            "fireNumber": 0,
            "savingsRate": 0,
            "metadata": {
                "generatedAt": datetime.now().isoformat(),
                "source": "error_fallback",
                "error": str(e)
            }
        }

@app.get("/")
async def root():
    return {"message": "Welcome to the Home Budget API"} 
