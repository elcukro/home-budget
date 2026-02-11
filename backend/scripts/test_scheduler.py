#!/usr/bin/env python3
"""
Manual test script for Tink sync job

Usage:
    python backend/scripts/test_scheduler.py
"""

import sys
import os
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.jobs.tink_sync_job import sync_all_tink_connections


async def main():
    """Run the Tink sync job manually."""
    print("=" * 60)
    print("Testing Tink Sync Job")
    print("=" * 60)
    print()

    print("Starting manual sync...")
    await sync_all_tink_connections()
    print()
    print("=" * 60)
    print("Sync job completed!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
