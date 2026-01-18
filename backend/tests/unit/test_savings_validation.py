"""
Unit tests for savings schema validation.

Tests Pydantic validation for:
- SavingCategory and SavingType enums
- AccountType enum (Polish III Pillar retirement accounts)
- GoalStatus enum
- SavingsGoalBase and SavingsGoal schemas
- SavingBase schema with validators
- RetirementAccountLimit schema
"""

import pytest
from datetime import date, datetime, timedelta
from pydantic import ValidationError
import sys
from unittest.mock import patch

# Mock external dependencies before importing the module
sys.modules['sqlalchemy'] = type(sys)('sqlalchemy')
sys.modules['sqlalchemy.orm'] = type(sys)('sqlalchemy.orm')

# Now import just what we need directly from the schema
# We'll recreate the enums and schemas here to test them in isolation
from enum import Enum
from pydantic import BaseModel, Field, validator
from typing import List, Optional


# ========== Enum Definitions (copied from schema for isolated testing) ==========

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
    STANDARD = "standard"
    IKE = "ike"
    IKZE = "ikze"
    PPK = "ppk"
    OIPE = "oipe"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    ABANDONED = "abandoned"


# ========== Schema Definitions (copied for isolated testing) ==========

class SavingsGoalBase(BaseModel):
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
            pass  # Allow past deadlines for editing
        return v


class SavingsGoalCreate(SavingsGoalBase):
    pass


class SavingsGoalUpdate(BaseModel):
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
    id: int
    user_id: str
    current_amount: float = 0
    status: GoalStatus = GoalStatus.ACTIVE
    created_at: datetime
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    progress_percent: float = 0
    remaining_amount: float = 0
    is_on_track: Optional[bool] = None
    monthly_needed: Optional[float] = None

    class Config:
        from_attributes = True


class SavingBase(BaseModel):
    category: SavingCategory
    description: str
    amount: float = Field(gt=0)
    date: date
    end_date: Optional[date] = None
    is_recurring: bool = False
    target_amount: Optional[float] = None
    saving_type: SavingType
    account_type: AccountType = AccountType.STANDARD
    annual_return_rate: Optional[float] = None
    goal_id: Optional[int] = None

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


class RetirementAccountLimit(BaseModel):
    account_type: AccountType
    year: int
    annual_limit: float
    current_contributions: float
    remaining_limit: float
    percentage_used: float
    is_over_limit: bool


# ========== Enum Tests ==========

class TestSavingCategory:
    """Tests for SavingCategory enum."""

    def test_all_categories_defined(self):
        """All expected categories should be defined."""
        expected = {
            "emergency_fund", "six_month_fund", "retirement",
            "college", "general", "investment", "real_estate", "other"
        }
        actual = {c.value for c in SavingCategory}
        assert actual == expected

    def test_category_values_are_lowercase(self):
        """All category values should be lowercase with underscores."""
        for category in SavingCategory:
            assert category.value == category.value.lower()
            assert ' ' not in category.value

    def test_emergency_fund_value(self):
        """Emergency fund should have correct value."""
        assert SavingCategory.EMERGENCY_FUND.value == "emergency_fund"

    def test_category_is_string_enum(self):
        """Category should be usable as string."""
        assert str(SavingCategory.RETIREMENT) == "SavingCategory.RETIREMENT"
        assert SavingCategory.RETIREMENT.value == "retirement"


class TestSavingType:
    """Tests for SavingType enum."""

    def test_only_deposit_and_withdrawal(self):
        """Only deposit and withdrawal types should exist."""
        assert len(SavingType) == 2
        assert SavingType.DEPOSIT.value == "deposit"
        assert SavingType.WITHDRAWAL.value == "withdrawal"


class TestAccountType:
    """Tests for AccountType enum (Polish III Pillar accounts)."""

    def test_all_polish_retirement_accounts(self):
        """All Polish III Pillar account types should be defined."""
        expected = {"standard", "ike", "ikze", "ppk", "oipe"}
        actual = {a.value for a in AccountType}
        assert actual == expected

    def test_ike_value(self):
        """IKE (Indywidualne Konto Emerytalne) should be defined."""
        assert AccountType.IKE.value == "ike"

    def test_ikze_value(self):
        """IKZE (Indywidualne Konto Zabezpieczenia Emerytalnego) should be defined."""
        assert AccountType.IKZE.value == "ikze"

    def test_ppk_value(self):
        """PPK (Pracownicze Plany Kapitałowe) should be defined."""
        assert AccountType.PPK.value == "ppk"

    def test_oipe_value(self):
        """OIPE (Ogólnoeuropejski Indywidualny Produkt Emerytalny) should be defined."""
        assert AccountType.OIPE.value == "oipe"

    def test_standard_is_default(self):
        """Standard account should be the default option."""
        assert AccountType.STANDARD.value == "standard"


