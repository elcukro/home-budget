"""
Integration test fixtures.

This module provides fixtures for integration testing the FastAPI application
using the real app from app.main with a SQLite test database.
"""
import os
import sys

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"  # Still needed to prevent validation errors
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake_key"

# Mock external dependencies before importing the app
from unittest.mock import MagicMock, patch

# Mock Sentry before it's imported
sentry_mock = MagicMock()
sys.modules['sentry_sdk'] = sentry_mock
sys.modules['sentry_sdk.integrations'] = MagicMock()
sys.modules['sentry_sdk.integrations.fastapi'] = MagicMock()
sys.modules['sentry_sdk.integrations.sqlalchemy'] = MagicMock()

# Mock Stripe
stripe_mock = MagicMock()
sys.modules['stripe'] = stripe_mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

# Now we can safely import the app
from app.database import engine, Base, get_db
from app.main import app
from app import models


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Create all tables at the start of the test session."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    yield
    # Tables will be dropped when the test process ends


@pytest.fixture(scope="function")
def db_session():
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
    user = models.User(
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
    settings = models.Settings(
        user_id=test_user.id,
        language="en",
        currency="USD"
    )
    db_session.add(settings)
    db_session.commit()
    return test_user


@pytest.fixture
def client(db_session):
    """Create a TestClient for the real FastAPI app with DB override."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Don't close the session - let the fixture handle it

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers for the test user."""
    return {"X-User-ID": test_user.id}


@pytest.fixture
def premium_subscription(db_session, test_user):
    """Create a premium subscription for the test user."""
    subscription = models.Subscription(
        user_id=test_user.id,
        status="active",
        plan_type="monthly",
        is_lifetime=False
    )
    db_session.add(subscription)
    db_session.commit()
    return subscription
