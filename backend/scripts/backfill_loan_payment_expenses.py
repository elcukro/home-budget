#!/usr/bin/env python3
"""
Backfill script: Create Expense records for historical LoanPayments.

This is a one-time data migration to ensure all past loan payments
appear as expenses in the Wydatki (Expenses) page with category="obligations".

Usage:
  cd backend
  source venv/bin/activate
  python scripts/backfill_loan_payment_expenses.py [--dry-run]

Dedup: Matches on (user_id, category="obligations", amount, date) to avoid
duplicates if run multiple times.
"""
import os
import sys
from datetime import date

# Add parent dir to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker
from app.models import LoanPayment, Loan, Expense

MONTH_NAMES_PL = [
    "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
    "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
]


def get_engine():
    postgres_user = os.getenv("POSTGRES_USER", "homebudget")
    postgres_password = os.getenv("POSTGRES_PASSWORD")
    if not postgres_password:
        raise ValueError("POSTGRES_PASSWORD environment variable is required")
    postgres_host = os.getenv("POSTGRES_HOST", "localhost")
    postgres_port = os.getenv("POSTGRES_PORT", "5432")
    postgres_db = os.getenv("POSTGRES_DB", "homebudget")
    url = f"postgresql://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_db}"
    return create_engine(url)


def main():
    dry_run = "--dry-run" in sys.argv

    engine = get_engine()
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # Get all regular loan payments with their associated loans
        payments = (
            session.query(LoanPayment, Loan)
            .join(Loan, LoanPayment.loan_id == Loan.id)
            .filter(LoanPayment.payment_type == "regular")
            .order_by(LoanPayment.payment_date)
            .all()
        )

        created = 0
        skipped = 0

        for payment, loan in payments:
            payment_date = payment.payment_date
            if isinstance(payment_date, str):
                payment_date = date.fromisoformat(payment_date)

            # Build description matching the frontend format
            month_idx = (payment.covers_month or payment_date.month) - 1
            year = payment.covers_year or payment_date.year
            description = f"{loan.description} — rata {MONTH_NAMES_PL[month_idx]} {year}"

            # Check if matching expense already exists (dedup)
            existing = (
                session.query(Expense)
                .filter(
                    and_(
                        Expense.user_id == payment.user_id,
                        Expense.category == "obligations",
                        Expense.amount == payment.amount,
                        Expense.date == payment_date,
                    )
                )
                .first()
            )

            if existing:
                skipped += 1
                continue

            expense = Expense(
                user_id=payment.user_id,
                category="obligations",
                description=description,
                amount=payment.amount,
                date=payment_date,
                is_recurring=False,
                source="manual",
                reconciliation_status="manual_confirmed",
            )

            if not dry_run:
                session.add(expense)
            created += 1

        if not dry_run:
            session.commit()
            print(f"Created {created} expense records, skipped {skipped} (already exist).")
        else:
            print(f"[DRY RUN] Would create {created} expense records, skip {skipped}.")

    except Exception as e:
        session.rollback()
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


if __name__ == "__main__":
    main()
