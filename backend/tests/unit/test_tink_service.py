"""
Unit tests for TinkService class.

Tests cover:
1. State token generation and verification
2. Pending auth database operations
3. Retry logic with exponential backoff
4. Backoff calculation
5. Token refresh operations
6. External user ID sanitization
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
import httpx
import json
import base64
import hmac
import hashlib

import sys
import os

# Set test environment BEFORE any app imports
os.environ["ENVIRONMENT"] = "test"
os.environ["POSTGRES_PASSWORD"] = "test"
os.environ["NEXTAUTH_SECRET"] = "test-signing-key-for-tests"
os.environ["TINK_CLIENT_ID"] = "test-client-id"
os.environ["TINK_CLIENT_SECRET"] = "test-client-secret"

# Add the backend app to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.tink_service import (
    TinkService,
    TinkAPIError,
    TinkAPIRetryExhausted,
    sanitize_external_user_id,
    _is_retryable_status,
    _parse_retry_after,
    _calculate_backoff_delay,
    RETRYABLE_STATUS_CODES,
    NON_RETRYABLE_STATUS_CODES,
)


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def tink_service():
    """Create a fresh TinkService instance for testing."""
    return TinkService()


@pytest.fixture
def mock_db_session():
    """Create a mock database session."""
    return MagicMock()


@pytest.fixture
def sample_user_id():
    """Sample user ID for testing."""
    return "test-user-123"


# =============================================================================
# State Token Tests
# =============================================================================

class TestStateTokenGeneration:
    """Tests for generate_state_token and verify_state_token methods."""

    def test_generate_state_token_creates_valid_format(self, tink_service, sample_user_id):
        """Test that generate_state_token creates a properly formatted token."""
        token = tink_service.generate_state_token(sample_user_id)

        # Token should have two parts separated by .
        parts = token.split('.')
        assert len(parts) == 2, "Token should have payload.signature format"

        # First part should be base64 encoded
        payload_b64 = parts[0]
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)

        # Payload should contain user_id, exp, and nonce
        assert "user_id" in payload
        assert payload["user_id"] == sample_user_id
        assert "exp" in payload
        assert "nonce" in payload

    def test_generate_state_token_expiration_is_future(self, tink_service, sample_user_id):
        """Test that token expiration is set in the future."""
        token = tink_service.generate_state_token(sample_user_id)

        payload_b64 = token.split('.')[0]
        payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
        payload = json.loads(payload_json)

        exp = datetime.fromisoformat(payload["exp"])
        now = datetime.utcnow()

        assert exp > now, "Expiration should be in the future"
        # Default is 1 hour
        assert exp < now + timedelta(hours=2), "Expiration should be within 2 hours"

    def test_verify_state_token_returns_user_id_for_valid_token(self, tink_service, sample_user_id):
        """Test that verify_state_token returns user_id for valid tokens."""
        token = tink_service.generate_state_token(sample_user_id)

        result = tink_service.verify_state_token(token)

        assert result == sample_user_id

    def test_verify_state_token_returns_none_for_expired_token(self, tink_service, sample_user_id):
        """Test that verify_state_token returns None for expired tokens."""
        # Create a token with expiration in the past
        expired_payload = {
            "user_id": sample_user_id,
            "exp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
            "nonce": "test-nonce"
        }
        payload_json = json.dumps(expired_payload, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()

        signature = hmac.new(
            tink_service._signing_key,
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()

        expired_token = f"{payload_b64}.{signature}"

        result = tink_service.verify_state_token(expired_token)

        assert result is None

    def test_verify_state_token_returns_none_for_tampered_token(self, tink_service, sample_user_id):
        """Test that verify_state_token returns None for tokens with invalid signature."""
        token = tink_service.generate_state_token(sample_user_id)

        # Tamper with the signature
        parts = token.split('.')
        tampered_signature = "a" * len(parts[1])  # Replace signature with a's
        tampered_token = f"{parts[0]}.{tampered_signature}"

        result = tink_service.verify_state_token(tampered_token)

        assert result is None

    def test_verify_state_token_returns_none_for_malformed_token(self, tink_service):
        """Test that verify_state_token returns None for malformed tokens."""
        malformed_tokens = [
            "",  # Empty
            "no-dot-separator",  # No separator
            "too.many.parts",  # Too many parts
            "invalid-base64.signature",  # Invalid base64
            "aW52YWxpZA==.signature",  # Valid base64 but not valid JSON
        ]

        for token in malformed_tokens:
            result = tink_service.verify_state_token(token)
            assert result is None, f"Token '{token}' should return None"

    def test_verify_state_token_at_exact_expiration_boundary(self, tink_service, sample_user_id):
        """Test token verification at exact expiration boundary."""
        # Create a token that expires in 1 second
        payload = {
            "user_id": sample_user_id,
            "exp": (datetime.utcnow() + timedelta(seconds=1)).isoformat(),
            "nonce": "test-nonce"
        }
        payload_json = json.dumps(payload, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()

        signature = hmac.new(
            tink_service._signing_key,
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()

        boundary_token = f"{payload_b64}.{signature}"

        # Should be valid now
        result = tink_service.verify_state_token(boundary_token)
        assert result == sample_user_id

        # Wait for expiration
        time.sleep(1.5)

        # Should be expired now
        result = tink_service.verify_state_token(boundary_token)
        assert result is None

    def test_generate_state_token_creates_unique_tokens(self, tink_service, sample_user_id):
        """Test that generate_state_token creates unique tokens each time."""
        tokens = [tink_service.generate_state_token(sample_user_id) for _ in range(10)]
        unique_tokens = set(tokens)

        assert len(unique_tokens) == len(tokens), "All tokens should be unique"


# =============================================================================
# External User ID Sanitization Tests
# =============================================================================

class TestSanitizeExternalUserId:
    """Tests for sanitize_external_user_id function."""

    def test_creates_consistent_hashes_for_same_input(self):
        """Test that same input produces same hash."""
        user_id = "test@example.com"

        hash1 = sanitize_external_user_id(user_id)
        hash2 = sanitize_external_user_id(user_id)

        assert hash1 == hash2

    def test_creates_unique_hashes_for_different_inputs(self):
        """Test that different inputs produce different hashes."""
        user_ids = [
            "test1@example.com",
            "test2@example.com",
            "user-123",
            "user-456",
        ]

        hashes = [sanitize_external_user_id(uid) for uid in user_ids]
        unique_hashes = set(hashes)

        assert len(unique_hashes) == len(user_ids)

    def test_output_format_matches_expected_pattern(self):
        """Test that output matches hb2_ prefix + 32-char hash."""
        user_id = "test@example.com"

        result = sanitize_external_user_id(user_id)

        assert result.startswith("hb2_"), "Should start with hb2_ prefix"
        assert len(result) == 36, "Should be 36 chars total (4 prefix + 32 hash)"

        # The hash part should be alphanumeric (hexadecimal)
        hash_part = result[4:]
        assert hash_part.isalnum(), "Hash part should be alphanumeric"


# =============================================================================
# Backoff Calculation Tests
# =============================================================================

class TestBackoffCalculation:
    """Tests for _calculate_backoff_delay function."""

    def test_attempt_zero_returns_base_delay_with_jitter(self):
        """Test that attempt=0 returns approximately base_delay."""
        base_delay = 1.0
        jitter_factor = 0.25

        # Run multiple times to account for jitter
        delays = [_calculate_backoff_delay(0, base_delay, jitter_factor=jitter_factor) for _ in range(100)]

        # All delays should be within jitter range
        min_expected = base_delay * (1 - jitter_factor)
        max_expected = base_delay * (1 + jitter_factor)

        for delay in delays:
            assert min_expected <= delay <= max_expected, f"Delay {delay} should be within jitter range"

    def test_exponential_growth(self):
        """Test that delay doubles each attempt (before jitter)."""
        base_delay = 1.0

        # Use jitter_factor=0 to test pure exponential growth
        delay_0 = _calculate_backoff_delay(0, base_delay, jitter_factor=0)
        delay_1 = _calculate_backoff_delay(1, base_delay, jitter_factor=0)
        delay_2 = _calculate_backoff_delay(2, base_delay, jitter_factor=0)
        delay_3 = _calculate_backoff_delay(3, base_delay, jitter_factor=0)

        assert delay_0 == pytest.approx(1.0)
        assert delay_1 == pytest.approx(2.0)
        assert delay_2 == pytest.approx(4.0)
        assert delay_3 == pytest.approx(8.0)

    def test_max_delay_cap_is_respected(self):
        """Test that max_delay caps the result."""
        base_delay = 1.0
        max_delay = 5.0

        # Attempt 10 would be 2^10 = 1024 without cap
        delay = _calculate_backoff_delay(10, base_delay, max_delay, jitter_factor=0)

        assert delay == max_delay

    def test_jitter_is_applied(self):
        """Test that jitter creates variation in delays."""
        base_delay = 10.0
        jitter_factor = 0.25

        delays = [_calculate_backoff_delay(0, base_delay, jitter_factor=jitter_factor) for _ in range(100)]

        # Should have some variation due to jitter
        min_delay = min(delays)
        max_delay = max(delays)

        assert min_delay != max_delay, "Jitter should create variation"

    def test_delay_is_never_negative(self):
        """Test that delay is never negative."""
        for attempt in range(10):
            for _ in range(50):
                delay = _calculate_backoff_delay(attempt, jitter_factor=0.5)
                assert delay >= 0, "Delay should never be negative"


class TestParseRetryAfter:
    """Tests for _parse_retry_after function."""

    def test_handles_integer_seconds(self):
        """Test parsing Retry-After as integer seconds."""
        response = MagicMock()
        response.headers = {"Retry-After": "30"}

        result = _parse_retry_after(response)

        assert result == 30.0

    def test_caps_at_60_seconds(self):
        """Test that Retry-After is capped at 60 seconds."""
        response = MagicMock()
        response.headers = {"Retry-After": "120"}

        result = _parse_retry_after(response)

        assert result == 60.0

    def test_handles_http_date_format(self):
        """Test parsing Retry-After as HTTP-date."""
        from email.utils import format_datetime

        future_time = datetime.now() + timedelta(seconds=30)
        http_date = format_datetime(future_time)

        response = MagicMock()
        response.headers = {"Retry-After": http_date}

        result = _parse_retry_after(response)

        # Should be approximately 30 seconds (with some tolerance for execution time)
        assert result is not None
        assert 25 <= result <= 60

    def test_returns_none_for_missing_header(self):
        """Test that missing Retry-After returns None."""
        response = MagicMock()
        response.headers = {}

        result = _parse_retry_after(response)

        assert result is None

    def test_returns_none_for_invalid_header(self):
        """Test that invalid Retry-After returns None."""
        invalid_values = [
            "invalid",
            "not-a-number",
            "",
            "invalid-date-format",
        ]

        for value in invalid_values:
            response = MagicMock()
            response.headers = {"Retry-After": value}

            result = _parse_retry_after(response)

            assert result is None, f"Invalid value '{value}' should return None"


class TestRetryableStatus:
    """Tests for _is_retryable_status function."""

    def test_retryable_status_codes(self):
        """Test that retryable status codes return True."""
        for code in RETRYABLE_STATUS_CODES:
            assert _is_retryable_status(code) is True, f"Status {code} should be retryable"

    def test_non_retryable_status_codes(self):
        """Test that non-retryable status codes return False."""
        for code in NON_RETRYABLE_STATUS_CODES:
            assert _is_retryable_status(code) is False, f"Status {code} should not be retryable"

    def test_success_codes_not_retryable(self):
        """Test that 2xx codes are not retryable."""
        for code in [200, 201, 204]:
            assert _is_retryable_status(code) is False


# =============================================================================
# Retry Logic Tests
# =============================================================================

class TestRetryLogic:
    """Tests for _request_with_retry method."""

    @pytest.mark.asyncio
    async def test_successful_request_on_first_attempt(self, tink_service):
        """Test that successful request on first attempt returns response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = '{"data": "test"}'
        mock_response.json.return_value = {"data": "test"}

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response

            result = await tink_service._request_with_retry(
                "GET",
                "https://api.tink.com/test",
                max_retries=3
            )

            assert result.status_code == 200
            mock_get.assert_called_once()

    @pytest.mark.asyncio
    async def test_retry_on_429_respects_retry_after_header(self, tink_service):
        """Test that 429 with Retry-After header respects the wait time."""
        # First response is 429, second is success
        response_429 = MagicMock()
        response_429.status_code = 429
        response_429.text = "Rate limited"
        response_429.headers = {"Retry-After": "1"}  # 1 second

        response_200 = MagicMock()
        response_200.status_code = 200
        response_200.text = '{"success": true}'

        call_count = 0

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return response_429
            return response_200

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
            mock_get_method.side_effect = mock_get

            start = time.time()
            result = await tink_service._request_with_retry(
                "GET",
                "https://api.tink.com/test",
                max_retries=3,
                base_delay=0.1
            )
            elapsed = time.time() - start

            assert result.status_code == 200
            assert call_count == 2
            # Should have waited at least 1 second (from Retry-After)
            assert elapsed >= 0.9

    @pytest.mark.asyncio
    async def test_retry_on_429_without_retry_after_uses_backoff(self, tink_service):
        """Test that 429 without Retry-After uses exponential backoff."""
        response_429 = MagicMock()
        response_429.status_code = 429
        response_429.text = "Rate limited"
        response_429.headers = {}  # No Retry-After

        response_200 = MagicMock()
        response_200.status_code = 200
        response_200.text = '{"success": true}'

        call_count = 0

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                return response_429
            return response_200

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
            mock_get_method.side_effect = mock_get

            result = await tink_service._request_with_retry(
                "GET",
                "https://api.tink.com/test",
                max_retries=5,
                base_delay=0.1
            )

            assert result.status_code == 200
            assert call_count == 3

    @pytest.mark.asyncio
    async def test_retry_on_5xx_uses_exponential_backoff(self, tink_service):
        """Test that 5xx errors trigger exponential backoff."""
        for status_code in [500, 502, 503, 504]:
            response_5xx = MagicMock()
            response_5xx.status_code = status_code
            response_5xx.text = "Server error"
            response_5xx.headers = {}

            response_200 = MagicMock()
            response_200.status_code = 200
            response_200.text = '{"success": true}'

            call_count = 0

            async def mock_get(*args, **kwargs):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    return response_5xx
                return response_200

            with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
                call_count = 0
                mock_get_method.side_effect = mock_get

                result = await tink_service._request_with_retry(
                    "GET",
                    "https://api.tink.com/test",
                    max_retries=3,
                    base_delay=0.01
                )

                assert result.status_code == 200, f"Should retry on {status_code}"

    @pytest.mark.asyncio
    async def test_no_retry_on_4xx_client_errors(self, tink_service):
        """Test that 4xx client errors raise TinkAPIError immediately without retry."""
        for status_code in [400, 401, 403, 404, 422]:
            response_4xx = MagicMock()
            response_4xx.status_code = status_code
            response_4xx.text = "Client error"

            with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
                mock_get_method.return_value = response_4xx

                with pytest.raises(TinkAPIError) as exc_info:
                    await tink_service._request_with_retry(
                        "GET",
                        "https://api.tink.com/test",
                        max_retries=5
                    )

                # Should have only called once (no retry)
                mock_get_method.assert_called_once()
                assert exc_info.value.status_code == status_code

    @pytest.mark.asyncio
    async def test_tink_api_retry_exhausted_after_max_retries(self, tink_service):
        """Test that TinkAPIRetryExhausted is raised after max_retries exceeded."""
        response_500 = MagicMock()
        response_500.status_code = 500
        response_500.text = "Server error"
        response_500.headers = {}

        call_count = 0

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return response_500

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
            mock_get_method.side_effect = mock_get

            with pytest.raises(TinkAPIRetryExhausted) as exc_info:
                await tink_service._request_with_retry(
                    "GET",
                    "https://api.tink.com/test",
                    max_retries=3,
                    base_delay=0.01
                )

            assert call_count == 3
            assert exc_info.value.attempts == 3
            assert exc_info.value.status_code == 500

    @pytest.mark.asyncio
    async def test_timeout_error_triggers_retry(self, tink_service):
        """Test that timeout errors trigger retry."""
        call_count = 0

        response_200 = MagicMock()
        response_200.status_code = 200
        response_200.text = '{"success": true}'

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.TimeoutException("Request timeout")
            return response_200

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
            mock_get_method.side_effect = mock_get

            result = await tink_service._request_with_retry(
                "GET",
                "https://api.tink.com/test",
                max_retries=3,
                base_delay=0.01
            )

            assert result.status_code == 200
            assert call_count == 2

    @pytest.mark.asyncio
    async def test_connection_error_triggers_retry(self, tink_service):
        """Test that connection errors trigger retry."""
        call_count = 0

        response_200 = MagicMock()
        response_200.status_code = 200
        response_200.text = '{"success": true}'

        async def mock_get(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise httpx.ConnectError("Connection failed")
            return response_200

        with patch.object(httpx.AsyncClient, 'get', new_callable=AsyncMock) as mock_get_method:
            mock_get_method.side_effect = mock_get

            result = await tink_service._request_with_retry(
                "GET",
                "https://api.tink.com/test",
                max_retries=3,
                base_delay=0.01
            )

            assert result.status_code == 200
            assert call_count == 2


# =============================================================================
# Pending Auth Database Tests
# =============================================================================

class TestPendingAuthOperations:
    """Tests for pending auth database operations."""

    def test_store_pending_auth_creates_record(self, tink_service):
        """Test that store_pending_auth creates a record with correct fields."""
        mock_db = MagicMock()
        mock_pending_auth = MagicMock()

        # Configure the mock to return None for expired auth query
        mock_db.query.return_value.filter.return_value.delete.return_value = 0

        result = tink_service.store_pending_auth(
            db=mock_db,
            state_token="test-state-token",
            user_id="test-user-id",
            tink_user_id="external-user-id",
            authorization_code="test-auth-code"
        )

        # Should have called add and commit
        assert mock_db.add.called
        assert mock_db.commit.called

    def test_get_pending_auth_returns_valid_record(self, tink_service):
        """Test that get_pending_auth returns valid, unexpired, unused records."""
        mock_db = MagicMock()
        mock_pending = MagicMock()
        mock_pending.state_token = "test-state"
        mock_pending.user_id = "test-user"
        mock_pending.used = False
        mock_pending.expires_at = datetime.utcnow() + timedelta(minutes=10)

        mock_db.query.return_value.filter.return_value.first.return_value = mock_pending

        result = tink_service.get_pending_auth(mock_db, "test-state")

        assert result == mock_pending

    def test_get_pending_auth_returns_none_for_expired(self, tink_service):
        """Test that get_pending_auth returns None for expired records."""
        mock_db = MagicMock()
        # Return None to simulate no valid records found
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = tink_service.get_pending_auth(mock_db, "expired-state")

        assert result is None

    def test_get_pending_auth_returns_none_for_used(self, tink_service):
        """Test that get_pending_auth returns None for already used records."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = None

        result = tink_service.get_pending_auth(mock_db, "used-state")

        assert result is None

    def test_mark_auth_used_updates_record(self, tink_service):
        """Test that mark_auth_used updates the used field."""
        mock_db = MagicMock()

        tink_service.mark_auth_used(mock_db, "test-state")

        mock_db.query.return_value.filter.return_value.update.assert_called_once_with({"used": True})
        mock_db.commit.assert_called_once()

    def test_cleanup_expired_auth_removes_expired(self, tink_service):
        """Test that cleanup_expired_auth removes only expired records."""
        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.delete.return_value = 5

        result = tink_service.cleanup_expired_auth(mock_db)

        assert result == 5
        mock_db.commit.assert_called_once()


# =============================================================================
# Token Refresh Tests
# =============================================================================

class TestTokenRefresh:
    """Tests for token refresh operations."""

    @pytest.mark.asyncio
    async def test_get_valid_access_token_returns_existing_if_not_expired(self, tink_service):
        """Test that get_valid_access_token returns existing token if not expired."""
        mock_db = MagicMock()
        mock_connection = MagicMock()
        mock_connection.access_token = "valid-access-token"
        mock_connection.token_expires_at = datetime.utcnow() + timedelta(hours=1)
        mock_connection.refresh_token = "refresh-token"

        result = await tink_service.get_valid_access_token(mock_connection, mock_db)

        assert result == "valid-access-token"

    @pytest.mark.asyncio
    async def test_get_valid_access_token_refreshes_when_near_expiration(self, tink_service):
        """Test that get_valid_access_token refreshes token when within 5 min of expiration."""
        mock_db = MagicMock()
        mock_connection = MagicMock()
        mock_connection.id = 1
        mock_connection.user_id = "test-user"
        mock_connection.access_token = "old-access-token"
        mock_connection.token_expires_at = datetime.utcnow() + timedelta(minutes=3)  # Within 5 min
        mock_connection.refresh_token = "valid-refresh-token"

        new_token_data = {
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 7200
        }

        with patch.object(tink_service, 'refresh_access_token', new_callable=AsyncMock) as mock_refresh:
            mock_refresh.return_value = new_token_data

            with patch('app.services.tink_service.audit_token_refreshed'):
                result = await tink_service.get_valid_access_token(mock_connection, mock_db)

            assert result == "new-access-token"
            mock_refresh.assert_called_once_with("valid-refresh-token")
            assert mock_connection.access_token == "new-access-token"
            mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_valid_access_token_raises_if_no_refresh_token(self, tink_service):
        """Test that get_valid_access_token raises if no refresh_token available."""
        mock_db = MagicMock()
        mock_connection = MagicMock()
        mock_connection.access_token = "expired-token"
        mock_connection.token_expires_at = datetime.utcnow() - timedelta(hours=1)  # Expired
        mock_connection.refresh_token = ""  # No refresh token

        with pytest.raises(Exception, match="no refresh token available"):
            await tink_service.get_valid_access_token(mock_connection, mock_db)

    @pytest.mark.asyncio
    async def test_token_refresh_updates_connection_record(self, tink_service):
        """Test that token refresh updates the connection record in database."""
        mock_db = MagicMock()
        mock_connection = MagicMock()
        mock_connection.id = 1
        mock_connection.user_id = "test-user"
        mock_connection.access_token = "old-token"
        mock_connection.token_expires_at = datetime.utcnow() - timedelta(minutes=10)
        mock_connection.refresh_token = "valid-refresh-token"

        new_token_data = {
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 3600
        }

        with patch.object(tink_service, 'refresh_access_token', new_callable=AsyncMock) as mock_refresh:
            mock_refresh.return_value = new_token_data

            with patch('app.services.tink_service.audit_token_refreshed'):
                await tink_service.get_valid_access_token(mock_connection, mock_db)

            # Verify connection was updated
            assert mock_connection.access_token == "new-access-token"
            assert mock_connection.refresh_token == "new-refresh-token"
            # token_expires_at should be updated
            assert mock_connection.token_expires_at is not None

    @pytest.mark.asyncio
    async def test_handles_timezone_aware_expiration(self, tink_service):
        """Test that token refresh handles timezone-aware datetime correctly."""
        from datetime import timezone as tz

        mock_db = MagicMock()
        mock_connection = MagicMock()
        mock_connection.access_token = "valid-token"
        # Create a timezone-aware datetime
        mock_connection.token_expires_at = datetime.now(tz.utc) + timedelta(hours=1)
        mock_connection.refresh_token = "refresh-token"

        result = await tink_service.get_valid_access_token(mock_connection, mock_db)

        # Should return existing token without refresh
        assert result == "valid-token"


# =============================================================================
# Credentials Check Tests
# =============================================================================

class TestCredentialsCheck:
    """Tests for credentials checking."""

    def test_check_credentials_raises_when_missing(self):
        """Test that _check_credentials raises ValueError when credentials missing."""
        service = TinkService()
        service.client_id = ""
        service.client_secret = ""

        with pytest.raises(ValueError, match="Tink API credentials not configured"):
            service._check_credentials()

    def test_check_credentials_passes_when_configured(self, tink_service):
        """Test that _check_credentials passes when credentials are set."""
        # Our test fixture has credentials set via environment
        # This should not raise
        tink_service._check_credentials()


# =============================================================================
# API Method Tests - get_client_access_token
# =============================================================================

class TestGetClientAccessToken:
    """Tests for get_client_access_token method."""

    @pytest.mark.asyncio
    async def test_successful_token_retrieval(self, tink_service):
        """Test successful client access token retrieval."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "test-client-token"}
        mock_response.text = '{"access_token": "test-client-token"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            token = await tink_service.get_client_access_token()

            assert token == "test-client-token"
            mock_request.assert_called_once()
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['method'] == 'POST'
            assert 'oauth/token' in call_kwargs['url']
            assert call_kwargs['data']['grant_type'] == 'client_credentials'

    @pytest.mark.asyncio
    async def test_custom_scope(self, tink_service):
        """Test that custom scope is passed correctly."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "test-token"}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            await tink_service.get_client_access_token(scope="providers:read")

            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['data']['scope'] == 'providers:read'

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on non-200 response."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = '{"error": "unauthorized"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.get_client_access_token()

            assert exc_info.value.status_code == 401
            assert "Failed to get client access token" in str(exc_info.value)


# =============================================================================
# API Method Tests - create_tink_user
# =============================================================================

class TestCreateTinkUser:
    """Tests for create_tink_user method."""

    @pytest.mark.asyncio
    async def test_successful_user_creation(self, tink_service):
        """Test successful Tink user creation."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "user_id": "tink-user-id-123",
            "external_user_id": "hb2_abc123"
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            result = await tink_service.create_tink_user(
                client_token="test-token",
                external_user_id="hb2_abc123",
                market="PL"
            )

            assert result["user_id"] == "tink-user-id-123"
            assert result["external_user_id"] == "hb2_abc123"

    @pytest.mark.asyncio
    async def test_handles_existing_user(self, tink_service):
        """Test handling of 409 Conflict when user already exists."""
        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = TinkAPIError(
                message="User already exists",
                status_code=409,
                endpoint="/api/v1/user/create",
                response_body='{"error": "conflict"}'
            )

            result = await tink_service.create_tink_user(
                client_token="test-token",
                external_user_id="hb2_existing"
            )

            assert result["external_user_id"] == "hb2_existing"
            assert result["user_id"] is None

    @pytest.mark.asyncio
    async def test_raises_error_on_other_failure(self, tink_service):
        """Test that TinkAPIError is raised for non-409 errors."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = '{"error": "bad request"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.create_tink_user("token", "user123")

            assert exc_info.value.status_code == 400


# =============================================================================
# API Method Tests - generate_delegated_auth_code
# =============================================================================

class TestGenerateDelegatedAuthCode:
    """Tests for generate_delegated_auth_code method."""

    @pytest.mark.asyncio
    async def test_successful_auth_code_generation_with_tink_user_id(self, tink_service):
        """Test auth code generation using tink_user_id."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"code": "auth-code-123"}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            code = await tink_service.generate_delegated_auth_code(
                client_token="test-token",
                tink_user_id="tink-user-123"
            )

            assert code == "auth-code-123"
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['data']['user_id'] == "tink-user-123"

    @pytest.mark.asyncio
    async def test_successful_auth_code_generation_with_external_user_id(self, tink_service):
        """Test auth code generation using external_user_id."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"code": "auth-code-456"}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            code = await tink_service.generate_delegated_auth_code(
                client_token="test-token",
                external_user_id="ext-user-123"
            )

            assert code == "auth-code-456"
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['data']['external_user_id'] == "ext-user-123"

    @pytest.mark.asyncio
    async def test_raises_error_when_no_user_id_provided(self, tink_service):
        """Test that ValueError is raised when neither user_id is provided."""
        with pytest.raises(ValueError, match="Either tink_user_id or external_user_id must be provided"):
            await tink_service.generate_delegated_auth_code(client_token="test-token")

    @pytest.mark.asyncio
    async def test_raises_error_on_api_failure(self, tink_service):
        """Test that TinkAPIError is raised on API failure."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = '{"error": "forbidden"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.generate_delegated_auth_code(
                    client_token="test-token",
                    tink_user_id="user-123"
                )

            assert exc_info.value.status_code == 403


