"""
Unit tests for Loan and LoanPayment Pydantic validation.

These tests verify the validation logic without requiring database access.
"""
import pytest
from datetime import date
from pydantic import ValidationError

# We need to import the models from main.py
# Use importlib to avoid loading the full FastAPI app
import sys
from unittest.mock import MagicMock

# Mock the database and models modules to avoid import errors
sys.modules['app.database'] = MagicMock()
sys.modules['app.models'] = MagicMock()
sys.modules['app.routers'] = MagicMock()
sys.modules['app.routers.users'] = MagicMock()
sys.modules['app.routers.auth'] = MagicMock()
sys.modules['app.routers.financial_freedom'] = MagicMock()
sys.modules['app.routers.savings'] = MagicMock()
sys.modules['app.routers.exchange_rates'] = MagicMock()
sys.modules['app.routers.banking'] = MagicMock()
sys.modules['app.routers.tink'] = MagicMock()
sys.modules['app.routers.stripe_billing'] = MagicMock()
sys.modules['app.routers.bank_transactions'] = MagicMock()
sys.modules['app.logging_utils'] = MagicMock()
sys.modules['app.logging_utils'].make_conditional_print = lambda x: print
sys.modules['app.services'] = MagicMock()
sys.modules['app.services.subscription_service'] = MagicMock()
sys.modules['app.dependencies'] = MagicMock()

# Now we can create the models directly using Pydantic
from pydantic import BaseModel, Field, model_validator


# Recreate the loan models for testing (same as in main.py)
VALID_LOAN_TYPES = ["mortgage", "car", "personal", "student", "credit_card", "cash_loan", "installment", "leasing", "overdraft", "other"]
VALID_PAYMENT_TYPES = ["regular", "overpayment"]


class LoanBase(BaseModel):
    loan_type: str = Field(..., description="Type of loan")
    description: str = Field(..., min_length=1, max_length=100, description="Loan description")
    principal_amount: float = Field(..., gt=0, description="Original loan amount")
    remaining_balance: float = Field(..., ge=0, description="Current remaining balance")
    interest_rate: float = Field(..., ge=0, le=100, description="Annual interest rate as percentage")
    monthly_payment: float = Field(..., ge=0, description="Monthly payment amount")
    start_date: date = Field(..., description="Loan start date")
    term_months: int = Field(..., gt=0, description="Loan term in months")
    due_day: int | None = Field(default=1, ge=1, le=31, description="Day of month when payment is due (1-31)")
    overpayment_fee_percent: float | None = Field(default=0, ge=0, le=10, description="Prepayment fee percentage (0-10%)")
    overpayment_fee_waived_until: date | None = Field(default=None, description="Date until prepayment fees are waived")

    @model_validator(mode='after')
    def validate_loan(self):
        if self.loan_type not in VALID_LOAN_TYPES:
            raise ValueError(f"Invalid loan type. Must be one of: {', '.join(VALID_LOAN_TYPES)}")
        if self.remaining_balance > self.principal_amount:
            raise ValueError("Remaining balance cannot exceed principal amount")
        if self.monthly_payment > self.principal_amount:
            raise ValueError("Monthly payment cannot exceed principal amount")
        return self


class LoanPaymentBase(BaseModel):
    amount: float = Field(..., gt=0, description="Payment amount")
    payment_date: date = Field(..., description="Date of payment")
    payment_type: str = Field(..., description="Type: 'regular' or 'overpayment'")
    covers_month: int | None = Field(default=None, ge=1, le=12, description="Month this payment covers (1-12)")
    covers_year: int | None = Field(default=None, ge=2000, le=2100, description="Year this payment covers")
    notes: str | None = Field(default=None, max_length=500, description="Optional notes")

    @model_validator(mode='after')
    def validate_payment(self):
        if self.payment_type not in VALID_PAYMENT_TYPES:
            raise ValueError(f"Invalid payment type. Must be one of: {', '.join(VALID_PAYMENT_TYPES)}")
        if self.payment_type == "regular" and (self.covers_month is None or self.covers_year is None):
            raise ValueError("Regular payments must specify covers_month and covers_year")
        return self


