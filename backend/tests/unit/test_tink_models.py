"""
Unit tests for Tink database models.

Tests cover:
1. TinkConnection model
2. TinkPendingAuth model
3. TinkAuditLog model
"""

import pytest
from datetime import datetime, timedelta
import sys
import os

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User, TinkConnection, TinkPendingAuth, TinkAuditLog


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def test_engine():
    """Create a test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
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


@pytest.fixture
def db_session(test_engine):
    """Create a new database session for each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        id="test-user-id",
        email="test@example.com",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


# =============================================================================
# TinkConnection Model Tests
# =============================================================================

class TestTinkConnectionModel:
    """Tests for TinkConnection model."""

    def test_creating_connection_with_required_fields(self, db_session, test_user):
        """Test creating a TinkConnection with all required fields."""
        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="hb2_abc123def456789012345678901234",
            access_token="test_access_token_12345",
            refresh_token="test_refresh_token_67890",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            accounts=["acc-1", "acc-2"],
            account_details={
                "acc-1": {"name": "Main Account", "iban": "PL12345678901234567890123456", "currency": "PLN"},
                "acc-2": {"name": "Savings", "iban": None, "currency": "PLN"},
            },
            is_active=True,
        )

        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        assert connection.id is not None
        assert connection.user_id == test_user.id
        assert connection.tink_user_id == "hb2_abc123def456789012345678901234"
        assert connection.access_token == "test_access_token_12345"
        assert connection.is_active is True
        assert connection.created_at is not None

    def test_unique_constraint_on_tink_user_id(self, db_session, test_user):
        """Test that tink_user_id has a unique constraint."""
        connection1 = TinkConnection(
            user_id=test_user.id,
            tink_user_id="unique_tink_user_id",
            access_token="token1",
            refresh_token="refresh1",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            is_active=True,
        )
        db_session.add(connection1)
        db_session.commit()

        # Try to create another connection with the same tink_user_id
        connection2 = TinkConnection(
            user_id=test_user.id,
            tink_user_id="unique_tink_user_id",  # Same ID - should fail
            access_token="token2",
            refresh_token="refresh2",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            is_active=True,
        )
        db_session.add(connection2)

        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()

    def test_json_fields_store_and_retrieve(self, db_session, test_user):
        """Test that JSON fields (accounts, account_details) store and retrieve correctly."""
        accounts_list = ["account-id-1", "account-id-2", "account-id-3"]
        account_details = {
            "account-id-1": {
                "name": "Konto Główne",  # Polish characters
                "iban": "PL12345678901234567890123456",
                "currency": "PLN",
                "type": "CHECKING",
            },
            "account-id-2": {
                "name": "Oszczędności",  # Polish characters
                "iban": None,
                "currency": "PLN",
                "type": "SAVINGS",
            },
        }

        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="tink_user_json_test",
            access_token="token",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            accounts=accounts_list,
            account_details=account_details,
            is_active=True,
        )
        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        # Verify JSON fields
        assert connection.accounts == accounts_list
        assert len(connection.accounts) == 3
        assert connection.account_details == account_details
        assert connection.account_details["account-id-1"]["name"] == "Konto Główne"
        assert connection.account_details["account-id-2"]["name"] == "Oszczędności"

    def test_relationship_to_user(self, db_session, test_user):
        """Test relationship to User model."""
        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="tink_user_relationship_test",
            access_token="token",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            is_active=True,
        )
        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        # Verify relationship
        assert connection.user_id == test_user.id
        assert connection.user.email == test_user.email


# =============================================================================
# TinkPendingAuth Model Tests
# =============================================================================

