"""
Unit Tests for Tink Sync Job

Tests the background sync job logic for Tink connections.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from app.jobs.tink_sync_job import sync_all_tink_connections, run_sync_job
from app.models import TinkConnection, User


class TestTinkSyncJob:
    """Test suite for Tink sync job."""

    @pytest.mark.asyncio
    async def test_sync_all_tink_connections_no_connections(self):
        """Test sync job when no connections exist."""
        with patch('app.jobs.tink_sync_job.SessionLocal') as mock_session:
            # Mock empty connection list
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = []
            mock_session.return_value = mock_db

            stats = await sync_all_tink_connections()

            assert stats['total_connections'] == 0
            assert stats['eligible_connections'] == 0
            assert stats['successful_syncs'] == 0
            assert stats['failed_syncs'] == 0

    @pytest.mark.asyncio
    async def test_sync_all_tink_connections_with_eligible(self):
        """Test sync job with eligible connections."""
        with patch('app.jobs.tink_sync_job.SessionLocal') as mock_session, \
             patch('app.jobs.tink_sync_job.SubscriptionService') as mock_subscription, \
             patch('app.jobs.tink_sync_job.sync_tink_connection') as mock_sync:

            # Mock connection
            mock_conn = MagicMock(spec=TinkConnection)
            mock_conn.id = 1
            mock_conn.user_id = "user1"
            mock_conn.is_active = True

            # Mock database
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = [mock_conn]
            mock_session.return_value = mock_db

            # Mock subscription check (eligible)
            mock_subscription.can_use_bank_integration.return_value = (True, "Premium active")

            # Mock successful sync
            mock_sync.return_value = {
                "success": True,
                "accounts_count": 2,
            }

            stats = await sync_all_tink_connections()

            assert stats['total_connections'] == 1
            assert stats['eligible_connections'] == 1
            assert stats['successful_syncs'] == 1
            assert stats['failed_syncs'] == 0

    @pytest.mark.asyncio
    async def test_sync_all_tink_connections_no_subscription(self):
        """Test sync job skips connections without subscriptions."""
        with patch('app.jobs.tink_sync_job.SessionLocal') as mock_session, \
             patch('app.jobs.tink_sync_job.SubscriptionService') as mock_subscription:

            # Mock connection
            mock_conn = MagicMock(spec=TinkConnection)
            mock_conn.id = 1
            mock_conn.user_id = "user1"

            # Mock database
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = [mock_conn]
            mock_session.return_value = mock_db

            # Mock subscription check (not eligible)
            mock_subscription.can_use_bank_integration.return_value = (
                False,
                "No active subscription"
            )

            stats = await sync_all_tink_connections()

            assert stats['total_connections'] == 1
            assert stats['eligible_connections'] == 0
            assert stats['skipped_no_subscription'] == 1

    @pytest.mark.asyncio
    async def test_sync_all_tink_connections_error_isolation(self):
        """Test that errors in one connection don't stop others."""
        with patch('app.jobs.tink_sync_job.SessionLocal') as mock_session, \
             patch('app.jobs.tink_sync_job.SubscriptionService') as mock_subscription, \
             patch('app.jobs.tink_sync_job.sync_tink_connection') as mock_sync, \
             patch('app.jobs.tink_sync_job.asyncio.sleep'):  # Skip delays in tests

            # Mock two connections
            mock_conn1 = MagicMock(spec=TinkConnection)
            mock_conn1.id = 1
            mock_conn1.user_id = "user1"

            mock_conn2 = MagicMock(spec=TinkConnection)
            mock_conn2.id = 2
            mock_conn2.user_id = "user2"

            # Mock database
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = [
                mock_conn1,
                mock_conn2,
            ]
            mock_session.return_value = mock_db

            # Both eligible
            mock_subscription.can_use_bank_integration.return_value = (True, "Premium active")

            # First sync fails, second succeeds
            mock_sync.side_effect = [
                Exception("Token expired"),
                {"success": True, "accounts_count": 2},
            ]

            stats = await sync_all_tink_connections()

            # Both should be attempted
            assert stats['eligible_connections'] == 2
            assert stats['successful_syncs'] == 1
            assert stats['failed_syncs'] == 1
            assert len(stats['errors']) == 1

    @pytest.mark.asyncio
    async def test_sync_all_tink_connections_db_cleanup(self):
        """Test that database session is always closed."""
        with patch('app.jobs.tink_sync_job.SessionLocal') as mock_session:
            # Mock database
            mock_db = MagicMock()
            mock_db.query.return_value.filter.return_value.all.return_value = []
            mock_session.return_value = mock_db

            await sync_all_tink_connections()

            # Verify db.close() was called
            mock_db.close.assert_called_once()

    def test_run_sync_job_wrapper(self):
        """Test the synchronous wrapper for APScheduler."""
        with patch('app.jobs.tink_sync_job.asyncio.run') as mock_run:
            run_sync_job()

            # Verify asyncio.run was called
            mock_run.assert_called_once()

    def test_run_sync_job_handles_exceptions(self):
        """Test that run_sync_job handles exceptions gracefully."""
        with patch('app.jobs.tink_sync_job.asyncio.run') as mock_run:
            # Simulate exception
            mock_run.side_effect = Exception("Test error")

            # Should not raise - just log
            run_sync_job()

            mock_run.assert_called_once()
