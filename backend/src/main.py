from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from datetime import date

from .database import get_db, engine
from . import models
from . import schemas

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Home Budget API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# User endpoints
@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    try:
        db_user = models.User(username=user.username, email=user.email)
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except IntegrityError as e:
        db.rollback()
        if "ix_users_email" in str(e):
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )
        elif "ix_users_username" in str(e):
            raise HTTPException(
                status_code=400,
                detail="Username already taken"
            )
        raise HTTPException(
            status_code=400,
            detail="Could not create user"
        )

@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

# Income endpoints
@app.post("/users/{user_id}/incomes/", response_model=schemas.Income)
def create_income(user_id: int, income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    db_income = models.Income(**income.dict(), user_id=user_id)
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income

@app.get("/users/{user_id}/incomes/", response_model=List[schemas.Income])
def get_user_incomes(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Income).filter(models.Income.user_id == user_id).all()

@app.put("/users/{user_id}/incomes/{income_id}", response_model=schemas.Income)
def update_income(user_id: int, income_id: int, income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    db_income = db.query(models.Income).filter(
        models.Income.user_id == user_id,
        models.Income.id == income_id
    ).first()
    
    if not db_income:
        raise HTTPException(status_code=404, detail="Income not found")
    
    for key, value in income.dict().items():
        setattr(db_income, key, value)
    
    db.commit()
    db.refresh(db_income)
    return db_income

@app.delete("/users/{user_id}/incomes/{income_id}")
def delete_income(user_id: int, income_id: int, db: Session = Depends(get_db)):
    db_income = db.query(models.Income).filter(
        models.Income.user_id == user_id,
        models.Income.id == income_id
    ).first()
    
    if not db_income:
        raise HTTPException(status_code=404, detail="Income not found")
    
    db.delete(db_income)
    db.commit()
    return {"message": "Income deleted successfully"}

# Expense endpoints
@app.post("/users/{user_id}/expenses/", response_model=schemas.Expense)
def create_expense(user_id: int, expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = models.Expense(**expense.dict(), user_id=user_id)
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

@app.get("/users/{user_id}/expenses/", response_model=List[schemas.Expense])
def get_user_expenses(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Expense).filter(models.Expense.user_id == user_id).all()

@app.put("/users/{user_id}/expenses/{expense_id}", response_model=schemas.Expense)
def update_expense(user_id: int, expense_id: int, expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.id == expense_id
    ).first()
    
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    for key, value in expense.dict().items():
        setattr(db_expense, key, value)
    
    db.commit()
    db.refresh(db_expense)
    return db_expense

@app.delete("/users/{user_id}/expenses/{expense_id}")
def delete_expense(user_id: int, expense_id: int, db: Session = Depends(get_db)):
    db_expense = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.id == expense_id
    ).first()
    
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    db.delete(db_expense)
    db.commit()
    return {"message": "Expense deleted successfully"}

# Loan endpoints
@app.post("/users/{user_id}/loans/", response_model=schemas.Loan)
def create_loan(user_id: int, loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    db_loan = models.Loan(**loan.dict(), user_id=user_id)
    db.add(db_loan)
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.get("/users/{user_id}/loans/", response_model=List[schemas.Loan])
def get_user_loans(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Loan).filter(models.Loan.user_id == user_id).all()

@app.put("/users/{user_id}/loans/{loan_id}", response_model=schemas.Loan)
def update_loan(user_id: int, loan_id: int, loan: schemas.LoanCreate, db: Session = Depends(get_db)):
    db_loan = db.query(models.Loan).filter(
        models.Loan.user_id == user_id,
        models.Loan.id == loan_id
    ).first()
    
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    for key, value in loan.dict().items():
        setattr(db_loan, key, value)
    
    db.commit()
    db.refresh(db_loan)
    return db_loan

@app.delete("/users/{user_id}/loans/{loan_id}")
def delete_loan(user_id: int, loan_id: int, db: Session = Depends(get_db)):
    db_loan = db.query(models.Loan).filter(
        models.Loan.user_id == user_id,
        models.Loan.id == loan_id
    ).first()
    
    if not db_loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    
    db.delete(db_loan)
    db.commit()
    return {"message": "Loan deleted successfully"}

# Summary endpoint
@app.get("/users/{user_id}/summary")
def get_user_summary(user_id: int, db: Session = Depends(get_db)):
    # Get monthly income
    incomes = db.query(models.Income).filter(
        models.Income.user_id == user_id,
        models.Income.is_recurring == True
    ).all()
    total_monthly_income = sum(income.amount for income in incomes)

    # Get monthly expenses
    expenses = db.query(models.Expense).filter(
        models.Expense.user_id == user_id,
        models.Expense.is_recurring == True
    ).all()
    total_monthly_expenses = sum(expense.amount for expense in expenses)

    # Get loans
    loans = db.query(models.Loan).filter(models.Loan.user_id == user_id).all()
    total_monthly_loan_payments = sum(loan.monthly_payment for loan in loans)
    total_loan_balance = sum(loan.remaining_balance for loan in loans)

    return {
        "total_monthly_income": total_monthly_income,
        "total_monthly_expenses": total_monthly_expenses,
        "total_monthly_loan_payments": total_monthly_loan_payments,
        "total_loan_balance": total_loan_balance,
        "monthly_balance": total_monthly_income - total_monthly_expenses - total_monthly_loan_payments
    } 