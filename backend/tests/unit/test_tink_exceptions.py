"""
Unit tests for Tink custom exceptions.

Tests cover:
1. TinkAPIError constructor and string representation
2. TinkAPIRetryExhausted inheritance and attributes
"""

import pytest
import sys
import os

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.tink_service import TinkAPIError, TinkAPIRetryExhausted


class TestTinkAPIError:
    """Tests for TinkAPIError exception class."""

    def test_constructor_stores_all_attributes(self):
        """Test that constructor stores status_code, endpoint, response_body."""
        error = TinkAPIError(
            message="Test error message",
            status_code=404,
            endpoint="/api/v1/accounts",
            response_body='{"error": "Not found"}'
        )

        assert error.status_code == 404
        assert error.endpoint == "/api/v1/accounts"
        assert error.response_body == '{"error": "Not found"}'
        assert str(error) != ""

    def test_constructor_with_message_only(self):
        """Test that constructor works with just a message."""
        error = TinkAPIError("Simple error")

        assert str(error).startswith("Simple error")
        assert error.status_code is None
        assert error.endpoint is None
        assert error.response_body is None

    def test_str_includes_all_available_details(self):
        """Test that __str__ includes all available details."""
        error = TinkAPIError(
            message="Token exchange failed",
            status_code=401,
            endpoint="/oauth/token",
            response_body='{"error": "invalid_grant"}'
        )

        str_repr = str(error)

        assert "Token exchange failed" in str_repr
        assert "status_code=401" in str_repr
        assert "endpoint=/oauth/token" in str_repr

    def test_str_excludes_none_values(self):
        """Test that __str__ excludes None values."""
        error = TinkAPIError(
            message="Error without details",
            status_code=None,
            endpoint=None
        )

        str_repr = str(error)

        assert "Error without details" in str_repr
        assert "status_code" not in str_repr
        assert "endpoint" not in str_repr

    def test_str_with_only_status_code(self):
        """Test __str__ with only status_code set."""
        error = TinkAPIError(
            message="Server error",
            status_code=500
        )

        str_repr = str(error)

        assert "Server error" in str_repr
        assert "status_code=500" in str_repr
        assert "endpoint" not in str_repr

    def test_str_with_only_endpoint(self):
        """Test __str__ with only endpoint set."""
        error = TinkAPIError(
            message="Request failed",
            endpoint="/api/v1/users"
        )

        str_repr = str(error)

        assert "Request failed" in str_repr
        assert "endpoint=/api/v1/users" in str_repr
        assert "status_code" not in str_repr

    def test_can_be_raised_and_caught(self):
        """Test that TinkAPIError can be raised and caught."""
        with pytest.raises(TinkAPIError) as exc_info:
            raise TinkAPIError(
                "Test exception",
                status_code=400,
                endpoint="/test"
            )

        assert exc_info.value.status_code == 400

    def test_inherits_from_exception(self):
        """Test that TinkAPIError inherits from Exception."""
        error = TinkAPIError("Test")

        assert isinstance(error, Exception)


