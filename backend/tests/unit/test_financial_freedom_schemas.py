"""
Unit tests for Financial Freedom Pydantic schemas.

Tests validation rules for BabyStep and FinancialFreedom schemas.
"""

import pytest
from datetime import datetime, timezone
from pydantic import ValidationError


# Copy of schemas from app/schemas/financial_freedom.py for isolated testing
from pydantic import BaseModel, Field
from typing import List, Optional


class BabyStep(BaseModel):
    """Dave Ramsey Baby Step model."""
    id: int
    titleKey: str
    descriptionKey: str
    isCompleted: bool = False
    progress: float = 0
    targetAmount: Optional[float] = None
    currentAmount: Optional[float] = None
    completionDate: Optional[datetime] = None
    notes: Optional[str] = ""


class FinancialFreedomBase(BaseModel):
    steps: List[BabyStep]


class FinancialFreedomCreate(FinancialFreedomBase):
    userId: str
    startDate: datetime
    lastUpdated: datetime


class FinancialFreedomUpdate(BaseModel):
    steps: List[BabyStep]
    startDate: Optional[datetime] = None


class FinancialFreedomResponse(BaseModel):
    userId: str
    steps: List[BabyStep]
    startDate: datetime
    lastUpdated: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Tests ============

class TestBabyStepValidation:
    """Tests for BabyStep schema validation."""

    def test_valid_baby_step(self):
        """Valid BabyStep is accepted."""
        step = BabyStep(
            id=1,
            titleKey="step1.title",
            descriptionKey="step1.description",
            isCompleted=False,
            progress=50.0,
            targetAmount=1000.0,
            currentAmount=500.0
        )
        assert step.id == 1
        assert step.progress == 50.0

    def test_minimal_baby_step(self):
        """BabyStep with only required fields is valid."""
        step = BabyStep(
            id=1,
            titleKey="title",
            descriptionKey="desc"
        )
        assert step.isCompleted is False
        assert step.progress == 0
        assert step.targetAmount is None
        assert step.currentAmount is None
        assert step.completionDate is None
        assert step.notes == ""

    def test_id_must_be_integer(self):
        """BabyStep id must be an integer."""
        with pytest.raises(ValidationError) as exc_info:
            BabyStep(
                id="not_an_int",
                titleKey="title",
                descriptionKey="desc"
            )
        assert "id" in str(exc_info.value)

    def test_title_key_required(self):
        """BabyStep titleKey is required."""
        with pytest.raises(ValidationError) as exc_info:
            BabyStep(
                id=1,
                descriptionKey="desc"
            )
        assert "titleKey" in str(exc_info.value)

    def test_description_key_required(self):
        """BabyStep descriptionKey is required."""
        with pytest.raises(ValidationError) as exc_info:
            BabyStep(
                id=1,
                titleKey="title"
            )
        assert "descriptionKey" in str(exc_info.value)

    def test_is_completed_defaults_to_false(self):
        """isCompleted defaults to False."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.isCompleted is False

    def test_is_completed_accepts_boolean(self):
        """isCompleted accepts boolean values."""
        step_true = BabyStep(id=1, titleKey="t", descriptionKey="d", isCompleted=True)
        step_false = BabyStep(id=1, titleKey="t", descriptionKey="d", isCompleted=False)
        assert step_true.isCompleted is True
        assert step_false.isCompleted is False

    def test_progress_defaults_to_zero(self):
        """progress defaults to 0."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.progress == 0

    def test_progress_accepts_float(self):
        """progress accepts float values."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", progress=75.5)
        assert step.progress == 75.5

    def test_progress_zero(self):
        """progress can be 0."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", progress=0)
        assert step.progress == 0

    def test_progress_hundred(self):
        """progress can be 100."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", progress=100)
        assert step.progress == 100

    def test_progress_accepts_integer(self):
        """progress coerces integers to floats."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", progress=50)
        assert step.progress == 50.0

    def test_target_amount_optional(self):
        """targetAmount is optional."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.targetAmount is None

    def test_target_amount_accepts_float(self):
        """targetAmount accepts float values."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", targetAmount=5000.50)
        assert step.targetAmount == 5000.50

    def test_current_amount_optional(self):
        """currentAmount is optional."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.currentAmount is None

    def test_current_amount_accepts_float(self):
        """currentAmount accepts float values."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", currentAmount=2500.25)
        assert step.currentAmount == 2500.25

    def test_completion_date_optional(self):
        """completionDate is optional."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.completionDate is None

    def test_completion_date_accepts_datetime(self):
        """completionDate accepts datetime values."""
        now = datetime.now(timezone.utc)
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", completionDate=now)
        assert step.completionDate == now

    def test_completion_date_accepts_iso_string(self):
        """completionDate accepts ISO format strings."""
        step = BabyStep(
            id=1,
            titleKey="t",
            descriptionKey="d",
            completionDate="2024-01-15T10:30:00Z"
        )
        assert step.completionDate is not None

    def test_notes_defaults_to_empty_string(self):
        """notes defaults to empty string."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d")
        assert step.notes == ""

    def test_notes_accepts_string(self):
        """notes accepts string values."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", notes="My progress notes")
        assert step.notes == "My progress notes"

    def test_notes_accepts_none(self):
        """notes accepts None."""
        step = BabyStep(id=1, titleKey="t", descriptionKey="d", notes=None)
        assert step.notes is None


class TestBabyStepIds:
    """Tests for BabyStep ID values (representing Dave Ramsey's 7 Baby Steps)."""

    @pytest.mark.parametrize("step_id", [1, 2, 3, 4, 5, 6, 7])
    def test_valid_baby_step_ids(self, step_id):
        """Standard baby step IDs (1-7) are valid."""
        step = BabyStep(id=step_id, titleKey="t", descriptionKey="d")
        assert step.id == step_id

    def test_zero_id_valid(self):
        """Zero is a valid ID (though not standard)."""
        step = BabyStep(id=0, titleKey="t", descriptionKey="d")
        assert step.id == 0

    def test_negative_id_valid(self):
        """Negative IDs are technically valid (no constraint)."""
        step = BabyStep(id=-1, titleKey="t", descriptionKey="d")
        assert step.id == -1


class TestFinancialFreedomCreate:
    """Tests for FinancialFreedomCreate schema."""

    def test_valid_create(self):
        """Valid FinancialFreedomCreate is accepted."""
        now = datetime.now(timezone.utc)
        data = FinancialFreedomCreate(
            userId="user@example.com",
            steps=[
                BabyStep(id=1, titleKey="t1", descriptionKey="d1"),
                BabyStep(id=2, titleKey="t2", descriptionKey="d2"),
            ],
            startDate=now,
            lastUpdated=now
        )
        assert data.userId == "user@example.com"
        assert len(data.steps) == 2

    def test_user_id_required(self):
        """userId is required."""
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError) as exc_info:
            FinancialFreedomCreate(
                steps=[],
                startDate=now,
                lastUpdated=now
            )
        assert "userId" in str(exc_info.value)

    def test_start_date_required(self):
        """startDate is required."""
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError) as exc_info:
            FinancialFreedomCreate(
                userId="user@example.com",
                steps=[],
                lastUpdated=now
            )
        assert "startDate" in str(exc_info.value)

    def test_last_updated_required(self):
        """lastUpdated is required."""
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError) as exc_info:
            FinancialFreedomCreate(
                userId="user@example.com",
                steps=[],
                startDate=now
            )
        assert "lastUpdated" in str(exc_info.value)

    def test_empty_steps_allowed(self):
        """Empty steps list is valid."""
        now = datetime.now(timezone.utc)
        data = FinancialFreedomCreate(
            userId="user@example.com",
            steps=[],
            startDate=now,
            lastUpdated=now
        )
        assert data.steps == []


