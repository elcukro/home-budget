"""
Unit tests for Transaction Duplicate Detection Service.

Tests cover:
1. Description normalization
2. Levenshtein distance calculation
3. Description similarity
4. Fingerprint creation
5. Duplicate confidence calculation
6. Database query functions
"""

import pytest
from datetime import date, timedelta
import sys
import os

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import User, BankTransaction
from app.services.duplicate_detection_service import (
    normalize_description,
    levenshtein_distance,
    description_similarity,
    create_fingerprint,
    create_fingerprint_from_transaction,
    calculate_duplicate_confidence,
    find_potential_duplicates,
    detect_duplicate_for_new_transaction,
    amounts_match,
    dates_within_window,
    TransactionFingerprint,
    DuplicateMatch,
    MIN_CONFIDENCE_THRESHOLD,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture(scope="module")
def test_engine():
    """Create a test database engine."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    return engine


@pytest.fixture
def db_session(test_engine):
    """Create a new database session for each test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user."""
    user = User(
        id="test-user-id",
        email="test@example.com",
        name="Test User"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sample_transaction(db_session, test_user):
    """Create a sample bank transaction."""
    tx = BankTransaction(
        user_id=test_user.id,
        tink_transaction_id="tx_sample_001",
        tink_account_id="acc_001",
        amount=-150.00,
        currency="PLN",
        date=date(2026, 2, 1),
        description_display="TESCO STORES 3297",
        merchant_name="Tesco",
        merchant_category_code="5411",
        status="pending",
    )
    db_session.add(tx)
    db_session.commit()
    db_session.refresh(tx)
    return tx


# =============================================================================
# Description Normalization Tests
# =============================================================================

class TestNormalizeDescription:
    """Tests for normalize_description function."""

    def test_lowercase_conversion(self):
        """Test that descriptions are converted to lowercase."""
        assert normalize_description("TESCO") == "tesco"
        assert normalize_description("Tesco Stores") == "tescostores"

    def test_special_chars_removed(self):
        """Test that special characters are removed."""
        assert normalize_description("TESCO - Store #123") == "tescostore123"
        assert normalize_description("Café & Restaurant!") == "cafrestaurant"

    def test_whitespace_collapsed(self):
        """Test that whitespace is removed."""
        assert normalize_description("TESCO   STORES   3297") == "tescostores3297"

    def test_empty_string(self):
        """Test handling of empty strings."""
        assert normalize_description("") == ""
        assert normalize_description(None) == ""

    def test_polish_characters(self):
        """Test handling of Polish characters."""
        # Polish characters without diacritics should be preserved if alphanumeric
        assert normalize_description("Żabka 123") == "abka123"

    def test_numbers_preserved(self):
        """Test that numbers are preserved."""
        assert normalize_description("Store 12345") == "store12345"


# =============================================================================
# Levenshtein Distance Tests
# =============================================================================

class TestLevenshteinDistance:
    """Tests for levenshtein_distance function."""

    def test_identical_strings(self):
        """Test that identical strings have distance 0."""
        assert levenshtein_distance("test", "test") == 0
        assert levenshtein_distance("tesco", "tesco") == 0

    def test_empty_strings(self):
        """Test handling of empty strings."""
        assert levenshtein_distance("", "") == 0
        assert levenshtein_distance("test", "") == 4
        assert levenshtein_distance("", "test") == 4

    def test_single_edit(self):
        """Test strings with single edit distance."""
        assert levenshtein_distance("test", "tests") == 1  # Insertion
        assert levenshtein_distance("test", "tst") == 1  # Deletion
        assert levenshtein_distance("test", "tent") == 1  # Substitution

    def test_multiple_edits(self):
        """Test strings with multiple edits."""
        assert levenshtein_distance("kitten", "sitting") == 3
        assert levenshtein_distance("tesco", "asda") == 4  # t->a, e->s, s->d, c->a (4 edits)


# =============================================================================
# Description Similarity Tests
# =============================================================================

class TestDescriptionSimilarity:
    """Tests for description_similarity function."""

    def test_identical_descriptions(self):
        """Test that identical descriptions have similarity 1.0."""
        assert description_similarity("TESCO", "TESCO") == 1.0
        assert description_similarity("tesco", "TESCO") == 1.0  # Case insensitive

    def test_similar_descriptions(self):
        """Test similar descriptions have high similarity."""
        sim = description_similarity("TESCO STORES", "TESCO STORE")
        assert sim >= 0.8

    def test_different_descriptions(self):
        """Test different descriptions have low similarity."""
        sim = description_similarity("TESCO", "ASDA")
        assert sim < 0.5

    def test_empty_descriptions(self):
        """Test handling of empty descriptions."""
        assert description_similarity("", "") == 0.0
        assert description_similarity("test", "") == 0.0
        assert description_similarity("", "test") == 0.0

    def test_tesco_variations(self):
        """Test common Tesco description variations match."""
        # These should match after normalization
        sim1 = description_similarity("TESCO", "Tesco Stores")
        sim2 = description_similarity("TESCO STORES 3297", "TESCO STORES 3298")
        # "tesco" (5 chars) vs "tescostores" (11 chars) - 6 char difference
        assert sim1 >= 0.4  # Partial match expected
        assert sim2 >= 0.9  # Only 1 digit difference


# =============================================================================
# Amount and Date Matching Tests
# =============================================================================

class TestAmountsMatch:
    """Tests for amounts_match function."""

    def test_exact_match(self):
        """Test exact amount matches."""
        assert amounts_match(100.00, 100.00) is True
        assert amounts_match(-150.50, -150.50) is True

    def test_within_tolerance(self):
        """Test amounts within tolerance."""
        assert amounts_match(100.00, 100.005) is True  # Within 0.01
        assert amounts_match(100.00, 100.015) is False  # Outside 0.01

    def test_absolute_values(self):
        """Test that absolute values are compared."""
        assert amounts_match(-100.00, 100.00) is True
        assert amounts_match(100.00, -100.00) is True


class TestDatesWithinWindow:
    """Tests for dates_within_window function."""

    def test_same_date(self):
        """Test same dates are within window."""
        d = date(2026, 2, 1)
        assert dates_within_window(d, d) is True

    def test_within_window(self):
        """Test dates within the window."""
        d1 = date(2026, 2, 1)
        d2 = date(2026, 2, 2)
        assert dates_within_window(d1, d2, window_days=2) is True

    def test_at_window_boundary(self):
        """Test dates at the boundary of the window."""
        d1 = date(2026, 2, 1)
        d2 = date(2026, 2, 3)  # 2 days apart
        assert dates_within_window(d1, d2, window_days=2) is True

    def test_outside_window(self):
        """Test dates outside the window."""
        d1 = date(2026, 2, 1)
        d2 = date(2026, 2, 5)  # 4 days apart
        assert dates_within_window(d1, d2, window_days=2) is False


# =============================================================================
# Fingerprint Creation Tests
# =============================================================================

class TestFingerprintCreation:
    """Tests for fingerprint creation functions."""

    def test_create_fingerprint(self):
        """Test creating a fingerprint from raw data."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        assert fp.amount_abs == 150.00
        assert fp.currency == "PLN"
        assert fp.date == date(2026, 2, 1)
        assert fp.description_normalized == "tescostores3297"
        assert fp.merchant_category_code == "5411"
        assert fp.tink_account_id == "acc_001"

    def test_fingerprint_from_transaction(self, sample_transaction):
        """Test creating a fingerprint from a BankTransaction record."""
        fp = create_fingerprint_from_transaction(sample_transaction)

        assert fp.amount_abs == 150.00
        assert fp.currency == "PLN"
        assert fp.date == date(2026, 2, 1)
        assert "tesco" in fp.description_normalized

    def test_fingerprint_currency_uppercase(self):
        """Test that currency is uppercased."""
        fp = create_fingerprint(
            amount=100,
            currency="pln",
            tx_date=date(2026, 2, 1),
            description="Test",
            merchant_category_code=None,
            tink_account_id="acc",
        )
        assert fp.currency == "PLN"


# =============================================================================
# Duplicate Confidence Calculation Tests
# =============================================================================

class TestDuplicateConfidenceCalculation:
    """Tests for calculate_duplicate_confidence function."""

    def test_currency_mismatch_returns_zero(self, sample_transaction):
        """Test that currency mismatch returns 0 confidence."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="EUR",  # Different currency
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        confidence, reason = calculate_duplicate_confidence(fp, sample_transaction)
        assert confidence == 0.0
        assert reason == "currency_mismatch"

    def test_amount_mismatch_returns_zero(self, sample_transaction):
        """Test that amount mismatch returns 0 confidence."""
        fp = create_fingerprint(
            amount=-200.00,  # Different amount
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        confidence, reason = calculate_duplicate_confidence(fp, sample_transaction)
        assert confidence == 0.0
        assert reason == "amount_mismatch"

    def test_same_account_exact_match(self, sample_transaction):
        """Test high confidence for same account, same date, same description."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",  # Same account
        )

        confidence, reason = calculate_duplicate_confidence(fp, sample_transaction)
        assert confidence == 0.95
        assert reason == "same_account_exact_match"

    def test_same_account_date_variance(self, sample_transaction):
        """Test high confidence for same account, ±1 day, similar description."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 2),  # 1 day later
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",  # Same account
        )

        confidence, reason = calculate_duplicate_confidence(fp, sample_transaction)
        assert confidence == 0.85
        assert reason == "same_account_date_variance"

    def test_cross_account_similar(self, sample_transaction):
        """Test lower confidence for different account, similar details."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 2),  # ±2 days
            description="TESCO STORES 3298",  # Similar description
            merchant_category_code="5411",
            tink_account_id="acc_002",  # Different account
        )

        confidence, reason = calculate_duplicate_confidence(fp, sample_transaction)
        # Should match cross_account_similar or same_account criteria
        assert confidence >= 0.60