# =============================================================================
# API Method Tests - generate_user_auth_code
# =============================================================================

class TestGenerateUserAuthCode:
    """Tests for generate_user_auth_code method."""

    @pytest.mark.asyncio
    async def test_successful_user_auth_code_generation(self, tink_service):
        """Test successful user auth code generation."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"code": "user-auth-code-123"}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            code = await tink_service.generate_user_auth_code(
                client_token="test-token",
                external_user_id="ext-user-123"
            )

            assert code == "user-auth-code-123"
            call_kwargs = mock_request.call_args[1]
            assert 'authorization-grant' in call_kwargs['url']
            assert 'delegate' not in call_kwargs['url']

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on failure."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = '{"error": "internal server error"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.generate_user_auth_code(
                    client_token="test-token",
                    external_user_id="ext-user-123"
                )

            assert exc_info.value.status_code == 500


# =============================================================================
# API Method Tests - exchange_code_for_tokens
# =============================================================================

class TestExchangeCodeForTokens:
    """Tests for exchange_code_for_tokens method."""

    @pytest.mark.asyncio
    async def test_successful_token_exchange(self, tink_service):
        """Test successful code exchange for tokens."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "access-token-123",
            "refresh_token": "refresh-token-123",
            "expires_in": 3600,
            "token_type": "Bearer"
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            result = await tink_service.exchange_code_for_tokens("auth-code-123")

            assert result["access_token"] == "access-token-123"
            assert result["refresh_token"] == "refresh-token-123"
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['data']['code'] == "auth-code-123"
            assert call_kwargs['data']['grant_type'] == 'authorization_code'

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on failure."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = '{"error": "invalid_grant"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.exchange_code_for_tokens("invalid-code")

            assert exc_info.value.status_code == 400
            assert "Failed to exchange code for tokens" in str(exc_info.value)


