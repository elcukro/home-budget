"""
Backfill is_internal_transfer for existing bank transactions.

Checks raw_data for Enable Banking transactions and types.type for GoCardless.
Run after migration: python scripts/backfill_internal_transfers.py

Can be run inside Docker:
  docker exec home-budget-backend python scripts/backfill_internal_transfers.py

Or on production:
  ssh root@firedup.app "cd /opt/home-budget/backend && source venv/bin/activate && python scripts/backfill_internal_transfers.py"
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction
from app.services.internal_transfer_detection import (
    detect_internal_transfer as _detect_internal_transfer,
    detect_internal_from_descriptions as _detect_internal_from_descriptions_raw,
)


def _detect_internal_from_descriptions(tx) -> bool:
    """Fallback detection using description fields from a BankTransaction ORM object."""
    return _detect_internal_from_descriptions_raw(
        description_display=tx.description_display or "",
        description_original=tx.description_original or "",
        description_detailed=tx.description_detailed or "",
    )


def main():
    db = SessionLocal()
    try:
        transactions = db.query(BankTransaction).filter(
            BankTransaction.is_internal_transfer != True,  # Skip already-marked
        ).all()

        total = len(transactions)
        marked = 0

        for tx in transactions:
            if not tx.provider:
                continue

            is_internal = False

            # Primary: check raw_data
            if tx.raw_data:
                is_internal = _detect_internal_transfer(tx.raw_data, tx.provider)

            # Fallback: check description fields
            if not is_internal:
                is_internal = _detect_internal_from_descriptions(tx)

            if is_internal:
                tx.is_internal_transfer = True
                marked += 1

        db.commit()
        print(f"Backfill complete: {marked}/{total} transactions marked as internal transfers")

    finally:
        db.close()


if __name__ == "__main__":
    main()
