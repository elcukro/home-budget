"""
Cleanup income/expense entries that were created from internal transfers.

Deletes income/expense rows linked to bank transactions marked as
is_internal_transfer=True, and resets those bank transactions back to
pending state (clears linked_income_id/linked_expense_id).

Run after backfill_internal_transfers.py has already marked the bank
transactions.

Usage:
  ssh root@firedup.app "set -a && source /opt/home-budget/backend/.env && set +a && \
    cd /opt/home-budget/backend && source venv/bin/activate && \
    python scripts/cleanup_internal_transfer_entries.py"
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction, Income, Expense


def main():
    db = SessionLocal()
    try:
        # Find all internal transfer bank transaction IDs
        internal_txs = db.query(BankTransaction).filter(
            BankTransaction.is_internal_transfer == True
        ).all()
        internal_ids = [tx.id for tx in internal_txs]

        if not internal_ids:
            print("No internal transfers found. Run backfill_internal_transfers.py first.")
            return

        # Find linked income entries
        incomes = db.query(Income).filter(
            Income.bank_transaction_id.in_(internal_ids)
        ).all()

        # Find linked expense entries
        expenses = db.query(Expense).filter(
            Expense.bank_transaction_id.in_(internal_ids)
        ).all()

        income_total = sum(i.amount for i in incomes)
        expense_total = sum(e.amount for e in expenses)

        print(f"Found {len(incomes)} income entries (total {income_total:.2f} zł)")
        print(f"Found {len(expenses)} expense entries (total {expense_total:.2f} zł)")

        if not incomes and not expenses:
            print("Nothing to clean up.")
            return

        # Collect IDs for bank transaction reset
        income_ids = {i.id for i in incomes}
        expense_ids = {e.id for e in expenses}

        # Reset bank transactions that pointed to these entries
        for tx in internal_txs:
            if tx.linked_income_id in income_ids:
                tx.linked_income_id = None
                tx.status = "pending"
            if tx.linked_expense_id in expense_ids:
                tx.linked_expense_id = None
                tx.status = "pending"

        # Delete the income/expense entries
        for i in incomes:
            db.delete(i)
        for e in expenses:
            db.delete(e)

        db.commit()

        print(f"\nCleanup complete:")
        print(f"  Deleted {len(incomes)} income entries ({income_total:.2f} zł)")
        print(f"  Deleted {len(expenses)} expense entries ({expense_total:.2f} zł)")
        print(f"  Reset linked bank transactions back to pending")

    finally:
        db.close()


if __name__ == "__main__":
    main()
