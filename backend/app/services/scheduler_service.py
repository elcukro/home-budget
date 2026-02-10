"""
APScheduler Service

Manages background job scheduling using APScheduler with SQLAlchemy persistence.

This service:
- Initializes APScheduler with SQLite job store (same DB as main app)
- Provides centralized scheduler instance for the FastAPI app
- Handles graceful startup and shutdown
- Supports feature flag control via SCHEDULER_ENABLED env var
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.pool import ThreadPoolExecutor
import logging
import os

from ..database import SQLALCHEMY_DATABASE_URL
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)

# Global scheduler instance
_scheduler: AsyncIOScheduler = None


def get_scheduler() -> AsyncIOScheduler:
    """
    Get the global scheduler instance.

    Returns:
        AsyncIOScheduler: The scheduler instance

    Raises:
        RuntimeError: If scheduler hasn't been initialized
    """
    global _scheduler
    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized. Call initialize_scheduler() first.")
    return _scheduler


def initialize_scheduler() -> AsyncIOScheduler:
    """
    Initialize APScheduler with SQLAlchemy job store.

    Configuration:
    - Job store: SQLite database (same as main app)
    - Executor: ThreadPoolExecutor with 10 workers
    - Coalesce: Combine multiple pending executions into one
    - Max instances: 1 (prevent job overlap)

    Returns:
        AsyncIOScheduler: Initialized scheduler instance

    Environment Variables:
        SCHEDULER_ENABLED: Feature flag (default: true)
    """
    global _scheduler

    # Check feature flag
    enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    if not enabled:
        logger.info("Scheduler is disabled (SCHEDULER_ENABLED=false)")
        return None

    if _scheduler is not None:
        logger.warning("Scheduler already initialized")
        return _scheduler

    # Configure job store (SQLite database)
    jobstores = {
        'default': SQLAlchemyJobStore(url=SQLALCHEMY_DATABASE_URL)
    }

    # Configure executor (thread pool for background jobs)
    executors = {
        'default': ThreadPoolExecutor(max_workers=10)
    }

    # Job defaults
    job_defaults = {
        'coalesce': True,  # Combine multiple pending executions into one
        'max_instances': 1,  # Prevent job overlap
        'misfire_grace_time': 300,  # 5 minutes grace period for missed jobs
    }

    # Create scheduler
    _scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone='UTC'
    )

    logger.info("Scheduler initialized successfully")
    return _scheduler


def start_scheduler():
    """
    Start the scheduler.

    This should be called during FastAPI app startup.
    """
    global _scheduler
    if _scheduler is None:
        logger.warning("Cannot start scheduler: not initialized")
        return

    if _scheduler.running:
        logger.warning("Scheduler is already running")
        return

    _scheduler.start()
    logger.info("Scheduler started")


def shutdown_scheduler(wait: bool = True):
    """
    Shut down the scheduler gracefully.

    This should be called during FastAPI app shutdown.

    Args:
        wait: If True, wait for all jobs to complete before shutting down
    """
    global _scheduler
    if _scheduler is None:
        return

    if not _scheduler.running:
        logger.warning("Scheduler is not running")
        return

    _scheduler.shutdown(wait=wait)
    logger.info("Scheduler shut down")
    _scheduler = None


def add_job(func, trigger, **kwargs):
    """
    Add a job to the scheduler.

    Args:
        func: The function to execute
        trigger: Trigger type ('interval', 'cron', 'date')
        **kwargs: Additional job configuration (id, args, etc.)

    Returns:
        Job: The scheduled job instance
    """
    scheduler = get_scheduler()
    job = scheduler.add_job(func, trigger, **kwargs)
    logger.info(f"Job added: {job.id} with trigger {trigger}")
    return job


def list_jobs():
    """
    List all scheduled jobs.

    Returns:
        list: List of Job objects
    """
    scheduler = get_scheduler()
    return scheduler.get_jobs()


def get_job(job_id: str):
    """
    Get a specific job by ID.

    Args:
        job_id: The job ID

    Returns:
        Job: The job instance, or None if not found
    """
    scheduler = get_scheduler()
    return scheduler.get_job(job_id)


def remove_job(job_id: str):
    """
    Remove a job from the scheduler.

    Args:
        job_id: The job ID to remove
    """
    scheduler = get_scheduler()
    scheduler.remove_job(job_id)
    logger.info(f"Job removed: {job_id}")
