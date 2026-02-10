"""
Unit Tests for Scheduler Service

Tests the APScheduler service initialization, configuration, and lifecycle.
"""

import pytest
import os
from unittest.mock import patch, MagicMock, PropertyMock
from app.services.scheduler_service import (
    initialize_scheduler,
    start_scheduler,
    shutdown_scheduler,
    get_scheduler,
    add_job,
    list_jobs,
    get_job,
    remove_job,
)


class TestSchedulerService:
    """Test suite for scheduler service."""

    def setup_method(self):
        """Reset scheduler before each test."""
        # Import the internal _scheduler and reset it
        import app.services.scheduler_service as svc
        svc._scheduler = None

    def teardown_method(self):
        """Clean up after each test."""
        try:
            shutdown_scheduler(wait=False)
        except Exception:
            pass

    def test_initialize_scheduler_enabled(self):
        """Test scheduler initialization when enabled."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            scheduler = initialize_scheduler()

            assert scheduler is not None
            assert scheduler.state == 0  # STATE_STOPPED

    def test_initialize_scheduler_disabled(self):
        """Test scheduler initialization when disabled."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "false"}):
            scheduler = initialize_scheduler()

            assert scheduler is None

    def test_initialize_scheduler_twice(self):
        """Test that initializing scheduler twice returns same instance."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            scheduler1 = initialize_scheduler()
            scheduler2 = initialize_scheduler()

            assert scheduler1 is scheduler2

    def test_get_scheduler_before_init(self):
        """Test that get_scheduler raises error before initialization."""
        with pytest.raises(RuntimeError, match="Scheduler not initialized"):
            get_scheduler()

    def test_get_scheduler_after_init(self):
        """Test that get_scheduler returns initialized scheduler."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()
            scheduler = get_scheduler()

            assert scheduler is not None

    def test_start_scheduler(self):
        """Test starting the scheduler."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            # Mock the start method since AsyncIOScheduler needs an event loop
            scheduler = get_scheduler()
            with patch.object(scheduler, 'start') as mock_start:
                start_scheduler()
                mock_start.assert_called_once()

    def test_start_scheduler_twice(self):
        """Test that starting scheduler twice is safe."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            scheduler = get_scheduler()
            with patch.object(scheduler, 'start') as mock_start:
                # Mock running property
                with patch.object(type(scheduler), 'running', new_callable=PropertyMock) as mock_running:
                    mock_running.return_value = False
                    start_scheduler()

                    # Mock running=True for second call
                    mock_running.return_value = True
                    start_scheduler()  # Should not raise error

                # Start should only be called once
                assert mock_start.call_count == 1

    def test_shutdown_scheduler(self):
        """Test shutting down the scheduler."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            scheduler = get_scheduler()
            with patch.object(scheduler, 'start'), \
                 patch.object(scheduler, 'shutdown') as mock_shutdown, \
                 patch.object(type(scheduler), 'running', new_callable=PropertyMock) as mock_running:

                mock_running.return_value = True
                start_scheduler()
                shutdown_scheduler(wait=False)

                mock_shutdown.assert_called_once_with(wait=False)

            # After shutdown, scheduler should be None
            with pytest.raises(RuntimeError):
                get_scheduler()

    def test_add_job(self):
        """Test adding a job to the scheduler."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            def dummy_job():
                pass

            job = add_job(dummy_job, 'interval', seconds=60, id='test_job')

            assert job is not None
            assert job.id == 'test_job'

    def test_list_jobs(self):
        """Test listing all jobs."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            def dummy_job():
                pass

            add_job(dummy_job, 'interval', seconds=60, id='job1')
            add_job(dummy_job, 'interval', seconds=120, id='job2')

            jobs = list_jobs()
            assert len(jobs) == 2

    def test_get_job(self):
        """Test getting a specific job."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            def dummy_job():
                pass

            add_job(dummy_job, 'interval', seconds=60, id='test_job')

            job = get_job('test_job')
            assert job is not None
            assert job.id == 'test_job'

    def test_get_nonexistent_job(self):
        """Test getting a job that doesn't exist."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            job = get_job('nonexistent')
            assert job is None

    def test_remove_job(self):
        """Test removing a job."""
        with patch.dict(os.environ, {"SCHEDULER_ENABLED": "true"}):
            initialize_scheduler()

            def dummy_job():
                pass

            add_job(dummy_job, 'interval', seconds=60, id='test_job')

            # Job should exist
            assert get_job('test_job') is not None

            # Remove job
            remove_job('test_job')

            # Job should no longer exist
            assert get_job('test_job') is None
