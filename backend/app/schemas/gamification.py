"""Pydantic schemas for gamification system."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# ==========================================
# ENUMS
# ==========================================

class BadgeCategory(str, Enum):
    """Categories of achievements/badges."""
    EMERGENCY_FUND = "emergency_fund"
    DEBT = "debt"
    SAVINGS = "savings"
    CONSISTENCY = "consistency"
    FIRE = "fire"


class BadgeId(str, Enum):
    """All available badge identifiers."""
    # Emergency Fund badges
    FIRST_THOUSAND = "first_thousand"  # 1,000 PLN in emergency fund
    STARTER_FUND = "starter_fund"  # 3,000 PLN (Step 1 complete)
    FULL_FUND = "full_fund"  # 6 months expenses (Step 3 complete)

    # Debt badges
    FIRST_OVERPAYMENT = "first_overpayment"  # First loan overpayment
    DEBT_SLAYER = "debt_slayer"  # 10,000 PLN debt paid
    CONSUMER_DEBT_FREE = "consumer_debt_free"  # All consumer debt paid (Step 2)
    MORTGAGE_SLAYER = "mortgage_slayer"  # Mortgage paid off (Step 6)

    # Savings badges
    SAVINGS_HABIT = "savings_habit"  # 3 consecutive months saving
    SAVINGS_RATE_20 = "savings_rate_20"  # 20% savings rate
    SAVINGS_RATE_30 = "savings_rate_30"  # 30% savings rate
    SAVINGS_RATE_50 = "savings_rate_50"  # 50% savings rate

    # Consistency badges
    WEEK_CONTROL = "week_control"  # 7-day streak
    MONTH_DISCIPLINE = "month_discipline"  # 30-day streak
    QUARTER_MASTER = "quarter_master"  # 90-day streak
    YEAR_CHAMPION = "year_champion"  # 365-day streak

    # FIRE Journey badges
    FIRE_STARTER = "fire_starter"  # Started journey (first step)
    HALFWAY_THERE = "halfway_there"  # 4 of 7 steps complete
    FINANCIALLY_FREE = "financially_free"  # All 7 steps complete


class EventType(str, Enum):
    """Types of gamification events."""
    XP_EARNED = "xp_earned"
    BADGE_UNLOCKED = "badge_unlocked"
    LEVEL_UP = "level_up"
    STREAK_MILESTONE = "streak_milestone"
    CHECKIN = "checkin"


class StreakType(str, Enum):
    """Types of streaks tracked."""
    DAILY_CHECKIN = "daily_checkin"
    EXPENSE_LOGGING = "expense_logging"
    SAVINGS = "savings"


# ==========================================
# BADGE DEFINITIONS (Static data)
# ==========================================

BADGE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    # Emergency Fund badges
    BadgeId.FIRST_THOUSAND: {
        "name": "Pierwszy Tysiąc",
        "name_en": "First Thousand",
        "description": "Zgromadziłeś 1,000 zł w funduszu awaryjnym",
        "description_en": "Saved 1,000 PLN in emergency fund",
        "icon": "🌱",
        "category": BadgeCategory.EMERGENCY_FUND,
        "xp_reward": 100,
        "threshold": 1000,
    },
    BadgeId.STARTER_FUND: {
        "name": "Starter Fundusz",
        "name_en": "Starter Fund",
        "description": "Ukończyłeś Krok 1 - masz 3,000 zł na start",
        "description_en": "Completed Step 1 - 3,000 PLN starter fund",
        "icon": "🛡️",
        "category": BadgeCategory.EMERGENCY_FUND,
        "xp_reward": 200,
        "threshold": 3000,
    },
    BadgeId.FULL_FUND: {
        "name": "Pełny Fundusz",
        "name_en": "Full Fund",
        "description": "Masz 6-miesięczny fundusz awaryjny",
        "description_en": "Built 6-month emergency fund",
        "icon": "🏰",
        "category": BadgeCategory.EMERGENCY_FUND,
        "xp_reward": 500,
    },

    # Debt badges
    BadgeId.FIRST_OVERPAYMENT: {
        "name": "Pierwsza Nadpłata",
        "name_en": "First Overpayment",
        "description": "Dokonałeś pierwszej nadpłaty kredytu",
        "description_en": "Made your first loan overpayment",
        "icon": "⚔️",
        "category": BadgeCategory.DEBT,
        "xp_reward": 50,
    },
    BadgeId.DEBT_SLAYER: {
        "name": "Pogromca Długów",
        "name_en": "Debt Slayer",
        "description": "Spłaciłeś 10,000 zł długu",
        "description_en": "Paid off 10,000 PLN of debt",
        "icon": "🗡️",
        "category": BadgeCategory.DEBT,
        "xp_reward": 300,
        "threshold": 10000,
    },
    BadgeId.CONSUMER_DEBT_FREE: {
        "name": "Wolny od Konsumpcji",
        "name_en": "Consumer Debt Free",
        "description": "Spłaciłeś wszystkie kredyty konsumpcyjne",
        "description_en": "Paid off all consumer debt",
        "icon": "🦅",
        "category": BadgeCategory.DEBT,
        "xp_reward": 500,
    },
    BadgeId.MORTGAGE_SLAYER: {
        "name": "Mortgage Slayer",
        "name_en": "Mortgage Slayer",
        "description": "Spłaciłeś kredyt hipoteczny!",
        "description_en": "Paid off your mortgage!",
        "icon": "🏆",
        "category": BadgeCategory.DEBT,
        "xp_reward": 1000,
    },

    # Savings badges
    BadgeId.SAVINGS_HABIT: {
        "name": "Nawyk Oszczędzania",
        "name_en": "Savings Habit",
        "description": "Oszczędzasz 3 miesiące z rzędu",
        "description_en": "3 consecutive months of saving",
        "icon": "💎",
        "category": BadgeCategory.SAVINGS,
        "xp_reward": 150,
        "threshold": 3,
    },
    BadgeId.SAVINGS_RATE_20: {
        "name": "Stopa 20%",
        "name_en": "20% Rate",
        "description": "Osiągnąłeś stopę oszczędności 20%",
        "description_en": "Achieved 20% savings rate",
        "icon": "📈",
        "category": BadgeCategory.SAVINGS,
        "xp_reward": 200,
        "threshold": 0.20,
    },
    BadgeId.SAVINGS_RATE_30: {
        "name": "Stopa 30%",
        "name_en": "30% Rate",
        "description": "Osiągnąłeś stopę oszczędności 30%",
        "description_en": "Achieved 30% savings rate",
        "icon": "🚀",
        "category": BadgeCategory.SAVINGS,
        "xp_reward": 300,
        "threshold": 0.30,
    },
    BadgeId.SAVINGS_RATE_50: {
        "name": "Stopa 50%",
        "name_en": "50% Rate",
        "description": "Osiągnąłeś stopę oszczędności 50%!",
        "description_en": "Achieved 50% savings rate!",
        "icon": "🔥",
        "category": BadgeCategory.SAVINGS,
        "xp_reward": 500,
        "threshold": 0.50,
    },

    # Consistency badges
    BadgeId.WEEK_CONTROL: {
        "name": "Tydzień Kontroli",
        "name_en": "Week of Control",
        "description": "7-dniowy streak logowania",
        "description_en": "7-day logging streak",
        "icon": "📅",
        "category": BadgeCategory.CONSISTENCY,
        "xp_reward": 50,
        "threshold": 7,
    },
    BadgeId.MONTH_DISCIPLINE: {
        "name": "Miesiąc Dyscypliny",
        "name_en": "Month of Discipline",
        "description": "30-dniowy streak logowania",
        "description_en": "30-day logging streak",
        "icon": "🎯",
        "category": BadgeCategory.CONSISTENCY,
        "xp_reward": 150,
        "threshold": 30,
    },
    BadgeId.QUARTER_MASTER: {
        "name": "Kwartał Mistrza",
        "name_en": "Quarter Master",
        "description": "90-dniowy streak logowania",
        "description_en": "90-day logging streak",
        "icon": "👑",
        "category": BadgeCategory.CONSISTENCY,
        "xp_reward": 300,
        "threshold": 90,
    },
    BadgeId.YEAR_CHAMPION: {
        "name": "Mistrz Roku",
        "name_en": "Year Champion",
        "description": "365-dniowy streak logowania!",
        "description_en": "365-day logging streak!",
        "icon": "🏅",
        "category": BadgeCategory.CONSISTENCY,
        "xp_reward": 1000,
        "threshold": 365,
    },

    # FIRE Journey badges
    BadgeId.FIRE_STARTER: {
        "name": "FIRE Starter",
        "name_en": "FIRE Starter",
        "description": "Rozpocząłeś podróż do wolności finansowej",
        "description_en": "Started your journey to financial freedom",
        "icon": "🔥",
        "category": BadgeCategory.FIRE,
        "xp_reward": 50,
    },
    BadgeId.HALFWAY_THERE: {
        "name": "Połowa Drogi",
        "name_en": "Halfway There",
        "description": "Ukończyłeś 4 z 7 Baby Steps",
        "description_en": "Completed 4 of 7 Baby Steps",
        "icon": "⭐",
        "category": BadgeCategory.FIRE,
        "xp_reward": 400,
        "threshold": 4,
    },
    BadgeId.FINANCIALLY_FREE: {
        "name": "Wolność Finansowa",
        "name_en": "Financially Free",
        "description": "Ukończyłeś wszystkie 7 Baby Steps!",
        "description_en": "Completed all 7 Baby Steps!",
        "icon": "🏝️",
        "category": BadgeCategory.FIRE,
        "xp_reward": 1000,
        "threshold": 7,
    },
}


# ==========================================
# LEVEL DEFINITIONS
# ==========================================

LEVEL_THRESHOLDS = [
    (1, 0, "Początkujący", "Beginner"),
    (2, 100, "Świadomy", "Aware"),
    (3, 300, "Oszczędny", "Saver"),
    (4, 600, "Strateg", "Strategist"),
    (5, 1000, "Inwestor", "Investor"),
    (6, 2000, "Wolny Finansowo", "Financially Free"),
]


def get_level_for_xp(xp: int) -> tuple[int, str, str]:
    """Returns (level, name_pl, name_en) for given XP amount."""
    for level, threshold, name_pl, name_en in reversed(LEVEL_THRESHOLDS):
        if xp >= threshold:
            return level, name_pl, name_en
    return 1, "Początkujący", "Beginner"


def get_xp_for_next_level(current_xp: int) -> tuple[int, int]:
    """Returns (xp_needed_for_next_level, xp_progress_in_current_level)."""
    current_level = get_level_for_xp(current_xp)[0]
    if current_level >= len(LEVEL_THRESHOLDS):
        return 0, 0  # Max level

    current_threshold = LEVEL_THRESHOLDS[current_level - 1][1]
    next_threshold = LEVEL_THRESHOLDS[current_level][1]

    xp_in_level = current_xp - current_threshold
    xp_needed = next_threshold - current_threshold

    return xp_needed, xp_in_level


# ==========================================
# XP REWARDS
# ==========================================

XP_REWARDS = {
    "expense_logged": 5,
    "income_logged": 5,
    "saving_deposit": 10,
    "loan_payment": 10,
    "loan_overpayment": 20,
    "daily_checkin": 10,
    "streak_continued": 5,  # Bonus for maintaining streak
    "baby_step_completed": 100,  # Per step
}


# ==========================================
# RESPONSE SCHEMAS
# ==========================================

class BadgeDefinition(BaseModel):
    """Static badge definition."""
    badge_id: str
    name: str
    name_en: str
    description: str
    description_en: str
    icon: str
    category: BadgeCategory
    xp_reward: int
    threshold: Optional[float] = None


class UnlockedBadge(BaseModel):
    """Badge that user has unlocked."""
    badge_id: str
    name: str
    name_en: str
    description: str
    description_en: str
    icon: str
    category: BadgeCategory
    xp_awarded: int
    unlocked_at: datetime
    unlock_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class BadgeProgress(BaseModel):
    """Progress toward a locked badge."""
    badge_id: str
    name: str
    name_en: str
    description: str
    description_en: str
    icon: str
    category: BadgeCategory
    xp_reward: int
    current_value: float
    target_value: float
    progress_percent: float  # 0-100


class GamificationStats(BaseModel):
    """User's gamification statistics."""
    # Streak info
    current_streak: int = 0
    longest_streak: int = 0
    last_activity_date: Optional[date] = None

    # Level info
    total_xp: int = 0
    level: int = 1
    level_name: str = "Początkujący"
    level_name_en: str = "Beginner"
    xp_for_next_level: int = 100
    xp_progress_in_level: int = 0

    # Activity counts
    total_expenses_logged: int = 0
    total_savings_deposits: int = 0
    total_loan_payments: int = 0
    total_checkins: int = 0

    # Financial progress
    total_debt_paid: float = 0
    months_with_savings: int = 0

    class Config:
        from_attributes = True


