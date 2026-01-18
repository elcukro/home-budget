"""
Integration test fixtures.

This module provides fixtures for integration testing the FastAPI application
with a real TestClient and SQLite in-memory database.

The approach here is to create a minimal test FastAPI app that mirrors
the actual app's endpoints but uses SQLite-compatible models.
"""
import os
import sys

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["POSTGRES_HOST"] = "localhost"
os.environ["POSTGRES_PORT"] = "5432"
os.environ["POSTGRES_DB"] = "test_db"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"

import pytest
from sqlalchemy import create_engine, event, Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, relationship, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import func
from datetime import datetime, timezone, timedelta, date
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.testclient import TestClient
from pydantic import BaseModel
from typing import List, Optional


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create Base for test models
Base = declarative_base()


# ============ Test Models ============

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    settings = relationship("Settings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")
    onboarding_backups = relationship("OnboardingBackup", back_populates="user", cascade="all, delete-orphan")
    savings = relationship("Saving", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")


class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    language = Column(String, default="en")
    currency = Column(String, default="USD")
    ai = Column(JSON, nullable=True)
    emergency_fund_target = Column(Integer, default=1000)
    emergency_fund_months = Column(Integer, default=3)
    base_currency = Column(String, default="USD")
    onboarding_completed = Column(Boolean, default=False)
    onboarding_completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="settings")


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    stripe_customer_id = Column(String, unique=True, nullable=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True)
    status = Column(String, default="trialing", nullable=False)
    plan_type = Column(String, default="trial", nullable=False)
    is_lifetime = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="subscription")


class OnboardingBackup(Base):
    __tablename__ = "onboarding_backups"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    data = Column(JSON, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="onboarding_backups")


class Saving(Base):
    __tablename__ = "savings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    is_recurring = Column(Boolean, default=False)
    target_amount = Column(Float, nullable=True)
    saving_type = Column(String, nullable=False)
    account_type = Column(String, default='standard')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="savings")


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    loan_type = Column(String)
    description = Column(String)
    principal_amount = Column(Float)
    remaining_balance = Column(Float)
    interest_rate = Column(Float)
    monthly_payment = Column(Float)
    start_date = Column(Date)
    term_months = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="loans")


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
    ai: Optional[dict] = None
    emergency_fund_target: Optional[int] = 1000
    emergency_fund_months: Optional[int] = 3
    base_currency: Optional[str] = "USD"
    onboarding_completed: Optional[bool] = False
    onboarding_completed_at: Optional[datetime] = None


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


# ============ Database fixtures ============

@pytest.fixture(scope="session")
def test_engine():
    """Create a test database engine that persists across the test session."""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def db_session(test_engine):
    """Create a new database session for each test function."""
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ============ Test App Creation ============