class TestFinancialFreedomUpdate:
    """Tests for FinancialFreedomUpdate schema."""

    def test_valid_update(self):
        """Valid FinancialFreedomUpdate is accepted."""
        data = FinancialFreedomUpdate(
            steps=[
                BabyStep(id=1, titleKey="t1", descriptionKey="d1", isCompleted=True),
            ]
        )
        assert len(data.steps) == 1
        assert data.steps[0].isCompleted is True

    def test_start_date_optional(self):
        """startDate is optional in updates."""
        data = FinancialFreedomUpdate(steps=[])
        assert data.startDate is None

    def test_start_date_can_be_set(self):
        """startDate can be set in updates."""
        now = datetime.now(timezone.utc)
        data = FinancialFreedomUpdate(
            steps=[],
            startDate=now
        )
        assert data.startDate == now


class TestFinancialFreedomResponse:
    """Tests for FinancialFreedomResponse schema."""

    def test_valid_response(self):
        """Valid FinancialFreedomResponse is created."""
        now = datetime.now(timezone.utc)
        response = FinancialFreedomResponse(
            userId="user@example.com",
            steps=[
                BabyStep(id=1, titleKey="t1", descriptionKey="d1"),
            ],
            startDate=now,
            lastUpdated=now
        )
        assert response.userId == "user@example.com"
        assert len(response.steps) == 1

    def test_from_attributes_enabled(self):
        """Response can be created from ORM objects."""
        # This tests the Config.from_attributes setting
        assert FinancialFreedomResponse.model_config.get("from_attributes") is True


