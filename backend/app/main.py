from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from . import models, database
from pydantic import BaseModel
from datetime import date, datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func
import calendar

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
models.Base.metadata.create_all(bind=database.engine)

# Pydantic models for request/response
class UserBase(BaseModel):
    email: str
    name: str | None = None

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime | None = None

    class Config:
        from_attributes = True

class LoanBase(BaseModel):
    loan_type: str
    description: str
    principal_amount: float
    remaining_balance: float
    interest_rate: float
    monthly_payment: float
    start_date: date
    term_months: int

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
    date: date

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
    date: date

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

# Settings models
class SettingsBase(BaseModel):
    language: str
    currency: str

class SettingsCreate(SettingsBase):
    pass

class Settings(SettingsBase):
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

# Monthly Budget Report models
class MonthlyBudgetData(BaseModel):
    incomes: List[Income]
    expenses: List[Expense]
    loan_payments: List[Loan]
    totals: dict

class YearlyBudgetReport(BaseModel):
    months: dict[str, MonthlyBudgetData]

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
                    currency="USD"
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
            currency="USD"
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
                currency="USD"
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
@app.get("/users/{user_id}/loans", response_model=List[Loan])
def get_user_loans(user_id: str, db: Session = Depends(database.get_db)):
    loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
    return loans

@app.post("/users/{user_id}/loans", response_model=Loan)
def create_loan(user_id: str, loan: LoanCreate, db: Session = Depends(database.get_db)):
    # Check if user exists
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    db_loan = models.Loan(**loan.model_dump(), user_id=user_id)
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.put("/users/{user_id}/loans/{loan_id}", response_model=Loan)
def update_loan(user_id: str, loan_id: int, loan: LoanCreate, db: Session = Depends(database.get_db)):
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

        # Fetch monthly income
        monthly_income = db.query(func.sum(models.Income.amount)).filter(
            models.Income.user_id == user_id,
            models.Income.date >= month_start,
            models.Income.date <= month_end
        ).scalar() or 0

        # Fetch monthly expenses
        monthly_expenses = db.query(func.sum(models.Expense.amount)).filter(
            models.Expense.user_id == user_id,
            models.Expense.date >= month_start,
            models.Expense.date <= month_end
        ).scalar() or 0

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

        summary = {
            "total_monthly_income": float(monthly_income),
            "total_monthly_expenses": float(monthly_expenses),
            "total_monthly_loan_payments": float(monthly_loan_payments),
            "total_loan_balance": float(total_loan_balance),
            "monthly_balance": float(monthly_balance)
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