def create_test_app(db_session):
    """Create a FastAPI test app with endpoints mirroring the actual app."""
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
            try:
                db.commit()
                db.refresh(user)
                # Create default settings
                settings = Settings(
                    user_id=user_id,
                    language="en",
                    currency="USD",
                    ai={"apiKey": None}
                )
                db.add(settings)
                db.commit()
            except Exception as e:
                db.rollback()
                raise HTTPException(status_code=500, detail=str(e))
        return user

    @app.post("/users", response_model=UserResponse)
    def create_user(user_data: UserCreate, db=Depends(get_db)):
        user = User(id=user_data.email, email=user_data.email, name=user_data.name)
        db.add(user)
        settings = Settings(
            user_id=user_data.email,
            language="en",
            currency="USD",
            ai={"apiKey": None}
        )
        db.add(settings)
        try:
            db.commit()
            db.refresh(user)
            return user
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

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
        settings.updated_at = datetime.utcnow()
        try:
            db.commit()
            db.refresh(settings)
            return settings
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

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
        try:
            db.delete(user)
            db.commit()
            return DeleteAccountResponse(success=True, message="Account deleted successfully")
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ============ Onboarding backup endpoints ============

    @app.post("/users/me/onboarding-backups", response_model=OnboardingBackupResponse)
    def create_onboarding_backup(
        backup: OnboardingBackupCreate,
        user_id: str = Query(...),
        db=Depends(get_db)
    ):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        try:
            db_backup = OnboardingBackup(user_id=user_id, data=backup.data, reason=backup.reason)
            db.add(db_backup)
            db.commit()
            db.refresh(db_backup)
            return db_backup
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

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
        try:
            db.delete(backup)
            db.commit()
            return {"success": True, "message": "Backup deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ============ Savings endpoints ============

    @app.get("/savings", response_model=List[SavingResponse])
    def list_savings(user_id: str = Query(...), db=Depends(get_db)):
        savings = db.query(Saving).filter(Saving.user_id == user_id).all()
        return savings

    @app.post("/savings", response_model=SavingResponse)
    def create_saving(saving: SavingCreate, user_id: str = Query(...), db=Depends(get_db)):
        db_saving = Saving(user_id=user_id, **saving.model_dump())
        db.add(db_saving)
        try:
            db.commit()
            db.refresh(db_saving)
            return db_saving
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/savings/{saving_id}", response_model=SavingResponse)
    def get_saving(saving_id: int, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(
            Saving.id == saving_id,
            Saving.user_id == user_id
        ).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        return saving

    @app.put("/savings/{saving_id}", response_model=SavingResponse)
    def update_saving(saving_id: int, saving_update: SavingCreate, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(
            Saving.id == saving_id,
            Saving.user_id == user_id
        ).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        for key, value in saving_update.model_dump().items():
            setattr(saving, key, value)
        saving.updated_at = datetime.utcnow()
        try:
            db.commit()
            db.refresh(saving)
            return saving
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/savings/{saving_id}")
    def delete_saving(saving_id: int, user_id: str = Query(...), db=Depends(get_db)):
        saving = db.query(Saving).filter(
            Saving.id == saving_id,
            Saving.user_id == user_id
        ).first()
        if not saving:
            raise HTTPException(status_code=404, detail="Saving not found")
        try:
            db.delete(saving)
            db.commit()
            return {"success": True, "message": "Saving deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    # ============ Loans endpoints ============

    @app.get("/loans", response_model=List[LoanResponse])
    def list_loans(user_id: str = Query(...), db=Depends(get_db)):
        loans = db.query(Loan).filter(Loan.user_id == user_id).all()
        return loans

    @app.post("/loans", response_model=LoanResponse)
    def create_loan(loan: LoanCreate, user_id: str = Query(...), db=Depends(get_db)):
        db_loan = Loan(user_id=user_id, **loan.model_dump())
        db.add(db_loan)
        try:
            db.commit()
            db.refresh(db_loan)
            return db_loan
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/loans/{loan_id}", response_model=LoanResponse)
    def get_loan(loan_id: int, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(
            Loan.id == loan_id,
            Loan.user_id == user_id
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        return loan

    @app.put("/loans/{loan_id}", response_model=LoanResponse)
    def update_loan(loan_id: int, loan_update: LoanCreate, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(
            Loan.id == loan_id,
            Loan.user_id == user_id
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        for key, value in loan_update.model_dump().items():
            setattr(loan, key, value)
        loan.updated_at = datetime.utcnow()
        try:
            db.commit()
            db.refresh(loan)
            return loan
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    @app.delete("/loans/{loan_id}")
    def delete_loan(loan_id: int, user_id: str = Query(...), db=Depends(get_db)):
        loan = db.query(Loan).filter(
            Loan.id == loan_id,
            Loan.user_id == user_id
        ).first()
        if not loan:
            raise HTTPException(status_code=404, detail="Loan not found")
        try:
            db.delete(loan)
            db.commit()
            return {"success": True, "message": "Loan deleted successfully"}
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

    return app


@pytest.fixture
def client(db_session):
    """Create a TestClient for the test app."""
    app = create_test_app(db_session)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def test_user(db_session):
    """Create a test user in the database."""
    user = User(
        id="test@example.com",
        email="test@example.com",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_with_settings(db_session, test_user):
    """Create a test user with settings."""
    settings = Settings(
        user_id=test_user.id,
        language="en",
        currency="USD",
        ai={"apiKey": None}
    )
    db_session.add(settings)
    db_session.commit()
    return test_user


@pytest.fixture
def test_user_with_subscription(db_session, test_user):
    """Create a test user with an active subscription."""
    subscription = Subscription(
        user_id=test_user.id,
        status="active",
        plan_type="monthly",
        stripe_subscription_id="sub_test123",
        is_lifetime=False
    )
    db_session.add(subscription)
    db_session.commit()
    return test_user