# =============================================================================
# Database Query Tests
# =============================================================================

class TestFindPotentialDuplicates:
    """Tests for find_potential_duplicates function."""

    def test_finds_matching_transaction(self, db_session, test_user, sample_transaction):
        """Test finding a potential duplicate in the database."""
        fp = create_fingerprint(
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3298",  # Similar description
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        matches = find_potential_duplicates(
            db=db_session,
            user_id=test_user.id,
            fingerprint=fp,
        )

        assert len(matches) > 0
        assert matches[0].original_transaction_id == sample_transaction.id
        assert matches[0].confidence >= MIN_CONFIDENCE_THRESHOLD

    def test_excludes_specified_transaction(self, db_session, test_user, sample_transaction):
        """Test that excluded transaction IDs are not returned."""
        fp = create_fingerprint_from_transaction(sample_transaction)

        matches = find_potential_duplicates(
            db=db_session,
            user_id=test_user.id,
            fingerprint=fp,
            exclude_transaction_ids=[sample_transaction.id],
        )

        # Should not find the excluded transaction
        for match in matches:
            assert match.original_transaction_id != sample_transaction.id

    def test_no_matches_for_different_user(self, db_session, sample_transaction):
        """Test that transactions from other users are not matched."""
        # Create another user
        other_user = User(
            id="other-user-id",
            email="other@example.com",
            name="Other User"
        )
        db_session.add(other_user)
        db_session.commit()

        fp = create_fingerprint_from_transaction(sample_transaction)

        matches = find_potential_duplicates(
            db=db_session,
            user_id=other_user.id,  # Different user
            fingerprint=fp,
        )

        assert len(matches) == 0

    def test_skips_tiny_amounts(self, db_session, test_user):
        """Test that tiny amounts are skipped."""
        fp = create_fingerprint(
            amount=0.005,  # Below threshold
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="Test",
            merchant_category_code=None,
            tink_account_id="acc_001",
        )

        matches = find_potential_duplicates(
            db=db_session,
            user_id=test_user.id,
            fingerprint=fp,
        )

        assert len(matches) == 0


class TestDetectDuplicateForNewTransaction:
    """Tests for detect_duplicate_for_new_transaction function."""

    def test_detects_exact_tink_id_match(self, db_session, test_user, sample_transaction):
        """Test that exact tink_transaction_id matches return 1.0 confidence."""
        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_sample_001",  # Same as sample_transaction
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        assert match is not None
        assert match.confidence == 1.0
        assert match.match_reason == "exact_tink_id_match"

    def test_detects_fuzzy_duplicate(self, db_session, test_user, sample_transaction):
        """Test that fuzzy duplicates are detected."""
        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_new_001",  # Different tink ID
            amount=-150.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="TESCO STORES 3297",  # Same description
            merchant_category_code="5411",
            tink_account_id="acc_001",
        )

        assert match is not None
        assert match.confidence >= MIN_CONFIDENCE_THRESHOLD
        assert match.original_transaction_id == sample_transaction.id

    def test_no_match_for_different_transaction(self, db_session, test_user, sample_transaction):
        """Test that clearly different transactions don't match."""
        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_new_002",
            amount=-500.00,  # Different amount
            currency="PLN",
            tx_date=date(2026, 2, 15),  # Different date
            description="ASDA Supermarket",  # Different merchant
            merchant_category_code="5411",
            tink_account_id="acc_002",  # Different account
        )

        assert match is None


