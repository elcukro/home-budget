from fastapi import APIRouter, HTTPException, Depends, Query
import httpx
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
import json
import logging
from dotenv import load_dotenv
from ..database import get_db
from sqlalchemy.orm import Session
from ..dependencies import get_current_user
from ..models import User
from ..security import require_debug_mode
from pydantic import BaseModel

# Set up logging first
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
import os
from pathlib import Path

# Try to find .env in different locations
base_dir = Path(__file__).resolve().parent.parent.parent  # backend directory
dotenv_paths = [
    os.path.join(base_dir, ".env"),                      # /backend/.env
    os.path.join(os.path.dirname(base_dir), ".env"),     # /parent-of-backend/.env
]

for dotenv_path in dotenv_paths:
    if os.path.exists(dotenv_path):
        logger.info(f"Loading environment variables from {dotenv_path}")
        load_dotenv(dotenv_path)
        break
else:
    logger.warning("No .env file found. Using default/environment values.")

# GoCardless API configuration
GOCARDLESS_API_URL = "https://bankaccountdata.gocardless.com/api/v2"
GOCARDLESS_SECRET_ID = os.getenv("GOCARDLESS_SECRET_ID", "")
GOCARDLESS_SECRET_KEY = os.getenv("GOCARDLESS_SECRET_KEY", "")

# Debug: Print environment variable status
logger.info(f"GOCARDLESS_SECRET_ID loaded: {'YES' if GOCARDLESS_SECRET_ID else 'NO'}")
logger.info(f"GOCARDLESS_SECRET_KEY loaded: {'YES' if GOCARDLESS_SECRET_KEY else 'NO'}")

router = APIRouter(
    prefix="/banking",
    tags=["banking"],
    responses={404: {"description": "Not found"}},
)

# Cache for the access token
TOKEN_CACHE = {
    "access_token": None,
    "expires_at": None
}

# Pydantic models for requests and responses
class TokenResponse(BaseModel):
    access: str
    access_expires: int
    refresh: str
    refresh_expires: int

class Institution(BaseModel):
    id: str
    name: str
    bic: Optional[str] = None
    transaction_total_days: Optional[str] = None
    countries: List[str]
    logo: Optional[str] = None
    max_access_valid_for_days: Optional[str] = None

class RequisitionRequest(BaseModel):
    redirect: str
    institution_id: str
    reference: Optional[str] = None
    agreement: Optional[str] = None
    user_language: Optional[str] = None

class RequisitionStatus(BaseModel):
    short: str
    long: str
    description: str

class Requisition(BaseModel):
    id: str
    redirect: str
    status: Optional[Union[str, RequisitionStatus]] = None
    agreement: Optional[str] = None
    accounts: List[str] = []
    reference: Optional[str] = None
    user_language: Optional[str] = None
    link: Optional[str] = None

class TransactionAmount(BaseModel):
    currency: str
    amount: str

class DebtorAccount(BaseModel):
    iban: Optional[str] = None

class Transaction(BaseModel):
    transactionId: Optional[str] = None
    debtorName: Optional[str] = None
    debtorAccount: Optional[DebtorAccount] = None
    transactionAmount: TransactionAmount
    bankTransactionCode: Optional[str] = None
    bookingDate: Optional[str] = None
    valueDate: Optional[str] = None
    remittanceInformationUnstructured: Optional[str] = None

class TransactionList(BaseModel):
    booked: List[Transaction] = []
    pending: List[Transaction] = []

class TransactionResponse(BaseModel):
    transactions: TransactionList
    
class AccountWithName(BaseModel):
    id: str
    name: Optional[str] = None

class BankingConnectionCreate(BaseModel):
    institution_id: str
    institution_name: str
    requisition_id: str
    expires_at: datetime
    accounts: Optional[List[str]] = None
    account_names: Optional[Dict[str, str]] = None  # Map of account ID to account name
    
class BankingConnectionResponse(BaseModel):
    id: int
    institution_id: str
    institution_name: str
    requisition_id: str
    created_at: datetime
    expires_at: datetime
    is_active: bool
    accounts: Optional[List[str]] = None
    account_names: Optional[Dict[str, str]] = None  # Map of account ID to account name

