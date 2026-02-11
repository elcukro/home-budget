#!/usr/bin/env python3
"""
Cleanup duplicate Income/Expense entries created during initial conversion.

Finds entries with the same description and similar amounts, keeps the most recent,
and deletes older duplicates.
"""
import sys
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from app.database import SessionLocal
from app.models import Expense, Income

def cleanup_duplicate_entries(user_email: str, dry_run: bool = False):
    """
    Remove duplicate entries created during bank transaction conversion.

    Args:
        user_email: User's email address
        dry_run: If True, only print what would be done without making changes
    """
    db: Session = SessionLocal()

    try:
        if dry_run:
            print("\n[DRY RUN MODE - No changes will be made]\n")

        # Cleanup duplicate income
        print("=" * 60)
        print("CLEANING UP DUPLICATE INCOME ENTRIES")
        print("=" * 60)

        income_groups = db.query(
            Income.description,
            func.count(Income.id).label('count')
        ).filter(
            Income.user_id == user_email,
            Income.source == "bank_import"
        ).group_by(
            Income.description
        ).having(
            func.count(Income.id) > 1
        ).all()

        income_deleted = 0
        for description, count in income_groups:
            # Get all entries with this description
            entries = db.query(Income).filter(
                Income.user_id == user_email,
                Income.description == description,
                Income.source == "bank_import"
            ).order_by(Income.date.desc()).all()

            # Keep the most recent, delete the rest
            if len(entries) > 1:
                keep = entries[0]
                to_delete = entries[1:]

                print(f"\n{description}")
                print(f"  Keep: #{keep.id} ({keep.date}, {keep.amount} zł)")
                print(f"  Delete {len(to_delete)} duplicates:")

                for dup in to_delete:
                    print(f"    ✗ #{dup.id} ({dup.date}, {dup.amount} zł)")
                    if not dry_run:
                        # Update any bank_transactions pointing to this income
                        db.execute(
                            text("UPDATE bank_transactions SET linked_income_id = :keep_id WHERE linked_income_id = :dup_id"),
                            {"keep_id": keep.id, "dup_id": dup.id}
                        )
                        db.delete(dup)
                        income_deleted += 1

        # Cleanup duplicate expenses
        print("\n" + "=" * 60)
        print("CLEANING UP DUPLICATE EXPENSE ENTRIES")
        print("=" * 60)

        expense_groups = db.query(
            Expense.description,
            func.count(Expense.id).label('count')
        ).filter(
            Expense.user_id == user_email,
            Expense.source == "bank_import"
        ).group_by(
            Expense.description
        ).having(
            func.count(Expense.id) > 1
        ).all()

        expense_deleted = 0
        for description, count in expense_groups:
            # Get all entries with this description
            entries = db.query(Expense).filter(
                Expense.user_id == user_email,
                Expense.description == description,
                Expense.source == "bank_import"
            ).order_by(Expense.date.desc()).all()

            # Keep the most recent, delete the rest
            if len(entries) > 1:
                keep = entries[0]
                to_delete = entries[1:]

                print(f"\n{description}")
                print(f"  Keep: #{keep.id} ({keep.date}, {keep.amount} zł)")
                print(f"  Delete {len(to_delete)} duplicates:")

                for dup in to_delete:
                    print(f"    ✗ #{dup.id} ({dup.date}, {dup.amount} zł)")
                    if not dry_run:
                        # Update any bank_transactions pointing to this expense
                        db.execute(
                            text("UPDATE bank_transactions SET linked_expense_id = :keep_id WHERE linked_expense_id = :dup_id"),
                            {"keep_id": keep.id, "dup_id": dup.id}
                        )
                        db.delete(dup)
                        expense_deleted += 1

        if not dry_run:
            db.commit()
            print(f"\n{'='*60}")
            print(f"Cleanup complete!")
            print(f"  Income entries deleted: {income_deleted}")
            print(f"  Expense entries deleted: {expense_deleted}")
            print(f"{'='*60}")
        else:
            print(f"\n[DRY RUN SUMMARY]")
            print(f"  Would delete {income_deleted + expense_deleted} duplicate entries")

    finally:
        db.close()

if __name__ == "__main__":
    user_email = "elcukrodev@gmail.com"
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("Running in DRY RUN mode...")

    cleanup_duplicate_entries(user_email, dry_run)