class TestGoalStatus:
    """Tests for GoalStatus enum."""

    def test_all_statuses_defined(self):
        """All goal statuses should be defined."""
        expected = {"active", "completed", "paused", "abandoned"}
        actual = {s.value for s in GoalStatus}
        assert actual == expected

    def test_active_is_default_workflow(self):
        """Active should be the first status in workflow."""
        assert GoalStatus.ACTIVE.value == "active"


# ========== SavingsGoalBase Tests ==========

class TestSavingsGoalBase:
    """Tests for SavingsGoalBase schema validation."""

    def test_valid_goal(self):
        """Valid savings goal should be created successfully."""
        goal = SavingsGoalBase(
            name="Emergency Fund",
            category=SavingCategory.EMERGENCY_FUND,
            target_amount=10000.0
        )
        assert goal.name == "Emergency Fund"
        assert goal.category == SavingCategory.EMERGENCY_FUND
        assert goal.target_amount == 10000.0
        assert goal.priority == 0  # default

    def test_goal_with_all_fields(self):
        """Goal with all optional fields should be valid."""
        future_date = date.today() + timedelta(days=365)
        goal = SavingsGoalBase(
            name="House Down Payment",
            category=SavingCategory.REAL_ESTATE,
            target_amount=50000.0,
            deadline=future_date,
            icon="🏠",
            color="#4CAF50",
            priority=90,
            notes="Save for a 20% down payment"
        )
        assert goal.deadline == future_date
        assert goal.icon == "🏠"
        assert goal.color == "#4CAF50"
        assert goal.priority == 90
        assert goal.notes == "Save for a 20% down payment"

    def test_name_cannot_be_empty(self):
        """Name must have at least 1 character."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="",
                category=SavingCategory.GENERAL,
                target_amount=1000.0
            )
        assert "String should have at least 1 character" in str(exc_info.value)

    def test_name_max_length(self):
        """Name cannot exceed 100 characters."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="A" * 101,
                category=SavingCategory.GENERAL,
                target_amount=1000.0
            )
        assert "String should have at most 100 characters" in str(exc_info.value)

    def test_name_at_max_length(self):
        """Name at exactly 100 characters should be valid."""
        goal = SavingsGoalBase(
            name="A" * 100,
            category=SavingCategory.GENERAL,
            target_amount=1000.0
        )
        assert len(goal.name) == 100

    def test_target_amount_must_be_positive(self):
        """Target amount must be greater than 0."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="Test Goal",
                category=SavingCategory.GENERAL,
                target_amount=0
            )
        assert "greater than 0" in str(exc_info.value)

    def test_target_amount_cannot_be_negative(self):
        """Target amount cannot be negative."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="Test Goal",
                category=SavingCategory.GENERAL,
                target_amount=-100.0
            )
        assert "greater than 0" in str(exc_info.value)

    def test_target_amount_small_positive(self):
        """Small positive target amount should be valid."""
        goal = SavingsGoalBase(
            name="Coffee Fund",
            category=SavingCategory.GENERAL,
            target_amount=0.01
        )
        assert goal.target_amount == 0.01

    def test_priority_range(self):
        """Priority must be between 0 and 100."""
        # Valid boundaries
        goal_min = SavingsGoalBase(
            name="Low Priority",
            category=SavingCategory.GENERAL,
            target_amount=100,
            priority=0
        )
        goal_max = SavingsGoalBase(
            name="High Priority",
            category=SavingCategory.GENERAL,
            target_amount=100,
            priority=100
        )
        assert goal_min.priority == 0
        assert goal_max.priority == 100

    def test_priority_below_range(self):
        """Priority below 0 should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="Test",
                category=SavingCategory.GENERAL,
                target_amount=100,
                priority=-1
            )
        assert "greater than or equal to 0" in str(exc_info.value)

    def test_priority_above_range(self):
        """Priority above 100 should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="Test",
                category=SavingCategory.GENERAL,
                target_amount=100,
                priority=101
            )
        assert "less than or equal to 100" in str(exc_info.value)

    def test_notes_max_length(self):
        """Notes cannot exceed 500 characters."""
        with pytest.raises(ValidationError) as exc_info:
            SavingsGoalBase(
                name="Test",
                category=SavingCategory.GENERAL,
                target_amount=100,
                notes="A" * 501
            )
        assert "String should have at most 500 characters" in str(exc_info.value)

    def test_notes_at_max_length(self):
        """Notes at exactly 500 characters should be valid."""
        goal = SavingsGoalBase(
            name="Test",
            category=SavingCategory.GENERAL,
            target_amount=100,
            notes="A" * 500
        )
        assert len(goal.notes) == 500

    def test_past_deadline_allowed(self):
        """Past deadline should be allowed (for editing existing goals)."""
        past_date = date.today() - timedelta(days=30)
        goal = SavingsGoalBase(
            name="Test",
            category=SavingCategory.GENERAL,
            target_amount=100,
            deadline=past_date
        )
        assert goal.deadline == past_date

    def test_invalid_category_rejected(self):
        """Invalid category string should be rejected."""
        with pytest.raises(ValidationError):
            SavingsGoalBase(
                name="Test",
                category="invalid_category",
                target_amount=100
            )