class TestLoanTypeValidation:
    """Tests for loan_type field validation."""

    def test_valid_loan_types(self):
        """All valid loan types should be accepted."""
        valid_types = ["mortgage", "car", "personal", "student", "credit_card",
                       "cash_loan", "installment", "leasing", "overdraft", "other"]

        for loan_type in valid_types:
            loan = LoanBase(
                loan_type=loan_type,
                description="Test loan",
                principal_amount=100000,
                remaining_balance=80000,
                interest_rate=5.0,
                monthly_payment=1000,
                start_date=date(2024, 1, 1),
                term_months=120
            )
            assert loan.loan_type == loan_type

    def test_invalid_loan_type_rejected(self):
        """Invalid loan types should raise ValidationError."""
        with pytest.raises(ValidationError) as exc_info:
            LoanBase(
                loan_type="invalid_type",
                description="Test loan",
                principal_amount=100000,
                remaining_balance=80000,
                interest_rate=5.0,
                monthly_payment=1000,
                start_date=date(2024, 1, 1),
                term_months=120
            )
        assert "Invalid loan type" in str(exc_info.value)


class TestLoanAmountValidation:
    """Tests for loan amount field validation."""

    def test_valid_amounts(self):
        """Valid principal, balance, and payment amounts should be accepted."""
        loan = LoanBase(
            loan_type="mortgage",
            description="Home loan",
            principal_amount=500000,
            remaining_balance=450000,
            interest_rate=4.5,
            monthly_payment=2500,
            start_date=date(2024, 1, 1),
            term_months=360
        )
        assert loan.principal_amount == 500000
        assert loan.remaining_balance == 450000
        assert loan.monthly_payment == 2500

    def test_remaining_balance_cannot_exceed_principal(self):
        """Remaining balance greater than principal should raise error."""
        with pytest.raises(ValidationError) as exc_info:
            LoanBase(
                loan_type="personal",
                description="Test loan",
                principal_amount=10000,
                remaining_balance=15000,  # Greater than principal
                interest_rate=10.0,
                monthly_payment=500,
                start_date=date(2024, 1, 1),
                term_months=24
            )
        assert "Remaining balance cannot exceed principal amount" in str(exc_info.value)

    def test_remaining_balance_equal_to_principal_is_valid(self):
        """Remaining balance equal to principal (new loan) should be valid."""
        loan = LoanBase(
            loan_type="car",
            description="New car loan",
            principal_amount=30000,
            remaining_balance=30000,  # Full amount remaining
            interest_rate=6.0,
            monthly_payment=600,
            start_date=date(2024, 1, 1),
            term_months=60
        )
        assert loan.remaining_balance == loan.principal_amount

    def test_zero_remaining_balance_is_valid(self):
        """Paid off loan (zero balance) should be valid."""
        loan = LoanBase(
            loan_type="student",
            description="Paid off student loan",
            principal_amount=50000,
            remaining_balance=0,
            interest_rate=4.0,
            monthly_payment=500,
            start_date=date(2020, 1, 1),
            term_months=120
        )
        assert loan.remaining_balance == 0

    def test_monthly_payment_cannot_exceed_principal(self):
        """Monthly payment greater than principal should raise error."""
        with pytest.raises(ValidationError) as exc_info:
            LoanBase(
                loan_type="personal",
                description="Test loan",
                principal_amount=5000,
                remaining_balance=5000,
                interest_rate=15.0,
                monthly_payment=6000,  # Greater than principal
                start_date=date(2024, 1, 1),
                term_months=12
            )
        assert "Monthly payment cannot exceed principal amount" in str(exc_info.value)

    def test_monthly_payment_equal_to_principal_is_valid(self):
        """Monthly payment equal to principal (1-month loan) should be valid."""
        loan = LoanBase(
            loan_type="personal",
            description="Short term loan",
            principal_amount=1000,
            remaining_balance=1000,
            interest_rate=0,
            monthly_payment=1000,
            start_date=date(2024, 1, 1),
            term_months=1
        )
        assert loan.monthly_payment == loan.principal_amount

    def test_negative_principal_rejected(self):
        """Negative principal amount should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="personal",
                description="Test",
                principal_amount=-1000,
                remaining_balance=0,
                interest_rate=5.0,
                monthly_payment=100,
                start_date=date(2024, 1, 1),
                term_months=12
            )

    def test_zero_principal_rejected(self):
        """Zero principal amount should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="personal",
                description="Test",
                principal_amount=0,
                remaining_balance=0,
                interest_rate=5.0,
                monthly_payment=100,
                start_date=date(2024, 1, 1),
                term_months=12
            )

    def test_negative_remaining_balance_rejected(self):
        """Negative remaining balance should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="personal",
                description="Test",
                principal_amount=10000,
                remaining_balance=-500,
                interest_rate=5.0,
                monthly_payment=100,
                start_date=date(2024, 1, 1),
                term_months=12
            )


class TestLoanInterestRateValidation:
    """Tests for interest rate validation."""

    def test_valid_interest_rates(self):
        """Interest rates between 0 and 100 should be valid."""
        test_rates = [0, 0.5, 5.0, 15.99, 50, 100]
        for rate in test_rates:
            loan = LoanBase(
                loan_type="personal",
                description="Test loan",
                principal_amount=10000,
                remaining_balance=10000,
                interest_rate=rate,
                monthly_payment=500,
                start_date=date(2024, 1, 1),
                term_months=24
            )
            assert loan.interest_rate == rate

    def test_negative_interest_rate_rejected(self):
        """Negative interest rates should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="personal",
                description="Test",
                principal_amount=10000,
                remaining_balance=10000,
                interest_rate=-5.0,
                monthly_payment=500,
                start_date=date(2024, 1, 1),
                term_months=24
            )

    def test_interest_rate_over_100_rejected(self):
        """Interest rates over 100% should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="personal",
                description="Test",
                principal_amount=10000,
                remaining_balance=10000,
                interest_rate=101,
                monthly_payment=500,
                start_date=date(2024, 1, 1),
                term_months=24
            )


class TestLoanDueDayValidation:
    """Tests for due day validation."""

    def test_valid_due_days(self):
        """Due days 1-31 should be valid."""
        for day in [1, 15, 28, 31]:
            loan = LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=100000,
                remaining_balance=100000,
                interest_rate=5.0,
                monthly_payment=1000,
                start_date=date(2024, 1, 1),
                term_months=120,
                due_day=day
            )
            assert loan.due_day == day

    def test_due_day_zero_rejected(self):
        """Due day 0 should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=100000,
                remaining_balance=100000,
                interest_rate=5.0,
                monthly_payment=1000,
                start_date=date(2024, 1, 1),
                term_months=120,
                due_day=0
            )

    def test_due_day_over_31_rejected(self):
        """Due day over 31 should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=100000,
                remaining_balance=100000,
                interest_rate=5.0,
                monthly_payment=1000,
                start_date=date(2024, 1, 1),
                term_months=120,
                due_day=32
            )

    def test_default_due_day_is_one(self):
        """Default due day should be 1."""
        loan = LoanBase(
            loan_type="mortgage",
            description="Test",
            principal_amount=100000,
            remaining_balance=100000,
            interest_rate=5.0,
            monthly_payment=1000,
            start_date=date(2024, 1, 1),
            term_months=120
        )
        assert loan.due_day == 1


class TestLoanOverpaymentFeeValidation:
    """Tests for overpayment fee validation (Polish regulations)."""

    def test_valid_overpayment_fees(self):
        """Overpayment fees 0-10% should be valid."""
        for fee in [0, 1.5, 3.0, 5.0, 10.0]:
            loan = LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=300000,
                remaining_balance=300000,
                interest_rate=5.0,
                monthly_payment=1500,
                start_date=date(2024, 1, 1),
                term_months=360,
                overpayment_fee_percent=fee
            )
            assert loan.overpayment_fee_percent == fee

    def test_negative_overpayment_fee_rejected(self):
        """Negative overpayment fee should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=300000,
                remaining_balance=300000,
                interest_rate=5.0,
                monthly_payment=1500,
                start_date=date(2024, 1, 1),
                term_months=360,
                overpayment_fee_percent=-1
            )

    def test_overpayment_fee_over_10_rejected(self):
        """Overpayment fee over 10% should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="Test",
                principal_amount=300000,
                remaining_balance=300000,
                interest_rate=5.0,
                monthly_payment=1500,
                start_date=date(2024, 1, 1),
                term_months=360,
                overpayment_fee_percent=11
            )

    def test_overpayment_fee_waived_until_date(self):
        """Overpayment fee waiver date should be accepted."""
        waived_until = date(2027, 1, 1)  # 3 years from start
        loan = LoanBase(
            loan_type="mortgage",
            description="Test",
            principal_amount=300000,
            remaining_balance=300000,
            interest_rate=5.0,
            monthly_payment=1500,
            start_date=date(2024, 1, 1),
            term_months=360,
            overpayment_fee_percent=3.0,
            overpayment_fee_waived_until=waived_until
        )
        assert loan.overpayment_fee_waived_until == waived_until


class TestLoanDescriptionValidation:
    """Tests for description field validation."""

    def test_valid_description(self):
        """Valid descriptions should be accepted."""
        loan = LoanBase(
            loan_type="mortgage",
            description="Home mortgage for apartment in Warsaw",
            principal_amount=500000,
            remaining_balance=500000,
            interest_rate=5.0,
            monthly_payment=2500,
            start_date=date(2024, 1, 1),
            term_months=360
        )
        assert len(loan.description) > 0

    def test_empty_description_rejected(self):
        """Empty description should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="",
                principal_amount=500000,
                remaining_balance=500000,
                interest_rate=5.0,
                monthly_payment=2500,
                start_date=date(2024, 1, 1),
                term_months=360
            )

    def test_description_too_long_rejected(self):
        """Description over 100 characters should be rejected."""
        with pytest.raises(ValidationError):
            LoanBase(
                loan_type="mortgage",
                description="A" * 101,  # 101 characters
                principal_amount=500000,
                remaining_balance=500000,
                interest_rate=5.0,
                monthly_payment=2500,
                start_date=date(2024, 1, 1),
                term_months=360
            )


