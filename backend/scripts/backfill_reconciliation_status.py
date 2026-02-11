#!/usr/bin/env python3
"""
Backfill reconciliation_status for existing expense and income records.

This script:
1. Marks all bank-backed entries (bank_transaction_id IS NOT NULL) as 'bank_backed'
2. Marks pre-bank-era entries (created before user's first TinkConnection) as 'pre_bank_era'
3. Leaves remaining manual entries as 'unreviewed'

Run this ONCE after deploying the reconciliation fields migration.
"""
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.database import SessionLocal


def backfill_reconciliation_status():
    """Backfill reconciliation_status for all existing records."""
    db = SessionLocal()

    try:
        print("Starting reconciliation_status backfill...")

        # 1. Mark all bank-backed expenses
        result = db.execute(text("""
            UPDATE expenses
            SET reconciliation_status = 'bank_backed'
            WHERE bank_transaction_id IS NOT NULL
            AND reconciliation_status = 'unreviewed'
        """))
        bank_expenses = result.rowcount
        print(f"✓ Marked {bank_expenses} expenses as 'bank_backed'")

        # 2. Mark all bank-backed income
        result = db.execute(text("""
            UPDATE income
            SET reconciliation_status = 'bank_backed'
            WHERE bank_transaction_id IS NOT NULL
            AND reconciliation_status = 'unreviewed'
        """))
        bank_income = result.rowcount
        print(f"✓ Marked {bank_income} income as 'bank_backed'")

        # 3. Mark pre-bank-era expenses (created before user's first TinkConnection)
        result = db.execute(text("""
            UPDATE expenses
            SET reconciliation_status = 'pre_bank_era'
            WHERE bank_transaction_id IS NULL
            AND reconciliation_status = 'unreviewed'
            AND created_at < (
                SELECT COALESCE(MIN(tc.created_at), NOW() + INTERVAL '1 day')
                FROM tink_connections tc
                WHERE tc.user_id = expenses.user_id
            )
        """))
        pre_bank_expenses = result.rowcount
        print(f"✓ Marked {pre_bank_expenses} expenses as 'pre_bank_era'")

        # 4. Mark pre-bank-era income (created before user's first TinkConnection)
        result = db.execute(text("""
            UPDATE income
            SET reconciliation_status = 'pre_bank_era'
            WHERE bank_transaction_id IS NULL
            AND reconciliation_status = 'unreviewed'
            AND created_at < (
                SELECT COALESCE(MIN(tc.created_at), NOW() + INTERVAL '1 day')
                FROM tink_connections tc
                WHERE tc.user_id = income.user_id
            )
        """))
        pre_bank_income = result.rowcount
        print(f"✓ Marked {pre_bank_income} income as 'pre_bank_era'")

        # 5. Count remaining unreviewed (manual entries created after bank connection)
        result = db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM expenses WHERE reconciliation_status = 'unreviewed') as unreviewed_expenses,
                (SELECT COUNT(*) FROM income WHERE reconciliation_status = 'unreviewed') as unreviewed_income
        """))
        row = result.fetchone()
        unreviewed_expenses = row[0]
        unreviewed_income = row[1]

        print(f"\n📊 Summary:")
        print(f"  Bank-backed: {bank_expenses} expenses, {bank_income} income")
        print(f"  Pre-bank era: {pre_bank_expenses} expenses, {pre_bank_income} income")
        print(f"  Unreviewed (manual, post-bank): {unreviewed_expenses} expenses, {unreviewed_income} income")

        db.commit()
        print("\n✅ Backfill completed successfully!")

    except Exception as e:
        print(f"\n❌ Error during backfill: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    backfill_reconciliation_status()
