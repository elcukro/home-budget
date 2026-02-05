"""
Unit tests for the Tink Audit Service.

Tests focus on:
1. PII/token masking in audit details
2. Sanitization of sensitive data
3. Audit log entry creation
"""

import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime

# Import the audit service functions
import sys
import os

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.audit_service import (
    sanitize_audit_details,
    SENSITIVE_PATTERNS,
)


class TestSanitizeAuditDetails:
    """Tests for the sanitize_audit_details function."""

    def test_empty_details(self):
        """Test that empty/None details return empty dict."""
        assert sanitize_audit_details(None) == {}
        assert sanitize_audit_details({}) == {}

    def test_safe_primitives_pass_through(self):
        """Test that safe primitive values pass through unchanged."""
        details = {
            "account_count": 3,
            "synced": True,
            "balance": 1234.56,
            "status": None,
        }
        result = sanitize_audit_details(details)

        assert result["account_count"] == 3
        assert result["synced"] is True
        assert result["balance"] == 1234.56
        assert result["status"] is None

    def test_blocked_keys_removed(self):
        """Test that keys containing sensitive names are completely removed."""
        details = {
            "access_token": "secret_token_value",
            "refresh_token": "another_secret",
            "api_key": "api_key_value",
            "iban": "PL12345678901234567890123456",
            "email": "user@example.com",
            "account_count": 3,  # This should remain
        }
        result = sanitize_audit_details(details)

        assert "access_token" not in result
        assert "refresh_token" not in result
        assert "api_key" not in result
        assert "iban" not in result
        assert "email" not in result
        assert result["account_count"] == 3

    def test_iban_masked_in_strings(self):
        """Test that IBAN patterns are masked in string values."""
        details = {
            "message": "Account PL12345678901234567890123456 connected successfully",
            "account_count": 1,
        }
        result = sanitize_audit_details(details)

        # IBAN should be redacted (may be matched by IBAN or TOKEN pattern)
        assert "PL12345678901234567890123456" not in result.get("message", "")
        # The important thing is the sensitive data is gone, not the specific replacement
        assert "_REDACTED" in result.get("message", "")

    def test_long_tokens_masked(self):
        """Test that long alphanumeric strings (likely tokens) are masked."""
        details = {
            "debug_info": "Token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
            "short_value": "abc",  # Should remain
        }
        result = sanitize_audit_details(details)

        # Long token-like string should be redacted
        assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in result.get("debug_info", "")
        assert result.get("short_value") == "abc"

    def test_email_masked_in_strings(self):
        """Test that email addresses are masked in string values."""
        details = {
            "info": "User john.doe@example.com logged in",
        }
        result = sanitize_audit_details(details)

        assert "john.doe@example.com" not in result.get("info", "")
        assert "EMAIL_REDACTED" in result.get("info", "")

    def test_credit_card_masked(self):
        """Test that credit card numbers are masked."""
        details = {
            "card_info": "Payment with 1234-5678-9012-3456",
            "card_alt": "Card 1234 5678 9012 3456 used",
        }
        result = sanitize_audit_details(details)

        # Card numbers should be redacted
        assert "1234-5678-9012-3456" not in result.get("card_info", "")
        assert "1234 5678 9012 3456" not in result.get("card_alt", "")
        assert "CARD_REDACTED" in result.get("card_info", "")

    def test_nested_dict_sanitized(self):
        """Test that nested dictionaries are recursively sanitized."""
        details = {
            "outer": {
                "iban": "PL12345678901234567890123456",
                "count": 5,
                "inner": {
                    "email": "test@test.com",
                    "value": 100,
                }
            },
            "top_count": 10,
        }
        result = sanitize_audit_details(details)

        assert "iban" not in result.get("outer", {})
        assert result["outer"]["count"] == 5
        assert "email" not in result.get("outer", {}).get("inner", {})
        assert result["outer"]["inner"]["value"] == 100
        assert result["top_count"] == 10

    def test_list_handling(self):
        """Test that lists are handled correctly."""
        details = {
            "accounts": [1, 2, 3],
            "nested_objects": [
                {"count": 1},
                {"count": 2},
            ],
        }
        result = sanitize_audit_details(details)

        assert result["accounts"] == [1, 2, 3]
        assert len(result["nested_objects"]) == 2
        assert result["nested_objects"][0]["count"] == 1

    def test_short_strings_preserved(self):
        """Test that short, safe strings are preserved."""
        details = {
            "status": "ok",
            "type": "expense",
            "category": "Groceries",
        }
        result = sanitize_audit_details(details)

        assert result["status"] == "ok"
        assert result["type"] == "expense"
        assert result["category"] == "Groceries"

    def test_mixed_sensitivity(self):
        """Test a realistic mix of sensitive and non-sensitive data."""
        details = {
            "action": "connection_created",
            "account_count": 3,
            "user_access_token": "should_be_removed",  # blocked key
            "message": "Connected account PL12345678901234567890123456",  # IBAN to mask
            "error_code": None,
            "duration_ms": 1234,
        }
        result = sanitize_audit_details(details)

        assert result["action"] == "connection_created"
        assert result["account_count"] == 3
        assert "user_access_token" not in result
        assert "PL12345678901234567890123456" not in result.get("message", "")
        assert result["error_code"] is None
        assert result["duration_ms"] == 1234


