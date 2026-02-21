"""
Comprehensive cleanup of income/expense entries created from internal transfers.

Unlike cleanup_internal_transfer_entries.py (which only cleans entries already
marked as is_internal_transfer), this script:
1. Scans ALL bank-imported income/expense entries
2. Checks descriptions AND raw_data for internal transfer patterns
3. Deletes matching records and marks their bank transactions
4. Supports --dry-run mode for safe preview

Usage:
  # Dry-run (preview what would be deleted):
  python scripts/cleanup_income_garbage.py --dry-run

  # Actually delete:
  python scripts/cleanup_income_garbage.py

  # Production:
  ssh root@firedup.app "cd /opt/home-budget/backend && source venv/bin/activate && \
    python scripts/cleanup_income_garbage.py --dry-run"
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction, Income, Expense
from app.services.internal_transfer_detection import INTERNAL_PATTERNS, _text_matches_internal


def _matches_internal_pattern(text: str) -> str | None:
    """Check if text matches any internal transfer pattern. Returns matched pattern or None."""
    if not text:
        return None
    text_lower = text.lower()
    for pattern in INTERNAL_PATTERNS:
        if pattern in text_lower:
            return pattern
    return None


def _check_raw_data_remittance(raw_data: dict) -> str | None:
    """Check raw_data remittance_information for patterns."""
    if not raw_data:
        return None
    remittance = raw_data.get("remittance_information", [])
    remittance_text = " ".join(remittance) if isinstance(remittance, list) else str(remittance or "")
    return _matches_internal_pattern(remittance_text)


def _check_transaction(tx: BankTransaction) -> str | None:
    """Check a bank transaction against all detection methods. Returns reason or None."""
    # Already marked
    if tx.is_internal_transfer:
        return "already_marked"

    # Check raw_data remittance
    if tx.raw_data:
        match = _check_raw_data_remittance(tx.raw_data)
        if match:
            return f"raw_data_remittance:{match}"

    # Check description fields
    for field_name in ["description_original", "description_detailed", "description_display"]:
        field_val = getattr(tx, field_name, None)
        match = _matches_internal_pattern(field_val)
        if match:
            return f"{field_name}:{match}"

    return None


def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE — no changes will be made ===\n")

    db = SessionLocal()
    try:
        # Find all income entries from bank import
        incomes = db.query(Income).filter(
            Income.source == "bank_import",
            Income.bank_transaction_id != None,
        ).all()

        # Find all expense entries from bank import
        expenses = db.query(Expense).filter(
            Expense.source == "bank_import",
            Expense.bank_transaction_id != None,
        ).all()

        print(f"Scanning {len(incomes)} bank-imported income entries...")
        print(f"Scanning {len(expenses)} bank-imported expense entries...")
        print()

        # Collect bank transaction IDs we need
        all_tx_ids = set()
        for i in incomes:
            all_tx_ids.add(i.bank_transaction_id)
        for e in expenses:
            all_tx_ids.add(e.bank_transaction_id)

        # Fetch all related bank transactions in one query
        bank_txs = {}
        if all_tx_ids:
            for tx in db.query(BankTransaction).filter(BankTransaction.id.in_(all_tx_ids)).all():
                bank_txs[tx.id] = tx

        # Check income entries
        income_to_delete = []
        for income in incomes:
            tx = bank_txs.get(income.bank_transaction_id)
            if not tx:
                continue
            reason = _check_transaction(tx)
            if reason:
                income_to_delete.append((income, tx, reason))

        # Check expense entries
        expense_to_delete = []
        for expense in expenses:
            tx = bank_txs.get(expense.bank_transaction_id)
            if not tx:
                continue
            reason = _check_transaction(tx)
            if reason:
                expense_to_delete.append((expense, tx, reason))

        # Report
        if income_to_delete:
            print(f"--- INCOME to delete: {len(income_to_delete)} entries ---")
            total_income = 0
            for income, tx, reason in income_to_delete:
                print(f"  [{income.id}] {income.date} | {income.amount:>10.2f} zł | {income.description[:50]:<50} | reason: {reason}")
                total_income += income.amount
            print(f"  TOTAL: {total_income:,.2f} zł\n")
        else:
            print("No income entries to delete.\n")

        if expense_to_delete:
            print(f"--- EXPENSES to delete: {len(expense_to_delete)} entries ---")
            total_expense = 0
            for expense, tx, reason in expense_to_delete:
                print(f"  [{expense.id}] {expense.date} | {expense.amount:>10.2f} zł | {expense.description[:50]:<50} | reason: {reason}")
                total_expense += expense.amount
            print(f"  TOTAL: {total_expense:,.2f} zł\n")
        else:
            print("No expense entries to delete.\n")

        if not income_to_delete and not expense_to_delete:
            print("Nothing to clean up!")
            return

        if dry_run:
            print("=== DRY RUN — no changes made. Run without --dry-run to execute. ===")
            return

        # Execute cleanup
        affected_tx_ids = set()

        for income, tx, reason in income_to_delete:
            affected_tx_ids.add(tx.id)
            if tx.linked_income_id == income.id:
                tx.linked_income_id = None
            db.delete(income)

        for expense, tx, reason in expense_to_delete:
            affected_tx_ids.add(tx.id)
            if tx.linked_expense_id == expense.id:
                tx.linked_expense_id = None
            db.delete(expense)

        # Mark affected bank transactions
        for tx_id in affected_tx_ids:
            tx = bank_txs.get(tx_id)
            if tx:
                tx.is_internal_transfer = True
                tx.status = "skipped"

        db.commit()

        print(f"Cleanup complete:")
        print(f"  Deleted {len(income_to_delete)} income entries")
        print(f"  Deleted {len(expense_to_delete)} expense entries")
        print(f"  Marked {len(affected_tx_ids)} bank transactions as internal transfers (status=skipped)")

    finally:
        db.close()


if __name__ == "__main__":
    main()
