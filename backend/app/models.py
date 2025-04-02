from sqlalchemy import Column, Integer, String, Float, Date, ForeignKey, DateTime, Boolean, JSON, UniqueConstraint, Table, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSONB

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)  # Changed to String for Google OAuth ID
    email = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    loans = relationship("Loan", back_populates="user")
    expenses = relationship("Expense", back_populates="user")
    income = relationship("Income", back_populates="user")
    settings = relationship("Settings", back_populates="user", uselist=False)
    activities = relationship("Activity", back_populates="user")
    insights_caches = relationship("InsightsCache", back_populates="user", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    financial_freedom = relationship("FinancialFreedom", back_populates="user", uselist=False)
    savings = relationship("Saving", back_populates="user", cascade="all, delete-orphan")
    banking_connections = relationship("BankingConnection", back_populates="user", cascade="all, delete-orphan")

class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))  # Changed to String to match User.id
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

    # Relationship
    user = relationship("User", back_populates="loans")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="expenses")

class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="income")

class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    language = Column(String, default="en")
    currency = Column(String, default="USD")
    ai = Column(JSON)
    # Financial Freedom settings
    emergency_fund_target = Column(Integer, default=1000)  # Target for Baby Step 1
    emergency_fund_months = Column(Integer, default=3)     # Months for Baby Step 3
    base_currency = Column(String, default="USD")          # Base currency for emergency fund target
    banking = Column(JSON)                                # Banking settings
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="settings")

class Activity(Base):
    __tablename__ = "activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    entity_type = Column(String)  # 'Income', 'Expense', or 'Loan'
    operation_type = Column(String)  # 'create', 'update', or 'delete'
    entity_id = Column(Integer)
    previous_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Relationship
    user = relationship("User", back_populates="activities")

class InsightsCache(Base):
    __tablename__ = "insights_cache"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    language = Column(String, default="en")  # Store the language of the insights
    insights = Column(JSON)
    financial_snapshot = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_stale = Column(Boolean, default=False)
    # New fields for caching strategy
    last_refresh_date = Column(DateTime, default=datetime.utcnow)
    total_income = Column(Float, default=0)
    total_expenses = Column(Float, default=0)
    total_loans = Column(Float, default=0)

    user = relationship("User", back_populates="insights_caches")

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    type = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    provider_account_id = Column(String, nullable=False)
    refresh_token = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
    expires_at = Column(Integer, nullable=True)
    token_type = Column(String, nullable=True)
    scope = Column(String, nullable=True)
    id_token = Column(String, nullable=True)
    session_state = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="accounts")

    __table_args__ = (UniqueConstraint('provider', 'provider_account_id', name='provider_account_id_unique'),)

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    session_token = Column(String, unique=True, nullable=False)
    expires = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="sessions")

class VerificationToken(Base):
    __tablename__ = "verification_tokens"

    identifier = Column(String, nullable=False)
    token = Column(String, primary_key=True)
    expires = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint('identifier', 'token', name='token_identifier_unique'),)

class FinancialFreedom(Base):
    __tablename__ = "financial_freedom"

    id = Column(Integer, primary_key=True, index=True)
    userId = Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"))  # Map user_id column to userId
    steps = Column(JSONB)
    startDate = Column("start_date", DateTime(timezone=True), server_default=func.now())  # Map start_date column to startDate
    lastUpdated = Column("last_updated", DateTime(timezone=True), server_default=func.now(), onupdate=func.now())  # Map last_updated column to lastUpdated

    user = relationship("User", back_populates="financial_freedom")

    __table_args__ = (
        Index('idx_financial_freedom_user_id', 'user_id'),
        Index('idx_financial_freedom_steps', 'steps', postgresql_using='gin'),
    )

class Saving(Base):
    __tablename__ = "savings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    category = Column(String, nullable=False)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    is_recurring = Column(Boolean, default=False)
    target_amount = Column(Float, nullable=True)
    saving_type = Column(String, nullable=False)  # 'deposit' or 'withdrawal'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="savings")

    __table_args__ = (
        Index('idx_savings_user_id', 'user_id'),
        Index('idx_savings_category', 'category'),
        Index('idx_savings_date', 'date'),
    )

class BankingConnection(Base):
    __tablename__ = "banking_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    institution_id = Column(String, nullable=False)
    institution_name = Column(String, nullable=False)
    requisition_id = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)
    accounts = Column(JSON)  # List of account IDs
    account_names = Column(JSON)  # Map of account ID to account name

    # Relationship
    user = relationship("User", back_populates="banking_connections")

    __table_args__ = (
        Index('idx_banking_connections_user_id', 'user_id'),
        Index('idx_banking_connections_requisition_id', 'requisition_id'),
    )