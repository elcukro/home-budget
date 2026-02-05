"""
Tink API Service

Handles OAuth flow and API interactions with Tink using Connectivity v1.

Flow:
1. Get client access token (client_credentials grant)
2. Create Tink user (if not exists)
3. Generate delegated authorization code (for Tink Link)
4. Build Tink Link URL
5. After callback, exchange OUR authorization code for user tokens
6. Use user tokens to fetch accounts/transactions

IMPORTANT: We exchange the code WE generated (step 3), NOT any code from callback!
"""

import os
import httpx
import secrets
import hmac
import hashlib
import base64
import json
import asyncio
import random
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlencode
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models import TinkConnection, BankTransaction, TinkPendingAuth
from ..logging_utils import get_secure_logger
from .audit_service import audit_token_refreshed

logger = get_secure_logger(__name__)

# Late import to avoid circular dependency - will be imported when needed
_metrics_service = None

def _get_metrics_service():
    """Lazy import of metrics service to avoid circular imports."""
    global _metrics_service
    if _metrics_service is None:
        from .tink_metrics_service import tink_metrics_service
        _metrics_service = tink_metrics_service
    return _metrics_service


# =============================================================================
# Custom Exceptions
# =============================================================================
class TinkAPIError(Exception):
    """Base exception for Tink API errors."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        endpoint: Optional[str] = None,
        response_body: Optional[str] = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.endpoint = endpoint
        self.response_body = response_body

    def __str__(self):
        parts = [super().__str__()]
        if self.status_code:
            parts.append(f"status_code={self.status_code}")
        if self.endpoint:
            parts.append(f"endpoint={self.endpoint}")
        return " | ".join(parts)


class TinkAPIRetryExhausted(TinkAPIError):
    """Exception raised when all retry attempts are exhausted for a Tink API call."""

    def __init__(
        self,
        message: str,
        status_code: Optional[int] = None,
        endpoint: Optional[str] = None,
        response_body: Optional[str] = None,
        attempts: int = 0,
    ):
        super().__init__(message, status_code, endpoint, response_body)
        self.attempts = attempts

    def __str__(self):
        base = super().__str__()
        return f"{base} | attempts={self.attempts}"


# =============================================================================
# HTTP Status Code Classification
# =============================================================================
# Status codes that should trigger a retry (transient errors)
RETRYABLE_STATUS_CODES = {
    429,  # Too Many Requests (rate limited)
    500,  # Internal Server Error
    502,  # Bad Gateway
    503,  # Service Unavailable
    504,  # Gateway Timeout
}

# Status codes that should NOT trigger retry (client errors / bugs)
NON_RETRYABLE_STATUS_CODES = {
    400,  # Bad Request
    401,  # Unauthorized
    403,  # Forbidden
    404,  # Not Found
    422,  # Unprocessable Entity
}


def _is_retryable_status(status_code: int) -> bool:
    """Check if HTTP status code should trigger a retry."""
    return status_code in RETRYABLE_STATUS_CODES


def _parse_retry_after(response: httpx.Response) -> Optional[float]:
    """
    Parse Retry-After header from response.

    The header can be either:
    - An integer number of seconds (e.g., "120")
    - An HTTP-date (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")

    Returns seconds to wait, or None if header is missing/invalid.
    Caps at 60 seconds to prevent unreasonably long waits.
    """
    retry_after = response.headers.get("Retry-After")
    if not retry_after:
        return None

    try:
        # Try parsing as integer seconds first
        seconds = int(retry_after)
        # Cap at 60 seconds
        return min(seconds, 60.0)
    except ValueError:
        pass

    try:
        # Try parsing as HTTP-date
        retry_date = parsedate_to_datetime(retry_after)
        now = datetime.now(retry_date.tzinfo)
        delta = (retry_date - now).total_seconds()
        if delta > 0:
            # Cap at 60 seconds
            return min(delta, 60.0)
    except (ValueError, TypeError):
        pass

    return None


def _calculate_backoff_delay(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter_factor: float = 0.25,
) -> float:
    """
    Calculate exponential backoff delay with jitter.

    Args:
        attempt: Zero-based attempt number (0, 1, 2, ...)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap in seconds
        jitter_factor: Jitter as fraction of delay (0.25 = ±25%)

    Returns:
        Delay in seconds with jitter applied
    """
    # Exponential backoff: base_delay * 2^attempt
    delay = min(base_delay * (2 ** attempt), max_delay)

    # Add jitter: ±jitter_factor of the delay
    jitter_range = delay * jitter_factor
    jitter = random.uniform(-jitter_range, jitter_range)

    return max(0.0, delay + jitter)


def sanitize_external_user_id(user_id: str) -> str:
    """
    Create a valid external_user_id for Tink from our user ID.
    Tink requires alphanumeric IDs, so we hash the email.

    Version 2: Using full 32-char hash with 'hb2_' prefix to ensure uniqueness
    and avoid conflicts with previously created users.
    """
    hash_bytes = hashlib.sha256(user_id.encode()).hexdigest()[:32]
    return f"hb2_{hash_bytes}"


class TinkService:
    """Service class for Tink API interactions."""

    # Tink Link's official client ID for delegation
    # This is a public well-known ID used by Tink Link, not a secret
    # Reference: https://docs.tink.com/resources/tink-link-web
    TINK_LINK_CLIENT_ID = os.getenv("TINK_LINK_CLIENT_ID", "df05e4b379934cd09963197cc855bfe9")

    def __init__(self):
        self.client_id = os.getenv("TINK_CLIENT_ID", "")
        self.client_secret = os.getenv("TINK_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("TINK_REDIRECT_URI", "http://localhost:3000/banking/tink/callback")
        self.api_url = "https://api.tink.com"
        self.link_url = "https://link.tink.com"
        self._signing_key = os.getenv("NEXTAUTH_SECRET", self.client_secret).encode()
        # Auth expiration time (15 minutes)
        self._auth_expiration_minutes = 15

    # =========================================================================
    # Pending Auth Database Operations (replaces in-memory storage)
    # =========================================================================
    def store_pending_auth(
        self,
        db: Session,
        state_token: str,
        user_id: str,
        tink_user_id: Optional[str] = None,
        authorization_code: Optional[str] = None,
    ) -> TinkPendingAuth:
        """Store pending authorization in database."""
        # Clean up expired entries first
        self.cleanup_expired_auth(db)

        pending = TinkPendingAuth(
            state_token=state_token,
            user_id=user_id,
            tink_user_id=tink_user_id,
            authorization_code=authorization_code,
            expires_at=datetime.utcnow() + timedelta(minutes=self._auth_expiration_minutes),
        )
        db.add(pending)
        db.commit()
        db.refresh(pending)
        return pending

    def get_pending_auth(self, db: Session, state_token: str) -> Optional[TinkPendingAuth]:
        """Get pending authorization from database."""
        pending = db.query(TinkPendingAuth).filter(
            TinkPendingAuth.state_token == state_token,
            TinkPendingAuth.used == False,
            TinkPendingAuth.expires_at > datetime.utcnow(),
        ).first()
        return pending

    def mark_auth_used(self, db: Session, state_token: str) -> None:
        """Mark pending authorization as used."""
        db.query(TinkPendingAuth).filter(
            TinkPendingAuth.state_token == state_token
        ).update({"used": True})
        db.commit()

    def cleanup_expired_auth(self, db: Session) -> int:
        """Clean up expired pending authorizations."""
        deleted = db.query(TinkPendingAuth).filter(
            TinkPendingAuth.expires_at < datetime.utcnow()
        ).delete()
        db.commit()
        return deleted

    def _check_credentials(self):
        """Check if Tink credentials are configured."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Tink API credentials not configured. "
                "Please set TINK_CLIENT_ID and TINK_CLIENT_SECRET in .env file."
            )

    # =========================================================================
    # Retry Logic for Tink API Requests
    # =========================================================================
    async def _request_with_retry(
        self,
        method: str,
        url: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
        json_data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 30.0,
        user_id: Optional[str] = None,
        connection_id: Optional[int] = None,
    ) -> httpx.Response:
        """
        Make an HTTP request to Tink API with retry logic and exponential backoff.

        Args:
            method: HTTP method ("GET" or "POST")
            url: Full URL to request
            headers: Optional request headers
            data: Optional form data (for application/x-www-form-urlencoded)
            json_data: Optional JSON data (for application/json)
            params: Optional query parameters
            max_retries: Maximum number of retry attempts (default: 3)
            base_delay: Base delay in seconds for exponential backoff (default: 1.0)
            max_delay: Maximum delay cap in seconds (default: 30.0)
            user_id: Optional user ID for metrics tracking
            connection_id: Optional connection ID for metrics tracking

        Returns:
            httpx.Response on success

        Raises:
            TinkAPIRetryExhausted: When all retry attempts are exhausted
            TinkAPIError: For non-retryable errors (4xx client errors)
            httpx.TimeoutException: Re-raised after retry exhaustion
            httpx.ConnectError: Re-raised after retry exhaustion
        """
        last_response: Optional[httpx.Response] = None
        last_exception: Optional[Exception] = None
        endpoint = url.replace(self.api_url, "")  # Log relative path for clarity
        start_time = time.time()
        total_retry_count = 0

        for attempt in range(max_retries):
            attempt_start = time.time()
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    if method.upper() == "GET":
                        response = await client.get(
                            url,
                            headers=headers,
                            params=params,
                        )
                    elif method.upper() == "POST":
                        response = await client.post(
                            url,
                            headers=headers,
                            data=data,
                            json=json_data,
                            params=params,
                        )
                    else:
                        raise ValueError(f"Unsupported HTTP method: {method}")

                # Check if response indicates success
                if response.status_code < 400:
                    duration_ms = (time.time() - start_time) * 1000
                    # Record successful metric
                    try:
                        metrics = _get_metrics_service()
                        metrics.record_api_call(
                            endpoint=endpoint,
                            method=method.upper(),
                            status_code=response.status_code,
                            duration_ms=duration_ms,
                            success=True,
                            retry_count=total_retry_count,
                            user_id=user_id,
                            connection_id=connection_id,
                        )
                    except Exception:
                        pass  # Never fail due to metrics

                    if attempt > 0:
                        logger.info(
                            f"Tink API request succeeded on attempt {attempt + 1} "
                            f"for {method} {endpoint}"
                        )
                    return response

                last_response = response
                total_retry_count = attempt

                # Check if this is a retryable status code
                if not _is_retryable_status(response.status_code):
                    # Non-retryable error (4xx client error) - fail immediately
                    duration_ms = (time.time() - start_time) * 1000
                    # Record failed metric
                    try:
                        metrics = _get_metrics_service()
                        metrics.record_api_call(
                            endpoint=endpoint,
                            method=method.upper(),
                            status_code=response.status_code,
                            duration_ms=duration_ms,
                            success=False,
                            retry_count=total_retry_count,
                            user_id=user_id,
                            connection_id=connection_id,
                        )
                    except Exception:
                        pass  # Never fail due to metrics

                    raise TinkAPIError(
                        message=f"Tink API error: {response.text}",
                        status_code=response.status_code,
                        endpoint=endpoint,
                        response_body=response.text,
                    )

                # Retryable status code - determine wait time
                if response.status_code == 429:
                    # Rate limited - check Retry-After header
                    retry_after = _parse_retry_after(response)
                    if retry_after is not None:
                        wait_time = retry_after
                        logger.warning(
                            f"Tink API rate limited (429) for {method} {endpoint}, "
                            f"Retry-After header indicates {wait_time:.1f}s wait "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                    else:
                        wait_time = _calculate_backoff_delay(attempt, base_delay, max_delay)
                        logger.warning(
                            f"Tink API rate limited (429) for {method} {endpoint}, "
                            f"using exponential backoff {wait_time:.1f}s "
                            f"(attempt {attempt + 1}/{max_retries})"
                        )
                else:
                    # Other retryable status (5xx)
                    wait_time = _calculate_backoff_delay(attempt, base_delay, max_delay)
                    logger.warning(
                        f"Tink API retry attempt {attempt + 1}/{max_retries} "
                        f"for {method} {endpoint} (status {response.status_code}), "
                        f"waiting {wait_time:.1f}s"
                    )

                # Don't wait on the last attempt
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait_time)

            except httpx.TimeoutException as e:
                last_exception = e
                total_retry_count = attempt
                wait_time = _calculate_backoff_delay(attempt, base_delay, max_delay)
                logger.warning(
                    f"Tink API timeout for {method} {endpoint} "
                    f"(attempt {attempt + 1}/{max_retries}), waiting {wait_time:.1f}s"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait_time)

            except httpx.ConnectError as e:
                last_exception = e
                total_retry_count = attempt
                wait_time = _calculate_backoff_delay(attempt, base_delay, max_delay)
                logger.warning(
                    f"Tink API connection error for {method} {endpoint}: {e} "
                    f"(attempt {attempt + 1}/{max_retries}), waiting {wait_time:.1f}s"
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait_time)

        # All retries exhausted - record failed metric
        duration_ms = (time.time() - start_time) * 1000
        try:
            metrics = _get_metrics_service()
            metrics.record_api_call(
                endpoint=endpoint,
                method=method.upper(),
                status_code=last_response.status_code if last_response else None,
                duration_ms=duration_ms,
                success=False,
                retry_count=max_retries,
                user_id=user_id,
                connection_id=connection_id,
                exception=last_exception,
            )
        except Exception:
            pass  # Never fail due to metrics

        if last_response is not None:
            logger.error(
                f"Tink API request failed after {max_retries} attempts "
                f"for {method} {endpoint} (last status: {last_response.status_code})"
            )
            raise TinkAPIRetryExhausted(
                message=f"Tink API request failed after {max_retries} attempts: {last_response.text}",
                status_code=last_response.status_code,
                endpoint=endpoint,
                response_body=last_response.text,
                attempts=max_retries,
            )
        elif last_exception is not None:
            logger.error(
                f"Tink API request failed after {max_retries} attempts "
                f"for {method} {endpoint} due to {type(last_exception).__name__}: {last_exception}"
            )
            raise TinkAPIRetryExhausted(
                message=f"Tink API request failed after {max_retries} attempts: {last_exception}",
                status_code=None,
                endpoint=endpoint,
                response_body=None,
                attempts=max_retries,
            )
        else:
            # Should not happen, but handle gracefully
            raise TinkAPIRetryExhausted(
                message=f"Tink API request failed after {max_retries} attempts (unknown error)",
                endpoint=endpoint,
                attempts=max_retries,
            )

    def generate_state_token(self, user_id: str) -> str:
        """Generate a signed state token containing user_id and timestamp."""
        payload = {
            "user_id": user_id,
            "exp": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "nonce": secrets.token_hex(8)
        }
        payload_json = json.dumps(payload, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()

        signature = hmac.new(
            self._signing_key,
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()

        return f"{payload_b64}.{signature}"

    def verify_state_token(self, state: str) -> Optional[str]:
        """Verify signed state token and return user_id if valid."""
        try:
            parts = state.split('.')
            if len(parts) != 2:
                logger.warning("Invalid state token format")
                return None

            payload_b64, signature = parts

            expected_signature = hmac.new(
                self._signing_key,
                payload_b64.encode(),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                logger.warning("Invalid state token signature")
                return None

            payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
            payload = json.loads(payload_json)

            exp = datetime.fromisoformat(payload["exp"])
            if datetime.utcnow() > exp:
                logger.warning("State token expired")
                return None

            return payload["user_id"]

        except Exception as e:
            logger.error(f"Error verifying state token: {e}")
            return None

    # =========================================================================
    # Step 1: Get Client Access Token
    # =========================================================================
    async def get_client_access_token(self, scope: str = "user:create,authorization:grant") -> str:
        """Get a client access token using client_credentials grant."""
        self._check_credentials()

        response = await self._request_with_retry(
            method="POST",
            url=f"{self.api_url}/api/v1/oauth/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials",
                "scope": scope,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            logger.error(f"Failed to get client token: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to get client access token: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/oauth/token",
                response_body=response.text,
            )

        data = response.json()
        logger.info("Successfully obtained client access token")
        return data["access_token"]

    # =========================================================================
    # Step 2: Create Tink User
    # =========================================================================
    async def create_tink_user(
        self,
        client_token: str,
        external_user_id: str,
        market: str = "PL"
    ) -> Dict[str, str]:
        """
        Create a permanent Tink user.

        Returns dict with user_id and external_user_id.
        If user already exists (409), that's OK - handled as non-retryable.
        """
        try:
            response = await self._request_with_retry(
                method="POST",
                url=f"{self.api_url}/api/v1/user/create",
                json_data={
                    "external_user_id": external_user_id,
                    "market": market,
                    "locale": "en_US",
                },
                headers={
                    "Authorization": f"Bearer {client_token}",
                    "Content-Type": "application/json",
                },
            )
        except TinkAPIError as e:
            # 409 Conflict means user already exists - this is OK
            if e.status_code == 409:
                logger.info(f"Tink user already exists for external_user_id: {external_user_id}")
                return {"external_user_id": external_user_id, "user_id": None}
            raise

        if response.status_code == 200:
            data = response.json()
            logger.info(f"Created Tink user: {data}")
            return data
        elif response.status_code == 409:
            # User already exists - this is fine
            logger.info(f"Tink user already exists for external_user_id: {external_user_id}")
            return {"external_user_id": external_user_id, "user_id": None}
        else:
            logger.error(f"Failed to create Tink user: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to create Tink user: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/user/create",
                response_body=response.text,
            )

    # =========================================================================
    # Step 3: Generate Delegated Authorization Code
    # =========================================================================
    async def generate_delegated_auth_code(
        self,
        client_token: str,
        tink_user_id: Optional[str] = None,
        external_user_id: Optional[str] = None,
        id_hint: str = "User",
        scope: str = "authorization:read,authorization:grant,credentials:refresh,credentials:read,credentials:write,providers:read,user:read"
    ) -> str:
        """
        Generate a delegated authorization code for Tink Link to use.

        Uses Tink's internal user_id if available, otherwise falls back to external_user_id.
        The actor_client_id is Tink Link's client ID.

        Required scopes for Tink Link:
        - credentials:write - to create bank credentials
        - credentials:read - to read credentials status
        - credentials:refresh - to refresh credentials
        - providers:read - to list available banks
        - user:read - to read user info
        - authorization:read - to read authorization status
        """
        # Prepare user identification - prefer tink_user_id
        request_data = {
            "actor_client_id": self.TINK_LINK_CLIENT_ID,
            "scope": scope,
            "id_hint": id_hint,  # Required for Tink Link
        }

        if tink_user_id:
            request_data["user_id"] = tink_user_id
            user_identifier = f"tink_user_id: {tink_user_id}"
        elif external_user_id:
            request_data["external_user_id"] = external_user_id
            user_identifier = f"external_user_id: {external_user_id}"
        else:
            raise ValueError("Either tink_user_id or external_user_id must be provided")

        response = await self._request_with_retry(
            method="POST",
            url=f"{self.api_url}/api/v1/oauth/authorization-grant/delegate",
            data=request_data,
            headers={
                "Authorization": f"Bearer {client_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

        if response.status_code != 200:
            logger.error(f"Failed to generate delegated auth code: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to generate authorization code: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/oauth/authorization-grant/delegate",
                response_body=response.text,
            )

        result = response.json()
        logger.info(f"Generated delegated auth code for {user_identifier}")
        return result["code"]

    async def generate_user_auth_code(
        self,
        client_token: str,
        external_user_id: str,
        scope: str = "accounts:read,balances:read,transactions:read,provider-consents:read"
    ) -> str:
        """
        Generate an authorization code for US to exchange for user tokens.

        This is different from delegated auth code - this code is for OUR use,
        not for Tink Link. Use this AFTER Tink Link flow completes.

        Endpoint: /api/v1/oauth/authorization-grant (NOT /delegate)
        """
        response = await self._request_with_retry(
            method="POST",
            url=f"{self.api_url}/api/v1/oauth/authorization-grant",
            data={
                "external_user_id": external_user_id,
                "scope": scope,
            },
            headers={
                "Authorization": f"Bearer {client_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )

        if response.status_code != 200:
            logger.error(f"Failed to generate user auth code: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to generate user authorization code: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/oauth/authorization-grant",
                response_body=response.text,
            )

        result = response.json()
        logger.info(f"Generated user auth code for {external_user_id}")
        return result["code"]

    # =========================================================================
    # Simple One-Time Access Flow (recommended for testing)
    # =========================================================================
    async def generate_simple_connect_url(
        self,
        user_id: str,
        db: Session,
        locale: str = "pl_PL"
    ) -> tuple[str, str]:
        """
        Generate a simple Tink Link URL for one-time access.

        This is the simpler flow that doesn't require permanent users or delegated auth.
        Tink Link will return a code in the callback that we can exchange for tokens.
        """
        self._check_credentials()

        # Generate state token for CSRF protection
        state = self.generate_state_token(user_id)

        # Store user info for callback in database
        external_user_id = sanitize_external_user_id(user_id)
        self.store_pending_auth(
            db=db,
            state_token=state,
            user_id=user_id,
            tink_user_id=external_user_id,  # Store external_user_id here
        )

        # Build simple Tink Link URL - no authorization_code needed!
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "market": "PL",
            "locale": locale,
            "state": state,
        }

        url = f"{self.link_url}/1.0/transactions/connect-accounts?{urlencode(params)}"

        logger.info(f"Generated simple Tink Link URL for user {user_id}")
        return url, state

    # =========================================================================
    # Permanent Users Flow (complex, requires proper Tink Console setup)
    # =========================================================================
    async def generate_connect_url(
        self,
        user_id: str,
        db: Session,
        locale: str = "en_US"
    ) -> tuple[str, str]:
        """
        Generate Tink Link URL for user to connect their bank.

        Flow:
        1. Get client access token
        2. Create Tink user (if not exists)
        3. Generate delegated authorization code
        4. Build Tink Link URL
        5. Store auth code for later exchange

        Returns:
            tuple: (tink_link_url, state_token)
        """
        self._check_credentials()

        # Create sanitized external_user_id
        external_user_id = sanitize_external_user_id(user_id)
        logger.info(f"Starting Tink Link flow for user {user_id} (external: {external_user_id})")

        # Step 1: Get client access token
        client_token = await self.get_client_access_token()

        # Step 2: Create Tink user (if not exists)
        user_data = await self.create_tink_user(client_token, external_user_id, market="PL")
        tink_user_id = user_data.get("user_id")  # May be None if user already exists (409)

        # Step 3: Generate delegated authorization code
        # Use tink_user_id if available (new user), otherwise external_user_id (existing user)
        # id_hint is shown to user for verification - use sanitized email
        id_hint = user_id.split("@")[0] if "@" in user_id else user_id[:20]
        auth_code = await self.generate_delegated_auth_code(
            client_token,
            tink_user_id=tink_user_id,
            external_user_id=external_user_id,
            id_hint=id_hint,
        )

        # Generate state token for CSRF protection
        state = self.generate_state_token(user_id)

        # Store auth data for later exchange in database
        self.store_pending_auth(
            db=db,
            state_token=state,
            user_id=user_id,
            tink_user_id=external_user_id,
            authorization_code=auth_code,
        )

        # Step 4: Build Tink Link URL
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "authorization_code": auth_code,
            "market": "PL",
            "locale": locale,
            "state": state,
        }

        url = f"{self.link_url}/1.0/transactions/connect-accounts?{urlencode(params)}"

        logger.info(f"Generated Tink Link URL for user {user_id}")
        return url, state

    # =========================================================================
    # Step 5-6: Exchange Auth Code for User Token (after callback)
    # =========================================================================
    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for user access and refresh tokens.

        IMPORTANT: Use the code WE generated (from generate_delegated_auth_code),
        NOT any code from the callback!
        """
        self._check_credentials()

        logger.info("Exchanging authorization code for user tokens...")

        response = await self._request_with_retry(
            method="POST",
            url=f"{self.api_url}/api/v1/oauth/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code": code,
                "grant_type": "authorization_code",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        logger.info(f"Token exchange response status: {response.status_code}")

        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to exchange code for tokens: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/oauth/token",
                response_body=response.text,
            )

        return response.json()

    # =========================================================================
    # Step 7: Fetch Data with User Token
    # =========================================================================
    async def fetch_accounts(self, access_token: str) -> List[Dict[str, Any]]:
        """Fetch user's connected accounts from Tink."""
        response = await self._request_with_retry(
            method="GET",
            url=f"{self.api_url}/data/v2/accounts",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch accounts: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to fetch accounts: {response.text}",
                status_code=response.status_code,
                endpoint="/data/v2/accounts",
                response_body=response.text,
            )

        data = response.json()
        return data.get("accounts", [])

    async def fetch_providers(self, market: str = "PL") -> List[Dict[str, Any]]:
        """
        Fetch available bank providers for a market with their logos.

        Returns list of providers with:
        - displayName: Bank display name
        - financialInstitutionId: UUID for the bank
        - images: { icon: "https://cdn.tink.se/...", banner: null }
        """
        # Get client access token (no user token needed for providers)
        client_token = await self.get_client_access_token(scope="providers:read")

        response = await self._request_with_retry(
            method="GET",
            url=f"{self.api_url}/api/v1/providers/{market}",
            headers={"Authorization": f"Bearer {client_token}"},
        )

        if response.status_code != 200:
            logger.error(f"Failed to fetch providers: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to fetch providers: {response.text}",
                status_code=response.status_code,
                endpoint=f"/api/v1/providers/{market}",
                response_body=response.text,
            )

        data = response.json()
        return data.get("providers", [])

    async def fetch_transactions(
        self,
        access_token: str,
        account_id: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        page_token: Optional[str] = None,
        use_enrichment: bool = True,
    ) -> Dict[str, Any]:
        """
        Fetch transactions from Tink.

        Args:
            use_enrichment: If True, uses /enrichment/v1/transactions endpoint
                           which includes MCC codes, merchant info, and PFM categories.
                           If False, uses basic /data/v2/transactions endpoint.
        """
        params = {"pageSize": 100}

        if account_id:
            params["accountIdIn"] = account_id
        if from_date:
            params["bookedDateGte"] = from_date.strftime("%Y-%m-%d")
        if to_date:
            params["bookedDateLte"] = to_date.strftime("%Y-%m-%d")
        if page_token:
            params["pageToken"] = page_token

        # Choose endpoint based on enrichment flag
        if use_enrichment:
            endpoint = f"{self.api_url}/enrichment/v1/transactions"
            endpoint_path = "/enrichment/v1/transactions"
        else:
            endpoint = f"{self.api_url}/data/v2/transactions"
            endpoint_path = "/data/v2/transactions"

        try:
            response = await self._request_with_retry(
                method="GET",
                url=endpoint,
                params=params,
                headers={"Authorization": f"Bearer {access_token}"},
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch transactions from {endpoint}: {response.status_code} - {response.text}")
                # Fallback to basic endpoint if enrichment fails with non-retryable error
                if use_enrichment:
                    logger.info("Falling back to basic transactions endpoint")
                    return await self.fetch_transactions(
                        access_token, account_id, from_date, to_date, page_token,
                        use_enrichment=False
                    )
                raise TinkAPIError(
                    message=f"Failed to fetch transactions: {response.text}",
                    status_code=response.status_code,
                    endpoint=endpoint_path,
                    response_body=response.text,
                )

            return response.json()

        except (TinkAPIError, TinkAPIRetryExhausted) as e:
            # Fallback to basic endpoint if enrichment fails after retries
            if use_enrichment and not isinstance(e, TinkAPIRetryExhausted):
                # For retryable errors that exhausted retries, also try fallback
                pass
            if use_enrichment:
                logger.info(f"Enrichment endpoint failed ({e}), falling back to basic transactions endpoint")
                return await self.fetch_transactions(
                    access_token, account_id, from_date, to_date, page_token,
                    use_enrichment=False
                )
            raise

    # =========================================================================
    # Connection Management
    # =========================================================================
    async def create_connection_from_callback(
        self,
        db: Session,
        user_id: str,
        state: str,
        code: Optional[str] = None,
        credentials_id: Optional[str] = None,
    ) -> TinkConnection:
        """
        Create a new Tink connection after successful Tink Link callback.

        Supports two flows:
        1. One-time flow: code comes from callback, exchange directly
        2. Permanent users flow: generate new code using authorization-grant
        """
        # Get stored auth data from database
        pending = self.get_pending_auth(db, state)
        if not pending:
            raise Exception("Authorization data not found. Please try connecting again.")

        external_user_id = pending.tink_user_id  # We stored external_user_id in tink_user_id field
        has_auth_code = bool(pending.authorization_code)

        logger.info(f"Creating connection for user {user_id}, external: {external_user_id}, has_auth_code: {has_auth_code}")

        if not has_auth_code and code:
            # One-time flow: use code from callback directly
            logger.info("Using one-time flow with code from callback")
            auth_code = code
        elif has_auth_code:
            # Permanent users flow: generate new code using the stored external_user_id
            logger.info("Using permanent users flow, generating new auth code")
            client_token = await self.get_client_access_token()
            auth_code = await self.generate_user_auth_code(
                client_token,
                external_user_id,
                scope="accounts:read,balances:read,transactions:read"
            )
        else:
            raise Exception("No authorization code available. Please try connecting again.")

        # Exchange auth code for user tokens
        token_data = await self.exchange_code_for_tokens(auth_code)

        access_token = token_data["access_token"]
        # Note: Tink may not return refresh_token for all grant types
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 7200)

        # Mark the pending auth as used
        self.mark_auth_used(db, state)

        # Fetch accounts using user token
        accounts = await self.fetch_accounts(access_token)

        # Extract account details
        account_ids = [acc["id"] for acc in accounts]
        account_details = {
            acc["id"]: {
                "name": acc.get("name", "Unknown Account"),
                "iban": acc.get("identifiers", {}).get("iban", {}).get("iban"),
                "currency": acc.get("balances", {}).get("booked", {}).get("amount", {}).get("currencyCode", "PLN"),
                "type": acc.get("type"),
            }
            for acc in accounts
        }

        # Check for existing connection (active OR inactive) by tink_user_id or user_id
        # This handles reconnection after disconnect
        existing = db.query(TinkConnection).filter(
            (TinkConnection.tink_user_id == external_user_id) |
            (TinkConnection.user_id == user_id)
        ).first()

        if existing:
            # Update existing connection (reactivate if disconnected)
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.accounts = account_ids
            existing.account_details = account_details
            existing.is_active = True
            existing.tink_user_id = external_user_id
            existing.scopes = token_data.get("scope", "")
            if credentials_id:
                existing.credentials_id = credentials_id
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated existing Tink connection {existing.id}")
            return existing

        # Create new connection (first time only)
        connection = TinkConnection(
            user_id=user_id,
            tink_user_id=external_user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            accounts=account_ids,
            account_details=account_details,
            scopes=token_data.get("scope", ""),
            is_active=True,
        )
        if credentials_id:
            connection.credentials_id = credentials_id

        db.add(connection)
        db.commit()
        db.refresh(connection)

        logger.info(f"Created new Tink connection {connection.id}")
        return connection

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh an expired access token."""
        self._check_credentials()

        response = await self._request_with_retry(
            method="POST",
            url=f"{self.api_url}/api/v1/oauth/token",
            data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code != 200:
            logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
            raise TinkAPIError(
                message=f"Failed to refresh token: {response.text}",
                status_code=response.status_code,
                endpoint="/api/v1/oauth/token",
                response_body=response.text,
            )

        return response.json()

    async def get_valid_access_token(self, connection: TinkConnection, db: Session) -> str:
        """Get a valid access token, refreshing if necessary."""
        # Handle both timezone-aware and naive datetimes
        now = datetime.utcnow()
        token_expires = connection.token_expires_at
        if token_expires.tzinfo is not None:
            token_expires = token_expires.replace(tzinfo=None)
        # Use 5-minute buffer to account for potential clock skew
        if token_expires > now + timedelta(minutes=5):
            return connection.access_token

        if not connection.refresh_token:
            raise Exception("Token expired and no refresh token available")

        logger.info(f"Refreshing expired token for connection {connection.id}")

        start_time = time.time()
        try:
            token_data = await self.refresh_access_token(connection.refresh_token)

            connection.access_token = token_data["access_token"]
            connection.refresh_token = token_data.get("refresh_token", connection.refresh_token)
            connection.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

            db.commit()

            # Record successful token refresh in metrics
            duration_ms = (time.time() - start_time) * 1000
            try:
                metrics = _get_metrics_service()
                metrics.record_token_refresh(
                    user_id=connection.user_id,
                    connection_id=connection.id,
                    success=True,
                    duration_ms=duration_ms,
                )
            except Exception:
                pass  # Never fail due to metrics

            # Audit: Token refresh succeeded
            audit_token_refreshed(db, connection.user_id, connection.id, "success")

            return connection.access_token

        except Exception as e:
            # Record failed token refresh in metrics
            duration_ms = (time.time() - start_time) * 1000
            try:
                metrics = _get_metrics_service()
                metrics.record_token_refresh(
                    user_id=connection.user_id,
                    connection_id=connection.id,
                    success=False,
                    duration_ms=duration_ms,
                )
            except Exception:
                pass  # Never fail due to metrics

            # Audit: Token refresh failed
            audit_token_refreshed(db, connection.user_id, connection.id, "failure")
            raise


# Singleton instance
tink_service = TinkService()
