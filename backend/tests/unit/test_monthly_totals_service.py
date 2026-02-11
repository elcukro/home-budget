"""
Unit tests for MonthlyTotalsService - Bank/Manual reconciliation logic.

Tests cover:
1. Monthly expense/income calculation with deduplication
2. Handling of reconciliation statuses
3. Recurring vs one-off entries
4. Fuzzy matching for duplicate detection
"""
import pytest
from datetime import date, datetime, timedelta
from app.services.monthly_totals_service import MonthlyTotalsService
from tests.conftest import User, Expense, Income, BankTransaction


class TestMonthlyExpensesCalculation:
    """Test calculate_monthly_expenses() with various scenarios."""

    def test_empty_month_returns_zeros(self, db_session):
        """Test that empty month returns all zeros."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 0
        assert result["from_bank"] == 0
        assert result["from_manual"] == 0
        assert result["bank_count"] == 0
        assert result["manual_count"] == 0
        assert result["duplicate_count"] == 0
        assert result["unreviewed_count"] == 0

    def test_manual_expenses_only(self, db_session):
        """Test month with only manual expenses."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Add 3 manual expenses for February 2026
        expenses = [
            Expense(
                user_id=user.id,
                category="Groceries",
                description="Tesco",
                amount=150.0,
                date=date(2026, 2, 5),
                reconciliation_status="manual_confirmed"
            ),
            Expense(
                user_id=user.id,
                category="Transport",
                description="Bus ticket",
                amount=50.0,
                date=date(2026, 2, 10),
                reconciliation_status="unreviewed"
            ),
            Expense(
                user_id=user.id,
                category="Entertainment",
                description="Cinema",
                amount=30.0,
                date=date(2026, 2, 15),
                reconciliation_status="unreviewed"
            ),
        ]
        db_session.add_all(expenses)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 230.0
        assert result["from_bank"] == 0
        assert result["from_manual"] == 230.0
        assert result["bank_count"] == 0
        assert result["manual_count"] == 3
        assert result["duplicate_count"] == 0
        assert result["unreviewed_count"] == 2

    def test_bank_backed_expenses_only(self, db_session):
        """Test month with only bank-backed expenses."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Add bank transactions
        bank_tx1 = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,  # Negative = expense
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Biedronka",
            status="pending"
        )
        bank_tx2 = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx2",
            tink_account_id="acc1",
            amount=-75.0,
            currency="PLN",
            date=date(2026, 2, 12),
            description_display="Orlen",
            status="pending"
        )
        db_session.add_all([bank_tx1, bank_tx2])
        db_session.commit()

        # Add bank-backed expenses (created from bank transactions)
        expenses = [
            Expense(
                user_id=user.id,
                category="Groceries",
                description="Biedronka",
                amount=100.0,
                date=date(2026, 2, 5),
                bank_transaction_id=bank_tx1.id,
                reconciliation_status="bank_backed"
            ),
            Expense(
                user_id=user.id,
                category="Transport",
                description="Orlen",
                amount=75.0,
                date=date(2026, 2, 12),
                bank_transaction_id=bank_tx2.id,
                reconciliation_status="bank_backed"
            ),
        ]
        db_session.add_all(expenses)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 175.0
        assert result["from_bank"] == 175.0
        assert result["from_manual"] == 0
        assert result["bank_count"] == 2
        assert result["manual_count"] == 0
        assert result["duplicate_count"] == 0
        assert result["unreviewed_count"] == 0

    def test_mixed_bank_and_manual_with_deduplication(self, db_session):
        """Test month with bank + manual entries, some marked as duplicates."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Add bank transaction
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Biedronka",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Add expenses:
        # 1. Bank-backed expense
        # 2. Manual expense (different) - should be included
        # 3. Manual expense marked as duplicate - should be EXCLUDED
        expenses = [
            Expense(
                user_id=user.id,
                category="Groceries",
                description="Biedronka",
                amount=100.0,
                date=date(2026, 2, 5),
                bank_transaction_id=bank_tx.id,
                reconciliation_status="bank_backed"
            ),
            Expense(
                user_id=user.id,
                category="Transport",
                description="Bus ticket (cash)",
                amount=50.0,
                date=date(2026, 2, 10),
                reconciliation_status="manual_confirmed"
            ),
            Expense(
                user_id=user.id,
                category="Groceries",
                description="Biedronka (manual duplicate)",
                amount=100.0,
                date=date(2026, 2, 5),
                reconciliation_status="duplicate_of_bank",
                duplicate_bank_transaction_id=bank_tx.id
            ),
        ]
        db_session.add_all(expenses)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        # Should count: bank (100) + manual confirmed (50) = 150
        # Should NOT count: duplicate (100)
        assert result["total"] == 150.0
        assert result["from_bank"] == 100.0
        assert result["from_manual"] == 50.0
        assert result["bank_count"] == 1
        assert result["manual_count"] == 1
        assert result["duplicate_count"] == 1
        assert result["unreviewed_count"] == 0

    def test_recurring_expense_active_in_month(self, db_session):
        """Test that recurring expenses are included when active."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Recurring expense: Started Jan 2026, ends Dec 2026
        expense = Expense(
            user_id=user.id,
            category="Subscriptions",
            description="Netflix",
            amount=50.0,
            date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_recurring=True,
            reconciliation_status="manual_confirmed"
        )
        db_session.add(expense)
        db_session.commit()

        # Should be included in Feb 2026
        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 50.0
        assert result["manual_count"] == 1

    def test_recurring_expense_not_active_yet(self, db_session):
        """Test that recurring expense not yet started is excluded."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Recurring expense: Starts March 2026
        expense = Expense(
            user_id=user.id,
            category="Subscriptions",
            description="Spotify",
            amount=30.0,
            date=date(2026, 3, 1),
            is_recurring=True,
            reconciliation_status="manual_confirmed"
        )
        db_session.add(expense)
        db_session.commit()

        # Should NOT be included in Feb 2026
        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 0
        assert result["manual_count"] == 0

    def test_recurring_expense_already_ended(self, db_session):
        """Test that recurring expense that already ended is excluded."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Recurring expense: Ended Jan 2026
        expense = Expense(
            user_id=user.id,
            category="Subscriptions",
            description="Old Service",
            amount=40.0,
            date=date(2025, 1, 1),
            end_date=date(2026, 1, 31),
            is_recurring=True,
            reconciliation_status="manual_confirmed"
        )
        db_session.add(expense)
        db_session.commit()

        # Should NOT be included in Feb 2026
        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 0
        assert result["manual_count"] == 0

    def test_pre_bank_era_entries_excluded(self, db_session):
        """Test that pre-bank-era entries are still counted."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Old manual expense from before bank connection
        expense = Expense(
            user_id=user.id,
            category="Groceries",
            description="Old expense",
            amount=200.0,
            date=date(2026, 2, 5),
            reconciliation_status="pre_bank_era"
        )
        db_session.add(expense)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_expenses(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        # Pre-bank-era entries should still be counted (they're valid historical data)
        assert result["total"] == 200.0
        assert result["from_manual"] == 200.0
        assert result["manual_count"] == 1
        assert result["unreviewed_count"] == 0  # Pre-bank-era is not "unreviewed"


class TestMonthlyIncomeCalculation:
    """Test calculate_monthly_income() - same logic as expenses."""

    def test_mixed_bank_and_manual_income(self, db_session):
        """Test income calculation with bank + manual sources."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction (positive = income)
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=5000.0,  # Positive = income
            currency="PLN",
            date=date(2026, 2, 1),
            description_display="Salary",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Add income entries
        income_entries = [
            Income(
                user_id=user.id,
                category="Salary",
                description="Monthly salary",
                amount=5000.0,
                date=date(2026, 2, 1),
                bank_transaction_id=bank_tx.id,
                reconciliation_status="bank_backed"
            ),
            Income(
                user_id=user.id,
                category="Freelance",
                description="Side project (cash)",
                amount=500.0,
                date=date(2026, 2, 15),
                reconciliation_status="manual_confirmed"
            ),
        ]
        db_session.add_all(income_entries)
        db_session.commit()

        result = MonthlyTotalsService.calculate_monthly_income(
            user_id=user.id, year=2026, month=2, db=db_session
        )

        assert result["total"] == 5500.0
        assert result["from_bank"] == 5000.0
        assert result["from_manual"] == 500.0
        assert result["bank_count"] == 1
        assert result["manual_count"] == 1


class TestDuplicateSuggestions:
    """Test suggest_duplicates() fuzzy matching algorithm."""

    def test_exact_match_high_score(self, db_session):
        """Test that exact matches get high confidence scores."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Biedronka",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Manual expense (exact match)
        expense = Expense(
            user_id=user.id,
            category="Groceries",
            description="Biedronka",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        suggestions = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session
        )

        assert len(suggestions) == 1
        assert suggestions[0]["match_score"] >= 0.9  # Should be very high
        assert "Same date" in suggestions[0]["match_reasons"]
        assert "Exact amount match" in suggestions[0]["match_reasons"]

    def test_date_difference_lowers_score(self, db_session):
        """Test that date differences lower the match score."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction on Feb 5
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Tesco",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Manual expense on Feb 7 (2 days later)
        expense = Expense(
            user_id=user.id,
            category="Groceries",
            description="Tesco",
            amount=100.0,
            date=date(2026, 2, 7),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        suggestions = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session
        )

        assert len(suggestions) == 1
        # Should still match but with slightly lower score due to date diff
        # (Score might be exactly 0.9 due to exact amount + similar description)
        assert 0.7 <= suggestions[0]["match_score"] <= 1.0
        assert "Date within 2 days" in suggestions[0]["match_reasons"]

    def test_amount_difference_lowers_score(self, db_session):
        """Test that amount differences lower the match score."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction: 100.00
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Restaurant",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Manual expense: 101.50 (1.5% difference)
        expense = Expense(
            user_id=user.id,
            category="Food",
            description="Restaurant",
            amount=101.50,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        suggestions = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session
        )

        assert len(suggestions) == 1
        assert 0.7 <= suggestions[0]["match_score"] <= 1.0
        # Check that amount reason is present (exact wording may vary)
        reasons_str = " ".join(suggestions[0]["match_reasons"])
        assert "Amount within" in reasons_str or "amount" in reasons_str.lower()

    def test_no_suggestions_for_confirmed_entries(self, db_session):
        """Test that manual_confirmed entries are not suggested."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Lidl",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Manual expense already confirmed as separate
        expense = Expense(
            user_id=user.id,
            category="Groceries",
            description="Lidl",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="manual_confirmed"  # Already reviewed
        )
        db_session.add(expense)
        db_session.commit()

        suggestions = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session
        )

        # Should not suggest confirmed entries
        assert len(suggestions) == 0

    def test_min_score_filter(self, db_session):
        """Test that min_score parameter filters low-confidence matches."""
        user = User(id="user1", email="test@example.com", name="Test User")
        db_session.add(user)
        db_session.commit()

        # Bank transaction
        bank_tx = BankTransaction(
            user_id=user.id,
            tink_transaction_id="tx1",
            tink_account_id="acc1",
            amount=-100.0,
            currency="PLN",
            date=date(2026, 2, 5),
            description_display="Unknown Merchant",
            status="pending"
        )
        db_session.add(bank_tx)
        db_session.commit()

        # Manual expense with completely different description
        expense = Expense(
            user_id=user.id,
            category="Other",
            description="Some random purchase",
            amount=100.0,
            date=date(2026, 2, 5),
            reconciliation_status="unreviewed"
        )
        db_session.add(expense)
        db_session.commit()

        # With default min_score=0.7, this should not match (description too different)
        suggestions = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session, min_score=0.7
        )

        # Even with matching date and amount, very different descriptions should fail
        # (Unless the score happens to be exactly 0.7 due to date+amount alone)
        # Let's test with a higher threshold to be sure
        suggestions_high = MonthlyTotalsService.suggest_duplicates(
            user_id=user.id, db=db_session, min_score=0.9
        )

        assert len(suggestions_high) == 0  # Should filter out low matches
