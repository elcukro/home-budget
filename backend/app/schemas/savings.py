from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import date, datetime
from enum import Enum

class SavingCategory(str, Enum):
    EMERGENCY_FUND = "emergency_fund"
    SIX_MONTH_FUND = "six_month_fund"
    RETIREMENT = "retirement"
    COLLEGE = "college"
    GENERAL = "general"
    INVESTMENT = "investment"
    REAL_ESTATE = "real_estate"
    OTHER = "other"

class SavingType(str, Enum):
    DEPOSIT = "deposit"
    WITHDRAWAL = "withdrawal"

class AccountType(str, Enum):
    """Polish III Pillar retirement accounts and standard savings."""
    STANDARD = "standard"       # Regular savings account
    IKE = "ike"                 # Indywidualne Konto Emerytalne (limit 2026: 28,260 PLN)
    IKZE = "ikze"               # Indywidualne Konto Zabezpieczenia Emerytalnego (limit 2026: 11,304 / 16,956 PLN)
    PPK = "ppk"                 # Pracownicze Plany Kapitałowe
    OIPE = "oipe"               # Ogólnoeuropejski Indywidualny Produkt Emerytalny


class GoalStatus(str, Enum):
    """Status of a savings goal."""
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


# ============== Savings Goal Schemas ==============

class SavingsGoalBase(BaseModel):
    """Base schema for savings goals."""
    name: str = Field(min_length=1, max_length=100)
    category: SavingCategory
    target_amount: float = Field(gt=0)
    deadline: Optional[date] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    priority: int = Field(default=0, ge=0, le=100)
    notes: Optional[str] = Field(default=None, max_length=500)

    @validator('deadline')
    def deadline_must_be_future(cls, v):
        if v is not None and v < date.today():
            # Allow past deadlines for editing existing goals
            pass
        return v


class SavingsGoalCreate(SavingsGoalBase):
    """Schema for creating a new savings goal."""
    pass


class SavingsGoalUpdate(BaseModel):
    """Schema for updating a savings goal (all fields optional)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    category: Optional[SavingCategory] = None
    target_amount: Optional[float] = Field(default=None, gt=0)
    deadline: Optional[date] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: Optional[GoalStatus] = None
    priority: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = Field(default=None, max_length=500)


class SavingsGoal(SavingsGoalBase):
    """Full savings goal schema with computed fields."""
    id: int
    user_id: str
    current_amount: float = 0
    status: GoalStatus = GoalStatus.ACTIVE
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Computed fields (not in DB)
    progress_percent: float = 0
    remaining_amount: float = 0
    is_on_track: Optional[bool] = None  # Based on deadline and current progress
    monthly_needed: Optional[float] = None  # Amount needed per month to reach deadline

    class Config:
        from_attributes = True


class SavingsGoalWithSavings(SavingsGoal):
    """Savings goal with linked savings entries."""
    savings: List["Saving"] = []

    class Config:
        from_attributes = True

class SavingBase(BaseModel):
    category: SavingCategory
    description: str
    amount: float = Field(gt=0)  # Amount must be positive
    date: date
    end_date: Optional[date] = None  # Optional end date for recurring items
    is_recurring: bool = False
    target_amount: Optional[float] = None  # Deprecated - use goal_id instead
    saving_type: SavingType
    account_type: AccountType = AccountType.STANDARD  # Type of savings account (IKE/IKZE/PPK/OIPE/standard)
    annual_return_rate: Optional[float] = None  # Expected annual return rate for compound interest (e.g., 0.05 for 5%)
    goal_id: Optional[int] = None  # Link to a savings goal
    owner: Optional[str] = None  # "self", "partner" (null = "self")

    @validator('target_amount')
    def target_amount_must_be_positive(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Target amount must be positive')
        return v

    @validator('end_date')
    def end_date_must_be_after_start_date(cls, v, values):
        if v is not None and 'date' in values and v < values['date']:
            raise ValueError('End date must be after start date')
        return v

    @validator('annual_return_rate')
    def annual_return_rate_must_be_valid(cls, v):
        if v is not None and (v < -1 or v > 1):
            raise ValueError('Annual return rate must be between -100% and 100% (-1 to 1)')
        return v

class SavingCreate(SavingBase):
    pass

class SavingUpdate(SavingBase):
    pass

class Saving(SavingBase):
    id: int
    user_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class SavingsSummary(BaseModel):
    total_savings: float
    emergency_fund: float
    emergency_fund_target: float = 1000  # Default target for baby step 1
    emergency_fund_progress: float
    monthly_contribution: float
    category_totals: dict[SavingCategory, float]
    recent_transactions: List[Saving]

    class Config:
        from_attributes = True


class RetirementAccountLimit(BaseModel):
    """Individual retirement account limit tracking."""
    account_type: AccountType
    year: int
    annual_limit: float
    current_contributions: float
    remaining_limit: float
    percentage_used: float
    is_over_limit: bool


class RetirementLimitsResponse(BaseModel):
    """Response for retirement account limits endpoint."""
    year: int
    accounts: List[RetirementAccountLimit]
    total_retirement_contributions: float
    # Polish 2026 limits
    ike_limit: float = 28260.0  # IKE 2026 limit
    ikze_limit_standard: float = 11304.0  # IKZE 2026 standard limit
    ikze_limit_jdg: float = 16956.0  # IKZE 2026 limit for self-employed (JDG)
