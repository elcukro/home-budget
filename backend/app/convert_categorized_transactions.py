#!/usr/bin/env python3
"""
Convert already-categorized bank transactions to Expense/Income records.

This script finds all transactions that have been AI-categorized but not yet converted,
and creates the corresponding Expense or Income records with proper linking.
"""
import sys
from datetime import datetime
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import BankTransaction, Expense, Income

def convert_categorized_transactions(user_email: str, dry_run: bool = False):
    """
    Convert categorized transactions for a specific user.

    Args:
        user_email: User's email address
        dry_run: If True, only print what would be done without making changes
    """
    db: Session = SessionLocal()

    try:
        # Find categorized but not converted transactions
        transactions = db.query(BankTransaction).filter(
            BankTransaction.user_id == user_email,
            BankTransaction.status == "pending",
            BankTransaction.suggested_type.isnot(None),
            BankTransaction.suggested_category.isnot(None)
        ).all()

        print(f"Found {len(transactions)} categorized transactions to convert")

        if dry_run:
            print("\n[DRY RUN MODE - No changes will be made]\n")

        converted_expenses = 0
        converted_income = 0
        errors = 0

        for tx in transactions:
            amount = abs(tx.amount)

            # Check for duplicates - skip if similar entry already exists
            # (prevents creating multiple entries for recurring transactions)
            description_lower = tx.description_display.lower()

            if tx.suggested_type == "expense":
                # Check if similar expense already exists (same description, similar amount, recent date)
                existing = db.query(Expense).filter(
                    Expense.user_id == tx.user_id,
                    Expense.description.ilike(f"%{tx.description_display}%"),
                    Expense.amount.between(amount * 0.95, amount * 1.05),  # Within 5%
                ).first()

                if existing:
                    if dry_run:
                        print(f"Would SKIP (duplicate): {tx.description_display[:50]}, {amount} zł - similar to expense #{existing.id}")
                    else:
                        print(f"⊘ Skipped (duplicate): {tx.description_display[:50]} - similar to expense #{existing.id}")
                    continue

            elif tx.suggested_type == "income":
                # Check if similar income already exists
                existing = db.query(Income).filter(
                    Income.user_id == tx.user_id,
                    Income.description.ilike(f"%{tx.description_display}%"),
                    Income.amount.between(amount * 0.95, amount * 1.05),  # Within 5%
                ).first()

                if existing:
                    if dry_run:
                        print(f"Would SKIP (duplicate): {tx.description_display[:50]}, {amount} zł - similar to income #{existing.id}")
                    else:
                        print(f"⊘ Skipped (duplicate): {tx.description_display[:50]} - similar to income #{existing.id}")
                    continue

            try:
                if tx.suggested_type == "expense":
                    if dry_run:
                        print(f"Would create EXPENSE: {tx.description_display[:50]}, {amount} zł, category={tx.suggested_category}")
                    else:
                        new_expense = Expense(
                            user_id=tx.user_id,
                            category=tx.suggested_category,
                            description=tx.description_display,
                            amount=amount,
                            date=tx.date,
                            is_recurring=False,
                            source="bank_import",
                            bank_transaction_id=tx.id,
                            reconciliation_status="bank_backed"
                        )
                        db.add(new_expense)
                        db.flush()

                        tx.status = "converted"
                        tx.linked_expense_id = new_expense.id
                        tx.reviewed_at = datetime.now()
                        converted_expenses += 1
                        print(f"✓ Created expense #{new_expense.id}: {tx.description_display[:50]}")

                elif tx.suggested_type == "income":
                    if dry_run:
                        print(f"Would create INCOME: {tx.description_display[:50]}, {amount} zł, category={tx.suggested_category}")
                    else:
                        new_income = Income(
                            user_id=tx.user_id,
                            category=tx.suggested_category,
                            description=tx.description_display,
                            amount=amount,
                            date=tx.date,
                            is_recurring=False,
                            source="bank_import",
                            bank_transaction_id=tx.id,
                            reconciliation_status="bank_backed"
                        )
                        db.add(new_income)
                        db.flush()

                        tx.status = "converted"
                        tx.linked_income_id = new_income.id
                        tx.reviewed_at = datetime.now()
                        converted_income += 1
                        print(f"✓ Created income #{new_income.id}: {tx.description_display[:50]}")

            except Exception as e:
                print(f"✗ Error converting transaction {tx.id}: {e}")
                errors += 1
                continue

        if not dry_run:
            db.commit()
            print(f"\n{'='*60}")
            print(f"Conversion complete!")
            print(f"  Expenses created: {converted_expenses}")
            print(f"  Income created: {converted_income}")
            print(f"  Errors: {errors}")
            print(f"{'='*60}")
        else:
            print(f"\n[DRY RUN SUMMARY]")
            print(f"  Would create {converted_expenses + converted_income} records")

    finally:
        db.close()

if __name__ == "__main__":
    # Default to the test user
    user_email = "elcukrodev@gmail.com"
    dry_run = "--dry-run" in sys.argv

    if dry_run:
        print("Running in DRY RUN mode...")

    convert_categorized_transactions(user_email, dry_run)