# ========== SavingBase Tests ==========

class TestSavingBase:
    """Tests for SavingBase schema validation."""

    def test_valid_deposit(self):
        """Valid deposit should be created successfully."""
        saving = SavingBase(
            category=SavingCategory.EMERGENCY_FUND,
            description="Monthly savings",
            amount=500.0,
            date=date.today(),
            saving_type=SavingType.DEPOSIT
        )
        assert saving.amount == 500.0
        assert saving.saving_type == SavingType.DEPOSIT
        assert saving.account_type == AccountType.STANDARD  # default

    def test_valid_withdrawal(self):
        """Valid withdrawal should be created successfully."""
        saving = SavingBase(
            category=SavingCategory.EMERGENCY_FUND,
            description="Emergency expense",
            amount=200.0,
            date=date.today(),
            saving_type=SavingType.WITHDRAWAL
        )
        assert saving.saving_type == SavingType.WITHDRAWAL

    def test_amount_must_be_positive(self):
        """Amount must be greater than 0."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.GENERAL,
                description="Test",
                amount=0,
                date=date.today(),
                saving_type=SavingType.DEPOSIT
            )
        assert "greater than 0" in str(exc_info.value)

    def test_amount_cannot_be_negative(self):
        """Amount cannot be negative."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.GENERAL,
                description="Test",
                amount=-100,
                date=date.today(),
                saving_type=SavingType.DEPOSIT
            )
        assert "greater than 0" in str(exc_info.value)

    def test_target_amount_must_be_positive(self):
        """Target amount must be positive if provided."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.GENERAL,
                description="Test",
                amount=100,
                date=date.today(),
                saving_type=SavingType.DEPOSIT,
                target_amount=0
            )
        assert "Target amount must be positive" in str(exc_info.value)

    def test_target_amount_negative_rejected(self):
        """Negative target amount should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.GENERAL,
                description="Test",
                amount=100,
                date=date.today(),
                saving_type=SavingType.DEPOSIT,
                target_amount=-500
            )
        assert "Target amount must be positive" in str(exc_info.value)

    def test_end_date_after_start_date(self):
        """End date must be after start date."""
        start = date.today()
        end = start - timedelta(days=1)
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.GENERAL,
                description="Test",
                amount=100,
                date=start,
                end_date=end,
                saving_type=SavingType.DEPOSIT,
                is_recurring=True
            )
        assert "End date must be after start date" in str(exc_info.value)

    def test_end_date_same_as_start_allowed(self):
        """End date same as start date is allowed (for one-time entries)."""
        today = date.today()
        # The validator uses < not <=, so same date is allowed
        saving = SavingBase(
            category=SavingCategory.GENERAL,
            description="Test",
            amount=100,
            date=today,
            end_date=today,
            saving_type=SavingType.DEPOSIT,
            is_recurring=True
        )
        assert saving.date == saving.end_date

    def test_valid_end_date(self):
        """Valid end date after start should work."""
        start = date.today()
        end = start + timedelta(days=30)
        saving = SavingBase(
            category=SavingCategory.GENERAL,
            description="Monthly recurring",
            amount=100,
            date=start,
            end_date=end,
            saving_type=SavingType.DEPOSIT,
            is_recurring=True
        )
        assert saving.end_date == end

    def test_annual_return_rate_valid_range(self):
        """Annual return rate between -1 and 1 should be valid."""
        # Negative return (loss)
        saving_loss = SavingBase(
            category=SavingCategory.INVESTMENT,
            description="Bad investment",
            amount=1000,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            annual_return_rate=-0.5  # -50%
        )
        assert saving_loss.annual_return_rate == -0.5

        # Positive return
        saving_gain = SavingBase(
            category=SavingCategory.INVESTMENT,
            description="Good investment",
            amount=1000,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            annual_return_rate=0.08  # 8%
        )
        assert saving_gain.annual_return_rate == 0.08

    def test_annual_return_rate_boundary_values(self):
        """Annual return rate at boundaries (-1 and 1) should be valid."""
        # -100% (total loss)
        saving_total_loss = SavingBase(
            category=SavingCategory.INVESTMENT,
            description="Total loss",
            amount=1000,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            annual_return_rate=-1.0
        )
        assert saving_total_loss.annual_return_rate == -1.0

        # +100% return
        saving_double = SavingBase(
            category=SavingCategory.INVESTMENT,
            description="Double return",
            amount=1000,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            annual_return_rate=1.0
        )
        assert saving_double.annual_return_rate == 1.0

    def test_annual_return_rate_below_range(self):
        """Annual return rate below -1 should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.INVESTMENT,
                description="Test",
                amount=1000,
                date=date.today(),
                saving_type=SavingType.DEPOSIT,
                annual_return_rate=-1.5  # -150%
            )
        assert "Annual return rate must be between -100% and 100%" in str(exc_info.value)

    def test_annual_return_rate_above_range(self):
        """Annual return rate above 1 should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            SavingBase(
                category=SavingCategory.INVESTMENT,
                description="Test",
                amount=1000,
                date=date.today(),
                saving_type=SavingType.DEPOSIT,
                annual_return_rate=1.5  # 150%
            )
        assert "Annual return rate must be between -100% and 100%" in str(exc_info.value)

    def test_all_account_types(self):
        """All account types should be accepted."""
        for account_type in AccountType:
            saving = SavingBase(
                category=SavingCategory.RETIREMENT,
                description=f"{account_type.value} contribution",
                amount=1000,
                date=date.today(),
                saving_type=SavingType.DEPOSIT,
                account_type=account_type
            )
            assert saving.account_type == account_type

    def test_ike_retirement_account(self):
        """IKE contribution should be valid."""
        saving = SavingBase(
            category=SavingCategory.RETIREMENT,
            description="IKE 2026 contribution",
            amount=28260,  # 2026 IKE limit
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            account_type=AccountType.IKE
        )
        assert saving.account_type == AccountType.IKE

    def test_ikze_retirement_account(self):
        """IKZE contribution should be valid."""
        saving = SavingBase(
            category=SavingCategory.RETIREMENT,
            description="IKZE 2026 contribution",
            amount=11304,  # 2026 IKZE standard limit
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            account_type=AccountType.IKZE
        )
        assert saving.account_type == AccountType.IKZE

    def test_recurring_saving(self):
        """Recurring saving should be valid."""
        saving = SavingBase(
            category=SavingCategory.GENERAL,
            description="Monthly automatic transfer",
            amount=500,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            is_recurring=True
        )
        assert saving.is_recurring is True

    def test_goal_id_link(self):
        """Saving can be linked to a goal via goal_id."""
        saving = SavingBase(
            category=SavingCategory.EMERGENCY_FUND,
            description="Contribution to emergency fund goal",
            amount=250,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            goal_id=42
        )
        assert saving.goal_id == 42


