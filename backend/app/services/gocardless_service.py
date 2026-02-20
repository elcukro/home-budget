"""
GoCardless Bank Account Data API Service

Wraps the GoCardless (formerly Nordigen) API for fetching bank accounts,
transactions, and balances via PSD2 Open Banking.

API docs: https://bankaccountdata.gocardless.com/api/v2/
"""

import os
import httpx
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any

from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

GOCARDLESS_API_URL = "https://bankaccountdata.gocardless.com/api/v2"
GOCARDLESS_SECRET_ID = os.getenv("GOCARDLESS_SECRET_ID", "")
GOCARDLESS_SECRET_KEY = os.getenv("GOCARDLESS_SECRET_KEY", "")

# Module-level token cache (GoCardless tokens last ~24 hours)
_TOKEN_CACHE: Dict[str, Any] = {
    "access_token": None,
    "expires_at": None,
}


class GoCardlessAPIError(Exception):
    """Raised when GoCardless API returns an error."""
    def __init__(self, message: str, status_code: int = 500):
        self.status_code = status_code
        super().__init__(message)


class GoCardlessService:
    """Service for interacting with GoCardless Bank Account Data API."""

    def __init__(self):
        self.api_url = GOCARDLESS_API_URL

    async def get_access_token(self) -> str:
        """Get or refresh the cached GoCardless access token."""
        now = datetime.now()

        if not GOCARDLESS_SECRET_ID or not GOCARDLESS_SECRET_KEY:
            raise GoCardlessAPIError(
                "GoCardless credentials not configured (GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY)",
                status_code=500,
            )

        # Return cached token if still valid
        if (_TOKEN_CACHE["access_token"]
                and _TOKEN_CACHE["expires_at"]
                and now < _TOKEN_CACHE["expires_at"]):
            return _TOKEN_CACHE["access_token"]

        logger.info("Requesting new GoCardless access token")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_url}/token/new/",
                json={
                    "secret_id": GOCARDLESS_SECRET_ID,
                    "secret_key": GOCARDLESS_SECRET_KEY,
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )

            if response.status_code != 200:
                raise GoCardlessAPIError(
                    f"Failed to get access token: {response.text}",
                    status_code=response.status_code,
                )

            token_data = response.json()
            # Cache with 5-minute safety margin
            _TOKEN_CACHE["access_token"] = token_data["access"]
            _TOKEN_CACHE["expires_at"] = now + timedelta(
                seconds=token_data["access_expires"] - 300
            )

            return token_data["access"]

    async def fetch_requisition(self, requisition_id: str) -> dict:
        """Fetch requisition details including linked account IDs."""
        token = await self.get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/requisitions/{requisition_id}/",
                headers={"Authorization": f"Bearer {token}"},
            )

            if response.status_code != 200:
                raise GoCardlessAPIError(
                    f"Failed to fetch requisition {requisition_id}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json()

    async def fetch_account_details(self, account_id: str) -> dict:
        """Fetch account details (IBAN, owner name, currency, product)."""
        token = await self.get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/accounts/{account_id}/details/",
                headers={"Authorization": f"Bearer {token}"},
            )

            if response.status_code != 200:
                raise GoCardlessAPIError(
                    f"Failed to fetch account details for {account_id}: {response.text}",
                    status_code=response.status_code,
                )

            return response.json().get("account", {})

    async def fetch_accounts(self, requisition_id: str) -> List[dict]:
        """Fetch all accounts for a requisition with their details."""
        requisition = await self.fetch_requisition(requisition_id)
        account_ids = requisition.get("accounts", [])

        accounts = []
        for account_id in account_ids:
            try:
                details = await self.fetch_account_details(account_id)
                accounts.append({
                    "id": account_id,
                    "iban": details.get("iban"),
                    "owner_name": details.get("ownerName"),
                    "currency": details.get("currency"),
                    "product": details.get("product"),
                })
            except GoCardlessAPIError as e:
                logger.warning(f"Failed to fetch details for account {account_id}: {e}")
                accounts.append({"id": account_id})

        return accounts

    async def fetch_transactions(
        self,
        account_id: str,
        from_date: Optional[str] = None,
    ) -> List[dict]:
        """
        Fetch booked transactions for an account.

        Args:
            account_id: GoCardless account UUID
            from_date: Optional ISO date string (YYYY-MM-DD) to filter from

        Returns:
            List of booked transaction dicts from GoCardless API
        """
        token = await self.get_access_token()

        params = {}
        if from_date:
            params["date_from"] = from_date

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/accounts/{account_id}/transactions/",
                params=params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=60.0,
            )

            if response.status_code != 200:
                raise GoCardlessAPIError(
                    f"Failed to fetch transactions for {account_id}: {response.text}",
                    status_code=response.status_code,
                )

            data = response.json()
            transactions = data.get("transactions", {})
            return transactions.get("booked", [])

    async def fetch_balances(self, account_id: str) -> List[dict]:
        """Fetch balances for an account."""
        token = await self.get_access_token()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/accounts/{account_id}/balances/",
                headers={"Authorization": f"Bearer {token}"},
            )

            if response.status_code != 200:
                raise GoCardlessAPIError(
                    f"Failed to fetch balances for {account_id}: {response.text}",
                    status_code=response.status_code,
                )

            data = response.json()
            return data.get("balances", [])


# Singleton instance
gocardless_service = GoCardlessService()
