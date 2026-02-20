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


def _detect_internal_transfer(raw_data: dict, provider: str) -> bool:
    """Detect internal transfers from raw transaction data."""
    if not raw_data:
        return False

    # GoCardless: check types.type == "TRANSFER"
    if provider == "gocardless":
        types = raw_data.get("types") or {}
        if isinstance(types, dict) and types.get("type") == "TRANSFER":
            return True
        # Also check list of types
        if isinstance(types, list):
            for t in types:
                if isinstance(t, dict) and t.get("type") == "TRANSFER":
                    return True
        return False

    # Enable Banking: same patterns as the sync function
    remittance = raw_data.get("remittance_information", [])
    remittance_text = " ".join(remittance) if isinstance(remittance, list) else str(remittance or "")
    remittance_lower = remittance_text.lower()

    if "smart saver" in remittance_lower:
        return True

    if "przelew własny" in remittance_lower:
        return True

    if "konto oszczędnościowe" in remittance_lower:
        return True

    debtor_agent = raw_data.get("debtor_agent") or {}
    creditor_agent = raw_data.get("creditor_agent") or {}
    if (debtor_agent.get("bic_fi") and
            debtor_agent.get("bic_fi") == creditor_agent.get("bic_fi")):
        debtor_addr = (raw_data.get("debtor") or {}).get("postal_address") or {}
        creditor_addr = (raw_data.get("creditor") or {}).get("postal_address") or {}
        debtor_lines = debtor_addr.get("address_line") or []
        creditor_lines = creditor_addr.get("address_line") or []
        if debtor_lines and creditor_lines and debtor_lines[0] == creditor_lines[0]:
            return True

    return False


def main():
    db = SessionLocal()
    try:
        transactions = db.query(BankTransaction).filter(
            BankTransaction.raw_data != None,
            BankTransaction.is_internal_transfer != True,  # Skip already-marked
        ).all()

        total = len(transactions)
        marked = 0

        for tx in transactions:
            if not tx.provider:
                continue
            is_internal = _detect_internal_transfer(tx.raw_data, tx.provider)
            if is_internal:
                tx.is_internal_transfer = True
                marked += 1

        db.commit()
        print(f"Backfill complete: {marked}/{total} transactions marked as internal transfers")

    finally:
        db.close()


if __name__ == "__main__":
    main()