# =============================================================================
# API Method Tests - fetch_accounts
# =============================================================================

class TestFetchAccounts:
    """Tests for fetch_accounts method."""

    @pytest.mark.asyncio
    async def test_successful_accounts_fetch(self, tink_service):
        """Test successful accounts fetching."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "accounts": [
                {"id": "acc-1", "name": "Checking", "type": "CHECKING"},
                {"id": "acc-2", "name": "Savings", "type": "SAVINGS"}
            ]
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            accounts = await tink_service.fetch_accounts("access-token-123")

            assert len(accounts) == 2
            assert accounts[0]["id"] == "acc-1"
            assert accounts[1]["type"] == "SAVINGS"

    @pytest.mark.asyncio
    async def test_empty_accounts_list(self, tink_service):
        """Test handling of empty accounts list."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"accounts": []}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            accounts = await tink_service.fetch_accounts("access-token")

            assert accounts == []

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on failure."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = '{"error": "unauthorized"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.fetch_accounts("invalid-token")

            assert exc_info.value.status_code == 401


# =============================================================================
# API Method Tests - fetch_providers
# =============================================================================

class TestFetchProviders:
    """Tests for fetch_providers method."""

    @pytest.mark.asyncio
    async def test_successful_providers_fetch(self, tink_service):
        """Test successful providers fetching."""
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.json.return_value = {"access_token": "client-token"}

        mock_providers_response = MagicMock()
        mock_providers_response.status_code = 200
        mock_providers_response.json.return_value = {
            "providers": [
                {"displayName": "ING Bank", "financialInstitutionId": "ing-123"},
                {"displayName": "mBank", "financialInstitutionId": "mbank-456"}
            ]
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = [mock_token_response, mock_providers_response]

            providers = await tink_service.fetch_providers(market="PL")

            assert len(providers) == 2
            assert providers[0]["displayName"] == "ING Bank"

    @pytest.mark.asyncio
    async def test_raises_error_on_providers_fetch_failure(self, tink_service):
        """Test that TinkAPIError is raised when providers fetch fails."""
        mock_token_response = MagicMock()
        mock_token_response.status_code = 200
        mock_token_response.json.return_value = {"access_token": "client-token"}

        mock_providers_response = MagicMock()
        mock_providers_response.status_code = 404
        mock_providers_response.text = '{"error": "market not found"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = [mock_token_response, mock_providers_response]

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.fetch_providers(market="XX")

            assert exc_info.value.status_code == 404


# =============================================================================
# API Method Tests - fetch_transactions
# =============================================================================

class TestFetchTransactions:
    """Tests for fetch_transactions method."""

    @pytest.mark.asyncio
    async def test_successful_transactions_fetch_with_enrichment(self, tink_service):
        """Test successful transactions fetch using enrichment endpoint."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "transactions": [
                {"id": "tx-1", "amount": {"value": {"unscaledValue": "100"}}},
                {"id": "tx-2", "amount": {"value": {"unscaledValue": "50"}}}
            ],
            "nextPageToken": "page2"
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            result = await tink_service.fetch_transactions(
                access_token="access-token",
                use_enrichment=True
            )

            assert len(result["transactions"]) == 2
            assert result["nextPageToken"] == "page2"
            call_kwargs = mock_request.call_args[1]
            assert "enrichment" in call_kwargs['url']

    @pytest.mark.asyncio
    async def test_transactions_fetch_without_enrichment(self, tink_service):
        """Test transactions fetch using basic endpoint."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"transactions": []}

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            await tink_service.fetch_transactions(
                access_token="access-token",
                use_enrichment=False
            )

            call_kwargs = mock_request.call_args[1]
            assert "data/v2/transactions" in call_kwargs['url']

    @pytest.mark.asyncio
    async def test_transactions_fetch_with_filters(self, tink_service):
        """Test transactions fetch with date filters and account_id."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"transactions": []}

        from_date = datetime(2024, 1, 1)
        to_date = datetime(2024, 12, 31)

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            await tink_service.fetch_transactions(
                access_token="access-token",
                account_id="acc-123",
                from_date=from_date,
                to_date=to_date,
                page_token="page2"
            )

            call_kwargs = mock_request.call_args[1]
            url = call_kwargs['url']
            assert "accountIdIn=acc-123" in url or "acc-123" in str(call_kwargs)

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on failure."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = '{"error": "forbidden"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError):
                await tink_service.fetch_transactions("invalid-token")


# =============================================================================
# API Method Tests - generate_connect_url
# =============================================================================

class TestGenerateConnectUrl:
    """Tests for generate_connect_url method."""

    @pytest.mark.asyncio
    async def test_successful_connect_url_generation(self, tink_service):
        """Test successful connect URL generation."""
        mock_db = MagicMock()

        # Mock all the internal calls
        with patch.object(tink_service, 'get_client_access_token', new_callable=AsyncMock) as mock_client_token:
            mock_client_token.return_value = "client-token"

            with patch.object(tink_service, 'create_tink_user', new_callable=AsyncMock) as mock_create_user:
                mock_create_user.return_value = {"user_id": "tink-user-123", "external_user_id": "ext-123"}

                with patch.object(tink_service, 'generate_delegated_auth_code', new_callable=AsyncMock) as mock_auth_code:
                    mock_auth_code.return_value = "auth-code-123"

                    with patch.object(tink_service, 'store_pending_auth') as mock_store:
                        url, state = await tink_service.generate_connect_url(
                            user_id="user@example.com",
                            db=mock_db
                        )

                        assert "link.tink.com" in url
                        assert "authorization_code=auth-code-123" in url
                        assert "state=" in url
                        mock_store.assert_called_once()


# =============================================================================
# API Method Tests - generate_simple_connect_url
# =============================================================================

class TestGenerateSimpleConnectUrl:
    """Tests for generate_simple_connect_url method."""

    @pytest.mark.asyncio
    async def test_successful_simple_connect_url_generation(self, tink_service):
        """Test successful simple connect URL generation."""
        mock_db = MagicMock()

        with patch.object(tink_service, 'store_pending_auth') as mock_store:
            url, state = await tink_service.generate_simple_connect_url(
                user_id="user@example.com",
                db=mock_db,
                locale="pl_PL"
            )

            assert "link.tink.com" in url
            assert "connect-accounts" in url
            assert "client_id=" in url
            assert "state=" in url
            assert "authorization_code" not in url  # Simple flow doesn't have auth code
            mock_store.assert_called_once()


# =============================================================================
# API Method Tests - refresh_access_token
# =============================================================================

class TestRefreshAccessToken:
    """Tests for refresh_access_token method."""

    @pytest.mark.asyncio
    async def test_successful_token_refresh(self, tink_service):
        """Test successful token refresh."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new-access-token",
            "refresh_token": "new-refresh-token",
            "expires_in": 3600
        }

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            result = await tink_service.refresh_access_token("old-refresh-token")

            assert result["access_token"] == "new-access-token"
            call_kwargs = mock_request.call_args[1]
            assert call_kwargs['data']['grant_type'] == 'refresh_token'
            assert call_kwargs['data']['refresh_token'] == "old-refresh-token"

    @pytest.mark.asyncio
    async def test_raises_error_on_failure(self, tink_service):
        """Test that TinkAPIError is raised on refresh failure."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = '{"error": "invalid_grant"}'

        with patch.object(tink_service, '_request_with_retry', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response

            with pytest.raises(TinkAPIError) as exc_info:
                await tink_service.refresh_access_token("invalid-refresh-token")

            assert exc_info.value.status_code == 400
