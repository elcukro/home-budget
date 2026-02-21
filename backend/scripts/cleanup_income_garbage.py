"""
Comprehensive cleanup of income/expense entries created from internal transfers.

Uses structural BIC-based detection (same bank = internal) plus text patterns.
1. Scans ALL bank-imported income/expense entries
2. Checks BIC structure, descriptions AND raw_data for internal transfer patterns
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
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import BankTransaction, Income, Expense
from app.services.internal_transfer_detection import (
    INTERNAL_PATTERNS,
    _text_matches_internal,
    detect_internal_transfer_eb,
    infer_account_bic,
)


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


def _check_transaction(tx: BankTransaction, account_bics: dict) -> str | None:
    """Check a bank transaction against all detection methods. Returns reason or None."""
    # Already marked
    if tx.is_internal_transfer:
        return "already_marked"

    # Structural BIC detection (primary for Enable Banking CRDT)
    if tx.raw_data and tx.provider == "enablebanking":
        account_bic = account_bics.get(tx.tink_account_id)
        if detect_internal_transfer_eb(tx.raw_data, account_bic=account_bic):
            # Determine reason for reporting
            cdi = tx.raw_data.get("credit_debit_indicator", "")
            debtor_bic = ((tx.raw_data.get("debtor_agent") or {}).get("bic_fi") or "").strip()
            if cdi == "CRDT" and not debtor_bic:
                return "structural:no_debtor_bic(ATM)"
            if cdi == "CRDT" and account_bic and debtor_bic == account_bic:
                return f"structural:same_bank({debtor_bic})"
            # Fall through to text pattern reason
            match = _check_raw_data_remittance(tx.raw_data)
            if match:
                return f"raw_data_remittance:{match}"
            return "structural:bic_match"

    # Check raw_data remittance (non-EB or fallback)
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

        # Infer account BICs from raw_data for structural detection
        eb_by_account = defaultdict(list)
        for tx in bank_txs.values():
            if tx.provider == "enablebanking" and tx.raw_data and tx.tink_account_id:
                eb_by_account[tx.tink_account_id].append(tx.raw_data)

        account_bics = {}
        for account_id, raw_data_list in eb_by_account.items():
            bic = infer_account_bic(raw_data_list)
            if bic:
                account_bics[account_id] = bic
                print(f"  Account {account_id[:8]}...: inferred BIC = {bic}")

        # Also try inferring from ALL EB transactions in the DB (not just linked ones)
        if not account_bics:
            all_eb_txs = db.query(BankTransaction).filter(
                BankTransaction.provider == "enablebanking",
                BankTransaction.raw_data != None,
            ).limit(100).all()
            for tx in all_eb_txs:
                if tx.tink_account_id and tx.tink_account_id not in account_bics:
                    bic = infer_account_bic([tx.raw_data])
                    if bic:
                        account_bics[tx.tink_account_id] = bic
                        print(f"  Account {tx.tink_account_id[:8]}...: inferred BIC = {bic} (from DB)")

        print()

        # Check income entries
        income_to_delete = []
        for income in incomes:
            tx = bank_txs.get(income.bank_transaction_id)
            if not tx:
                continue
            reason = _check_transaction(tx, account_bics)
            if reason:
                income_to_delete.append((income, tx, reason))

        # Check expense entries
        expense_to_delete = []
        for expense in expenses:
            tx = bank_txs.get(expense.bank_transaction_id)
            if not tx:
                continue
            reason = _check_transaction(tx, account_bics)
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

        # Execute cleanup — must NULL FK references BEFORE deleting records
        affected_tx_ids = set()

        # Phase 1: Collect IDs to delete
        income_ids_to_delete = {income.id for income, tx, reason in income_to_delete}
        expense_ids_to_delete = {expense.id for expense, tx, reason in expense_to_delete}

        # Phase 2: NULL all FK references in bank_transactions that point to these records
        if income_ids_to_delete:
            db.query(BankTransaction).filter(
                BankTransaction.linked_income_id.in_(income_ids_to_delete)
            ).update({
                BankTransaction.linked_income_id: None,
                BankTransaction.status: "skipped",
            }, synchronize_session="fetch")

        if expense_ids_to_delete:
            db.query(BankTransaction).filter(
                BankTransaction.linked_expense_id.in_(expense_ids_to_delete)
            ).update({
                BankTransaction.linked_expense_id: None,
                BankTransaction.status: "skipped",
            }, synchronize_session="fetch")

        db.flush()

        # Phase 3: Delete the income/expense records (FK references already cleared)
        for income, tx, reason in income_to_delete:
            affected_tx_ids.add(tx.id)
            db.delete(income)

        for expense, tx, reason in expense_to_delete:
            affected_tx_ids.add(tx.id)
            db.delete(expense)

        # Phase 4: Mark affected bank transactions as internal transfers
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
