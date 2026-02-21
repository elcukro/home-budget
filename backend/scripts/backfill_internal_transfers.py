"""
Backfill is_internal_transfer for existing bank transactions.

Checks raw_data for Enable Banking transactions and types.type for GoCardless.
Uses structural BIC-based detection for EB CRDT transactions (infers account BIC per account).

Run after migration: python scripts/backfill_internal_transfers.py

Can be run inside Docker:
  docker exec home-budget-backend python scripts/backfill_internal_transfers.py

Or on production:
  ssh root@firedup.app "cd /opt/home-budget/backend && source venv/bin/activate && python scripts/backfill_internal_transfers.py"
"""

import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction
from app.services.internal_transfer_detection import (
    detect_internal_transfer as _detect_internal_transfer,
    detect_internal_from_descriptions as _detect_internal_from_descriptions_raw,
    infer_account_bic,
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

        # Group EB transactions by account to infer BIC per account
        eb_by_account = defaultdict(list)
        for tx in transactions:
            if tx.provider == "enablebanking" and tx.raw_data and tx.tink_account_id:
                eb_by_account[tx.tink_account_id].append(tx.raw_data)

        # Infer BIC per account from raw_data
        account_bics = {}
        for account_id, raw_data_list in eb_by_account.items():
            bic = infer_account_bic(raw_data_list)
            if bic:
                account_bics[account_id] = bic
                print(f"  Account {account_id[:8]}...: inferred BIC = {bic}")

        marked = 0
        for tx in transactions:
            if not tx.provider:
                continue

            is_internal = False

            # Primary: check raw_data (with account_bic for structural detection)
            if tx.raw_data:
                account_bic = account_bics.get(tx.tink_account_id)
                is_internal = _detect_internal_transfer(tx.raw_data, tx.provider, account_bic=account_bic)

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