class TestSensitivePatterns:
    """Tests to verify sensitive patterns work correctly."""

    def test_polish_iban_pattern(self):
        """Test that Polish IBAN format is detected."""
        import re
        polish_iban = "PL12345678901234567890123456"

        # Find the IBAN pattern
        iban_pattern = next(
            (p for p, r in SENSITIVE_PATTERNS if "IBAN" in r),
            None
        )
        assert iban_pattern is not None

        match = re.search(iban_pattern, polish_iban)
        assert match is not None

    def test_generic_iban_pattern(self):
        """Test that generic IBAN formats are detected."""
        import re
        german_iban = "DE89370400440532013000"

        # Find the IBAN pattern
        iban_patterns = [p for p, r in SENSITIVE_PATTERNS if "IBAN" in r]

        matched = any(re.search(p, german_iban) for p in iban_patterns)
        assert matched

    def test_card_number_patterns(self):
        """Test that credit card patterns are detected."""
        import re
        card_numbers = [
            "1234-5678-9012-3456",
            "1234 5678 9012 3456",
            "1234567890123456",
        ]

        card_pattern = next(
            (p for p, r in SENSITIVE_PATTERNS if "CARD" in r),
            None
        )
        assert card_pattern is not None

        for card in card_numbers:
            match = re.search(card_pattern, card)
            assert match is not None, f"Card pattern failed for: {card}"

    def test_email_pattern(self):
        """Test that email patterns are detected."""
        import re
        emails = [
            "user@example.com",
            "john.doe@company.co.uk",
            "test+filter@gmail.com",
        ]

        email_pattern = next(
            (p for p, r in SENSITIVE_PATTERNS if "EMAIL" in r),
            None
        )
        assert email_pattern is not None

        for email in emails:
            match = re.search(email_pattern, email)
            assert match is not None, f"Email pattern failed for: {email}"


class TestAuditDetailsIntegration:
    """Integration tests for realistic audit scenarios."""

    def test_connection_created_audit(self):
        """Test sanitization for a connection_created audit entry."""
        details = {
            "account_count": 2,
            "accounts": [
                {"id": "acc-123", "type": "checking"},
                {"id": "acc-456", "type": "savings"},
            ],
            # These should NOT be included - but let's verify they'd be sanitized
            "raw_response": "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        }
        result = sanitize_audit_details(details)

        assert result["account_count"] == 2
        # Token should be masked in raw_response
        assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in str(result)

    def test_transaction_sync_audit(self):
        """Test sanitization for a transaction sync audit entry."""
        details = {
            "synced_count": 150,
            "duplicate_count": 10,
            "total_fetched": 160,
            "date_range_days": 90,
        }
        result = sanitize_audit_details(details)

        assert result == details  # All numeric, should pass through unchanged

    def test_error_audit(self):
        """Test sanitization for an error audit entry."""
        details = {
            "error_category": "token_expired",
            "error_message": "Token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 is invalid for user@example.com",
        }
        result = sanitize_audit_details(details)

        assert result["error_category"] == "token_expired"
        # Both token and email should be masked
        error_msg = result.get("error_message", "")
        assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in error_msg
        assert "user@example.com" not in error_msg