class TestBabyStepProgressScenarios:
    """Tests for realistic Baby Step progress scenarios."""

    def test_step1_starter_emergency_fund(self):
        """Step 1: $1,000 starter emergency fund."""
        step = BabyStep(
            id=1,
            titleKey="babySteps.step1.title",
            descriptionKey="babySteps.step1.description",
            isCompleted=False,
            progress=75.0,
            targetAmount=1000.0,
            currentAmount=750.0
        )
        assert step.progress == 75.0
        assert step.targetAmount == 1000.0

    def test_step2_debt_payoff(self):
        """Step 2: Pay off all debt (debt snowball)."""
        step = BabyStep(
            id=2,
            titleKey="babySteps.step2.title",
            descriptionKey="babySteps.step2.description",
            isCompleted=True,
            progress=100.0,
            targetAmount=25000.0,
            currentAmount=0.0,
            completionDate=datetime(2024, 6, 15, tzinfo=timezone.utc),
            notes="Paid off all credit cards and car loan!"
        )
        assert step.isCompleted is True
        assert step.progress == 100.0
        assert step.completionDate is not None

    def test_step3_full_emergency_fund(self):
        """Step 3: 3-6 months of expenses emergency fund."""
        step = BabyStep(
            id=3,
            titleKey="babySteps.step3.title",
            descriptionKey="babySteps.step3.description",
            isCompleted=False,
            progress=40.0,
            targetAmount=18000.0,
            currentAmount=7200.0
        )
        assert step.targetAmount == 18000.0
        assert step.currentAmount == 7200.0

    def test_step4_retirement_investing(self):
        """Step 4: Invest 15% of income for retirement."""
        step = BabyStep(
            id=4,
            titleKey="babySteps.step4.title",
            descriptionKey="babySteps.step4.description",
            isCompleted=False,
            progress=100.0,  # Ongoing step - always contributing
            notes="Contributing 15% to 401k and Roth IRA"
        )
        assert step.progress == 100.0

    def test_step7_wealth_building(self):
        """Step 7: Build wealth and give generously."""
        step = BabyStep(
            id=7,
            titleKey="babySteps.step7.title",
            descriptionKey="babySteps.step7.description",
            isCompleted=False,
            progress=0.0,
            notes="Not started yet - completing earlier steps"
        )
        assert step.progress == 0.0
        assert step.isCompleted is False
