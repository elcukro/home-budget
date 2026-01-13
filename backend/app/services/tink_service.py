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
import logging
import hmac
import hashlib
import base64
import json
from datetime import datetime, timedelta
from urllib.parse import urlencode
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models import TinkConnection, BankTransaction

logger = logging.getLogger(__name__)


def sanitize_external_user_id(user_id: str) -> str:
    """
    Create a valid external_user_id for Tink from our user ID.
    Tink requires alphanumeric IDs, so we hash the email.
    """
    hash_bytes = hashlib.sha256(user_id.encode()).hexdigest()[:24]
    return f"u{hash_bytes}"


class TinkService:
    """Service class for Tink API interactions."""

    # Tink Link's official client ID for delegation
    TINK_LINK_CLIENT_ID = "df05e4b379934cd09963197cc855bfe9"

    def __init__(self):
        self.client_id = os.getenv("TINK_CLIENT_ID", "")
        self.client_secret = os.getenv("TINK_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("TINK_REDIRECT_URI", "http://localhost:3000/banking/tink/callback")
        self.api_url = "https://api.tink.com"
        self.link_url = "https://link.tink.com"
        self._signing_key = os.getenv("NEXTAUTH_SECRET", self.client_secret).encode()
        # Store pending authorization codes - maps state -> auth data
        # TODO: In production, use Redis or database instead of memory
        self._pending_auth: Dict[str, Dict[str, Any]] = {}

    def _check_credentials(self):
        """Check if Tink credentials are configured."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Tink API credentials not configured. "
                "Please set TINK_CLIENT_ID and TINK_CLIENT_SECRET in .env file."
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

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/oauth/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                    "scope": scope,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.error(f"Failed to get client token: {response.status_code} - {response.text}")
                raise Exception(f"Failed to get client access token: {response.text}")

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
        If user already exists (409), that's OK.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/user/create",
                json={
                    "external_user_id": external_user_id,
                    "market": market,
                    "locale": "en_US",
                },
                headers={
                    "Authorization": f"Bearer {client_token}",
                    "Content-Type": "application/json",
                }
            )

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
                raise Exception(f"Failed to create Tink user: {response.text}")

    # =========================================================================
    # Step 3: Generate Delegated Authorization Code
    # =========================================================================
    async def generate_delegated_auth_code(
        self,
        client_token: str,
        external_user_id: str,
        scope: str = "accounts:read,transactions:read,credentials:write,credentials:read"
    ) -> str:
        """
        Generate a delegated authorization code for Tink Link to use.

        The actor_client_id is Tink Link's client ID.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/oauth/authorization-grant/delegate",
                data={
                    "external_user_id": external_user_id,
                    "actor_client_id": self.TINK_LINK_CLIENT_ID,
                    "scope": scope,
                },
                headers={
                    "Authorization": f"Bearer {client_token}",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )

            if response.status_code != 200:
                logger.error(f"Failed to generate delegated auth code: {response.status_code} - {response.text}")
                raise Exception(f"Failed to generate authorization code: {response.text}")

            data = response.json()
            logger.info(f"Generated delegated auth code for {external_user_id}")
            return data["code"]

    # =========================================================================
    # Main Entry Point: Generate Connect URL
    # =========================================================================
    async def generate_connect_url(self, user_id: str, locale: str = "en_US") -> tuple[str, str]:
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

        # Step 3: Generate delegated authorization code
        auth_code = await self.generate_delegated_auth_code(
            client_token,
            external_user_id,
            scope="accounts:read,transactions:read,credentials:write,credentials:read"
        )

        # Generate state token for CSRF protection
        state = self.generate_state_token(user_id)

        # Store auth data for later exchange (IMPORTANT!)
        self._pending_auth[state] = {
            "auth_code": auth_code,
            "user_id": user_id,
            "external_user_id": external_user_id,
            "tink_user_id": user_data.get("user_id"),
            "created_at": datetime.utcnow().isoformat(),
        }

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

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/oauth/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            logger.info(f"Token exchange response status: {response.status_code}")

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to exchange code for tokens: {response.text}")

            return response.json()

    # =========================================================================
    # Step 7: Fetch Data with User Token
    # =========================================================================
    async def fetch_accounts(self, access_token: str) -> List[Dict[str, Any]]:
        """Fetch user's connected accounts from Tink."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/data/v2/accounts",
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch accounts: {response.status_code} - {response.text}")
                raise Exception(f"Failed to fetch accounts: {response.text}")

            data = response.json()
            return data.get("accounts", [])

    async def fetch_transactions(
        self,
        access_token: str,
        account_id: Optional[str] = None,
        from_date: Optional[datetime] = None,
        to_date: Optional[datetime] = None,
        page_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch transactions from Tink."""
        params = {"pageSize": 100}

        if account_id:
            params["accountIdIn"] = account_id
        if from_date:
            params["bookedDateGte"] = from_date.strftime("%Y-%m-%d")
        if to_date:
            params["bookedDateLte"] = to_date.strftime("%Y-%m-%d")
        if page_token:
            params["pageToken"] = page_token

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/data/v2/transactions",
                params=params,
                headers={"Authorization": f"Bearer {access_token}"}
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch transactions: {response.status_code} - {response.text}")
                raise Exception(f"Failed to fetch transactions: {response.text}")

            return response.json()

    # =========================================================================
    # Connection Management
    # =========================================================================
    async def create_connection_from_callback(
        self,
        db: Session,
        user_id: str,
        state: str,
        credentials_id: Optional[str] = None,
    ) -> TinkConnection:
        """
        Create a new Tink connection after successful Tink Link callback.

        Uses the stored authorization code (NOT from callback) to get user tokens.
        """
        # Get stored auth data
        pending = self._pending_auth.get(state)
        if not pending:
            raise Exception("Authorization data not found. Please try connecting again.")

        auth_code = pending["auth_code"]
        external_user_id = pending["external_user_id"]

        logger.info(f"Creating connection for user {user_id}, external: {external_user_id}")

        # Exchange OUR auth code for user tokens
        token_data = await self.exchange_code_for_tokens(auth_code)

        access_token = token_data["access_token"]
        # Note: Tink may not return refresh_token for all grant types
        refresh_token = token_data.get("refresh_token", "")
        expires_in = token_data.get("expires_in", 7200)

        # Clear the pending auth
        del self._pending_auth[state]

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

        # Check for existing connection
        existing = db.query(TinkConnection).filter(
            TinkConnection.user_id == user_id,
            TinkConnection.is_active == True
        ).first()

        if existing:
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.accounts = account_ids
            existing.account_details = account_details
            existing.is_active = True
            existing.tink_user_id = external_user_id
            if credentials_id:
                existing.credentials_id = credentials_id
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated existing Tink connection {existing.id}")
            return existing

        # Create new connection
        connection = TinkConnection(
            user_id=user_id,
            tink_user_id=external_user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            accounts=account_ids,
            account_details=account_details,
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

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/oauth/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to refresh token: {response.text}")

            return response.json()

    async def get_valid_access_token(self, connection: TinkConnection, db: Session) -> str:
        """Get a valid access token, refreshing if necessary."""
        if connection.token_expires_at > datetime.utcnow() + timedelta(minutes=5):
            return connection.access_token

        if not connection.refresh_token:
            raise Exception("Token expired and no refresh token available")

        logger.info(f"Refreshing expired token for connection {connection.id}")
        token_data = await self.refresh_access_token(connection.refresh_token)

        connection.access_token = token_data["access_token"]
        connection.refresh_token = token_data.get("refresh_token", connection.refresh_token)
        connection.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

        db.commit()

        return connection.access_token


# Singleton instance
tink_service = TinkService()
