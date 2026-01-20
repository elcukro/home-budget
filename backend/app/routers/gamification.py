"""API endpoints for gamification system."""
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..dependencies import get_current_user
from ..services.gamification_service import GamificationService
from ..schemas.gamification import (
    GamificationStats,
    GamificationOverview,
    UnlockedBadge,
    BadgeProgress,
    CheckinResponse,
    Achievement,
    GamificationEvent,
    BADGE_DEFINITIONS,
    BadgeDefinition,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/gamification",
    tags=["gamification"],
    responses={404: {"description": "Not found"}},
)


@router.get("/stats", response_model=GamificationStats)
async def get_gamification_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get user's gamification statistics.

    Returns streak info, XP, level, and activity counts.
    """
    try:
        stats = GamificationService.get_stats(current_user.id, db)
        return stats
    except Exception as e:
        logger.error(f"Error getting gamification stats for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get gamification stats",
        )


@router.get("/overview", response_model=GamificationOverview)
async def get_gamification_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get complete gamification overview.

    Returns stats, unlocked badges, badge progress, and recent events.
    This is the main endpoint for the mobile app dashboard.
    """
    try:
        overview = GamificationService.get_overview(current_user.id, db)
        return overview
    except Exception as e:
        logger.error(f"Error getting gamification overview for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get gamification overview",
        )


@router.post("/checkin", response_model=CheckinResponse)
async def daily_checkin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Register daily check-in.

    Updates streak, awards XP, and checks for new achievements.
    Should be called when user opens the app.
    """
    try:
        response = GamificationService.daily_checkin(current_user.id, db)
        logger.info(f"User {current_user.id} checked in. Streak: {response.new_streak}")
        return response
    except Exception as e:
        logger.error(f"Error processing check-in for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process check-in",
        )


@router.get("/achievements", response_model=List[UnlockedBadge])
async def get_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all badges user has unlocked.

    Returns list of unlocked badges sorted by unlock date (newest first).
    """
    try:
        badges = GamificationService.get_unlocked_badges(current_user.id, db)
        return badges
    except Exception as e:
        logger.error(f"Error getting achievements for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get achievements",
        )


@router.get("/progress", response_model=List[BadgeProgress])
async def get_badge_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get progress toward locked badges.

    Returns list of badges user hasn't unlocked yet with their progress.
    Sorted by progress percentage (closest to completion first).
    """
    try:
        progress = GamificationService.get_badge_progress(current_user.id, db)
        return progress
    except Exception as e:
        logger.error(f"Error getting badge progress for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get badge progress",
        )


@router.post("/calculate")
async def calculate_achievements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Recalculate all achievements for user.

    This is a manual trigger to check all achievement conditions.
    Useful after data imports or corrections.
    """
    try:
        new_badges = GamificationService.check_all_achievements(current_user.id, db)
        return {
            "success": True,
            "new_badges_count": len(new_badges),
            "new_badges": [b.badge_id for b in new_badges],
        }
    except Exception as e:
        logger.error(f"Error calculating achievements for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to calculate achievements",
        )


@router.get("/badges/all", response_model=List[BadgeDefinition])
async def get_all_badge_definitions(
    current_user: User = Depends(get_current_user),
):
    """
    Get all available badge definitions.

    Returns list of all possible badges with their requirements.
    """
    badges = []
    for badge_id, badge_def in BADGE_DEFINITIONS.items():
        badges.append(BadgeDefinition(
            badge_id=badge_id,
            name=badge_def["name"],
            name_en=badge_def["name_en"],
            description=badge_def["description"],
            description_en=badge_def["description_en"],
            icon=badge_def["icon"],
            category=badge_def["category"],
            xp_reward=badge_def["xp_reward"],
            threshold=badge_def.get("threshold"),
        ))
    return badges


@router.get("/events", response_model=List[GamificationEvent])
async def get_gamification_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
):
    """
    Get recent gamification events for user.

    Returns list of recent XP gains, badge unlocks, level ups, etc.
    """
    try:
        from ..models import GamificationEvent as GamificationEventModel

        events = db.query(GamificationEventModel).filter(
            GamificationEventModel.user_id == current_user.id
        ).order_by(
            GamificationEventModel.created_at.desc()
        ).limit(limit).all()

        return events
    except Exception as e:
        logger.error(f"Error getting gamification events for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get gamification events",
        )
