"""
Integration tests for monthly breakdown endpoints.

Tests the /expenses/monthly and /income/monthly endpoints that provide
bank vs manual reconciliation data.
"""
import pytest
from datetime import datetime
from app.models import Expense, Income, BankTransaction


class TestMonthlyExpensesBreakdown:
    """Test /users/{id}/expenses/monthly endpoint."""

    def test_get_monthly_expenses_breakdown_success(self, client, test_user, auth_headers, db_session):
        """Should return breakdown of bank vs manual expenses."""
        # Create test data for February 2026
        # Bank-backed expense
        bank_tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_test_001",
            tink_account_id="acc_test_001",
            description_display="Gas Station",
            amount=-100.0,
            currency="PLN",
            date=datetime(2026, 2, 15),
            status="converted"
        )
        db_session.add(bank_tx)
        db_session.flush()

        expense_bank = Expense(
            user_id=test_user.id,
            category="transport",
            description="Gas from bank",
            amount=100.0,
            date=datetime(2026, 2, 15),
            is_recurring=False,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
            reconciliation_status="bank_backed"
        )
        db_session.add(expense_bank)

        # Manual expense
        expense_manual = Expense(
            user_id=test_user.id,
            category="food",
            description="Cash groceries",
            amount=50.0,
            date=datetime(2026, 2, 20),
            is_recurring=False,
            source="manual",
            reconciliation_status="manual_confirmed"
        )
        db_session.add(expense_manual)

        db_session.commit()

        # Call endpoint
        response = client.get(
            f"/users/{test_user.id}/expenses/monthly?month=2026-02",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "month" in data
        assert "total" in data
        assert "from_bank" in data
        assert "from_manual" in data
        assert "breakdown" in data

        # Verify values
        assert data["month"] == "2026-02"
        assert data["total"] == 150.0  # 100 + 50
        assert data["from_bank"] == 100.0
        assert data["from_manual"] == 50.0
        assert data["breakdown"]["bank_count"] == 1
        assert data["breakdown"]["manual_count"] == 1

    def test_get_monthly_expenses_excludes_duplicates(self, client, test_user, auth_headers, db_session):
        """Should exclude entries marked as duplicates."""
        # Bank-backed expense
        bank_tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_test_002",
            tink_account_id="acc_test_001",
            description_display="Netflix Subscription",
            amount=-30.0,
            currency="PLN",
            date=datetime(2026, 2, 10),
            status="converted"
        )
        db_session.add(bank_tx)
        db_session.flush()

        expense_bank = Expense(
            user_id=test_user.id,
            category="subscriptions",
            description="Netflix",
            amount=30.0,
            date=datetime(2026, 2, 10),
            is_recurring=False,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
            reconciliation_status="bank_backed"
        )
        db_session.add(expense_bank)

        # Manual entry marked as duplicate
        expense_duplicate = Expense(
            user_id=test_user.id,
            category="subscriptions",
            description="Netflix manual entry",
            amount=30.0,
            date=datetime(2026, 2, 10),
            is_recurring=False,
            source="manual",
            reconciliation_status="duplicate_of_bank",
            duplicate_bank_transaction_id=bank_tx.id
        )
        db_session.add(expense_duplicate)

        db_session.commit()

        response = client.get(
            f"/users/{test_user.id}/expenses/monthly?month=2026-02",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Should only count the bank entry, not the duplicate
        assert data["total"] == 30.0
        assert data["from_bank"] == 30.0
        assert data["from_manual"] == 0.0
        assert data["breakdown"]["duplicate_count"] == 1

    def test_get_monthly_expenses_no_month_uses_current(self, client, test_user, auth_headers, db_session):
        """Should use current month when month parameter not provided."""
        response = client.get(
            f"/users/{test_user.id}/expenses/monthly",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Should have current month in YYYY-MM format
        current_month = datetime.now().strftime("%Y-%m")
        assert data["month"] == current_month

    def test_get_monthly_expenses_invalid_month_format(self, client, test_user, auth_headers):
        """Should return 400 for invalid month format."""
        response = client.get(
            f"/users/{test_user.id}/expenses/monthly?month=invalid",
            headers=auth_headers
        )

        assert response.status_code == 400


class TestMonthlyIncomeBreakdown:
    """Test /users/{id}/income/monthly endpoint."""

    def test_get_monthly_income_breakdown_success(self, client, test_user, auth_headers, db_session):
        """Should return breakdown of bank vs manual income."""
        # Create test data for February 2026
        # Bank-backed income
        bank_tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_test_003",
            tink_account_id="acc_test_001",
            description_display="Salary deposit",
            amount=5000.0,
            currency="PLN",
            date=datetime(2026, 2, 1),
            status="converted"
        )
        db_session.add(bank_tx)
        db_session.flush()

        income_bank = Income(
            user_id=test_user.id,
            category="salary",
            description="Monthly salary",
            amount=5000.0,
            date=datetime(2026, 2, 1),
            is_recurring=True,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
            reconciliation_status="bank_backed"
        )
        db_session.add(income_bank)

        # Manual income
        income_manual = Income(
            user_id=test_user.id,
            category="freelance",
            description="Cash payment",
            amount=500.0,
            date=datetime(2026, 2, 15),
            is_recurring=False,
            source="manual",
            reconciliation_status="manual_confirmed"
        )
        db_session.add(income_manual)

        db_session.commit()

        # Call endpoint
        response = client.get(
            f"/users/{test_user.id}/income/monthly?month=2026-02",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "month" in data
        assert "total" in data
        assert "from_bank" in data
        assert "from_manual" in data
        assert "breakdown" in data

        # Verify values
        assert data["month"] == "2026-02"
        assert data["total"] == 5500.0  # 5000 + 500
        assert data["from_bank"] == 5000.0
        assert data["from_manual"] == 500.0
        assert data["breakdown"]["bank_count"] == 1
        assert data["breakdown"]["manual_count"] == 1

    def test_get_monthly_income_excludes_duplicates(self, client, test_user, auth_headers, db_session):
        """Should exclude income entries marked as duplicates."""
        # Bank-backed income
        bank_tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_test_004",
            tink_account_id="acc_test_001",
            description_display="Interest payment",
            amount=100.0,
            currency="PLN",
            date=datetime(2026, 2, 28),
            status="converted"
        )
        db_session.add(bank_tx)
        db_session.flush()

        income_bank = Income(
            user_id=test_user.id,
            category="investment",
            description="Interest",
            amount=100.0,
            date=datetime(2026, 2, 28),
            is_recurring=False,
            source="bank_import",
            bank_transaction_id=bank_tx.id,
            reconciliation_status="bank_backed"
        )
        db_session.add(income_bank)

        # Manual entry marked as duplicate
        income_duplicate = Income(
            user_id=test_user.id,
            category="investment",
            description="Interest manual",
            amount=100.0,
            date=datetime(2026, 2, 28),
            is_recurring=False,
            source="manual",
            reconciliation_status="duplicate_of_bank",
            duplicate_bank_transaction_id=bank_tx.id
        )
        db_session.add(income_duplicate)

        db_session.commit()

        response = client.get(
            f"/users/{test_user.id}/income/monthly?month=2026-02",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()

        # Should only count the bank entry
        assert data["total"] == 100.0
        assert data["from_bank"] == 100.0
        assert data["from_manual"] == 0.0
        assert data["breakdown"]["duplicate_count"] == 1

    def test_get_monthly_income_unauthorized(self, client, test_user):
        """Should return 401 without authentication."""
        response = client.get(
            f"/users/{test_user.id}/income/monthly?month=2026-02"
        )

        assert response.status_code == 401
