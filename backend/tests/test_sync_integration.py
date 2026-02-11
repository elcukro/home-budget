"""
Integration Tests for Tink Sync

Tests the full integration between scheduler, sync job, and database.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta
from app.models import Base, TinkConnection, User
from app.services.tink_sync_service import sync_tink_connection


@pytest.fixture
def test_db():
    """Create a test database."""
    # Use in-memory SQLite for tests
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    TestSessionLocal = sessionmaker(bind=engine)
    db = TestSessionLocal()

    yield db

    db.close()


@pytest.fixture
def test_user(test_db):
    """Create a test user."""
    user = User(
        id="test_user_123",
        email="test@example.com",
        name="Test User",
    )
    test_db.add(user)
    test_db.commit()
    return user


@pytest.fixture
def test_connection(test_db, test_user):
    """Create a test Tink connection."""
    connection = TinkConnection(
        user_id=test_user.id,
        tink_user_id="tink_123",
        access_token="test_access_token",
        refresh_token="test_refresh_token",
        token_expires_at=datetime.now() + timedelta(hours=1),
        is_active=True,
        accounts=["acc1", "acc2"],
        account_details={
            "acc1": {
                "name": "Checking Account",
                "iban": "PL12345678901234567890123456",
                "currency": "PLN",
                "type": "CHECKING",
            },
            "acc2": {
                "name": "Savings Account",
                "iban": "PL98765432109876543210987654",
                "currency": "PLN",
                "type": "SAVINGS",
            },
        },
    )
    test_db.add(connection)
    test_db.commit()
    return connection


class TestSyncIntegration:
    """Integration test suite for sync functionality."""

    @pytest.mark.asyncio
    async def test_sync_tink_connection_updates_timestamp(self, test_db, test_connection):
        """Test that sync updates last_sync_at timestamp."""
        from unittest.mock import AsyncMock, patch

        # Mock tink_service methods
        with patch('app.services.tink_sync_service.tink_service.get_valid_access_token') as mock_token, \
             patch('app.services.tink_sync_service.tink_service.fetch_accounts') as mock_fetch:

            mock_token.return_value = "valid_token"
            mock_fetch.return_value = [
                {
                    "id": "acc1",
                    "name": "Updated Checking",
                    "identifiers": {"iban": {"iban": "PL12345678901234567890123456"}},
                    "balances": {"booked": {"amount": {"currencyCode": "PLN"}}},
                    "type": "CHECKING",
                }
            ]

            initial_sync_at = test_connection.last_sync_at

            result = await sync_tink_connection(test_connection, test_db)

            assert result["success"] is True
            assert test_connection.last_sync_at != initial_sync_at
            assert test_connection.last_sync_at is not None

    @pytest.mark.asyncio
    async def test_sync_tink_connection_updates_accounts(self, test_db, test_connection):
        """Test that sync updates account data."""
        from unittest.mock import patch

        with patch('app.services.tink_sync_service.tink_service.get_valid_access_token') as mock_token, \
             patch('app.services.tink_sync_service.tink_service.fetch_accounts') as mock_fetch:

            mock_token.return_value = "valid_token"
            mock_fetch.return_value = [
                {
                    "id": "acc1",
                    "name": "Updated Checking",
                    "identifiers": {"iban": {"iban": "PL11111111111111111111111111"}},
                    "balances": {"booked": {"amount": {"currencyCode": "PLN"}}},
                    "type": "CHECKING",
                },
                {
                    "id": "acc3",
                    "name": "New Account",
                    "identifiers": {"iban": {"iban": "PL33333333333333333333333333"}},
                    "balances": {"booked": {"amount": {"currencyCode": "PLN"}}},
                    "type": "SAVINGS",
                },
            ]

            result = await sync_tink_connection(test_connection, test_db)

            assert result["success"] is True
            assert result["accounts_count"] == 2

            # Check updated accounts
            assert "acc1" in test_connection.accounts
            assert "acc3" in test_connection.accounts

            # Check account details
            assert test_connection.account_details["acc1"]["name"] == "Updated Checking"
            assert test_connection.account_details["acc3"]["name"] == "New Account"

    @pytest.mark.asyncio
    async def test_sync_tink_connection_handles_errors(self, test_db, test_connection):
        """Test that sync handles errors gracefully."""
        from unittest.mock import patch

        with patch('app.services.tink_sync_service.tink_service.get_valid_access_token') as mock_token:
            # Simulate token error
            mock_token.side_effect = Exception("Token refresh failed")

            with pytest.raises(Exception, match="Token refresh failed"):
                await sync_tink_connection(test_connection, test_db)

    @pytest.mark.asyncio
    async def test_sync_without_http_request_no_audit(self, test_db, test_connection):
        """Test that sync without http_request doesn't create audit logs."""
        from unittest.mock import patch

        with patch('app.routers.tink.tink_service.get_valid_access_token') as mock_token, \
             patch('app.routers.tink.tink_service.fetch_accounts') as mock_fetch, \
             patch('app.services.tink_sync_service.audit_data_refreshed') as mock_audit:

            mock_token.return_value = "valid_token"
            mock_fetch.return_value = []

            # Sync without http_request (background job scenario)
            result = await sync_tink_connection(test_connection, test_db, http_request=None)

            assert result["success"] is True

            # audit_data_refreshed should NOT be called
            mock_audit.assert_not_called()
