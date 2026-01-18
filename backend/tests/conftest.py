"""
Shared test fixtures for the backend test suite.

This module provides pytest fixtures for testing the backend application.
It sets up an in-memory SQLite database for tests to avoid needing a real PostgreSQL instance.
"""
import os
import sys
from unittest.mock import patch, MagicMock

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["POSTGRES_HOST"] = "localhost"
os.environ["POSTGRES_PORT"] = "5432"
os.environ["POSTGRES_DB"] = "test_db"

import pytest
from sqlalchemy import create_engine, event, Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, JSON
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import func
from datetime import datetime, timezone, timedelta


SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

# Create Base for test models
Base = declarative_base()


# Define test-compatible models (simplified versions that work with SQLite)
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    language = Column(String, default="en")
    currency = Column(String, default="USD")


class Subscription(Base):
    __tablename__ = "subscriptions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"), unique=True)
    stripe_customer_id = Column(String, unique=True, nullable=True)
    stripe_subscription_id = Column(String, unique=True, nullable=True)
    status = Column(String, default="trialing", nullable=False)
    plan_type = Column(String, default="trial", nullable=False)
    trial_start = Column(DateTime(timezone=True), nullable=True)
    trial_end = Column(DateTime(timezone=True), nullable=True)
    is_lifetime = Column(Boolean, default=False)
    lifetime_purchased_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Income(Base):
    __tablename__ = "income"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)
    description = Column(String)
    amount = Column(Float)
    is_recurring = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Loan(Base):
    __tablename__ = "loans"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
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


class Saving(Base):
    __tablename__ = "savings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
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


class OnboardingBackup(Base):
    __tablename__ = "onboarding_backups"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    data = Column(JSON, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


@pytest.fixture(scope="session")
def engine():
    """Create a test database engine that persists across the test session."""
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Enable foreign key support for SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture(scope="function")
def db_session(engine):
    """Create a new database session for each test function with transaction rollback."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user in the database."""
    user = User(
        id="test-user-id",
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
        currency="USD"
    )
    db_session.add(settings)
    db_session.commit()
    return test_user


@pytest.fixture
def premium_subscription(db_session, test_user):
    """Create a premium subscription for the test user."""
    subscription = Subscription(
        user_id=test_user.id,
        status="active",
        plan_type="monthly",
        is_lifetime=False
    )
    db_session.add(subscription)
    db_session.commit()
    return subscription


@pytest.fixture
def trial_subscription(db_session, test_user):
    """Create an active trial subscription for the test user."""
    subscription = Subscription(
        user_id=test_user.id,
        status="trialing",
        plan_type="trial",
        is_lifetime=False,
        trial_start=datetime.now(timezone.utc) - timedelta(days=7),
        trial_end=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db_session.add(subscription)
    db_session.commit()
    return subscription


@pytest.fixture
def expired_trial_subscription(db_session, test_user):
    """Create an expired trial subscription for the test user."""
    subscription = Subscription(
        user_id=test_user.id,
        status="trialing",
        plan_type="trial",
        is_lifetime=False,
        trial_start=datetime.now(timezone.utc) - timedelta(days=21),
        trial_end=datetime.now(timezone.utc) - timedelta(days=7)
    )
    db_session.add(subscription)
    db_session.commit()
    return subscription


@pytest.fixture
def lifetime_subscription(db_session, test_user):
    """Create a lifetime subscription for the test user."""
    subscription = Subscription(
        user_id=test_user.id,
        status="active",
        plan_type="lifetime",
        is_lifetime=True,
        lifetime_purchased_at=datetime.now(timezone.utc) - timedelta(days=30)
    )
    db_session.add(subscription)
    db_session.commit()
    return subscription


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers for the test user."""
    return {"X-User-ID": test_user.id}
