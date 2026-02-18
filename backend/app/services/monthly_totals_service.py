"""
MonthlyTotalsService - Calculate monthly income/expenses with bank/manual deduplication.

This service is the core of the reconciliation system. It:
1. Combines bank-backed and manual entries
2. Excludes entries marked as duplicates
3. Provides breakdown by source (bank vs manual)
4. Identifies potential duplicates for user review
"""
from typing import Dict, List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract
from datetime import date, timedelta
from ..models import Expense, Income, BankTransaction
import difflib


class MonthlyTotalsService:
    """Service for calculating monthly totals with reconciliation logic."""

    @staticmethod
    def calculate_monthly_expenses(
        user_id: str, year: int, month: int, db: Session
    ) -> Dict:
        """
        Calculate actual expenses for a month combining bank + manual sources.
        Excludes entries marked as duplicates.

        Args:
            user_id: User ID
            year: Year (e.g., 2026)
            month: Month (1-12)
            db: Database session

        Returns:
            Dictionary with:
                - total: Combined total from all sources
                - from_bank: Total from bank-backed entries
                - from_manual: Total from manual entries (after deduplication)
                - bank_count: Number of bank-backed entries
                - manual_count: Number of manual entries (after deduplication)
                - duplicate_count: Number of entries marked as duplicates
                - unreviewed_count: Number of manual entries needing review
        """
        # Get all expense records active in the month
        expenses = MonthlyTotalsService._query_active_expenses_for_month(
            user_id, year, month, db
        )

        # Separate by source
        bank_backed = [e for e in expenses if e.bank_transaction_id is not None]
        manual = [e for e in expenses if e.bank_transaction_id is None]

        # Filter out duplicates from manual entries (bank reconciliation duplicates)
        deduplicated_manual = [
            e for e in manual
            if e.reconciliation_status not in ["duplicate_of_bank"]
        ]

        # Deduplicate recurring manual entries with no end_date that share (category, description).
        # When a user edits a recurring expense, a new row is created without closing the old one,
        # leaving two rows with end_date=None. Keep only the newest (highest id).
        seen_recurring: dict = {}
        non_recurring_manual = []
        for e in deduplicated_manual:
            if e.is_recurring and e.end_date is None:
                key = (e.category, e.description)
                if key not in seen_recurring or e.id > seen_recurring[key].id:
                    seen_recurring[key] = e
            else:
                non_recurring_manual.append(e)
        deduplicated_manual = non_recurring_manual + list(seen_recurring.values())

        # Count unreviewed entries (manual entries created after bank connection)
        unreviewed = [
            e for e in manual
            if e.reconciliation_status == "unreviewed"
        ]

        return {
            "total": sum(e.amount for e in bank_backed) + sum(e.amount for e in deduplicated_manual),
            "from_bank": sum(e.amount for e in bank_backed),
            "from_manual": sum(e.amount for e in deduplicated_manual),
            "bank_count": len(bank_backed),
            "manual_count": len(deduplicated_manual),
            "duplicate_count": len(manual) - len(deduplicated_manual),
            "unreviewed_count": len(unreviewed),
        }

    @staticmethod
    def calculate_monthly_income(
        user_id: str, year: int, month: int, db: Session
    ) -> Dict:
        """
        Calculate actual income for a month combining bank + manual sources.
        Excludes entries marked as duplicates.

        Same return structure as calculate_monthly_expenses().
        """
        # Get all income records active in the month
        income = MonthlyTotalsService._query_active_income_for_month(
            user_id, year, month, db
        )

        # Separate by source
        bank_backed = [i for i in income if i.bank_transaction_id is not None]
        manual = [i for i in income if i.bank_transaction_id is None]

        # Filter out duplicates from manual entries (bank reconciliation duplicates)
        deduplicated_manual = [
            i for i in manual
            if i.reconciliation_status not in ["duplicate_of_bank"]
        ]

        # Deduplicate recurring manual entries with no end_date that share (category, description).
        # When a user edits a recurring income, a new row is created without closing the old one,
        # leaving two rows with end_date=None for the same income. Keep only the newest (highest id).
        seen_recurring: dict = {}
        non_recurring_manual = []
        for i in deduplicated_manual:
            if i.is_recurring and i.end_date is None:
                key = (i.category, i.description)
                if key not in seen_recurring or i.id > seen_recurring[key].id:
                    seen_recurring[key] = i
            else:
                non_recurring_manual.append(i)
        deduplicated_manual = non_recurring_manual + list(seen_recurring.values())

        # Count unreviewed entries
        unreviewed = [
            i for i in manual
            if i.reconciliation_status == "unreviewed"
        ]

        return {
            "total": sum(i.amount for i in bank_backed) + sum(i.amount for i in deduplicated_manual),
            "from_bank": sum(i.amount for i in bank_backed),
            "from_manual": sum(i.amount for i in deduplicated_manual),
            "bank_count": len(bank_backed),
            "manual_count": len(deduplicated_manual),
            "duplicate_count": len(manual) - len(deduplicated_manual),
            "unreviewed_count": len(unreviewed),
        }

    @staticmethod
    def suggest_duplicates(
        user_id: str,
        db: Session,
        limit: int = 50,
        min_score: float = 0.7
    ) -> List[Dict]:
        """
        Find potential duplicate transactions between manual entries and bank transactions.
        Uses fuzzy matching: date ±3 days, amount ±2%, description similarity.

        Args:
            user_id: User ID
            limit: Maximum number of suggestions to return
            db: Database session
            min_score: Minimum match score (0.0-1.0) to include

        Returns:
            List of suggestions, each containing:
                - manual_entry: Expense or Income object
                - bank_transaction: BankTransaction object
                - match_score: Confidence score (0.0-1.0)
                - match_reasons: List of matching factors
        """
        suggestions = []

        # Get unreviewed manual expenses from last 6 months
        six_months_ago = date.today() - timedelta(days=180)
        manual_expenses = db.query(Expense).filter(
            and_(
                Expense.user_id == user_id,
                Expense.bank_transaction_id.is_(None),
                Expense.reconciliation_status == "unreviewed",
                Expense.date >= six_months_ago
            )
        ).all()

        # Get unreviewed manual income from last 6 months
        manual_income = db.query(Income).filter(
            and_(
                Income.user_id == user_id,
                Income.bank_transaction_id.is_(None),
                Income.reconciliation_status == "unreviewed",
                Income.date >= six_months_ago
            )
        ).all()

        # Get bank transactions from last 6 months that aren't already accepted
        bank_transactions = db.query(BankTransaction).filter(
            and_(
                BankTransaction.user_id == user_id,
                BankTransaction.date >= six_months_ago,
                BankTransaction.status == "pending"
            )
        ).all()

        # Match expenses with negative bank transactions
        for expense in manual_expenses:
            for bank_tx in bank_transactions:
                if bank_tx.amount < 0:  # Negative = expense
                    match_score, reasons = MonthlyTotalsService._calculate_match_score(
                        expense, bank_tx
                    )
                    if match_score >= min_score:
                        suggestions.append({
                            "manual_entry": expense,
                            "entry_type": "expense",
                            "bank_transaction": bank_tx,
                            "match_score": match_score,
                            "match_reasons": reasons
                        })

        # Match income with positive bank transactions
        for income in manual_income:
            for bank_tx in bank_transactions:
                if bank_tx.amount > 0:  # Positive = income
                    match_score, reasons = MonthlyTotalsService._calculate_match_score(
                        income, bank_tx
                    )
                    if match_score >= min_score:
                        suggestions.append({
                            "manual_entry": income,
                            "entry_type": "income",
                            "bank_transaction": bank_tx,
                            "match_score": match_score,
                            "match_reasons": reasons
                        })

        # Sort by match score (highest first) and limit
        suggestions.sort(key=lambda x: x["match_score"], reverse=True)
        return suggestions[:limit]

    @staticmethod
    def _calculate_match_score(
        manual_entry,  # Expense or Income
        bank_transaction: BankTransaction
    ) -> Tuple[float, List[str]]:
        """
        Calculate match score between a manual entry and bank transaction.

        Matching criteria:
        - Date within ±3 days: +0.3
        - Amount within ±2%: +0.4
        - Description similarity > 0.6: +0.3

        Returns:
            Tuple of (score, reasons) where score is 0.0-1.0
        """
        score = 0.0
        reasons = []

        # 1. Date matching (±3 days)
        date_diff = abs((manual_entry.date - bank_transaction.date).days)
        if date_diff == 0:
            score += 0.3
            reasons.append("Same date")
        elif date_diff <= 3:
            score += 0.2
            reasons.append(f"Date within {date_diff} days")

        # 2. Amount matching (±2%)
        manual_amount = abs(manual_entry.amount)
        bank_amount = abs(bank_transaction.amount)
        amount_diff_pct = abs(manual_amount - bank_amount) / max(manual_amount, bank_amount)

        if amount_diff_pct < 0.001:  # Exact match
            score += 0.4
            reasons.append("Exact amount match")
        elif amount_diff_pct <= 0.02:  # Within 2%
            score += 0.3
            reasons.append(f"Amount within {amount_diff_pct*100:.1f}%")

        # 3. Description similarity
        manual_desc = manual_entry.description.lower()
        bank_desc = (bank_transaction.description_display or "").lower()

        # Use SequenceMatcher for fuzzy string matching
        similarity = difflib.SequenceMatcher(None, manual_desc, bank_desc).ratio()

        if similarity > 0.8:
            score += 0.3
            reasons.append("Very similar descriptions")
        elif similarity > 0.6:
            score += 0.2
            reasons.append("Similar descriptions")

        return score, reasons

    @staticmethod
    def _query_active_expenses_for_month(
        user_id: str, year: int, month: int, db: Session
    ) -> List[Expense]:
        """
        Query all expense records that are active (contribute to totals) in a given month.

        This handles both:
        - One-off expenses (date in month)
        - Recurring expenses (active during month)
        """
        # First day of month
        month_start = date(year, month, 1)

        # Last day of month
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        expenses = db.query(Expense).filter(
            and_(
                Expense.user_id == user_id,
                or_(
                    # One-off expense in this month
                    and_(
                        Expense.is_recurring == False,
                        Expense.date >= month_start,
                        Expense.date <= month_end
                    ),
                    # Recurring expense active during this month
                    and_(
                        Expense.is_recurring == True,
                        Expense.date <= month_end,  # Started before or during month
                        or_(
                            Expense.end_date.is_(None),  # No end date
                            Expense.end_date >= month_start  # Ends after or during month
                        )
                    )
                )
            )
        ).all()

        return expenses

    @staticmethod
    def _query_active_income_for_month(
        user_id: str, year: int, month: int, db: Session
    ) -> List[Income]:
        """
        Query all income records that are active (contribute to totals) in a given month.

        Same logic as _query_active_expenses_for_month but for Income.
        """
        # First day of month
        month_start = date(year, month, 1)

        # Last day of month
        if month == 12:
            month_end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(year, month + 1, 1) - timedelta(days=1)

        income = db.query(Income).filter(
            and_(
                Income.user_id == user_id,
                or_(
                    # One-off income in this month
                    and_(
                        Income.is_recurring == False,
                        Income.date >= month_start,
                        Income.date <= month_end
                    ),
                    # Recurring income active during this month
                    and_(
                        Income.is_recurring == True,
                        Income.date <= month_end,  # Started before or during month
                        or_(
                            Income.end_date.is_(None),  # No end date
                            Income.end_date >= month_start  # Ends after or during month
                        )
                    )
                )
            )
        ).all()

        return income
