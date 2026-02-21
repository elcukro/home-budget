"""
Internal transfer detection logic.

Shared by:
- enable_banking.py (sync-time detection)
- bank_transactions.py (GoCardless sync)
- backfill_internal_transfers.py (retroactive marking)
- cleanup_income_garbage.py (cleanup script)

Kept in its own module to avoid import chain issues (routers/__init__.py pulls in stripe, etc.)

Detection strategy for Enable Banking (CRDT/income transactions):
  1. STRUCTURAL: Same bank BIC or no bank → internal (catches ~70% without text matching)
  2. TEXT PATTERNS: Cross-bank own-account transfers (Velo, przelew własny, etc.)
  3. BIC+PERSON: Same bank + same person name/address → internal
"""

from typing import Optional


# ── Text patterns ────────────────────────────────────────────────────────────
# Case-insensitive matching on remittance/description text.
# Includes both Polish diacritics and ASCII variants (some banks strip diacritics).
INTERNAL_PATTERNS = [
    "smart saver",              # ING Smart Saver auto-savings
    "przelew własny",           # Own-account transfer (diacritics)
    "przelew wlasny",           # Own-account transfer (ASCII, e.g. mBank)
    "konto oszczędnościowe",    # Savings account transfer
    "konto oszczednosciowe",    # Savings account (ASCII variant)
    "velo zasilenie",           # ING Velo savings account funding
    "velo ",                    # Any Velo-related transfer (trailing space avoids false matches)
    "wpłatomat",               # ATM self-deposit
    "wplatomat",               # ATM self-deposit (ASCII)
    "wpłata własna",           # Self-deposit (ATM or branch)
    "wplata wlasna",           # Self-deposit (ASCII)
    "zasilenie kredyt",         # Loan account top-up
    "przelew środków",          # Fund transfer between own accounts
    "przelew srodkow",          # Fund transfer (ASCII, e.g. mBank "PRZELEW SRODKOW")
    "wymiana",                  # Currency exchange within bank
    "płatność kartą",           # Card payment appearing on credit side
    "platnosc karta",           # Card payment (ASCII)
    "zwrot kartą",              # Card refund
    "zwrot karta",              # Card refund (ASCII)
    "kapitalizacja odsetek",    # Interest capitalization
    "naliczenie odsetek",       # Interest accrual posting
    "zwrot transakcji blik",    # BLIK transaction refund
]


def _text_matches_internal(text: str) -> bool:
    """Check if text matches any internal transfer pattern."""
    if not text:
        return False
    text_lower = text.lower()
    for pattern in INTERNAL_PATTERNS:
        if pattern in text_lower:
            return True
    return False


# ── Account BIC inference ────────────────────────────────────────────────────

def infer_account_bic(transactions: list[dict]) -> Optional[str]:
    """Infer the account's own bank BIC from a batch of transactions.

    For DBIT transactions, debtor_agent.bic_fi = account's bank.
    For CRDT transactions with creditor_agent, that's the account's bank.
    Returns the first BIC found, or None.
    """
    for tx in transactions:
        cdi = tx.get("credit_debit_indicator", "")
        if cdi == "DBIT":
            bic = ((tx.get("debtor_agent") or {}).get("bic_fi") or "").strip()
            if bic:
                return bic
        if cdi == "CRDT":
            bic = ((tx.get("creditor_agent") or {}).get("bic_fi") or "").strip()
            if bic:
                return bic
    return None


# ── Enable Banking detection ─────────────────────────────────────────────────

def detect_internal_transfer_eb(tx: dict, account_bic: Optional[str] = None) -> bool:
    """Detect internal transfers from Enable Banking raw transaction data.

    For CRDT (incoming money) — structural BIC-based approach:
      1. No debtor bank → internal (ATM deposits, cash operations)
      2. Same bank as account → internal (card reversals, own transfers, interest, BLIK)
      3. Text patterns → internal (cross-bank own-account: Velo, przelew własny)

    For DBIT (outgoing money) — text + BIC-based:
      1. Text patterns catch own-account transfers, savings deposits
      2. Same BIC + same person catches ING-to-ING own transfers

    The account_bic parameter enables structural filtering for CRDT.
    When provided, any CRDT where debtor comes from the same bank is marked internal.
    """
    debtor_bic = ((tx.get("debtor_agent") or {}).get("bic_fi") or "").strip() or None
    creditor_bic = ((tx.get("creditor_agent") or {}).get("bic_fi") or "").strip() or None
    cdi = tx.get("credit_debit_indicator", "")

    # ── CRDT: Structural BIC filter (primary for income classification) ──
    if cdi == "CRDT":
        # No debtor bank → ATM/cash deposit → internal
        if not debtor_bic:
            return True

        # Same bank as account → internal (card reversals, own transfers, interest)
        if account_bic and debtor_bic == account_bic:
            return True

        # Fallback: same debtor & creditor BIC (when account_bic unknown)
        if creditor_bic and debtor_bic == creditor_bic:
            return True

    # ── Text pattern matching (all transaction types) ────────────────────
    remittance = tx.get("remittance_information", [])
    remittance_text = " ".join(remittance) if isinstance(remittance, list) else str(remittance or "")
    if _text_matches_internal(remittance_text):
        return True

    # ── BIC: Same bank + same person (mainly catches DBIT own-transfers) ─
    if debtor_bic and creditor_bic and debtor_bic == creditor_bic:
        debtor = tx.get("debtor") or {}
        creditor = tx.get("creditor") or {}

        # Same name
        d_name = debtor.get("name", "")
        c_name = creditor.get("name", "")
        if d_name and c_name and d_name.lower() == c_name.lower():
            return True

        # Same address
        d_addr = (debtor.get("postal_address") or {}).get("address_line") or []
        c_addr = (creditor.get("postal_address") or {}).get("address_line") or []
        if d_addr and c_addr and d_addr[0] == c_addr[0]:
            return True

    return False


# ── GoCardless detection ─────────────────────────────────────────────────────

def detect_internal_transfer_gc(raw_data: dict) -> bool:
    """Detect internal transfers from GoCardless raw transaction data."""
    if not raw_data:
        return False
    types = raw_data.get("types") or {}
    if isinstance(types, dict) and types.get("type") == "TRANSFER":
        return True
    if isinstance(types, list):
        for t in types:
            if isinstance(t, dict) and t.get("type") == "TRANSFER":
                return True
    return False


# ── Unified detection ────────────────────────────────────────────────────────

def detect_internal_transfer(raw_data: dict, provider: str, account_bic: Optional[str] = None) -> bool:
    """Unified detection for any provider."""
    if not raw_data:
        return False
    if provider == "gocardless":
        return detect_internal_transfer_gc(raw_data)
    return detect_internal_transfer_eb(raw_data, account_bic=account_bic)


def detect_internal_from_descriptions(description_display: str = "",
                                       description_original: str = "",
                                       description_detailed: str = "") -> bool:
    """Fallback detection using description fields when raw_data lacks remittance."""
    for field in [description_original, description_detailed, description_display]:
        if _text_matches_internal(field or ""):
            return True
    return False
