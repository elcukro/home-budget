# Tink Background Scheduler - Deployment Guide

## Summary

The Tink background job scheduler has been successfully implemented. This completes the final requirement for Tink certification.

## What Was Implemented

### 1. Core Components

**APScheduler Service** (`app/services/scheduler_service.py`)
- SQLite job persistence (survives app restarts)
- Thread pool executor with 10 workers
- Feature flag support via `SCHEDULER_ENABLED` env var
- Graceful startup and shutdown

**Tink Sync Service** (`app/services/tink_sync_service.py`)
- Reusable sync logic extracted from router
- Used by both API endpoints and background jobs
- Optional audit logging (only for user-initiated syncs)

**Tink Sync Job** (`app/jobs/tink_sync_job.py`)
- Syncs all active Tink connections
- Filters by premium subscription status
- Error isolation (one failure doesn't stop others)
- Comprehensive statistics and logging

**FastAPI Integration** (`app/main.py`)
- Lifespan context manager
- Scheduler initialization on startup
- 6-hour interval job registration
- Graceful shutdown on app exit

### 2. Configuration

Added to `.env`, `.env.sandbox`, and `.env.example`:
```bash
SCHEDULER_ENABLED=true
TINK_SYNC_INTERVAL_HOURS=6
```

### 3. Testing

**Unit Tests:**
- `tests/test_scheduler_service.py` - Scheduler lifecycle
- `tests/test_tink_sync_job.py` - Job logic and error handling
- `tests/test_sync_integration.py` - Integration with database

**Manual Test Script:**
- `scripts/test_scheduler.py` - Trigger sync immediately

## Deployment Steps

### 1. Install Dependencies

```bash
cd backend
source venv/bin/activate  # If using virtualenv
pip install -r requirements.txt
```

APScheduler 3.10.4 was added to `requirements.txt`.

### 2. Configuration

The configuration is already in `.env` files:
- **SCHEDULER_ENABLED**: Set to `false` to disable scheduler
- **TINK_SYNC_INTERVAL_HOURS**: Sync frequency (default: 6 hours)

### 3. Start Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

**Expected logs on startup:**
```
INFO: Starting application...
INFO: Scheduler initialized successfully
INFO: Scheduler started
INFO: Tink sync job scheduled: every 6 hours
```

### 4. Verify Scheduler Status

Check the logs for "Scheduler initialized" message.

**Health check endpoint:**
```bash
curl http://localhost:8000/health
```

### 5. Manual Test (Immediate Sync)

Run the test script to trigger a sync without waiting 6 hours:

```bash
cd backend
source venv/bin/activate
python scripts/test_scheduler.py
```

**Expected output:**
```
======================================================================
  Tink Scheduler Test Script
======================================================================
Started at: 2026-02-10T17:30:00

--- Environment Check ---
SCHEDULER_ENABLED: True
TINK_SYNC_INTERVAL_HOURS: 6

--- Database Connections ---
Total active Tink connections: 2
Connections with premium subscription: 2/2

--- Running Sync Job ---
Executing sync_all_tink_connections()...

--- Results ---
Duration: 3.45 seconds

Total connections found: 2
Eligible for sync: 2
Skipped (no subscription): 0

Successful syncs: 2 ✅
Failed syncs: 0 ❌

--- Summary ---
✅ All syncs completed successfully!

======================================================================
  Test Complete
======================================================================
```

## Verification Checklist

### ✅ Startup Verification

- [ ] Backend starts without errors
- [ ] Log shows "Scheduler initialized successfully"
- [ ] Log shows "Scheduler started"
- [ ] Log shows "Tink sync job scheduled: every 6 hours"

### ✅ Manual Test

- [ ] Run `python scripts/test_scheduler.py`
- [ ] Script completes without errors
- [ ] Connections are synced successfully
- [ ] `last_sync_at` timestamp updated in database

### ✅ Automatic Sync (after 6 hours)

- [ ] Check logs for "Starting Tink sync job"
- [ ] Check logs for sync completion with statistics
- [ ] Verify no errors in logs
- [ ] Check database: `last_sync_at` updated for all connections

### ✅ Feature Flag Test

- [ ] Set `SCHEDULER_ENABLED=false` in `.env`
- [ ] Restart backend
- [ ] Log shows "Scheduler is disabled"
- [ ] No sync jobs run
- [ ] Manual API sync via `/banking/tink/refresh-data` still works

### ✅ Error Isolation Test

To test error isolation:
1. Manually corrupt one connection's token in database
2. Wait for automatic sync or run manual test
3. Verify:
   - [ ] Corrupted connection fails (logged)
   - [ ] Other connections sync successfully
   - [ ] Job completes with statistics showing failures

## Rate Limiting

### Tink API Limits
- **100 syncs/day per user** (Tink API limit)
- **Job runs 4x/day** (every 6 hours)
- Well within limit with buffer for manual syncs

### Rate Limit Handling
- 1-second delay between connection syncs
- Exponential backoff can be added if needed
- Failed syncs logged but don't stop job

## Monitoring

### Log Messages

**Startup:**
```
INFO: Scheduler initialized successfully
INFO: Scheduler started
INFO: Tink sync job scheduled: every 6 hours
```

**Job Execution:**
```
INFO: Starting Tink sync job
INFO: Found 5 active Tink connections
INFO: Successfully synced connection 1 for user user_123: 2 accounts
INFO: Successfully synced connection 2 for user user_456: 3 accounts
INFO: Tink sync job completed in 4.23s: 5/5 successful, 0 failed, 0 skipped (no subscription)
```

**Errors:**
```
ERROR: Exception syncing connection 3 for user user_789: Token expired
ERROR: Failed to sync connection 3 for user user_789: Token expired
```

**Shutdown:**
```
INFO: Shutting down application...
INFO: Scheduler shut down successfully
```

### Database Monitoring

Check `last_sync_at` timestamps in `tink_connections` table:

```sql
SELECT
    id,
    user_id,
    is_active,
    last_sync_at,
    TIMESTAMPDIFF(HOUR, last_sync_at, NOW()) as hours_since_sync
FROM tink_connections
WHERE is_active = TRUE
ORDER BY last_sync_at DESC;
```

## Troubleshooting

### Problem: Scheduler Not Starting

**Symptoms:**
- No "Scheduler initialized" log message
- No scheduled jobs running

**Solutions:**
1. Check `SCHEDULER_ENABLED=true` in `.env`
2. Check for import errors: `python -c "from app.services.scheduler_service import initialize_scheduler"`
3. Check APScheduler installed: `pip show APScheduler`

### Problem: Jobs Not Running

**Symptoms:**
- Scheduler starts but no sync jobs execute
- No "Starting Tink sync job" log messages

**Solutions:**
1. Check job was added: Look for "Tink sync job scheduled" in logs
2. Check job interval: Verify `TINK_SYNC_INTERVAL_HOURS` in `.env`
3. Manual trigger: Run `python scripts/test_scheduler.py`
4. Check scheduler state: Add debug logging in scheduler service

### Problem: Syncs Failing

**Symptoms:**
- "Failed syncs: X" in job logs
- Errors in sync job logs

**Common Causes:**
1. **Expired tokens:** Tink refresh token expired (user needs to reconnect)
2. **No subscription:** User's premium subscription expired
3. **Network issues:** Tink API unreachable
4. **Rate limiting:** Too many requests to Tink API

**Solutions:**
1. Check error messages in logs
2. Verify user subscriptions: `python scripts/check_subscriptions.py` (if exists)
3. Test individual connection: Use `/banking/tink/refresh-data` API endpoint
4. Check Tink API status: https://docs.tink.com/api

### Problem: Database Lock Errors

**Symptoms:**
- "database is locked" errors
- Sync job timeouts

**Solutions:**
1. Reduce concurrent jobs: Set `max_instances=1` in job config (already set)
2. Increase SQLite timeout: Modify `SQLALCHEMY_DATABASE_URL` to include `?timeout=30`
3. Use PostgreSQL in production (recommended)

## Production Deployment

### Server: firedup.app

**Deploy backend:**
```bash
# From local machine
ssh root@firedup.app "cd /opt/home-budget/backend && git pull && sudo systemctl restart home-budget-backend"
```

**Verify deployment:**
```bash
ssh root@firedup.app
journalctl -u home-budget-backend -f | grep -E "Scheduler|Tink sync"
```

**Check first sync:**
Wait for the first automatic sync (6 hours after deployment) and monitor logs:
```bash
ssh root@firedup.app
journalctl -u home-budget-backend --since "6 hours ago" | grep "Tink sync"
```

### Environment Variables

Ensure production `.env` has:
```bash
SCHEDULER_ENABLED=true
TINK_SYNC_INTERVAL_HOURS=6
```

### Database Migration

No database migration needed. APScheduler creates its own tables:
- `apscheduler_jobs` - Job definitions

These are created automatically on first run.

## Rollback Plan

If issues occur in production:

### Option 1: Disable Scheduler (Recommended)

```bash
# SSH to server
ssh root@firedup.app

# Edit .env
cd /opt/home-budget/backend
nano .env
# Set: SCHEDULER_ENABLED=false

# Restart backend
sudo systemctl restart home-budget-backend

# Verify
journalctl -u home-budget-backend -n 50 | grep "Scheduler is disabled"
```

Manual syncs via API will still work.

### Option 2: Full Rollback

```bash
# SSH to server
ssh root@firedup.app
cd /opt/home-budget/backend

# Revert to previous commit
git log --oneline -10  # Find commit before scheduler
git reset --hard <previous-commit-hash>

# Restart backend
sudo systemctl restart home-budget-backend
```

## Testing in Sandbox

Before deploying to production, test in sandbox:

```bash
cd ~/claude/repos/home-budget/backend

# Start backend with sandbox .env
source venv/bin/activate
uvicorn app.main:app --reload

# In another terminal, run manual test
cd ~/claude/repos/home-budget/backend
source venv/bin/activate
python scripts/test_scheduler.py
```

## Post-Deployment Monitoring

### First 48 Hours

Monitor logs every 6 hours (after each automatic sync):
```bash
ssh root@firedup.app
journalctl -u home-budget-backend --since "10 minutes ago" | grep -E "Tink sync|ERROR"
```

### Weekly Monitoring

Check sync statistics weekly:
1. Count successful syncs
2. Count failed syncs
3. Check average sync duration
4. Review error patterns

### Alerts (Optional)

Set up alerts for:
- Sync failure rate > 10%
- No syncs in 12 hours (scheduler stopped)
- Sync duration > 60 seconds (performance issue)

## Success Criteria

✅ Scheduler starts automatically with FastAPI app
✅ Background job syncs all connections every 6 hours
✅ Manual test script triggers job successfully
✅ Audit table shows successful syncs with timestamps
✅ Error in one connection doesn't affect others
✅ Feature flag disables scheduler when needed
✅ All tests pass
✅ **Tink certification technical requirements complete**

## Next Steps

After successful deployment:

1. **Update Documentation:**
   - Mark Tink certification requirements as complete
   - Update `/docs/tink-certification/00-INDEX.md`

2. **Monitor Performance:**
   - Track sync success rate
   - Monitor API rate limit usage
   - Adjust sync interval if needed

3. **User Communication:**
   - Notify users about automatic bank data sync
   - Update help documentation
   - Add sync status indicator in UI (optional)

## Contact

For issues or questions:
- Check logs first
- Run manual test script for debugging
- Review error patterns in audit logs
- Contact: [your email/support channel]