class TestTinkAPIRetryExhausted:
    """Tests for TinkAPIRetryExhausted exception class."""

    def test_inherits_from_tink_api_error(self):
        """Test that TinkAPIRetryExhausted inherits from TinkAPIError."""
        error = TinkAPIRetryExhausted(
            message="Retries exhausted",
            attempts=3
        )

        assert isinstance(error, TinkAPIError)
        assert isinstance(error, Exception)

    def test_stores_attempts_count(self):
        """Test that TinkAPIRetryExhausted stores attempts count."""
        error = TinkAPIRetryExhausted(
            message="Max retries exceeded",
            status_code=503,
            endpoint="/api/v1/data",
            attempts=5
        )

        assert error.attempts == 5
        assert error.status_code == 503
        assert error.endpoint == "/api/v1/data"

    def test_str_includes_attempts(self):
        """Test that __str__ includes attempts count."""
        error = TinkAPIRetryExhausted(
            message="Connection failed after retries",
            status_code=502,
            endpoint="/api/test",
            attempts=3
        )

        str_repr = str(error)

        assert "Connection failed after retries" in str_repr
        assert "attempts=3" in str_repr
        assert "status_code=502" in str_repr

    def test_str_with_all_attributes(self):
        """Test __str__ with all attributes set."""
        error = TinkAPIRetryExhausted(
            message="API unavailable",
            status_code=500,
            endpoint="/data/v2/accounts",
            response_body='{"error": "timeout"}',
            attempts=5
        )

        str_repr = str(error)

        assert "API unavailable" in str_repr
        assert "status_code=500" in str_repr
        assert "endpoint=/data/v2/accounts" in str_repr
        assert "attempts=5" in str_repr

    def test_default_attempts_is_zero(self):
        """Test that default attempts value is 0."""
        error = TinkAPIRetryExhausted("Error without attempts specified")

        assert error.attempts == 0

    def test_can_be_caught_as_tink_api_error(self):
        """Test that TinkAPIRetryExhausted can be caught as TinkAPIError."""
        with pytest.raises(TinkAPIError) as exc_info:
            raise TinkAPIRetryExhausted(
                "Retries failed",
                attempts=3
            )

        # Should be caught as TinkAPIError
        assert isinstance(exc_info.value, TinkAPIRetryExhausted)
        assert exc_info.value.attempts == 3

    def test_can_be_caught_specifically(self):
        """Test that TinkAPIRetryExhausted can be caught specifically."""
        with pytest.raises(TinkAPIRetryExhausted) as exc_info:
            raise TinkAPIRetryExhausted(
                "Max retries exceeded",
                status_code=429,
                attempts=10
            )

        assert exc_info.value.attempts == 10
        assert exc_info.value.status_code == 429

    def test_exception_chaining_preserved(self):
        """Test that exception chaining is preserved."""
        try:
            try:
                raise ValueError("Original error")
            except ValueError as e:
                raise TinkAPIRetryExhausted(
                    "Wrapped error",
                    attempts=3
                ) from e
        except TinkAPIRetryExhausted as exc:
            assert exc.__cause__ is not None
            assert isinstance(exc.__cause__, ValueError)
            assert str(exc.__cause__) == "Original error"


class TestExceptionIntegration:
    """Integration tests for exception handling patterns."""

    def test_retry_exhausted_after_catching_api_errors(self):
        """Test typical retry exhaustion scenario."""
        max_retries = 3
        attempts = 0
        last_error = None

        for _ in range(max_retries):
            attempts += 1
            try:
                # Simulate API call failure
                raise TinkAPIError(
                    "Server error",
                    status_code=500,
                    endpoint="/test"
                )
            except TinkAPIError as e:
                last_error = e
                continue

        # After retries exhausted, should raise TinkAPIRetryExhausted
        with pytest.raises(TinkAPIRetryExhausted):
            raise TinkAPIRetryExhausted(
                message=f"Failed after {attempts} attempts: {last_error}",
                status_code=last_error.status_code if last_error else None,
                endpoint=last_error.endpoint if last_error else None,
                attempts=attempts
            )

    def test_distinguishing_error_types(self):
        """Test distinguishing between retryable and non-retryable errors."""
        # Non-retryable error (4xx)
        client_error = TinkAPIError(
            "Bad request",
            status_code=400,
            endpoint="/test"
        )

        # After retries (5xx that exhausted retries)
        retry_error = TinkAPIRetryExhausted(
            "Service unavailable",
            status_code=503,
            endpoint="/test",
            attempts=5
        )

        # Should be able to distinguish them
        errors = [client_error, retry_error]

        retry_errors = [e for e in errors if isinstance(e, TinkAPIRetryExhausted)]
        assert len(retry_errors) == 1
        assert retry_errors[0].attempts == 5

    def test_error_message_formatting_consistency(self):
        """Test that error messages are formatted consistently."""
        errors = [
            TinkAPIError("Simple", status_code=400),
            TinkAPIError("With endpoint", status_code=401, endpoint="/api"),
            TinkAPIRetryExhausted("Retry", status_code=500, attempts=3),
            TinkAPIRetryExhausted("Retry+endpoint", status_code=502, endpoint="/data", attempts=5),
        ]

        for error in errors:
            str_repr = str(error)
            # Should always start with the message
            assert str_repr.startswith(str(error.args[0]))
            # Pipes should separate components
            if error.status_code or error.endpoint:
                assert " | " in str_repr
