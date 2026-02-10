#!/usr/bin/env python3
"""
Quick startup test - validates scheduler integration.
"""

import sys
import os
from dotenv import load_dotenv

# Load environment
load_dotenv('.env')

print("=" * 70)
print("  Backend Startup Test")
print("=" * 70)

# Test imports
print("\n📦 Testing imports...")
try:
    from app.services.scheduler_service import initialize_scheduler
    from app.jobs.tink_sync_job import sync_all_tink_connections
    from app.services.tink_sync_service import sync_tink_connection
    print("✅ All modules import successfully")
except Exception as e:
    print(f"❌ Import error: {e}")
    sys.exit(1)

# Test scheduler initialization
print("\n⚙️  Testing scheduler initialization...")
try:
    scheduler = initialize_scheduler()
    if scheduler:
        print(f"✅ Scheduler initialized: {type(scheduler).__name__}")
        print(f"   State: {scheduler.state}")

        # Check jobstores
        print(f"   Job stores: {list(scheduler._jobstores.keys())}")
        print(f"   Executors: {list(scheduler._executors.keys())}")
    else:
        print("⚠️  Scheduler is disabled (SCHEDULER_ENABLED=false)")
except Exception as e:
    print(f"❌ Scheduler error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test configuration
print("\n🔧 Configuration:")
print(f"   SCHEDULER_ENABLED: {os.getenv('SCHEDULER_ENABLED', 'not set')}")
print(f"   TINK_SYNC_INTERVAL_HOURS: {os.getenv('TINK_SYNC_INTERVAL_HOURS', 'not set')}")
print(f"   POSTGRES_HOST: {os.getenv('POSTGRES_HOST', 'not set')}")

print("\n" + "=" * 70)
print("✅ All startup checks passed!")
print("=" * 70)
print("\n💡 To start the backend:")
print("   uvicorn app.main:app --reload --host 0.0.0.0 --port 8100")