class TestTinkPendingAuthModel:
    """Tests for TinkPendingAuth model."""

    def test_creating_pending_auth_with_required_fields(self, db_session, test_user):
        """Test creating a TinkPendingAuth with required fields."""
        pending = TinkPendingAuth(
            state_token="unique_state_token_123",
            user_id=test_user.id,
            tink_user_id="external_user_id",
            authorization_code="auth_code_abc",
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            used=False,
        )

        db_session.add(pending)
        db_session.commit()
        db_session.refresh(pending)

        assert pending.id is not None
        assert pending.state_token == "unique_state_token_123"
        assert pending.user_id == test_user.id
        assert pending.used is False
        assert pending.created_at is not None

    def test_unique_constraint_on_state_token(self, db_session, test_user):
        """Test that state_token has a unique constraint."""
        pending1 = TinkPendingAuth(
            state_token="duplicate_state_token",
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
        db_session.add(pending1)
        db_session.commit()

        pending2 = TinkPendingAuth(
            state_token="duplicate_state_token",  # Same token - should fail
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
        )
        db_session.add(pending2)

        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()

    def test_expiration_time_is_set_correctly(self, db_session, test_user):
        """Test that expiration time is set correctly."""
        now = datetime.utcnow()
        expires_at = now + timedelta(minutes=15)

        pending = TinkPendingAuth(
            state_token="expiration_test_token",
            user_id=test_user.id,
            expires_at=expires_at,
        )
        db_session.add(pending)
        db_session.commit()
        db_session.refresh(pending)

        # Verify expiration is approximately 15 minutes from now
        assert pending.expires_at is not None
        # Allow 1 second tolerance for execution time
        assert abs((pending.expires_at - expires_at).total_seconds()) < 1

    def test_optional_fields_can_be_none(self, db_session, test_user):
        """Test that optional fields (tink_user_id, authorization_code) can be None."""
        pending = TinkPendingAuth(
            state_token="minimal_token",
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            # tink_user_id and authorization_code not set
        )
        db_session.add(pending)
        db_session.commit()
        db_session.refresh(pending)

        assert pending.tink_user_id is None
        assert pending.authorization_code is None


# =============================================================================
# TinkAuditLog Model Tests
# =============================================================================

class TestTinkAuditLogModel:
    """Tests for TinkAuditLog model."""

    def test_creating_audit_log_entry(self, db_session, test_user):
        """Test creating an audit log entry."""
        log = TinkAuditLog(
            user_id=test_user.id,
            action_type="connection_created",
            result="success",
            request_method="POST",
            request_path="/banking/tink/callback",
            status_code=200,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 (Test)",
            details={"account_count": 2},
        )

        db_session.add(log)
        db_session.commit()
        db_session.refresh(log)

        assert log.id is not None
        assert log.user_id == test_user.id
        assert log.action_type == "connection_created"
        assert log.result == "success"
        assert log.created_at is not None

    def test_json_field_stores_sanitized_data(self, db_session, test_user):
        """Test that JSON field (details) stores sanitized data."""
        details = {
            "account_count": 3,
            "error_category": None,
            "security_flag": False,
        }

        log = TinkAuditLog(
            user_id=test_user.id,
            action_type="data_refreshed",
            result="success",
            details=details,
        )

        db_session.add(log)
        db_session.commit()
        db_session.refresh(log)

        assert log.details == details
        assert log.details["account_count"] == 3

    def test_audit_log_without_user_id(self, db_session):
        """Test creating audit log without user_id (anonymous callback)."""
        log = TinkAuditLog(
            user_id=None,  # Anonymous
            action_type="callback_received",
            result="failure",
            request_method="GET",
            request_path="/banking/tink/callback",
            ip_address="10.0.0.1",
        )

        db_session.add(log)
        db_session.commit()
        db_session.refresh(log)

        assert log.id is not None
        assert log.user_id is None

    def test_all_action_types_can_be_stored(self, db_session, test_user):
        """Test that all documented action types can be stored."""
        action_types = [
            "connect_initiated",
            "connection_created",
            "connection_failed",
            "connection_disconnected",
            "token_refreshed",
            "transactions_synced",
            "transaction_reviewed",
            "debug_access",
            "data_refreshed",
        ]

        for action_type in action_types:
            log = TinkAuditLog(
                user_id=test_user.id,
                action_type=action_type,
                result="success",
            )
            db_session.add(log)

        db_session.commit()

        # Verify all were stored
        logs = db_session.query(TinkAuditLog).filter(
            TinkAuditLog.user_id == test_user.id
        ).all()

        stored_types = {log.action_type for log in logs}
        assert stored_types == set(action_types)

    def test_result_values(self, db_session, test_user):
        """Test that all valid result values can be stored."""
        results = ["success", "failure", "partial"]

        for result in results:
            log = TinkAuditLog(
                user_id=test_user.id,
                action_type="test_action",
                result=result,
            )
            db_session.add(log)

        db_session.commit()


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestTinkModelsEdgeCases:
    """Edge case tests for Tink models."""

    def test_empty_account_list(self, db_session, test_user):
        """Test handling of empty account list."""
        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="empty_accounts_user",
            access_token="token",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            accounts=[],  # Empty list
            account_details={},  # Empty dict
            is_active=True,
        )

        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        assert connection.accounts == []
        assert connection.account_details == {}

    def test_unicode_in_account_names(self, db_session, test_user):
        """Test that Polish characters in account names are preserved."""
        account_details = {
            "acc-1": {"name": "Konto Główne ąęśćżźółń", "currency": "PLN"},
            "acc-2": {"name": "Oszczędności żółć", "currency": "PLN"},
        }

        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="unicode_test_user",
            access_token="token",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            account_details=account_details,
            is_active=True,
        )

        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        # Verify Polish characters are preserved
        assert "ąęśćżźółń" in connection.account_details["acc-1"]["name"]
        assert "żółć" in connection.account_details["acc-2"]["name"]

    def test_long_token_values(self, db_session, test_user):
        """Test handling of long token values."""
        # Simulate a long JWT-like token
        long_token = "eyJ" + "a" * 2000 + ".signature"

        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="long_token_user",
            access_token=long_token,
            refresh_token=long_token,
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            is_active=True,
        )

        db_session.add(connection)
        db_session.commit()
        db_session.refresh(connection)

        assert len(connection.access_token) > 2000

    def test_soft_delete_connection(self, db_session, test_user):
        """Test soft delete (is_active = False) of connection."""
        connection = TinkConnection(
            user_id=test_user.id,
            tink_user_id="soft_delete_user",
            access_token="token",
            refresh_token="refresh",
            token_expires_at=datetime.utcnow() + timedelta(hours=2),
            is_active=True,
        )

        db_session.add(connection)
        db_session.commit()

        # Soft delete
        connection.is_active = False
        db_session.commit()
        db_session.refresh(connection)

        assert connection.is_active is False
        # Record still exists
        assert connection.id is not None
