"""Gamification service for handling achievements, XP, levels, and streaks."""
import logging
from datetime import date, datetime, timedelta
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    User,
    UserGamificationStats,
    Achievement,
    StreakHistory,
    GamificationEvent,
    Saving,
    LoanPayment,
    Expense,
    Income,
    Loan,
    FinancialFreedom,
    SavingsGoal,
)
from ..schemas.gamification import (
    BadgeId,
    BadgeCategory,
    BADGE_DEFINITIONS,
    XP_REWARDS,
    get_level_for_xp,
    get_xp_for_next_level,
    GamificationStats,
    UnlockedBadge,
    BadgeProgress,
    GamificationOverview,
    CheckinResponse,
    CelebrationData,
    StreakType,
)

logger = logging.getLogger(__name__)


class GamificationService:
    """Service for managing gamification features."""

    # ==========================================
    # STATS MANAGEMENT
    # ==========================================

    @staticmethod
    def get_or_create_stats(user_id: str, db: Session) -> UserGamificationStats:
        """Get user's gamification stats, creating if doesn't exist."""
        stats = db.query(UserGamificationStats).filter(
            UserGamificationStats.user_id == user_id
        ).first()

        if not stats:
            stats = UserGamificationStats(user_id=user_id)
            db.add(stats)
            db.commit()
            db.refresh(stats)
            logger.info(f"Created gamification stats for user {user_id}")

        return stats

    @staticmethod
    def get_stats(user_id: str, db: Session) -> GamificationStats:
        """Get formatted gamification stats for API response."""
        stats = GamificationService.get_or_create_stats(user_id, db)

        level, level_name, level_name_en = get_level_for_xp(stats.total_xp)
        xp_needed, xp_progress = get_xp_for_next_level(stats.total_xp)

        return GamificationStats(
            current_streak=stats.current_streak,
            longest_streak=stats.longest_streak,
            last_activity_date=stats.last_activity_date,
            total_xp=stats.total_xp,
            level=level,
            level_name=level_name,
            level_name_en=level_name_en,
            xp_for_next_level=xp_needed,
            xp_progress_in_level=xp_progress,
            total_expenses_logged=stats.total_expenses_logged,
            total_savings_deposits=stats.total_savings_deposits,
            total_loan_payments=stats.total_loan_payments,
            total_checkins=stats.total_checkins,
            total_debt_paid=stats.total_debt_paid,
            months_with_savings=stats.months_with_savings,
        )

    # ==========================================
    # XP MANAGEMENT
    # ==========================================

    @staticmethod
    def award_xp(
        user_id: str,
        xp_amount: int,
        reason: str,
        db: Session,
        trigger_entity: Optional[str] = None,
        trigger_entity_id: Optional[int] = None,
    ) -> Tuple[int, bool, Optional[int]]:
        """
        Award XP to user and check for level up.

        Returns: (total_xp, did_level_up, new_level)
        """
        stats = GamificationService.get_or_create_stats(user_id, db)
        old_level = get_level_for_xp(stats.total_xp)[0]

        stats.total_xp += xp_amount
        new_level = get_level_for_xp(stats.total_xp)[0]

        did_level_up = new_level > old_level

        # Log the XP event
        event = GamificationEvent(
            user_id=user_id,
            event_type="xp_earned",
            event_data={"reason": reason, "amount": xp_amount},
            xp_change=xp_amount,
            trigger_entity=trigger_entity,
            trigger_entity_id=trigger_entity_id,
        )
        db.add(event)

        # Log level up if it happened
        if did_level_up:
            level_event = GamificationEvent(
                user_id=user_id,
                event_type="level_up",
                event_data={
                    "old_level": old_level,
                    "new_level": new_level,
                    "total_xp": stats.total_xp,
                },
                xp_change=0,
            )
            db.add(level_event)
            logger.info(f"User {user_id} leveled up from {old_level} to {new_level}")

        db.commit()
        return stats.total_xp, did_level_up, new_level if did_level_up else None

    # ==========================================
    # STREAK MANAGEMENT
    # ==========================================

    @staticmethod
    def update_streak(
        user_id: str,
        db: Session,
        streak_type: str = StreakType.DAILY_CHECKIN,
    ) -> Tuple[int, bool, bool]:
        """
        Update user's streak for today.

        Returns: (new_streak_count, streak_continued, is_new_record)
        """
        stats = GamificationService.get_or_create_stats(user_id, db)
        today = date.today()
        yesterday = today - timedelta(days=1)

        streak_continued = False
        is_new_record = False

        # Check if already recorded today
        existing_today = db.query(StreakHistory).filter(
            StreakHistory.user_id == user_id,
            StreakHistory.date == today,
            StreakHistory.streak_type == streak_type,
        ).first()

        if existing_today:
            # Already checked in today, just increment activity count
            existing_today.activity_count += 1
            db.commit()
            return stats.current_streak, True, False

        # Check if streak continues from yesterday
        if stats.last_activity_date == yesterday:
            stats.current_streak += 1
            streak_continued = True
        elif stats.last_activity_date == today:
            # Same day, no change
            pass
        else:
            # Streak broken, start fresh
            stats.current_streak = 1

        # Update last activity date
        stats.last_activity_date = today

        # Check for new record
        if stats.current_streak > stats.longest_streak:
            stats.longest_streak = stats.current_streak
            is_new_record = True

        # Record in streak history
        streak_record = StreakHistory(
            user_id=user_id,
            date=today,
            streak_type=streak_type,
            activity_count=1,
            streak_count=stats.current_streak,
        )
        db.add(streak_record)

        db.commit()
        logger.info(f"User {user_id} streak updated to {stats.current_streak}")

        return stats.current_streak, streak_continued, is_new_record

    # ==========================================
    # CHECK-IN
    # ==========================================

    @staticmethod
    def daily_checkin(user_id: str, db: Session) -> CheckinResponse:
        """
        Process daily check-in: update streak, award XP, check badges.
        """
        stats = GamificationService.get_or_create_stats(user_id, db)
        today = date.today()

        # Check if already checked in today
        already_checked_in = stats.last_activity_date == today

        if already_checked_in:
            return CheckinResponse(
                success=True,
                xp_earned=0,
                new_streak=stats.current_streak,
                streak_continued=True,
                new_badges=[],
                level_up=False,
                message="Już się dziś zameldowałeś! Wracaj jutro.",
            )

        # Update streak
        new_streak, streak_continued, is_new_record = GamificationService.update_streak(
            user_id, db, StreakType.DAILY_CHECKIN
        )

        # Award XP
        xp_to_award = XP_REWARDS["daily_checkin"]
        if streak_continued:
            xp_to_award += XP_REWARDS["streak_continued"]

        stats.total_checkins += 1

        total_xp, level_up, new_level = GamificationService.award_xp(
            user_id, xp_to_award, "daily_checkin", db,
            trigger_entity="checkin",
        )

        # Check for streak-related badges
        new_badges = GamificationService.check_streak_badges(user_id, new_streak, db)

        # Build message
        if is_new_record:
            message = f"Nowy rekord! 🎉 Twój streak to teraz {new_streak} dni!"
        elif streak_continued:
            message = f"Świetnie! Dzień {new_streak} z rzędu! 🔥"
        else:
            message = f"Witaj z powrotem! Zaczynasz nowy streak. 💪"

        db.commit()

        return CheckinResponse(
            success=True,
            xp_earned=xp_to_award,
            new_streak=new_streak,
            streak_continued=streak_continued,
            new_badges=new_badges,
            level_up=level_up,
            new_level=new_level,
            message=message,
        )

    # ==========================================
    # ACHIEVEMENT CHECKING
    # ==========================================

    @staticmethod
    def has_badge(user_id: str, badge_id: str, db: Session) -> bool:
        """Check if user already has a specific badge."""
        return db.query(Achievement).filter(
            Achievement.user_id == user_id,
            Achievement.badge_id == badge_id,
        ).first() is not None

    @staticmethod
    def unlock_badge(
        user_id: str,
        badge_id: str,
        db: Session,
        unlock_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[UnlockedBadge]:
        """Unlock a badge for user if not already unlocked."""
        if GamificationService.has_badge(user_id, badge_id, db):
            return None

        badge_def = BADGE_DEFINITIONS.get(badge_id)
        if not badge_def:
            logger.error(f"Unknown badge_id: {badge_id}")
            return None

        # Create achievement record
        achievement = Achievement(
            user_id=user_id,
            badge_id=badge_id,
            badge_category=badge_def["category"],
            xp_awarded=badge_def["xp_reward"],
            unlock_data=unlock_data,
        )
        db.add(achievement)

        # Award XP for the badge
        GamificationService.award_xp(
            user_id,
            badge_def["xp_reward"],
            f"badge_unlocked:{badge_id}",
            db,
            trigger_entity="achievement",
        )

        # Log the event
        event = GamificationEvent(
            user_id=user_id,
            event_type="badge_unlocked",
            event_data={
                "badge_id": badge_id,
                "badge_name": badge_def["name"],
                "xp_reward": badge_def["xp_reward"],
            },
            xp_change=badge_def["xp_reward"],
        )
        db.add(event)

        db.commit()
        db.refresh(achievement)

        logger.info(f"User {user_id} unlocked badge: {badge_id}")

        return UnlockedBadge(
            badge_id=badge_id,
            name=badge_def["name"],
            name_en=badge_def["name_en"],
            description=badge_def["description"],
            description_en=badge_def["description_en"],
            icon=badge_def["icon"],
            category=badge_def["category"],
            xp_awarded=badge_def["xp_reward"],
            unlocked_at=achievement.unlocked_at,
            unlock_data=unlock_data,
        )

    @staticmethod
    def check_streak_badges(
        user_id: str,
        current_streak: int,
        db: Session,
    ) -> List[UnlockedBadge]:
        """Check and award streak-based badges."""
        new_badges = []

        streak_badges = [
            (7, BadgeId.WEEK_CONTROL),
            (30, BadgeId.MONTH_DISCIPLINE),
            (90, BadgeId.QUARTER_MASTER),
            (365, BadgeId.YEAR_CHAMPION),
        ]

        for threshold, badge_id in streak_badges:
            if current_streak >= threshold:
                badge = GamificationService.unlock_badge(
                    user_id, badge_id, db,
                    unlock_data={"streak": current_streak},
                )
                if badge:
                    new_badges.append(badge)

        return new_badges

    @staticmethod
    def check_emergency_fund_badges(
        user_id: str,
        db: Session,
    ) -> List[UnlockedBadge]:
        """Check emergency fund related badges."""
        new_badges = []

        # Calculate emergency fund total
        emergency_savings = db.query(func.coalesce(func.sum(Saving.amount), 0)).filter(
            Saving.user_id == user_id,
            Saving.category == "emergency_fund",
            Saving.saving_type == "deposit",
        ).scalar() or 0

        emergency_withdrawals = db.query(func.coalesce(func.sum(Saving.amount), 0)).filter(
            Saving.user_id == user_id,
            Saving.category == "emergency_fund",
            Saving.saving_type == "withdrawal",
        ).scalar() or 0

        emergency_total = emergency_savings - emergency_withdrawals

        # First Thousand badge
        if emergency_total >= 1000:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.FIRST_THOUSAND, db,
                unlock_data={"amount": emergency_total},
            )
            if badge:
                new_badges.append(badge)

        # Starter Fund badge (3000)
        if emergency_total >= 3000:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.STARTER_FUND, db,
                unlock_data={"amount": emergency_total},
            )
            if badge:
                new_badges.append(badge)

        return new_badges

    @staticmethod
    def check_debt_badges(
        user_id: str,
        db: Session,
    ) -> List[UnlockedBadge]:
        """Check debt-related badges."""
        new_badges = []
        stats = GamificationService.get_or_create_stats(user_id, db)

        # First overpayment badge
        overpayment_count = db.query(func.count(LoanPayment.id)).filter(
            LoanPayment.user_id == user_id,
            LoanPayment.payment_type == "overpayment",
        ).scalar() or 0

        if overpayment_count >= 1:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.FIRST_OVERPAYMENT, db,
                unlock_data={"overpayment_count": overpayment_count},
            )
            if badge:
                new_badges.append(badge)

        # Debt Slayer badge (10,000 PLN paid)
        total_payments = db.query(func.coalesce(func.sum(LoanPayment.amount), 0)).filter(
            LoanPayment.user_id == user_id,
        ).scalar() or 0

        if total_payments >= 10000:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.DEBT_SLAYER, db,
                unlock_data={"total_paid": total_payments},
            )
            if badge:
                new_badges.append(badge)

        # Update stats
        stats.total_debt_paid = total_payments

        return new_badges

    @staticmethod
    def check_fire_badges(
        user_id: str,
        db: Session,
    ) -> List[UnlockedBadge]:
        """Check FIRE journey related badges."""
        new_badges = []

        # Get financial freedom progress
        ff = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == user_id
        ).first()

        if not ff or not ff.steps:
            return new_badges

        steps = ff.steps
        completed_steps = sum(1 for step in steps if step.get("status") == "completed")

        # FIRE Starter badge (first step started or completed)
        if completed_steps >= 1 or any(step.get("status") == "in_progress" for step in steps):
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.FIRE_STARTER, db,
                unlock_data={"completed_steps": completed_steps},
            )
            if badge:
                new_badges.append(badge)

        # Halfway There badge (4 steps)
        if completed_steps >= 4:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.HALFWAY_THERE, db,
                unlock_data={"completed_steps": completed_steps},
            )
            if badge:
                new_badges.append(badge)

        # Financially Free badge (all 7 steps)
        if completed_steps >= 7:
            badge = GamificationService.unlock_badge(
                user_id, BadgeId.FINANCIALLY_FREE, db,
                unlock_data={"completed_steps": completed_steps},
            )
            if badge:
                new_badges.append(badge)

        return new_badges

    @staticmethod
    def check_all_achievements(
        user_id: str,
        db: Session,
    ) -> List[UnlockedBadge]:
        """Check all achievement conditions and award new badges."""
        all_new_badges = []

        # Check each category
        all_new_badges.extend(GamificationService.check_emergency_fund_badges(user_id, db))
        all_new_badges.extend(GamificationService.check_debt_badges(user_id, db))
        all_new_badges.extend(GamificationService.check_fire_badges(user_id, db))

        # Get current streak for consistency badges
        stats = GamificationService.get_or_create_stats(user_id, db)
        all_new_badges.extend(
            GamificationService.check_streak_badges(user_id, stats.current_streak, db)
        )

        db.commit()
        return all_new_badges

    # ==========================================
    # ACTIVITY TRIGGERS
    # ==========================================

    @staticmethod
    def on_expense_logged(
        user_id: str,
        expense_id: int,
        db: Session,
    ) -> Tuple[int, List[UnlockedBadge]]:
        """Called when user logs an expense."""
        stats = GamificationService.get_or_create_stats(user_id, db)
        stats.total_expenses_logged += 1

        # Update streak
        GamificationService.update_streak(user_id, db, StreakType.EXPENSE_LOGGING)

        # Award XP
        xp_earned, _, _ = GamificationService.award_xp(
            user_id, XP_REWARDS["expense_logged"], "expense_logged", db,
            trigger_entity="expense", trigger_entity_id=expense_id,
        )

        # Check achievements
        new_badges = GamificationService.check_streak_badges(
            user_id, stats.current_streak, db
        )

        db.commit()
        return xp_earned, new_badges

    @staticmethod
    def on_income_logged(
        user_id: str,
        income_id: int,
        db: Session,
    ) -> Tuple[int, List[UnlockedBadge]]:
        """Called when user logs income."""
        # Update streak
        GamificationService.update_streak(user_id, db, StreakType.DAILY_CHECKIN)

        # Award XP
        xp_earned, _, _ = GamificationService.award_xp(
            user_id, XP_REWARDS["income_logged"], "income_logged", db,
            trigger_entity="income", trigger_entity_id=income_id,
        )

        db.commit()
        return xp_earned, []

    @staticmethod
    def on_saving_deposit(
        user_id: str,
        saving_id: int,
        category: str,
        db: Session,
    ) -> Tuple[int, List[UnlockedBadge]]:
        """Called when user makes a savings deposit."""
        stats = GamificationService.get_or_create_stats(user_id, db)
        stats.total_savings_deposits += 1

        # Update streak
        GamificationService.update_streak(user_id, db, StreakType.SAVINGS)

        # Award XP
        xp_earned, _, _ = GamificationService.award_xp(
            user_id, XP_REWARDS["saving_deposit"], "saving_deposit", db,
            trigger_entity="saving", trigger_entity_id=saving_id,
        )

        # Check emergency fund badges if applicable
        new_badges = []
        if category == "emergency_fund":
            new_badges.extend(
                GamificationService.check_emergency_fund_badges(user_id, db)
            )

        db.commit()
        return xp_earned, new_badges

    @staticmethod
    def on_loan_payment(
        user_id: str,
        payment_id: int,
        is_overpayment: bool,
        db: Session,
    ) -> Tuple[int, List[UnlockedBadge]]:
        """Called when user makes a loan payment."""
        stats = GamificationService.get_or_create_stats(user_id, db)
        stats.total_loan_payments += 1

        # Award XP (more for overpayments)
        reward_key = "loan_overpayment" if is_overpayment else "loan_payment"
        xp_earned, _, _ = GamificationService.award_xp(
            user_id, XP_REWARDS[reward_key], reward_key, db,
            trigger_entity="loan_payment", trigger_entity_id=payment_id,
        )

        # Check debt badges
        new_badges = GamificationService.check_debt_badges(user_id, db)

        db.commit()
        return xp_earned, new_badges

    @staticmethod
    def on_baby_step_completed(
        user_id: str,
        step_number: int,
        db: Session,
    ) -> Tuple[int, List[UnlockedBadge]]:
        """Called when user completes a Baby Step."""
        # Award XP for completing step (scales with step number)
        base_xp = XP_REWARDS["baby_step_completed"]
        xp_amount = base_xp * step_number  # Later steps worth more

        xp_earned, _, _ = GamificationService.award_xp(
            user_id, xp_amount, f"baby_step_{step_number}_completed", db,
            trigger_entity="financial_freedom",
        )

        # Check FIRE badges
        new_badges = GamificationService.check_fire_badges(user_id, db)

        db.commit()
        return xp_earned, new_badges

    # ==========================================
    # OVERVIEW & RETRIEVAL
    # ==========================================

    @staticmethod
    def get_unlocked_badges(user_id: str, db: Session) -> List[UnlockedBadge]:
        """Get all badges user has unlocked."""
        achievements = db.query(Achievement).filter(
            Achievement.user_id == user_id
        ).order_by(Achievement.unlocked_at.desc()).all()

        unlocked = []
        for achievement in achievements:
            badge_def = BADGE_DEFINITIONS.get(achievement.badge_id)
            if badge_def:
                unlocked.append(UnlockedBadge(
                    badge_id=achievement.badge_id,
                    name=badge_def["name"],
                    name_en=badge_def["name_en"],
                    description=badge_def["description"],
                    description_en=badge_def["description_en"],
                    icon=badge_def["icon"],
                    category=badge_def["category"],
                    xp_awarded=achievement.xp_awarded,
                    unlocked_at=achievement.unlocked_at,
                    unlock_data=achievement.unlock_data,
                ))

        return unlocked

    @staticmethod
    def get_badge_progress(user_id: str, db: Session) -> List[BadgeProgress]:
        """Get progress toward locked badges."""
        stats = GamificationService.get_or_create_stats(user_id, db)
        progress_list = []

        # Get user's current values
        emergency_total = GamificationService._get_emergency_fund_total(user_id, db)
        total_debt_paid = stats.total_debt_paid
        current_streak = stats.current_streak
        completed_steps = GamificationService._get_completed_steps_count(user_id, db)

        # Define progress mappings
        progress_mappings = {
            BadgeId.FIRST_THOUSAND: (emergency_total, 1000),
            BadgeId.STARTER_FUND: (emergency_total, 3000),
            BadgeId.DEBT_SLAYER: (total_debt_paid, 10000),
            BadgeId.WEEK_CONTROL: (current_streak, 7),
            BadgeId.MONTH_DISCIPLINE: (current_streak, 30),
            BadgeId.QUARTER_MASTER: (current_streak, 90),
            BadgeId.YEAR_CHAMPION: (current_streak, 365),
            BadgeId.HALFWAY_THERE: (completed_steps, 4),
            BadgeId.FINANCIALLY_FREE: (completed_steps, 7),
        }

        # Check which badges user doesn't have yet
        for badge_id, (current_value, target_value) in progress_mappings.items():
            if GamificationService.has_badge(user_id, badge_id, db):
                continue

            badge_def = BADGE_DEFINITIONS.get(badge_id)
            if not badge_def:
                continue

            progress_percent = min(100, (current_value / target_value) * 100) if target_value > 0 else 0

            progress_list.append(BadgeProgress(
                badge_id=badge_id,
                name=badge_def["name"],
                name_en=badge_def["name_en"],
                description=badge_def["description"],
                description_en=badge_def["description_en"],
                icon=badge_def["icon"],
                category=badge_def["category"],
                xp_reward=badge_def["xp_reward"],
                current_value=current_value,
                target_value=target_value,
                progress_percent=progress_percent,
            ))

        # Sort by progress (closest to completion first)
        progress_list.sort(key=lambda x: x.progress_percent, reverse=True)

        return progress_list

    @staticmethod
    def get_overview(user_id: str, db: Session) -> GamificationOverview:
        """Get complete gamification overview for mobile app."""
        stats = GamificationService.get_stats(user_id, db)
        unlocked = GamificationService.get_unlocked_badges(user_id, db)
        progress = GamificationService.get_badge_progress(user_id, db)

        # Get recent events (last 10)
        recent = db.query(GamificationEvent).filter(
            GamificationEvent.user_id == user_id
        ).order_by(GamificationEvent.created_at.desc()).limit(10).all()

        recent_events = [
            {
                "type": e.event_type,
                "data": e.event_data,
                "xp_change": e.xp_change,
                "created_at": e.created_at.isoformat(),
            }
            for e in recent
        ]

        return GamificationOverview(
            stats=stats,
            unlocked_badges=unlocked,
            badge_progress=progress,
            recent_events=recent_events,
        )

    # ==========================================
    # HELPER METHODS
    # ==========================================

    @staticmethod
    def _get_emergency_fund_total(user_id: str, db: Session) -> float:
        """Calculate total emergency fund balance."""
        deposits = db.query(func.coalesce(func.sum(Saving.amount), 0)).filter(
            Saving.user_id == user_id,
            Saving.category == "emergency_fund",
            Saving.saving_type == "deposit",
        ).scalar() or 0

        withdrawals = db.query(func.coalesce(func.sum(Saving.amount), 0)).filter(
            Saving.user_id == user_id,
            Saving.category == "emergency_fund",
            Saving.saving_type == "withdrawal",
        ).scalar() or 0

        return deposits - withdrawals

    @staticmethod
    def _get_completed_steps_count(user_id: str, db: Session) -> int:
        """Get number of completed Baby Steps."""
        ff = db.query(FinancialFreedom).filter(
            FinancialFreedom.userId == user_id
        ).first()

        if not ff or not ff.steps:
            return 0

        return sum(1 for step in ff.steps if step.get("status") == "completed")
