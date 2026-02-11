"""
Scheduler Service

Manages APScheduler for background jobs like Tink transaction syncing.
"""

import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)

# Global scheduler instance
_scheduler: AsyncIOScheduler | None = None


def get_scheduler() -> AsyncIOScheduler:
    """
    Get or create the global scheduler instance.

    Returns:
        AsyncIOScheduler: The scheduler instance
    """
    global _scheduler

    if _scheduler is None:
        raise RuntimeError("Scheduler not initialized. Call init_scheduler() first.")

    return _scheduler


def init_scheduler(database_url: str) -> AsyncIOScheduler:
    """
    Initialize the APScheduler with SQLAlchemy job store.

    Args:
        database_url: Database connection URL for job store

    Returns:
        AsyncIOScheduler: Initialized scheduler instance
    """
    global _scheduler

    if _scheduler is not None:
        logger.warning("Scheduler already initialized")
        return _scheduler

    # Configure job store (SQLAlchemy for persistence)
    jobstores = {
        'default': SQLAlchemyJobStore(url=database_url, tablename='apscheduler_jobs')
    }

    # Configure executors
    executors = {
        'default': AsyncIOExecutor()
    }

    # Job defaults
    job_defaults = {
        'coalesce': True,  # Combine missed runs into one
        'max_instances': 1,  # Only one instance of each job at a time
        'misfire_grace_time': 3600  # 1 hour grace period for missed jobs
    }

    # Create scheduler
    _scheduler = AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone='UTC'
    )

    logger.info("Scheduler initialized with SQLAlchemy job store")
    return _scheduler


def start_scheduler():
    """Start the scheduler if not already running."""
    scheduler = get_scheduler()

    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler started")
    else:
        logger.warning("Scheduler already running")


def shutdown_scheduler(wait: bool = True):
    """Shutdown the scheduler gracefully."""
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=wait)
        logger.info("Scheduler shut down")
        _scheduler = None


def initialize_scheduler():
    """
    Initialize scheduler with database URL from environment.

    This is a convenience wrapper that reads POSTGRES_* variables from environment
    and calls init_scheduler().

    Returns:
        AsyncIOScheduler or None if SCHEDULER_ENABLED=false
    """
    # Check if scheduler is enabled
    scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"

    if not scheduler_enabled:
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return None

    # Construct database URL from POSTGRES_* environment variables (same as database.py)
    postgres_user = os.getenv("POSTGRES_USER", "homebudget")
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB", "homebudget")

    if not postgres_password:
        logger.error("POSTGRES_PASSWORD not set, cannot initialize scheduler")
        return None

    database_url = f"postgresql://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"

    # Initialize and return
    return init_scheduler(database_url)


def add_job(func, trigger, **kwargs):
    """
    Add a job to the scheduler.

    Args:
        func: The function to execute
        trigger: Trigger type ('interval', 'cron', 'date')
        **kwargs: Additional arguments passed to scheduler.add_job()
    """
    scheduler = get_scheduler()
    return scheduler.add_job(func, trigger, **kwargs)
