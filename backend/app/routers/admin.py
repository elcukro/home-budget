"""
Admin Router

Provides administrative endpoints for system management and audit logs.
All endpoints require admin authentication.

Rate Limits:
- /audit/tink: 60/minute - read-only audit queries
"""

from fastapi import APIRouter, HTTPException, Depends, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel

from slowapi import Limiter

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkAuditLog
from ..services.tink_metrics_service import tink_analytics_service
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


def get_limiter(request: Request) -> Limiter:
    """Get the limiter instance from app state."""
    return request.app.state.limiter


router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    responses={404: {"description": "Not found"}},
)


# Admin users whitelist - in production, this should be managed via database or config
# For now, we check if user email ends with specific domain or is in a list
ADMIN_EMAILS = {
    "elcukrodev@gmail.com",  # Test/dev account
}


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency that requires the current user to be an admin.

    For now, admin status is determined by email whitelist.
    In production, this should check a role/permission in the database.
    """
    if current_user.email not in ADMIN_EMAILS:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user


# ============================================================================
# Pydantic Models
# ============================================================================

class TinkAuditLogResponse(BaseModel):
    id: int
    user_id: Optional[str] = None
    tink_connection_id: Optional[int] = None
    action_type: str
    result: str
    request_method: Optional[str] = None
    request_path: Optional[str] = None
    status_code: Optional[int] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class TinkAuditLogListResponse(BaseModel):
    items: List[TinkAuditLogResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class AuditStatsResponse(BaseModel):
    total_entries: int
    entries_by_action: dict
    entries_by_result: dict
    unique_users: int
    date_range: dict


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/audit/tink", response_model=TinkAuditLogListResponse)
async def get_tink_audit_logs(
    http_request: Request,
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    result: Optional[str] = Query(None, description="Filter by result (success/failure/partial)"),
    connection_id: Optional[int] = Query(None, description="Filter by Tink connection ID"),
    from_date: Optional[date] = Query(None, description="Filter from date (inclusive)"),
    to_date: Optional[date] = Query(None, description="Filter to date (inclusive)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Query Tink audit logs with filtering and pagination.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    # Build query
    query = db.query(TinkAuditLog)

    # Apply filters
    if user_id:
        query = query.filter(TinkAuditLog.user_id == user_id)

    if action_type:
        query = query.filter(TinkAuditLog.action_type == action_type)

    if result:
        query = query.filter(TinkAuditLog.result == result)

    if connection_id:
        query = query.filter(TinkAuditLog.tink_connection_id == connection_id)

    if from_date:
        query = query.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))

    if to_date:
        query = query.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))

    # Get total count
    total = query.count()

    # Order by created_at descending and apply pagination
    offset = (page - 1) * page_size
    items = query.order_by(TinkAuditLog.created_at.desc()).offset(offset).limit(page_size).all()

    has_more = (page * page_size) < total

    return TinkAuditLogListResponse(
        items=[TinkAuditLogResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        has_more=has_more,
    )


@router.get("/audit/tink/stats", response_model=AuditStatsResponse)
async def get_tink_audit_stats(
    http_request: Request,
    from_date: Optional[date] = Query(None, description="Stats from date"),
    to_date: Optional[date] = Query(None, description="Stats to date"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get aggregated statistics for Tink audit logs.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    from sqlalchemy import func

    # Base query with date filters
    query = db.query(TinkAuditLog)

    if from_date:
        query = query.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))

    if to_date:
        query = query.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))

    # Total entries
    total_entries = query.count()

    # Entries by action type
    action_counts = db.query(
        TinkAuditLog.action_type,
        func.count(TinkAuditLog.id).label("count")
    )
    if from_date:
        action_counts = action_counts.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        action_counts = action_counts.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))
    action_counts = action_counts.group_by(TinkAuditLog.action_type).all()
    entries_by_action = {action: count for action, count in action_counts}

    # Entries by result
    result_counts = db.query(
        TinkAuditLog.result,
        func.count(TinkAuditLog.id).label("count")
    )
    if from_date:
        result_counts = result_counts.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        result_counts = result_counts.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))
    result_counts = result_counts.group_by(TinkAuditLog.result).all()
    entries_by_result = {result: count for result, count in result_counts}

    # Unique users
    unique_users_query = db.query(func.count(func.distinct(TinkAuditLog.user_id)))
    if from_date:
        unique_users_query = unique_users_query.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        unique_users_query = unique_users_query.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))
    unique_users = unique_users_query.scalar() or 0

    # Date range
    date_range_query = db.query(
        func.min(TinkAuditLog.created_at).label("earliest"),
        func.max(TinkAuditLog.created_at).label("latest")
    )
    if from_date:
        date_range_query = date_range_query.filter(TinkAuditLog.created_at >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        date_range_query = date_range_query.filter(TinkAuditLog.created_at <= datetime.combine(to_date, datetime.max.time()))
    date_range_result = date_range_query.first()

    date_range = {
        "earliest": date_range_result.earliest.isoformat() if date_range_result.earliest else None,
        "latest": date_range_result.latest.isoformat() if date_range_result.latest else None,
    }

    return AuditStatsResponse(
        total_entries=total_entries,
        entries_by_action=entries_by_action,
        entries_by_result=entries_by_result,
        unique_users=unique_users,
        date_range=date_range,
    )


@router.get("/audit/tink/{log_id}", response_model=TinkAuditLogResponse)
async def get_tink_audit_log_by_id(
    http_request: Request,
    log_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get a specific Tink audit log entry by ID.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    log_entry = db.query(TinkAuditLog).filter(TinkAuditLog.id == log_id).first()

    if not log_entry:
        raise HTTPException(status_code=404, detail="Audit log entry not found")

    return TinkAuditLogResponse.model_validate(log_entry)


# ============================================================================
# Tink Analytics Endpoints
# ============================================================================

@router.get("/tink/analytics")
async def get_tink_analytics(
    http_request: Request,
    period: str = Query("7d", description="Time period: 7d, 30d, or 90d"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive Tink analytics for monitoring dashboard.

    Returns aggregated stats including:
    - Daily operation counts and success/failure breakdown
    - Error breakdown by category
    - Sync performance metrics
    - User engagement stats

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    # Parse period
    period_days = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
    }.get(period, 7)

    return {
        "period": period,
        "period_days": period_days,
        "generated_at": datetime.utcnow().isoformat(),
        "daily_stats": tink_analytics_service.get_daily_stats(db, days=period_days),
        "error_breakdown": tink_analytics_service.get_error_breakdown(db, days=period_days),
        "sync_performance": tink_analytics_service.get_sync_performance(db, days=period_days),
        "user_engagement": tink_analytics_service.get_user_engagement(db, days=period_days),
    }


@router.get("/tink/analytics/daily")
async def get_tink_daily_stats(
    http_request: Request,
    days: int = Query(30, ge=1, le=90, description="Number of days"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get daily aggregated Tink operation stats.

    Returns list of daily summaries for trend analysis.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    return {
        "days": days,
        "stats": tink_analytics_service.get_daily_stats(db, days=days),
    }


@router.get("/tink/analytics/errors")
async def get_tink_error_breakdown(
    http_request: Request,
    days: int = Query(7, ge=1, le=90, description="Number of days"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get breakdown of Tink errors by category.

    Useful for identifying recurring issues.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    return tink_analytics_service.get_error_breakdown(db, days=days)


@router.get("/tink/analytics/sync")
async def get_tink_sync_performance(
    http_request: Request,
    days: int = Query(7, ge=1, le=90, description="Number of days"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get transaction sync performance metrics.

    Includes sync counts, transaction volumes, and duplicate detection stats.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    return tink_analytics_service.get_sync_performance(db, days=days)


@router.get("/tink/analytics/engagement")
async def get_tink_user_engagement(
    http_request: Request,
    days: int = Query(30, ge=1, le=90, description="Number of days"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get user engagement metrics with bank sync feature.

    Includes new connections, active users, etc.

    Requires admin access.

    Rate limit: 60/minute
    """
    limiter = get_limiter(http_request)
    await limiter.check("60/minute", http_request)

    return tink_analytics_service.get_user_engagement(db, days=days)
