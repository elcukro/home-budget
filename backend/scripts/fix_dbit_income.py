"""
Fix DBIT transactions incorrectly classified as income.

DBIT = money leaving the account (outgoing) → should be expense, not income.
This script finds income records linked to DBIT bank transactions and converts
them to expense records with appropriate categories.

Usage:
  python scripts/fix_dbit_income.py --dry-run   # Preview
  python scripts/fix_dbit_income.py              # Execute

Production:
  ssh root@firedup.app "cd /opt/home-budget/backend && source venv/bin/activate && \
    python scripts/fix_dbit_income.py --dry-run"
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction, Income, Expense


def main():
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("=== DRY RUN MODE — no changes will be made ===\n")

    db = SessionLocal()
    try:
        # Find income records linked to DBIT bank transactions
        incomes = db.query(Income).filter(
            Income.source == "bank_import",
            Income.bank_transaction_id != None,
        ).all()

        to_fix = []
        for income in incomes:
            tx = db.query(BankTransaction).filter(
                BankTransaction.id == income.bank_transaction_id
            ).first()
            if not tx or not tx.raw_data:
                continue
            cdi = tx.raw_data.get("credit_debit_indicator", "")
            if cdi == "DBIT":
                to_fix.append((income, tx))

        print(f"Found {len(to_fix)} income records linked to DBIT (outgoing) transactions\n")

        if not to_fix:
            print("Nothing to fix!")
            return

        total_amount = 0
        for income, tx in to_fix:
            print(f"  [{income.id}] {income.date} | {income.amount:>10.2f} zł | {income.description[:55]:<55} | cat: {income.category}")
            total_amount += income.amount

        print(f"\n  TOTAL: {total_amount:,.2f} zł")
        print(f"  Action: Delete these income records → create expense records instead\n")

        if dry_run:
            print("=== DRY RUN — no changes made. Run without --dry-run to execute. ===")
            return

        # Fix: delete income records, create expense records
        converted = 0
        for income, tx in to_fix:
            # Map income category to expense category
            category = _map_category(income.category, tx)

            # NULL the FK reference in bank_transaction
            if tx.linked_income_id == income.id:
                tx.linked_income_id = None

            # Delete the income record
            db.delete(income)
            db.flush()

            # Create expense record
            new_expense = Expense(
                user_id=income.user_id,
                category=category,
                description=income.description,
                amount=income.amount,
                date=income.date,
                is_recurring=False,
                source="bank_import",
                bank_transaction_id=tx.id,
                reconciliation_status="bank_backed",
            )
            db.add(new_expense)
            db.flush()

            # Update bank transaction links
            tx.linked_expense_id = new_expense.id
            tx.status = "converted"
            converted += 1

        db.commit()
        print(f"Fixed {converted} records: income → expense")

    finally:
        db.close()


def _map_category(income_category: str, tx: BankTransaction) -> str:
    """Map income category to an appropriate expense category."""
    desc = (tx.description_display or "").lower()

    # Phone transfers to family
    if "przelew na telefon" in desc:
        return "other"
    # BLIK payments
    if "blik" in desc:
        return "other"
    # Food related
    if any(w in desc for w in ["jajka", "papier", "makaron", "zakupy", "sushi"]):
        return "food"
    # Health
    if "badanie" in desc:
        return "healthcare"

    return "other"


if __name__ == "__main__":
    main()