class GamificationOverview(BaseModel):
    """Complete gamification overview for mobile app."""
    stats: GamificationStats
    unlocked_badges: List[UnlockedBadge]
    badge_progress: List[BadgeProgress]
    recent_events: List[Dict[str, Any]] = []


class CheckinResponse(BaseModel):
    """Response for daily check-in."""
    success: bool
    xp_earned: int
    new_streak: int
    streak_continued: bool
    new_badges: List[UnlockedBadge] = []
    level_up: bool = False
    new_level: Optional[int] = None
    message: str


class AchievementCreate(BaseModel):
    """Request to manually award an achievement (admin use)."""
    badge_id: str
    unlock_data: Optional[Dict[str, Any]] = None


class Achievement(BaseModel):
    """Achievement response model."""
    id: int
    user_id: str
    badge_id: str
    badge_category: str
    unlocked_at: datetime
    xp_awarded: int
    unlock_data: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class GamificationEvent(BaseModel):
    """Gamification event log entry."""
    id: int
    user_id: str
    event_type: str
    event_data: Optional[Dict[str, Any]] = None
    xp_change: int = 0
    trigger_entity: Optional[str] = None
    trigger_entity_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CelebrationData(BaseModel):
    """Data for celebration modal in mobile app."""
    type: str  # "badge", "level_up", "streak_milestone", "step_completed"
    title: str
    title_en: str
    description: str
    description_en: str
    icon: str
    xp_earned: int = 0
    extra_data: Optional[Dict[str, Any]] = None