async def get_access_token():
    """Get or refresh the access token for GoCardless API"""
    now = datetime.now()
    
    # Check if credentials are set
    if not GOCARDLESS_SECRET_ID or not GOCARDLESS_SECRET_KEY:
        logger.error("GoCardless credentials not set in environment variables")
        raise HTTPException(
            status_code=500,
            detail="GoCardless API credentials are not configured. Please check GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in the .env file."
        )
    
    # Check if cached token is still valid
    if (TOKEN_CACHE["access_token"] and TOKEN_CACHE["expires_at"] 
            and now < TOKEN_CACHE["expires_at"]):
        return TOKEN_CACHE["access_token"]
    
    try:
        logger.info("Requesting new GoCardless access token")
        logger.info(f"Using URL: {GOCARDLESS_API_URL}/token/new/")
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GOCARDLESS_API_URL}/token/new/",
                json={
                    "secret_id": GOCARDLESS_SECRET_ID,
                    "secret_key": GOCARDLESS_SECRET_KEY
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            
            logger.info(f"Response status: {response.status_code}")
            if response.status_code != 200:
                error_text = response.text
                logger.error(f"Error getting access token: {error_text}")
                
                # Try to parse the response for better error info
                try:
                    error_data = response.json()
                    logger.error(f"Error details: {json.dumps(error_data)}")
                except:
                    pass
                
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error getting access token: {error_text}"
                )
            
            token_data = response.json()
            
            # Cache the token with expiration time
            TOKEN_CACHE["access_token"] = token_data["access"]
            TOKEN_CACHE["expires_at"] = now + timedelta(seconds=token_data["access_expires"] - 300)  # Expire 5 minutes early
            
            return token_data["access"]
            
    except Exception as e:
        logger.error(f"Error getting access token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting access token: {str(e)}"
        )

@router.get("/token", response_model=dict)
async def get_token(
    _debug: None = Depends(require_debug_mode),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get access token for GoCardless API (for testing purposes). Protected in production."""
    try:
        token = await get_access_token()
        return {
            "access_token": token,
            "expires_at": TOKEN_CACHE["expires_at"].isoformat() if TOKEN_CACHE["expires_at"] else None
        }
    except Exception as e:
        logger.error(f"Error in get_token: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting token: {str(e)}"
        )

@router.get("/institutions", response_model=List[Institution])
async def get_institutions(
    country: str = Query(..., description="Two-letter country code (ISO 3166)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get list of available financial institutions in a given country"""
    try:
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GOCARDLESS_API_URL}/institutions/",
                params={"country": country},
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Error getting institutions: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error getting institutions: {response.text}"
                )
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Error getting institutions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting institutions: {str(e)}"
        )

@router.post("/requisitions", response_model=Requisition)
async def create_requisition(
    requisition_data: RequisitionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a requisition for bank account access"""
    try:
        logger.info(f"Creating requisition with data: {requisition_data}")
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{GOCARDLESS_API_URL}/requisitions/",
                json=requisition_data.dict(exclude_none=True),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            
            logger.info(f"Requisition response status: {response.status_code}")
            
            if response.status_code != 200 and response.status_code != 201:
                logger.error(f"Error creating requisition: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error creating requisition: {response.text}"
                )
            
            # Log the response data
            response_data = response.json()
            logger.info(f"Requisition created successfully with ID: {response_data.get('id')}")
            logger.info(f"Link for bank authorization: {response_data.get('link')}")
            
            return response_data
            
    except Exception as e:
        logger.error(f"Error creating requisition: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating requisition: {str(e)}"
        )

@router.get("/requisitions/{requisition_id}", response_model=Requisition)
async def get_requisition(
    requisition_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a requisition by ID"""
    try:
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GOCARDLESS_API_URL}/requisitions/{requisition_id}/",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Error getting requisition: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error getting requisition: {response.text}"
                )
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Error getting requisition: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting requisition: {str(e)}"
        )

class AccountDetails(BaseModel):
    iban: Optional[str] = None
    currency: Optional[str] = None
    ownerName: Optional[str] = None
    product: Optional[str] = None
    bic: Optional[str] = None
    ownerAddressUnstructured: Optional[List[str]] = None
    resourceId: Optional[str] = None

class AccountDetailsResponse(BaseModel):
    account: AccountDetails

@router.get("/accounts/{account_id}/details", response_model=AccountDetailsResponse)
async def get_account_details(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details for a specific account, including owner name"""
    try:
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GOCARDLESS_API_URL}/accounts/{account_id}/details/",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Error getting account details: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error getting account details: {response.text}"
                )
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Error getting account details: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting account details: {str(e)}"
        )

@router.get("/accounts/{account_id}/transactions", response_model=TransactionResponse)
async def get_account_transactions(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transactions for a specific account"""
    try:
        token = await get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{GOCARDLESS_API_URL}/accounts/{account_id}/transactions/",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code != 200:
                logger.error(f"Error getting transactions: {response.text}")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Error getting transactions: {response.text}"
                )
            
            return response.json()
            
    except Exception as e:
        logger.error(f"Error getting transactions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error getting transactions: {str(e)}"
        )

