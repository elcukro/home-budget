"""
Integration tests for reconciliation API endpoints.

Tests the full HTTP request/response cycle for:
- GET /users/{email}/reconciliation/suggestions
- POST /users/{email}/reconciliation/expenses/{id}/mark-duplicate
- POST /users/{email}/reconciliation/expenses/{id}/confirm-separate
- POST /users/{email}/reconciliation/income/{id}/mark-duplicate
- POST /users/{email}/reconciliation/income/{id}/confirm-separate
"""
import pytest
from datetime import date
from app import models


class TestReconciliationSuggestions:
    """Test GET /users/{email}/reconciliation/suggestions endpoint."""

    def test_get_suggestions_empty(self, client, db_session, auth_headers):
        """Test suggestions endpoint with no data."""
        response = client.get(
            "/users/test@example.com/reconciliation/suggestions",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_suggestions_with_matches(self, client, db_session, test_user, auth_headers):
        """Test suggestions endpoint returns potential duplicates."""
        # Add bank transaction
        bank_tx = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Biedronka",
            status="pending"
        )
        db_session.add(bank_tx)

        # Add manual expense (potential duplicate)
        expense = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Biedronka",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        response = client.get(
            "/users/test@example.com/reconciliation/suggestions",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["entry_type"] == "expense"
        assert data[0]["match_score"] >= 0.7
        assert data[0]["manual_entry_id"] == expense.id
        assert data[0]["bank_transaction_id"] == bank_tx.id

    def test_get_suggestions_filter_by_month(self, client, db_session, test_user, auth_headers):
        """Test month filter parameter."""
        

        # Add Feb expense
        bank_tx_feb = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_feb",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Lidl",
            status="pending"
        )
        expense_feb = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Lidl",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )

        # Add March expense
        bank_tx_march = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_march",
            tink_account_id="acc1",
            amount=-150.0,
            currency="PLN",
            date=date(2026, 3, 10),
            description_display="Carrefour",
            status="pending"
        )
        expense_march = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Carrefour",
            amount=150.0,
            date=date(2026, 3, 10),
            reconciliation_status="unreviewed"
        )

        db_session.add_all([bank_tx_feb, expense_feb, bank_tx_march, expense_march])
        db_session.commit()

        # Filter for February only
        response = client.get(
            "/users/test@example.com/reconciliation/suggestions?month=2",
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["manual_entry_id"] == expense_feb.id


class TestMarkExpenseAsDuplicate:
    """Test POST /users/{email}/reconciliation/expenses/{id}/mark-duplicate endpoint."""

    def test_mark_expense_as_duplicate_success(self, client, db_session, test_user, auth_headers):
        """Test successfully marking expense as duplicate."""
        

        # Add bank transaction and manual expense
        bank_tx = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Tesco",
            status="pending"
        )
        expense = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Tesco",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add_all([bank_tx, expense])
        db_session.commit()

        # Mark as duplicate
        response = client.post(
            f"/users/test@example.com/reconciliation/expenses/{expense.id}/mark-duplicate",
            headers=auth_headers,
            json={
                "bank_transaction_id": bank_tx.id,
                "note": "Same transaction, entered manually before bank sync"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["expense_id"] == expense.id
        assert data["bank_transaction_id"] == bank_tx.id

        # Verify database was updated
        db_session.refresh(expense)
        assert expense.reconciliation_status == "duplicate_of_bank"
        assert expense.duplicate_bank_transaction_id == bank_tx.id
        assert expense.reconciliation_note == "Same transaction, entered manually before bank sync"
        assert expense.reconciliation_reviewed_at is not None

    def test_mark_expense_invalid_expense_id(self, client, db_session, test_user, auth_headers):
        """Test marking non-existent expense returns 404."""
        response = client.post(
            "/users/test@example.com/reconciliation/expenses/99999/mark-duplicate",
            headers=auth_headers,
            json={"bank_transaction_id": 1}
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_mark_expense_invalid_bank_transaction_id(self, client, db_session, test_user, auth_headers):
        """Test marking with non-existent bank transaction returns 404."""
        

        expense = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Tesco",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        response = client.post(
            f"/users/test@example.com/reconciliation/expenses/{expense.id}/mark-duplicate",
            headers=auth_headers,
            json={"bank_transaction_id": 99999}
        )

        assert response.status_code == 404
        assert "Bank transaction not found" in response.json()["detail"]

    def test_mark_bank_backed_expense_fails(self, client, db_session, test_user, auth_headers):
        """Test that bank-backed expenses cannot be marked as duplicates."""
        bank_tx = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Tesco",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()  # Commit first to get bank_tx.id
        db_session.refresh(bank_tx)

        expense = models.Expense(
            user_id=test_user.id,
            category="Groceries",
            description="Tesco",
            amount=100.0,
            date=date(2026, 2, 5),
            bank_transaction_id=bank_tx.id,  # Now bank_tx.id is set
            reconciliation_status="bank_backed"
        )
        db_session.add(expense)
        db_session.commit()

        response = client.post(
            f"/users/test@example.com/reconciliation/expenses/{expense.id}/mark-duplicate",
            headers=auth_headers,
            json={"bank_transaction_id": bank_tx.id}
        )

        assert response.status_code == 400
        assert "Cannot mark bank-backed expense" in response.json()["detail"]


class TestConfirmExpenseSeparate:
    """Test POST /users/{email}/reconciliation/expenses/{id}/confirm-separate endpoint."""

    def test_confirm_expense_separate_success(self, client, db_session, test_user, auth_headers):
        """Test successfully confirming expense as separate."""
        

        expense = models.Expense(
            user_id=test_user.id,
            category="Transport",
            description="Bus ticket (cash)",
            amount=50.0,
            date=date(2026, 2, 10),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        response = client.post(
            f"/users/test@example.com/reconciliation/expenses/{expense.id}/confirm-separate",
            headers=auth_headers,
            params={"note": "Paid with cash, no bank record"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["expense_id"] == expense.id

        # Verify database was updated
        db_session.refresh(expense)
        assert expense.reconciliation_status == "manual_confirmed"
        assert expense.reconciliation_note == "Paid with cash, no bank record"
        assert expense.reconciliation_reviewed_at is not None

    def test_confirm_expense_invalid_id(self, client, db_session, test_user, auth_headers):
        """Test confirming non-existent expense returns 404."""
        response = client.post(
            "/users/test@example.com/reconciliation/expenses/99999/confirm-separate",
            headers=auth_headers
        )

        assert response.status_code == 404


class TestIncomeReconciliation:
    """Test income reconciliation endpoints (mirror expense logic)."""

    def test_mark_income_as_duplicate(self, client, db_session, test_user, auth_headers):
        """Test marking income as duplicate."""
        

        bank_tx = models.BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=5000.0,  # Positive = income
            currency="PLN",
            date=date(2026, 2, 1),
            description_display="Salary",
            status="pending"
        )
        income = models.Income(
            user_id=test_user.id,
            category="Salary",
            description="Monthly salary",
            amount=5000.0,
            date=date(2026, 2, 1),
            reconciliation_status="unreviewed"
        )
        db_session.add_all([bank_tx, income])
        db_session.commit()

        response = client.post(
            f"/users/test@example.com/reconciliation/income/{income.id}/mark-duplicate",
            headers=auth_headers,
            json={"bank_transaction_id": bank_tx.id}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify database
        db_session.refresh(income)
        assert income.reconciliation_status == "duplicate_of_bank"
        assert income.duplicate_bank_transaction_id == bank_tx.id

    def test_confirm_income_separate(self, client, db_session, test_user, auth_headers):
        """Test confirming income as separate."""
        

        income = models.Income(
            user_id=test_user.id,
            category="Freelance",
            description="Side project (cash)",
            amount=500.0,
            date=date(2026, 2, 15),
            reconciliation_status="unreviewed"
        )
        db_session.add(income)
        db_session.commit()

        response = client.post(
            f"/users/test@example.com/reconciliation/income/{income.id}/confirm-separate",
            headers=auth_headers
        )

        assert response.status_code == 200

        # Verify database
        db_session.refresh(income)
        assert income.reconciliation_status == "manual_confirmed"
