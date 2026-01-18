"""
Integration test fixtures.

This module provides fixtures for integration testing the FastAPI application.
It reuses the database fixtures from the parent conftest.py and adds HTTP client fixtures.
"""
import pytest
from datetime import datetime, date
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.testclient import TestClient
from pydantic import BaseModel
from typing import List, Optional

# Import shared fixtures from parent conftest - pytest handles this automatically
# by loading the parent conftest.py first


# ============ Pydantic Schemas ============

class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    name: Optional[str] = None


class SettingsBase(BaseModel):
    language: str
    currency: str


class SettingsResponse(SettingsBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeleteAccountRequest(BaseModel):
    confirmation_phrase: str


class DeleteAccountResponse(BaseModel):
    success: bool
    message: str


class OnboardingBackupCreate(BaseModel):
    data: dict
    reason: Optional[str] = None


class OnboardingBackupResponse(BaseModel):
    id: int
    user_id: str
    data: dict
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OnboardingBackupListItem(BaseModel):
    id: int
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SavingCreate(BaseModel):
    category: str
    description: str
    amount: float
    date: date
    end_date: Optional[date] = None
    is_recurring: bool = False
    target_amount: Optional[float] = None
    saving_type: str
    account_type: str = "standard"


class SavingResponse(BaseModel):
    id: int
    user_id: str
    category: str
    description: str
    amount: float
    date: date
    end_date: Optional[date] = None
    is_recurring: bool
    target_amount: Optional[float] = None
    saving_type: str
    account_type: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LoanCreate(BaseModel):
    loan_type: str
    description: str
    principal_amount: float
    remaining_balance: float
    interest_rate: float
    monthly_payment: float
    start_date: date
    term_months: int


class LoanResponse(BaseModel):
    id: int
    user_id: str
    loan_type: str
    description: str
    principal_amount: float
    remaining_balance: float
    interest_rate: float
    monthly_payment: float
    start_date: date
    term_months: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Test App Creation ============

def create_test_app(db_session, User, Settings, Saving, Loan, OnboardingBackup):
    """
    Create a FastAPI test app with endpoints mirroring the actual app.

    Uses the models from the parent conftest.py.
    """
    app = FastAPI()

    def get_db():
        yield db_session

    # ============ Users endpoints ============

    @app.get("/users/me", response_model=UserResponse)
    def get_current_user(user_id: str = Query(...), db=Depends(get_db)):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(id=user_id, email=user_id, name=None)
            db.add(user)
            db.flush()  # Flush user first to satisfy FK constraint
            settings = Settings(user_id=user_id, language="en", currency="USD")
            db.add(settings)
            db.flush()
        return user

    @app.post("/users", response_model=UserResponse)
    def create_user(user_data: UserCreate, db=Depends(get_db)):
        user = User(id=user_data.email, email=user_data.email, name=user_data.name)
        db.add(user)
        db.flush()  # Flush user first to satisfy FK constraint
        settings = Settings(user_id=user_data.email, language="en", currency="USD")
        db.add(settings)
        db.flush()
        return user

    @app.get("/users/{email}/settings", response_model=SettingsResponse)
    def get_user_settings(email: str, db=Depends(get_db)):
        settings = db.query(Settings).filter(Settings.user_id == email).first()
        if not settings:
            raise HTTPException(status_code=404, detail="Settings not found")
        return settings

    @app.put("/users/{email}/settings", response_model=SettingsResponse)
    def update_user_settings(email: str, settings_update: SettingsBase, db=Depends(get_db)):
        settings = db.query(Settings).filter(Settings.user_id == email).first()
        if not settings:
            raise HTTPException(status_code=404, detail="Settings not found")
        for key, value in settings_update.model_dump().items():
            setattr(settings, key, value)
        db.flush()
        return settings

    @app.delete("/users/me/account", response_model=DeleteAccountResponse)
    def delete_user_account(request: DeleteAccountRequest, user_id: str = Query(...), db=Depends(get_db)):
        valid_phrases = ["USUŃ KONTO", "DELETE ACCOUNT"]
        if request.confirmation_phrase not in valid_phrases:
            raise HTTPException(
                status_code=400,
                detail="Invalid confirmation phrase. Please type 'USUŃ KONTO' or 'DELETE ACCOUNT' exactly."
            )
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        db.delete(user)
        db.flush()
        return DeleteAccountResponse(success=True, message="Account deleted successfully")

    # ============ Onboarding Backup endpoints ============

    @app.post("/users/me/onboarding-backups", response_model=OnboardingBackupResponse)
    def create_onboarding_backup(
        backup: OnboardingBackupCreate,
        user_id: str = Query(...),
        db=Depends(get_db)
    ):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        db_backup = OnboardingBackup(user_id=user_id, data=backup.data, reason=backup.reason)
        db.add(db_backup)
        db.flush()
        return db_backup

    @app.get("/users/me/onboarding-backups", response_model=List[OnboardingBackupListItem])
    def list_onboarding_backups(user_id: str = Query(...), db=Depends(get_db)):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        backups = db.query(OnboardingBackup).filter(
            OnboardingBackup.user_id == user_id
        ).order_by(OnboardingBackup.created_at.desc()).all()
        return backups

    @app.get("/users/me/onboarding-backups/{backup_id}", response_model=OnboardingBackupResponse)
    def get_onboarding_backup(backup_id: int, user_id: str = Query(...), db=Depends(get_db)):
        backup = db.query(OnboardingBackup).filter(
            OnboardingBackup.id == backup_id,
            OnboardingBackup.user_id == user_id
        ).first()
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        return backup

    @app.delete("/users/me/onboarding-backups/{backup_id}")
    def delete_onboarding_backup(backup_id: int, user_id: str = Query(...), db=Depends(get_db)):
        backup = db.query(OnboardingBackup).filter(
            OnboardingBackup.id == backup_id,
            OnboardingBackup.user_id == user_id
        ).first()
        if not backup:
            raise HTTPException(status_code=404, detail="Backup not found")
        db.delete(backup)
        db.flush()
        return {"success": True, "message": "Backup deleted successfully"}

    # ============ Savings endpoints ============

    @app.get("/savings", response_model=List[SavingResponse])
    def list_savings(user_id: str = Query(...), db=Depends(get_db)):
        savings = db.query(Saving).filter(Saving.user_id == user_id).all()
        return savings

    @app.post("/savings", response_model=SavingResponse)
    def create_saving(saving: SavingCreate, user_id: str = Query(...), db=Depends(get_db)):
        db_saving = Saving(user_id=user_id, **saving.model_dump())
        db.add(db_saving)
        db.flush()
        return db_saving

    @app.get("/savings/{saving_id}", response_model=SavingResponse)
    def get_saving(saving_id: int, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(Saving.id == saving_id, Saving.user_id == user_id).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        return saving

    @app.put("/savings/{saving_id}", response_model=SavingResponse)
    def update_saving(saving_id: int, saving_update: SavingCreate, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(Saving.id == saving_id, Saving.user_id == user_id).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        for key, value in saving_update.model_dump().items():
            setattr(saving, key, value)
        db.flush()
        return saving

    @app.delete("/savings/{saving_id}")
    def delete_saving(saving_id: int, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(Saving.id == saving_id, Saving.user_id == user_id).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        db.delete(saving)
        db.flush()
        return {"success": True, "message": "Saving deleted successfully"}

    # ============ Loans endpoints ============

    @app.get("/loans", response_model=List[LoanResponse])
    def list_loans(user_id: str = Query(...), db=Depends(get_db)):
        loans = db.query(Loan).filter(Loan.user_id == user_id).all()
        return loans

    @app.post("/loans", response_model=LoanResponse)
    def create_loan(loan: LoanCreate, user_id: str = Query(...), db=Depends(get_db)):
        db_loan = Loan(user_id=user_id, **loan.model_dump())
        db.add(db_loan)
        db.flush()
        return db_loan

    @app.get("/loans/{loan_id}", response_model=LoanResponse)
    def get_loan(loan_id: int, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        return loan

    @app.put("/loans/{loan_id}", response_model=LoanResponse)
    def update_loan(loan_id: int, loan_update: LoanCreate, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        for key, value in loan_update.model_dump().items():
            setattr(loan, key, value)
        db.flush()
        return loan

    @app.delete("/loans/{loan_id}")
    def delete_loan(loan_id: int, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(Loan.id == loan_id, Loan.user_id == user_id).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        db.delete(loan)
        db.flush()
        return {"success": True, "message": "Loan deleted successfully"}

    return app


@pytest.fixture
def client(db_session):
    """Create a TestClient for the test app using models from parent conftest."""
    # Import the models from the parent conftest
    from tests.conftest import User, Settings, Saving, Loan, OnboardingBackup

    app = create_test_app(db_session, User, Settings, Saving, Loan, OnboardingBackup)
    with TestClient(app) as test_client:
        yield test_client