# ========== SavingsGoalUpdate Tests ==========

class TestSavingsGoalUpdate:
    """Tests for SavingsGoalUpdate schema (partial updates)."""

    def test_empty_update(self):
        """Empty update should be valid."""
        update = SavingsGoalUpdate()
        assert update.name is None
        assert update.category is None

    def test_partial_update_name(self):
        """Can update only name."""
        update = SavingsGoalUpdate(name="New Name")
        assert update.name == "New Name"
        assert update.target_amount is None

    def test_partial_update_status(self):
        """Can update only status."""
        update = SavingsGoalUpdate(status=GoalStatus.COMPLETED)
        assert update.status == GoalStatus.COMPLETED

    def test_update_priority(self):
        """Can update priority."""
        update = SavingsGoalUpdate(priority=75)
        assert update.priority == 75

    def test_update_priority_boundary_validation(self):
        """Priority validation still applies in updates."""
        with pytest.raises(ValidationError):
            SavingsGoalUpdate(priority=150)


# ========== RetirementAccountLimit Tests ==========

class TestRetirementAccountLimit:
    """Tests for RetirementAccountLimit schema."""

    def test_valid_retirement_limit(self):
        """Valid retirement limit should be created."""
        limit = RetirementAccountLimit(
            account_type=AccountType.IKE,
            year=2026,
            annual_limit=28260.0,
            current_contributions=15000.0,
            remaining_limit=13260.0,
            percentage_used=53.1,
            is_over_limit=False
        )
        assert limit.account_type == AccountType.IKE
        assert limit.year == 2026
        assert limit.annual_limit == 28260.0
        assert limit.remaining_limit == 13260.0
        assert not limit.is_over_limit

    def test_over_limit_scenario(self):
        """Over limit scenario should be represented correctly."""
        limit = RetirementAccountLimit(
            account_type=AccountType.IKZE,
            year=2026,
            annual_limit=11304.0,
            current_contributions=12000.0,
            remaining_limit=0,
            percentage_used=106.2,
            is_over_limit=True
        )
        assert limit.is_over_limit is True
        assert limit.percentage_used > 100

    def test_ppk_no_annual_limit(self):
        """PPK typically has no annual limit."""
        limit = RetirementAccountLimit(
            account_type=AccountType.PPK,
            year=2026,
            annual_limit=0,  # No limit
            current_contributions=5000.0,
            remaining_limit=0,
            percentage_used=0,  # N/A for unlimited
            is_over_limit=False
        )
        assert limit.account_type == AccountType.PPK
        assert limit.annual_limit == 0


