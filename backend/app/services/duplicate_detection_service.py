"""
Transaction Duplicate Detection Service

Provides intelligent duplicate detection for bank transactions using:
1. Exact matching (tink_transaction_id)
2. Fuzzy matching (fingerprint-based)

Fingerprint algorithm considers:
- Absolute amount (±0.01 tolerance for floating point)
- Currency
- Date (±2 day window)
- Normalized description
- Merchant category code (MCC)
"""

import re
from datetime import date, timedelta
from typing import Optional, List, Tuple, Dict, Any
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models import BankTransaction
from ..logging_utils import get_secure_logger

logger = get_secure_logger(__name__)


# =============================================================================
# Configuration Constants
# =============================================================================

# Minimum confidence threshold for flagging as duplicate
MIN_CONFIDENCE_THRESHOLD = 0.60

# Date window for fuzzy matching (days)
DATE_WINDOW_DAYS = 2

# Amount tolerance for floating point comparison
AMOUNT_TOLERANCE = 0.01

# Description similarity threshold (0-1)
DESCRIPTION_SIMILARITY_THRESHOLD = 0.80

# Minimum amount for duplicate detection (skip zero/tiny transactions)
MIN_AMOUNT_FOR_DUPLICATE_CHECK = 0.01


# =============================================================================
# Data Classes
# =============================================================================

@dataclass
class TransactionFingerprint:
    """Fingerprint of a transaction for duplicate detection."""
    amount_abs: float
    currency: str
    date: date
    description_normalized: str
    merchant_category_code: Optional[str]
    tink_account_id: str


@dataclass
class DuplicateMatch:
    """Represents a potential duplicate match."""
    original_transaction_id: int
    confidence: float
    match_reason: str


# =============================================================================
# Helper Functions
# =============================================================================

def normalize_description(desc: str) -> str:
    """
    Normalize a transaction description for comparison.

    Rules:
    - Convert to lowercase
    - Remove all non-alphanumeric characters
    - Collapse multiple spaces
    - Trim whitespace

    Examples:
    - "TESCO" -> "tesco"
    - "Tesco Stores" -> "tescostores"
    - "TESCO STORES 3297" -> "tescostores3297"
    """
    if not desc:
        return ""

    # Lowercase
    normalized = desc.lower()

    # Remove non-alphanumeric (keep spaces for now)
    normalized = re.sub(r'[^a-z0-9\s]', '', normalized)

    # Remove all spaces
    normalized = re.sub(r'\s+', '', normalized)

    return normalized.strip()


def levenshtein_distance(s1: str, s2: str) -> int:
    """
    Calculate the Levenshtein distance between two strings.
    """
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


def description_similarity(desc1: str, desc2: str) -> float:
    """
    Calculate similarity between two descriptions (0-1).

    Uses Levenshtein distance normalized by max string length.
    """
    if not desc1 or not desc2:
        return 0.0

    # Normalize both descriptions
    norm1 = normalize_description(desc1)
    norm2 = normalize_description(desc2)

    if not norm1 or not norm2:
        return 0.0

    # Exact match after normalization
    if norm1 == norm2:
        return 1.0

    # Calculate Levenshtein similarity
    max_len = max(len(norm1), len(norm2))
    distance = levenshtein_distance(norm1, norm2)

    return 1.0 - (distance / max_len)


def amounts_match(amount1: float, amount2: float, tolerance: float = AMOUNT_TOLERANCE) -> bool:
    """Check if two amounts are equal within tolerance."""
    return abs(abs(amount1) - abs(amount2)) <= tolerance


def dates_within_window(date1: date, date2: date, window_days: int = DATE_WINDOW_DAYS) -> bool:
    """Check if two dates are within the specified window."""
    delta = abs((date1 - date2).days)
    return delta <= window_days


# =============================================================================
# Fingerprint Functions
# =============================================================================

def create_fingerprint(
    amount: float,
    currency: str,
    tx_date: date,
    description: str,
    merchant_category_code: Optional[str],
    tink_account_id: str,
) -> TransactionFingerprint:
    """
    Create a transaction fingerprint from raw data.
    """
    return TransactionFingerprint(
        amount_abs=abs(amount),
        currency=currency.upper() if currency else "PLN",
        date=tx_date,
        description_normalized=normalize_description(description),
        merchant_category_code=merchant_category_code,
        tink_account_id=tink_account_id,
    )


