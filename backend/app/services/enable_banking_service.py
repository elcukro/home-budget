"""
Enable Banking API Service

Wraps the Enable Banking API for PSD2 Account Information Services (AIS).
Uses JWT-based auth (RS256) — each request is signed with the app's RSA private key.

API docs: https://enablebanking.com/docs/api/reference/
"""

import os
import time
import httpx
import jwt
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Any

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

ENABLEBANKING_API_URL = "https://api.enablebanking.com"
ENABLEBANKING_APP_ID = os.getenv("ENABLEBANKING_APP_ID", "")
ENABLEBANKING_PRIVATE_KEY_PATH = os.getenv("ENABLEBANKING_PRIVATE_KEY_PATH", "")

# Load RSA private key once at module init
_PRIVATE_KEY: Optional[str] = None
if ENABLEBANKING_PRIVATE_KEY_PATH and os.path.exists(ENABLEBANKING_PRIVATE_KEY_PATH):
    with open(ENABLEBANKING_PRIVATE_KEY_PATH, "r") as f:
        _PRIVATE_KEY = f.read()


class EnableBankingAPIError(Exception):
    """Raised when Enable Banking API returns an error."""
    def __init__(self, message: str, status_code: int = 500):
        self.status_code = status_code
        super().__init__(message)


class EnableBankingService:
    """Service for interacting with Enable Banking PSD2 API."""

    def __init__(self):
        self.api_url = ENABLEBANKING_API_URL

    def generate_jwt(self) -> str:
        """
        Generate a signed JWT for Enable Banking API authentication.

        Uses RS256 with claims:
        - iss: "enablebanking.com"
        - aud: "api.enablebanking.com"
        - iat: current timestamp
        - exp: current timestamp + 3600 (1 hour)
        - kid (header): ENABLEBANKING_APP_ID
        """
        if not ENABLEBANKING_APP_ID:
            raise EnableBankingAPIError(
                "ENABLEBANKING_APP_ID not configured", status_code=500
            )
        if not _PRIVATE_KEY:
            raise EnableBankingAPIError(
                "Enable Banking private key not loaded. Check ENABLEBANKING_PRIVATE_KEY_PATH.",
                status_code=500,
            )

        now = int(time.time())
        payload = {
            "iss": "enablebanking.com",
            "aud": "api.enablebanking.com",
            "iat": now,
            "exp": now + 3600,
        }
        headers = {
            "kid": ENABLEBANKING_APP_ID,
        }

        return jwt.encode(payload, _PRIVATE_KEY, algorithm="RS256", headers=headers)

    def _auth_headers(self) -> dict:
        """Build Authorization header with a fresh JWT."""
        token = self.generate_jwt()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def get_aspsps(self, country: str) -> list:
        """
        List available ASPSPs (banks) for a country.

        GET /aspsps?country={country}
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/aspsps",
                params={"country": country.upper()},
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code != 200:
                raise EnableBankingAPIError(
                    f"Failed to list ASPSPs for {country}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json().get("aspsps", [])

    async def start_auth(
        self,
        aspsp_name: str,
        aspsp_country: str,
        redirect_url: str,
        state: str,
        psu_type: str = "personal",
    ) -> dict:
        """
        Start authorization flow with a bank.

        POST /auth → returns {url, authorization_id}

        The user should be redirected to the returned URL to authorize access.
        After auth, the bank redirects back to redirect_url with ?code=...&state=...
        """
        # Request consent for 90 days (standard PSD2 max; bank may grant more)
        valid_until = (datetime.utcnow() + timedelta(days=90)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        body = {
            "access": {
                "valid_until": valid_until,
            },
            "aspsp": {
                "name": aspsp_name,
                "country": aspsp_country.upper(),
            },
            "state": state,
            "redirect_url": redirect_url,
            "psu_type": psu_type,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/auth",
                json=body,
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code not in (200, 201):
                raise EnableBankingAPIError(
                    f"Failed to start auth for {aspsp_name}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def create_session(self, code: str) -> dict:
        """
        Exchange authorization code for a session.

        POST /sessions → returns {session_id, accounts, aspsp, access}

        The session_id is the long-lived credential (valid until consent expiry).
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/sessions",
                json={"code": code},
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code not in (200, 201):
                raise EnableBankingAPIError(
                    f"Failed to create session: {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def get_session(self, session_id: str) -> dict:
        """
        Get session details (status, accounts, access validity).

        GET /sessions/{session_id}
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/sessions/{session_id}",
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code != 200:
                raise EnableBankingAPIError(
                    f"Failed to get session {session_id}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def get_balances(self, account_uid: str) -> list:
        """
        Fetch balances for an account.

        GET /accounts/{account_uid}/balances
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/accounts/{account_uid}/balances",
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code != 200:
                raise EnableBankingAPIError(
                    f"Failed to fetch balances for {account_uid}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json().get("balances", [])

    async def get_transactions(
        self,
        account_uid: str,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[dict]:
        """
        Fetch transactions for an account, handling pagination via continuation_key.

        GET /accounts/{account_uid}/transactions

        Returns all booked transactions (follows continuation_key until exhausted).
        """
        all_transactions = []
        continuation_key = None

        async with httpx.AsyncClient() as client:
            while True:
                params = {}
                if date_from:
                    params["date_from"] = date_from
                if date_to:
                    params["date_to"] = date_to
                if continuation_key:
                    params["continuation_key"] = continuation_key

                response = await client.get(
                    f"{self.api_url}/accounts/{account_uid}/transactions",
                    params=params,
                    headers=self._auth_headers(),
                    timeout=60.0,
                )

                if response.status_code != 200:
                    raise EnableBankingAPIError(
                        f"Failed to fetch transactions for {account_uid}: {response.text}",
                        status_code=response.status_code,
                    )

                data = response.json()
                transactions = data.get("transactions", [])
                all_transactions.extend(transactions)

                continuation_key = data.get("continuation_key")
                if not continuation_key:
                    break

        return all_transactions

    async def delete_session(self, session_id: str) -> None:
        """
        Delete/revoke an Enable Banking session (ends consent).

        DELETE /sessions/{session_id}
        """
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.api_url}/sessions/{session_id}",
                headers=self._auth_headers(),
                timeout=30.0,
            )

            if response.status_code not in (200, 204):
                raise EnableBankingAPIError(
                    f"Failed to delete session {session_id}: {response.text}",
                    status_code=response.status_code,
                )


# Singleton instance
enable_banking_service = EnableBankingService()