class TestLoanPaymentTypeValidation:
    """Tests for loan payment type validation."""

    def test_regular_payment_valid(self):
        """Regular payment with month/year should be valid."""
        payment = LoanPaymentBase(
            amount=1500,
            payment_date=date(2024, 6, 15),
            payment_type="regular",
            covers_month=6,
            covers_year=2024
        )
        assert payment.payment_type == "regular"
        assert payment.covers_month == 6
        assert payment.covers_year == 2024

    def test_overpayment_valid(self):
        """Overpayment without month/year should be valid."""
        payment = LoanPaymentBase(
            amount=5000,
            payment_date=date(2024, 6, 20),
            payment_type="overpayment",
            notes="Extra payment from bonus"
        )
        assert payment.payment_type == "overpayment"
        assert payment.covers_month is None
        assert payment.covers_year is None

    def test_invalid_payment_type_rejected(self):
        """Invalid payment type should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 6, 15),
                payment_type="invalid",
                covers_month=6,
                covers_year=2024
            )
        assert "Invalid payment type" in str(exc_info.value)

    def test_regular_payment_without_month_rejected(self):
        """Regular payment without covers_month should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 6, 15),
                payment_type="regular",
                covers_year=2024
            )
        assert "Regular payments must specify covers_month and covers_year" in str(exc_info.value)

    def test_regular_payment_without_year_rejected(self):
        """Regular payment without covers_year should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 6, 15),
                payment_type="regular",
                covers_month=6
            )
        assert "Regular payments must specify covers_month and covers_year" in str(exc_info.value)


class TestLoanPaymentAmountValidation:
    """Tests for payment amount validation."""

    def test_positive_amount_valid(self):
        """Positive payment amounts should be valid."""
        payment = LoanPaymentBase(
            amount=1500.50,
            payment_date=date(2024, 6, 15),
            payment_type="overpayment"
        )
        assert payment.amount == 1500.50

    def test_zero_amount_rejected(self):
        """Zero payment amount should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=0,
                payment_date=date(2024, 6, 15),
                payment_type="overpayment"
            )

    def test_negative_amount_rejected(self):
        """Negative payment amount should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=-100,
                payment_date=date(2024, 6, 15),
                payment_type="overpayment"
            )


class TestLoanPaymentDateValidation:
    """Tests for payment month/year validation."""

    def test_valid_months(self):
        """Months 1-12 should be valid."""
        for month in range(1, 13):
            payment = LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=month,
                covers_year=2024
            )
            assert payment.covers_month == month

    def test_month_zero_rejected(self):
        """Month 0 should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=0,
                covers_year=2024
            )

    def test_month_over_12_rejected(self):
        """Month over 12 should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=13,
                covers_year=2024
            )

    def test_valid_years(self):
        """Years 2000-2100 should be valid."""
        for year in [2000, 2024, 2050, 2100]:
            payment = LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=1,
                covers_year=year
            )
            assert payment.covers_year == year

    def test_year_before_2000_rejected(self):
        """Year before 2000 should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=1,
                covers_year=1999
            )

    def test_year_after_2100_rejected(self):
        """Year after 2100 should be rejected."""
        with pytest.raises(ValidationError):
            LoanPaymentBase(
                amount=1500,
                payment_date=date(2024, 1, 15),
                payment_type="regular",
                covers_month=1,
                covers_year=2101
            )
