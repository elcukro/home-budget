"""
Tink API Service

Handles OAuth flow and API interactions with Tink.
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


class TinkService:
    """Service class for Tink API interactions."""

    def __init__(self):
        self.client_id = os.getenv("TINK_CLIENT_ID", "")
        self.client_secret = os.getenv("TINK_CLIENT_SECRET", "")
        self.redirect_uri = os.getenv("TINK_REDIRECT_URI", "http://localhost:3000/banking/tink/callback")
        self.api_url = "https://api.tink.com"
        self.link_url = "https://link.tink.com"
        # Use client_secret as signing key for state tokens
        self._signing_key = os.getenv("NEXTAUTH_SECRET", self.client_secret).encode()

    def _check_credentials(self):
        """Check if Tink credentials are configured."""
        if not self.client_id or not self.client_secret:
            raise ValueError(
                "Tink API credentials not configured. "
                "Please set TINK_CLIENT_ID and TINK_CLIENT_SECRET in .env file."
            )

    def generate_state_token(self, user_id: str) -> str:
        """Generate a signed state token containing user_id and timestamp."""
        # Create payload with user_id and expiration (1 hour)
        payload = {
            "user_id": user_id,
            "exp": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
            "nonce": secrets.token_hex(8)
        }
        payload_json = json.dumps(payload, separators=(',', ':'))
        payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()

        # Create signature
        signature = hmac.new(
            self._signing_key,
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()

        # Combine payload and signature
        state = f"{payload_b64}.{signature}"
        return state

    def verify_state_token(self, state: str) -> Optional[str]:
        """Verify signed state token and return user_id if valid."""
        try:
            # Split payload and signature
            parts = state.split('.')
            if len(parts) != 2:
                logger.warning("Invalid state token format")
                return None

            payload_b64, signature = parts

            # Verify signature
            expected_signature = hmac.new(
                self._signing_key,
                payload_b64.encode(),
                hashlib.sha256
            ).hexdigest()

            if not hmac.compare_digest(signature, expected_signature):
                logger.warning("Invalid state token signature")
                return None

            # Decode payload
            payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
            payload = json.loads(payload_json)

            # Check expiration
            exp = datetime.fromisoformat(payload["exp"])
            if datetime.utcnow() > exp:
                logger.warning("State token expired")
                return None

            return payload["user_id"]

        except Exception as e:
            logger.error(f"Error verifying state token: {e}")
            return None

    def generate_connect_url(self, user_id: str, locale: str = "en_US") -> tuple[str, str]:
        """
        Generate Tink Link URL for user to connect their bank.

        Returns:
            tuple: (tink_link_url, state_token)
        """
        self._check_credentials()

        state = self.generate_state_token(user_id)

        # Tink Link parameters
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": "accounts:read,transactions:read,credentials:read",
            "market": "PL",  # Poland
            "locale": locale,
            "state": state,
            "response_type": "code",
        }

        url = f"{self.link_url}/1.0/transactions/connect-accounts?{urlencode(params)}"

        logger.info(f"Generated Tink Link URL for user {user_id}")
        return url, state

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access and refresh tokens.

        Args:
            code: Authorization code from Tink callback

        Returns:
            Dict with access_token, refresh_token, expires_in, etc.
        """
        self._check_credentials()

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/api/v1/oauth/token",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to exchange code for tokens: {response.text}")

            return response.json()

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """
        Refresh an expired access token.

        Args:
            refresh_token: The refresh token

        Returns:
            Dict with new access_token, refresh_token, expires_in, etc.
        """
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
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                }
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise Exception(f"Failed to refresh token: {response.text}")

            return response.json()

    async def get_valid_access_token(self, connection: TinkConnection, db: Session) -> str:
        """
        Get a valid access token, refreshing if necessary.

        Args:
            connection: TinkConnection object
            db: Database session

        Returns:
            Valid access token string
        """
        # Check if token is still valid (with 5 minute buffer)
        if connection.token_expires_at > datetime.utcnow() + timedelta(minutes=5):
            return connection.access_token

        # Token expired, refresh it
        logger.info(f"Refreshing expired token for connection {connection.id}")
        token_data = await self.refresh_access_token(connection.refresh_token)

        # Update connection with new tokens
        connection.access_token = token_data["access_token"]
        connection.refresh_token = token_data.get("refresh_token", connection.refresh_token)
        connection.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data["expires_in"])

        db.commit()

        return connection.access_token

    async def fetch_accounts(self, access_token: str) -> List[Dict[str, Any]]:
        """
        Fetch user's connected accounts from Tink.

        Args:
            access_token: Valid access token

        Returns:
            List of account dictionaries
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/data/v2/accounts",
                headers={
                    "Authorization": f"Bearer {access_token}",
                }
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
        """
        Fetch transactions from Tink.

        Args:
            access_token: Valid access token
            account_id: Optional account ID to filter by
            from_date: Start date for transactions
            to_date: End date for transactions
            page_token: Token for pagination

        Returns:
            Dict with transactions list and nextPageToken
        """
        params = {
            "pageSize": 100,
        }

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
                headers={
                    "Authorization": f"Bearer {access_token}",
                }
            )

            if response.status_code != 200:
                logger.error(f"Failed to fetch transactions: {response.status_code} - {response.text}")
                raise Exception(f"Failed to fetch transactions: {response.text}")

            return response.json()

    async def create_connection(
        self,
        db: Session,
        user_id: str,
        code: str,
    ) -> TinkConnection:
        """
        Create a new Tink connection after successful OAuth.

        Args:
            db: Database session
            user_id: User ID
            code: Authorization code from callback

        Returns:
            Created TinkConnection object
        """
        # Exchange code for tokens
        token_data = await self.exchange_code_for_tokens(code)

        access_token = token_data["access_token"]
        refresh_token = token_data["refresh_token"]
        expires_in = token_data.get("expires_in", 3600)

        # Fetch accounts
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

        # Generate a unique Tink user ID (from the token or accounts)
        # In a real implementation, you'd get this from the token introspection
        tink_user_id = f"tink_{user_id}_{secrets.token_hex(8)}"

        # Check for existing connection
        existing = db.query(TinkConnection).filter(
            TinkConnection.user_id == user_id,
            TinkConnection.is_active == True
        ).first()

        if existing:
            # Update existing connection
            existing.access_token = access_token
            existing.refresh_token = refresh_token
            existing.token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            existing.accounts = account_ids
            existing.account_details = account_details
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            logger.info(f"Updated existing Tink connection {existing.id} for user {user_id}")
            return existing

        # Create new connection
        connection = TinkConnection(
            user_id=user_id,
            tink_user_id=tink_user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            token_expires_at=datetime.utcnow() + timedelta(seconds=expires_in),
            accounts=account_ids,
            account_details=account_details,
            is_active=True,
        )

        db.add(connection)
        db.commit()
        db.refresh(connection)

        logger.info(f"Created new Tink connection {connection.id} for user {user_id}")
        return connection


# Singleton instance
tink_service = TinkService()
