"""
Internal transfer detection logic.

Shared by:
- enable_banking.py (sync-time detection)
- bank_transactions.py (GoCardless sync)
- backfill_internal_transfers.py (retroactive marking)
- cleanup_income_garbage.py (cleanup script)

Kept in its own module to avoid import chain issues (routers/__init__.py pulls in stripe, etc.)
"""

# All known internal transfer patterns (case-insensitive matching on remittance/description text)
INTERNAL_PATTERNS = [
    "smart saver",              # ING Smart Saver auto-savings
    "przelew własny",           # Own-account transfer
    "konto oszczędnościowe",    # Savings account transfer
    "velo zasilenie",           # ING Velo savings account funding
    "velo ",                    # Any Velo-related transfer (trailing space to avoid false matches)
    "wpłatomat",               # ATM self-deposit
    "wpłata własna",           # Self-deposit (ATM or branch)
    "zasilenie kredyt",         # Loan account top-up
    "przelew środków",          # Fund transfer between own accounts
    "wymiana",                  # Currency exchange within bank
    "płatność kartą",           # Card payment appearing on credit side
    "zwrot kartą",              # Card refund
    "kapitalizacja odsetek",    # Interest capitalization
    "naliczenie odsetek",       # Interest accrual posting
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


def detect_internal_transfer_eb(tx: dict) -> bool:
    """Detect internal transfers from Enable Banking raw transaction data.

    Catches: ING Smart Saver, own-account transfers, savings account transfers,
    Velo savings, ATM self-deposits, loan top-ups, currency exchanges,
    card payment reversals, interest postings, and same-bank same-person transfers.
    """
    remittance = tx.get("remittance_information", [])
    remittance_text = " ".join(remittance) if isinstance(remittance, list) else str(remittance or "")

    if _text_matches_internal(remittance_text):
        return True

    # BIC-based detection: same bank, same person
    debtor_agent = tx.get("debtor_agent") or {}
    creditor_agent = tx.get("creditor_agent") or {}
    same_bic = (debtor_agent.get("bic_fi") and
                debtor_agent.get("bic_fi") == creditor_agent.get("bic_fi"))

    if same_bic:
        # Relaxed check: same BIC + same person name
        debtor_name = (tx.get("debtor") or {}).get("name", "")
        creditor_name = (tx.get("creditor") or {}).get("name", "")
        if debtor_name and creditor_name and debtor_name.lower() == creditor_name.lower():
            return True

        # Fallback: same BIC + same address line
        debtor_addr = (tx.get("debtor") or {}).get("postal_address") or {}
        creditor_addr = (tx.get("creditor") or {}).get("postal_address") or {}
        debtor_lines = debtor_addr.get("address_line") or []
        creditor_lines = creditor_addr.get("address_line") or []
        if debtor_lines and creditor_lines and debtor_lines[0] == creditor_lines[0]:
            return True

    return False


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


def detect_internal_transfer(raw_data: dict, provider: str) -> bool:
    """Unified detection for any provider."""
    if not raw_data:
        return False
    if provider == "gocardless":
        return detect_internal_transfer_gc(raw_data)
    return detect_internal_transfer_eb(raw_data)


def detect_internal_from_descriptions(description_display: str = "",
                                       description_original: str = "",
                                       description_detailed: str = "") -> bool:
    """Fallback detection using description fields when raw_data lacks remittance."""
    for field in [description_original, description_detailed, description_display]:
        if _text_matches_internal(field or ""):
            return True
    return False