def create_fingerprint_from_transaction(tx: BankTransaction) -> TransactionFingerprint:
    """
    Create a fingerprint from an existing BankTransaction record.
    """
    return create_fingerprint(
        amount=tx.amount,
        currency=tx.currency,
        tx_date=tx.date,
        description=tx.description_display or "",
        merchant_category_code=tx.merchant_category_code,
        tink_account_id=tx.tink_account_id,
    )


# =============================================================================
# Confidence Calculation
# =============================================================================

def calculate_duplicate_confidence(
    fingerprint: TransactionFingerprint,
    existing_tx: BankTransaction,
) -> Tuple[float, str]:
    """
    Calculate confidence that a new transaction is a duplicate of an existing one.

    Returns:
        Tuple of (confidence_score, match_reason)

    Confidence levels:
    - 0.95: Same account, same amount, same date, same description
    - 0.85: Same account, same amount, ±1 day, similar description (80%+)
    - 0.75: Different accounts, inverse amounts, same date (inter-account transfer)
    - 0.60: Different accounts, same absolute amount, ±2 days, similar description
    """
    existing_fingerprint = create_fingerprint_from_transaction(existing_tx)

    # Check currency match (must match)
    if fingerprint.currency != existing_fingerprint.currency:
        return 0.0, "currency_mismatch"

    # Check amount match (must be within tolerance)
    if not amounts_match(fingerprint.amount_abs, existing_fingerprint.amount_abs):
        return 0.0, "amount_mismatch"

    # Calculate description similarity
    desc_similarity = description_similarity(
        fingerprint.description_normalized,
        existing_fingerprint.description_normalized
    )

    # Same account scenarios
    same_account = fingerprint.tink_account_id == existing_fingerprint.tink_account_id

    # Date comparison
    date_delta = abs((fingerprint.date - existing_fingerprint.date).days)
    same_date = date_delta == 0
    within_1_day = date_delta <= 1
    within_2_days = date_delta <= 2

    # Scenario 1: Same account, same amount, same date, same/similar description
    if same_account and same_date and desc_similarity >= DESCRIPTION_SIMILARITY_THRESHOLD:
        return 0.95, "same_account_exact_match"

    # Scenario 2: Same account, same amount, ±1 day, similar description
    if same_account and within_1_day and desc_similarity >= DESCRIPTION_SIMILARITY_THRESHOLD:
        return 0.85, "same_account_date_variance"

    # Scenario 3: Different accounts, inverse amounts (transfer detection)
    # One transaction positive, one negative = inter-account transfer
    if not same_account and same_date:
        # Check if amounts are inverse (one positive, one negative)
        if (fingerprint.amount_abs > 0 and existing_tx.amount < 0) or \
           (fingerprint.amount_abs > 0 and existing_tx.amount > 0):
            # This is for detecting the same transaction showing up in both accounts
            # of an internal transfer
            return 0.75, "inter_account_transfer"

    # Scenario 4: Different accounts, same amount, ±2 days, similar description
    if not same_account and within_2_days and desc_similarity >= DESCRIPTION_SIMILARITY_THRESHOLD:
        return 0.60, "cross_account_similar"

    # Scenario 5: Same account, same amount, ±2 days, weaker description match
    if same_account and within_2_days and desc_similarity >= 0.5:
        return 0.60, "same_account_weak_match"

    # No match
    return 0.0, "no_match"


# =============================================================================
# Database Query Functions
# =============================================================================