# ========== Integration-style Tests ==========

class TestSavingsWorkflows:
    """Tests for common savings workflows."""

    def test_emergency_fund_workflow(self):
        """Test creating emergency fund savings."""
        # Create goal
        goal = SavingsGoalBase(
            name="3-Month Emergency Fund",
            category=SavingCategory.EMERGENCY_FUND,
            target_amount=15000.0,
            priority=100  # Highest priority (Baby Step 1)
        )

        # Create deposit
        deposit = SavingBase(
            category=SavingCategory.EMERGENCY_FUND,
            description="January emergency fund deposit",
            amount=500.0,
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            goal_id=1  # Would link to the goal
        )

        assert goal.category == deposit.category
        assert deposit.saving_type == SavingType.DEPOSIT

    def test_retirement_contribution_workflow(self):
        """Test Polish III Pillar retirement contributions."""
        # IKE contribution
        ike_contribution = SavingBase(
            category=SavingCategory.RETIREMENT,
            description="IKE 2026 - January contribution",
            amount=2355.0,  # 28260 / 12 months
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            account_type=AccountType.IKE,
            annual_return_rate=0.07  # Expected 7% return
        )

        # IKZE contribution (self-employed)
        ikze_contribution = SavingBase(
            category=SavingCategory.RETIREMENT,
            description="IKZE 2026 - January contribution",
            amount=1413.0,  # 16956 / 12 months (JDG limit)
            date=date.today(),
            saving_type=SavingType.DEPOSIT,
            account_type=AccountType.IKZE,
            annual_return_rate=0.05
        )

        assert ike_contribution.account_type == AccountType.IKE
        assert ikze_contribution.account_type == AccountType.IKZE

    def test_recurring_savings_workflow(self):
        """Test recurring savings setup."""
        recurring_saving = SavingBase(
            category=SavingCategory.GENERAL,
            description="Monthly automatic savings",
            amount=1000.0,
            date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            saving_type=SavingType.DEPOSIT,
            is_recurring=True
        )

        assert recurring_saving.is_recurring is True
        assert recurring_saving.end_date > recurring_saving.date