@router.post("/connections", response_model=BankingConnectionResponse)
async def create_banking_connection(
    connection_data: BankingConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save a banking connection with account names"""
    try:
        # Create a new BankingConnection
        from ..models import BankingConnection
        
        # Check if a connection with this requisition_id already exists
        existing_connection = db.query(BankingConnection).filter(
            BankingConnection.requisition_id == connection_data.requisition_id
        ).first()
        
        # If accounts are provided but no account names, try to fetch account details
        if connection_data.accounts and (not connection_data.account_names or len(connection_data.account_names) == 0):
            logger.info("Accounts provided without names, fetching account details automatically")
            account_names = {}
            
            # Get access token
            token = await get_access_token()
            
            # For each account, fetch details to get the owner name
            for account_id in connection_data.accounts:
                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            f"{GOCARDLESS_API_URL}/accounts/{account_id}/details/",
                            headers={"Authorization": f"Bearer {token}"}
                        )
                        
                        if response.status_code == 200:
                            details_data = response.json()
                            owner_name = details_data.get("account", {}).get("ownerName")
                            if owner_name:
                                account_names[account_id] = owner_name
                                logger.info(f"Found owner name for account {account_id}: {owner_name}")
                except Exception as e:
                    logger.error(f"Error fetching details for account {account_id}: {str(e)}")
            
            # Set the account names in the connection data
            connection_data.account_names = account_names
        
        if existing_connection:
            # Update the existing connection
            existing_connection.institution_id = connection_data.institution_id
            existing_connection.institution_name = connection_data.institution_name
            existing_connection.expires_at = connection_data.expires_at
            existing_connection.is_active = True
            existing_connection.accounts = connection_data.accounts
            
            # Update account names if provided
            try:
                if connection_data.account_names:
                    if hasattr(existing_connection, 'account_names') and existing_connection.account_names:
                        # Merge new account names with existing ones
                        existing_names = existing_connection.account_names
                        existing_names.update(connection_data.account_names)
                        existing_connection.account_names = existing_names
                    else:
                        existing_connection.account_names = connection_data.account_names
            except Exception as e:
                # Ignore errors related to account_names
                logger.warning(f"Error updating account_names: {str(e)}")
            
            db.commit()
            db.refresh(existing_connection)
            return existing_connection
        
        # Create a new connection
        try:
            new_connection = BankingConnection(
                user_id=current_user.id,
                institution_id=connection_data.institution_id,
                institution_name=connection_data.institution_name,
                requisition_id=connection_data.requisition_id,
                expires_at=connection_data.expires_at,
                accounts=connection_data.accounts,
                account_names=connection_data.account_names,
                is_active=True
            )
        except Exception as e:
            # If there's an error with account_names (e.g., column doesn't exist yet)
            logger.warning(f"Error including account_names, trying without it: {str(e)}")
            new_connection = BankingConnection(
                user_id=current_user.id,
                institution_id=connection_data.institution_id,
                institution_name=connection_data.institution_name,
                requisition_id=connection_data.requisition_id,
                expires_at=connection_data.expires_at,
                accounts=connection_data.accounts,
                is_active=True
            )
        
        db.add(new_connection)
        db.commit()
        db.refresh(new_connection)
        
        return new_connection
    except Exception as e:
        logger.error(f"Error creating banking connection: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating banking connection: {str(e)}"
        )

@router.get("/connections", response_model=List[BankingConnectionResponse])
async def get_banking_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all banking connections for the current user"""
    try:
        from ..models import BankingConnection
        
        connections = db.query(BankingConnection).filter(
            BankingConnection.user_id == current_user.id,
            BankingConnection.is_active == True
        ).all()
        
        return connections
    except Exception as e:
        logger.error(f"Error fetching banking connections: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching banking connections: {str(e)}"
        )

@router.delete("/connections/{connection_id}", response_model=dict)
async def delete_banking_connection(
    connection_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a banking connection"""
    try:
        from ..models import BankingConnection
        
        connection = db.query(BankingConnection).filter(
            BankingConnection.id == connection_id,
            BankingConnection.user_id == current_user.id
        ).first()
        
        if not connection:
            raise HTTPException(
                status_code=404,
                detail=f"Banking connection with ID {connection_id} not found"
            )
        
        # Soft delete by setting is_active to False
        connection.is_active = False
        db.commit()
        
        return {
            "status": "success",
            "message": f"Banking connection with ID {connection_id} has been deactivated",
            "timestamp": datetime.now().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting banking connection: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting banking connection: {str(e)}"
        )

@router.get("/test", response_model=dict)
async def test_banking_api(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test if the banking API router is working"""
    return {
        "status": "ok",
        "message": "Banking API is working",
        "timestamp": datetime.now().isoformat()
    }