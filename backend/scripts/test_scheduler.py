#!/usr/bin/env python3
"""
Manual Scheduler Test Script

This script manually triggers the Tink sync job without waiting for the
scheduler's interval. Useful for:
- Testing the sync job logic
- Verifying job execution
- Debugging issues
- Validating rate limiting and error handling

Usage:
    cd backend
    source venv/bin/activate  # if using virtualenv
    python scripts/test_scheduler.py

The script will:
1. Initialize the database session
2. Run the sync job manually
3. Display results and statistics
"""

import sys
import os
from pathlib import Path

# Add project root to Python path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# Load environment variables
from dotenv import load_dotenv
env_file = backend_dir / ".env"
if env_file.exists():
    load_dotenv(env_file)
else:
    print(f"Warning: {env_file} not found, using existing environment variables")

import asyncio
from datetime import datetime
from app.jobs.tink_sync_job import sync_all_tink_connections
from app.database import SessionLocal
from app.models import TinkConnection, User
from app.services.subscription_service import SubscriptionService


def print_header(text: str):
    """Print a formatted header."""
    print("\n" + "=" * 70)
    print(f"  {text}")
    print("=" * 70)


def print_section(text: str):
    """Print a formatted section."""
    print(f"\n--- {text} ---")


async def main():
    """Main test function."""
    print_header("Tink Scheduler Test Script")
    print(f"Started at: {datetime.now().isoformat()}")

    # Check environment
    print_section("Environment Check")
    scheduler_enabled = os.getenv("SCHEDULER_ENABLED", "true").lower() == "true"
    sync_interval = os.getenv("TINK_SYNC_INTERVAL_HOURS", "6")

    print(f"SCHEDULER_ENABLED: {scheduler_enabled}")
    print(f"TINK_SYNC_INTERVAL_HOURS: {sync_interval}")

    if not scheduler_enabled:
        print("\n⚠️  WARNING: Scheduler is disabled in .env")
        print("Set SCHEDULER_ENABLED=true to enable scheduler in production")

    # Check database connections
    print_section("Database Connections")
    db = SessionLocal()
    try:
        # Count active connections
        total_connections = db.query(TinkConnection).filter(
            TinkConnection.is_active == True
        ).count()

        print(f"Total active Tink connections: {total_connections}")

        if total_connections == 0:
            print("\n⚠️  No active Tink connections found!")
            print("Create a connection via the UI first to test sync.")
            return

        # Check which users have premium subscriptions
        connections = db.query(TinkConnection).filter(
            TinkConnection.is_active == True
        ).all()

        eligible_count = 0
        for conn in connections:
            can_use, message = SubscriptionService.can_use_bank_integration(
                conn.user_id,
                db
            )
            if can_use:
                eligible_count += 1

        print(f"Connections with premium subscription: {eligible_count}/{total_connections}")

        if eligible_count == 0:
            print("\n⚠️  No connections with premium subscriptions!")
            print("Users need premium subscription for automatic sync.")

    finally:
        db.close()

    # Run the sync job
    print_section("Running Sync Job")
    print("Executing sync_all_tink_connections()...")
    print("(This may take a few minutes depending on connection count)")

    start_time = datetime.now()

    try:
        stats = await sync_all_tink_connections()
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return

    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()

    # Display results
    print_section("Results")
    print(f"Duration: {duration:.2f} seconds")
    print(f"\nTotal connections found: {stats['total_connections']}")
    print(f"Eligible for sync: {stats['eligible_connections']}")
    print(f"Skipped (no subscription): {stats['skipped_no_subscription']}")
    print(f"\nSuccessful syncs: {stats['successful_syncs']} ✅")
    print(f"Failed syncs: {stats['failed_syncs']} ❌")

    # Display errors if any
    if stats['errors']:
        print_section("Errors")
        for error in stats['errors']:
            print(f"\nConnection ID: {error['connection_id']}")
            print(f"User ID: {error['user_id']}")
            print(f"Error: {error['error']}")

    # Success summary
    print_section("Summary")
    if stats['failed_syncs'] == 0 and stats['successful_syncs'] > 0:
        print("✅ All syncs completed successfully!")
    elif stats['failed_syncs'] > 0:
        print(f"⚠️  {stats['failed_syncs']} sync(s) failed - check errors above")
    elif stats['eligible_connections'] == 0:
        print("ℹ️  No connections eligible for sync (no premium subscriptions)")
    else:
        print("ℹ️  No connections found to sync")

    print_header("Test Complete")
    print(f"Finished at: {datetime.now().isoformat()}")


if __name__ == "__main__":
    asyncio.run(main())