# =============================================================================
# Edge Case Tests
# =============================================================================

class TestEdgeCases:
    """Edge case tests for duplicate detection."""

    def test_recurring_transactions_not_flagged_as_duplicates(self, db_session, test_user):
        """Test that recurring transactions (30+ days apart) are not flagged."""
        # Create a transaction from last month
        old_tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_recurring_jan",
            tink_account_id="acc_001",
            amount=-1000.00,
            currency="PLN",
            date=date(2026, 1, 1),
            description_display="Rent Payment",
            status="pending",
        )
        db_session.add(old_tx)
        db_session.commit()

        # Check if a new rent payment 30+ days later is flagged
        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_recurring_feb",
            amount=-1000.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),  # 31 days later
            description="Rent Payment",
            merchant_category_code=None,
            tink_account_id="acc_001",
        )

        # Should NOT be flagged as duplicate (outside 7-day search window)
        assert match is None

    def test_different_currencies_not_duplicates(self, db_session, test_user):
        """Test that same amount in different currencies are not duplicates."""
        tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_pln_001",
            tink_account_id="acc_001",
            amount=-100.00,
            currency="PLN",
            date=date(2026, 2, 1),
            description_display="International Store",
            status="pending",
        )
        db_session.add(tx)
        db_session.commit()

        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_eur_001",
            amount=-100.00,
            currency="EUR",  # Different currency
            tx_date=date(2026, 2, 1),
            description="International Store",
            merchant_category_code=None,
            tink_account_id="acc_001",
        )

        assert match is None

    def test_inter_account_transfer_detection(self, db_session, test_user):
        """Test that transfers between accounts are detected."""
        # Create outgoing transaction
        outgoing = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_transfer_out",
            tink_account_id="acc_001",
            amount=-500.00,  # Outgoing
            currency="PLN",
            date=date(2026, 2, 1),
            description_display="Transfer to savings",
            status="pending",
        )
        db_session.add(outgoing)
        db_session.commit()

        # Check if incoming transaction to another account is flagged
        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_transfer_in",
            amount=500.00,  # Incoming (positive)
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="Transfer from checking",
            merchant_category_code=None,
            tink_account_id="acc_002",  # Different account
        )

        # Should detect as potential inter-account transfer
        assert match is not None
        assert match.confidence >= MIN_CONFIDENCE_THRESHOLD

    def test_zero_amount_transactions_skipped(self, db_session, test_user):
        """Test that zero-amount transactions are skipped."""
        tx = BankTransaction(
            user_id=test_user.id,
            tink_transaction_id="tx_zero_001",
            tink_account_id="acc_001",
            amount=0.00,
            currency="PLN",
            date=date(2026, 2, 1),
            description_display="Bank fee waived",
            status="pending",
        )
        db_session.add(tx)
        db_session.commit()

        match = detect_duplicate_for_new_transaction(
            db=db_session,
            user_id=test_user.id,
            tink_transaction_id="tx_zero_002",
            amount=0.00,
            currency="PLN",
            tx_date=date(2026, 2, 1),
            description="Bank fee waived",
            merchant_category_code=None,
            tink_account_id="acc_001",
        )

        # Zero amounts should be skipped
        assert match is None
