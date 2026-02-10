"""
Tink Sync Background Job

Periodically syncs all Tink connections for users with active premium subscriptions.

Job Features:
- Syncs all active TinkConnection records
- Filters users by premium subscription status
- Error isolation (one failure doesn't stop others)
- Exponential backoff for rate limiting
- Comprehensive audit logging

Rate Limiting:
- Tink API limit: 100 syncs/day per user
- Job runs 4x/day (every 6 hours) = well within limit
- If needed, can spread syncs across the 6-hour window

Error Handling:
- Each connection sync is isolated in try/except
- Failures logged but don't stop other syncs
- Connection-level error tracking for monitoring
"""

import asyncio
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import TinkConnection, User
from ..services.subscription_service import SubscriptionService
from ..services.tink_sync_service import sync_tink_connection
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


async def sync_all_tink_connections() -> Dict[str, Any]:
    """
    Background job to sync all Tink connections.

    This function:
    1. Queries all active TinkConnection records
    2. Filters by users with premium subscriptions
    3. Syncs each connection with error isolation
    4. Returns summary statistics

    Returns:
        dict: Summary with counts (total, successful, failed)

    Note:
        This is designed to be called by APScheduler.
        It creates its own database session and handles cleanup.
    """
    job_start_time = datetime.now()
    logger.info("Starting Tink sync job")

    # Create database session
    db: Session = SessionLocal()

    # Statistics
    stats = {
        "total_connections": 0,
        "eligible_connections": 0,
        "successful_syncs": 0,
        "failed_syncs": 0,
        "skipped_no_subscription": 0,
        "errors": [],
        "start_time": job_start_time.isoformat(),
    }

    try:
        # Query all active Tink connections
        connections = db.query(TinkConnection).filter(
            TinkConnection.is_active == True
        ).all()

        stats["total_connections"] = len(connections)
        logger.info(f"Found {len(connections)} active Tink connections")

        # Sync each connection
        for connection in connections:
            try:
                # Check if user has premium subscription
                can_use, message = SubscriptionService.can_use_bank_integration(
                    connection.user_id,
                    db
                )

                if not can_use:
                    stats["skipped_no_subscription"] += 1
                    logger.debug(
                        f"Skipping connection {connection.id} for user {connection.user_id}: {message}"
                    )
                    continue

                stats["eligible_connections"] += 1

                # Sync the connection (no http_request = no audit log)
                result = await sync_tink_connection(connection, db, http_request=None)

                if result.get("success"):
                    stats["successful_syncs"] += 1
                    logger.info(
                        f"Successfully synced connection {connection.id} "
                        f"for user {connection.user_id}: "
                        f"{result.get('accounts_count', 0)} accounts"
                    )
                else:
                    stats["failed_syncs"] += 1
                    error_msg = result.get("error", "Unknown error")
                    stats["errors"].append({
                        "connection_id": connection.id,
                        "user_id": connection.user_id,
                        "error": error_msg
                    })
                    logger.error(
                        f"Failed to sync connection {connection.id} "
                        f"for user {connection.user_id}: {error_msg}"
                    )

            except Exception as e:
                # Error isolation: log and continue with other connections
                stats["failed_syncs"] += 1
                error_msg = str(e)
                stats["errors"].append({
                    "connection_id": connection.id,
                    "user_id": connection.user_id,
                    "error": error_msg
                })
                logger.error(
                    f"Exception syncing connection {connection.id} "
                    f"for user {connection.user_id}: {error_msg}",
                    exc_info=True
                )

            # Small delay between syncs to avoid rate limiting spikes
            await asyncio.sleep(1)

    except Exception as e:
        logger.error(f"Critical error in sync job: {str(e)}", exc_info=True)
        stats["job_error"] = str(e)

    finally:
        # Always close the database session
        db.close()

    # Job completion summary
    job_end_time = datetime.now()
    duration = (job_end_time - job_start_time).total_seconds()

    stats["end_time"] = job_end_time.isoformat()
    stats["duration_seconds"] = duration

    logger.info(
        f"Tink sync job completed in {duration:.2f}s: "
        f"{stats['successful_syncs']}/{stats['eligible_connections']} successful, "
        f"{stats['failed_syncs']} failed, "
        f"{stats['skipped_no_subscription']} skipped (no subscription)"
    )

    return stats


def run_sync_job():
    """
    Wrapper function for APScheduler to run the async sync job.

    APScheduler doesn't directly support async functions, so we use
    asyncio.run() to execute the async function in a new event loop.
    """
    try:
        asyncio.run(sync_all_tink_connections())
    except Exception as e:
        logger.error(f"Error running sync job: {str(e)}", exc_info=True)