def find_potential_duplicates(
    db: Session,
    user_id: str,
    fingerprint: TransactionFingerprint,
    exclude_transaction_ids: Optional[List[int]] = None,
    limit: int = 10,
) -> List[DuplicateMatch]:
    """
    Find potential duplicate transactions in the database.

    Strategy:
    1. Query transactions within date window (±7 days for wider net)
    2. Filter by approximate amount (in Python, for floating point safety)
    3. Calculate confidence for each candidate
    4. Return matches above minimum threshold

    Args:
        db: Database session
        user_id: User ID to search within
        fingerprint: Fingerprint of the new transaction
        exclude_transaction_ids: IDs to exclude from search (e.g., the transaction itself)
        limit: Maximum candidates to fetch from DB

    Returns:
        List of DuplicateMatch objects, sorted by confidence (highest first)
    """
    # Skip tiny transactions
    if fingerprint.amount_abs < MIN_AMOUNT_FOR_DUPLICATE_CHECK:
        return []

    # Calculate date range (wider than actual window for performance)
    date_min = fingerprint.date - timedelta(days=7)
    date_max = fingerprint.date + timedelta(days=7)

    # Base query
    query = db.query(BankTransaction).filter(
        BankTransaction.user_id == user_id,
        BankTransaction.currency == fingerprint.currency,
        BankTransaction.date >= date_min,
        BankTransaction.date <= date_max,
    )

    # Exclude specific transactions
    if exclude_transaction_ids:
        query = query.filter(BankTransaction.id.notin_(exclude_transaction_ids))

    # Fetch candidates
    candidates = query.limit(limit * 3).all()  # Fetch more than needed for filtering

    # Calculate confidence for each candidate
    matches = []
    for candidate in candidates:
        # Skip if amount doesn't match (approximate)
        if not amounts_match(fingerprint.amount_abs, abs(candidate.amount), tolerance=0.50):
            continue

        confidence, reason = calculate_duplicate_confidence(fingerprint, candidate)

        if confidence >= MIN_CONFIDENCE_THRESHOLD:
            matches.append(DuplicateMatch(
                original_transaction_id=candidate.id,
                confidence=confidence,
                match_reason=reason,
            ))

    # Sort by confidence (highest first)
    matches.sort(key=lambda m: m.confidence, reverse=True)

    return matches[:limit]


# =============================================================================
# High-Level Detection Functions
# =============================================================================

def detect_duplicate_for_new_transaction(
    db: Session,
    user_id: str,
    tink_transaction_id: str,
    amount: float,
    currency: str,
    tx_date: date,
    description: str,
    merchant_category_code: Optional[str],
    tink_account_id: str,
) -> Optional[DuplicateMatch]:
    """
    Check if a new transaction (not yet in DB) is a duplicate of an existing one.

    Args:
        db: Database session
        user_id: User ID
        tink_transaction_id: Tink's transaction ID
        amount: Transaction amount
        currency: Currency code
        tx_date: Transaction date
        description: Display description
        merchant_category_code: MCC code
        tink_account_id: Tink account ID

    Returns:
        DuplicateMatch if a potential duplicate is found, None otherwise
    """
    # First check: Exact tink_transaction_id match
    existing = db.query(BankTransaction).filter(
        BankTransaction.tink_transaction_id == tink_transaction_id
    ).first()

    if existing:
        # Exact duplicate - shouldn't be saved at all
        return DuplicateMatch(
            original_transaction_id=existing.id,
            confidence=1.0,
            match_reason="exact_tink_id_match",
        )

    # Second check: Fuzzy fingerprint matching
    fingerprint = create_fingerprint(
        amount=amount,
        currency=currency,
        tx_date=tx_date,
        description=description,
        merchant_category_code=merchant_category_code,
        tink_account_id=tink_account_id,
    )

    matches = find_potential_duplicates(db, user_id, fingerprint)

    if matches:
        return matches[0]  # Return best match

    return None


def check_pending_to_booked_update(
    db: Session,
    user_id: str,
    fingerprint: TransactionFingerprint,
    raw_data: Dict[str, Any],
) -> Optional[int]:
    """
    Check if this transaction is the booked version of a pending transaction.

    When Tink first returns a transaction as "pending" and later as "booked",
    we should update the existing record rather than creating a duplicate.

    Args:
        db: Database session
        user_id: User ID
        fingerprint: Transaction fingerprint
        raw_data: Raw Tink data (to check status field)

    Returns:
        Transaction ID to update if found, None otherwise
    """
    # Get status from raw data
    new_status = raw_data.get("status")
    if new_status != "BOOKED":
        return None

    # Look for pending transactions with matching fingerprint
    date_min = fingerprint.date - timedelta(days=7)
    date_max = fingerprint.date + timedelta(days=7)

    pending_candidates = db.query(BankTransaction).filter(
        BankTransaction.user_id == user_id,
        BankTransaction.currency == fingerprint.currency,
        BankTransaction.date >= date_min,
        BankTransaction.date <= date_max,
        BankTransaction.tink_account_id == fingerprint.tink_account_id,
        # Check raw_data for pending status
        BankTransaction.raw_data.op('->>')('status') == 'PENDING',
    ).all()

    for candidate in pending_candidates:
        if not amounts_match(fingerprint.amount_abs, abs(candidate.amount)):
            continue

        confidence, _ = calculate_duplicate_confidence(fingerprint, candidate)
        if confidence >= 0.85:
            return candidate.id

    return None
