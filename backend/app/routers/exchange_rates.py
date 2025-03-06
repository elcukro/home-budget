from fastapi import APIRouter, HTTPException, Depends
import httpx
import os
from datetime import datetime, timedelta
from typing import Dict, Optional
import json
import logging
from ..database import get_db
from sqlalchemy.orm import Session
from ..dependencies import get_current_user
from ..models import User

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/exchange-rates",
    tags=["exchange-rates"],
    responses={404: {"description": "Not found"}},
)

# Cache for exchange rates
EXCHANGE_RATES_CACHE = {}
CACHE_TTL = timedelta(hours=24)

# Exchange rate API configuration
# Note: You would need to sign up for an API key
API_KEY = os.getenv("EXCHANGE_RATE_API_KEY", "")
API_URL = "https://open.er-api.com/v6/latest/"  # Example API

# If you don't have an API key, use these fixed rates for demonstration
DEMO_RATES = {
    "USD": {
        "EUR": 0.92,
        "GBP": 0.77,
        "JPY": 150.29,
        "PLN": 3.94
    },
    "EUR": {
        "USD": 1.09,
        "GBP": 0.84,
        "JPY": 163.37,
        "PLN": 4.28
    },
    "GBP": {
        "USD": 1.29,
        "EUR": 1.19,
        "JPY": 194.80,
        "PLN": 5.11
    },
    "JPY": {
        "USD": 0.0067,
        "EUR": 0.0061,
        "GBP": 0.0051,
        "PLN": 0.026
    },
    "PLN": {
        "USD": 0.25,
        "EUR": 0.23,
        "GBP": 0.20,
        "JPY": 38.1
    }
}

@router.get("")
async def get_all_exchange_rates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all available exchange rates"""
    try:
        logger.info(f"Getting all exchange rates for user: {current_user.id}")
        
        # In a real app, we'd fetch from an API, but for now return demo rates
        return {
            "base": "USD",
            "rates": DEMO_RATES,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching exchange rates: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching exchange rates: {str(e)}"
        )

@router.get("/{base_currency}")
async def get_exchange_rates(
    base_currency: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get exchange rates for a specific base currency"""
    base_currency = base_currency.upper()
    
    try:
        logger.info(f"Getting exchange rates for base currency {base_currency} for user: {current_user.id}")
        
        # Check cache first
        if base_currency in EXCHANGE_RATES_CACHE:
            cache_entry = EXCHANGE_RATES_CACHE[base_currency]
            if datetime.now() - cache_entry["timestamp"] < CACHE_TTL:
                logger.info(f"Returning cached exchange rates for {base_currency}")
                return cache_entry["data"]
        
        # For demonstration, use fixed rates instead of API call
        if base_currency in DEMO_RATES:
            rates = DEMO_RATES[base_currency]
            
            response_data = {
                "base": base_currency,
                "rates": rates,
                "timestamp": datetime.now().isoformat()
            }
            
            # Cache the result
            EXCHANGE_RATES_CACHE[base_currency] = {
                "data": response_data,
                "timestamp": datetime.now()
            }
            
            return response_data
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Exchange rates for base currency '{base_currency}' not found"
            )
        
        # In a production environment, we would use a real API:
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(f"{API_URL}{base_currency}?apikey={API_KEY}")
        #     
        # if response.status_code != 200:
        #     raise HTTPException(status_code=response.status_code, 
        #                         detail=f"Error fetching exchange rates: {response.text}")
        # 
        # data = response.json()
        # 
        # # Cache the results
        # EXCHANGE_RATES_CACHE[base_currency] = {
        #     "data": data,
        #     "timestamp": datetime.now()
        # }
        # 
        # return data
        
    except Exception as e:
        logger.error(f"Error fetching exchange rates for {base_currency}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching exchange rates: {str(e)}"
        )

@router.get("/convert/{from_currency}/{to_currency}/{amount}")
async def convert_currency(
    from_currency: str,
    to_currency: str,
    amount: float,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convert an amount from one currency to another"""
    from_currency = from_currency.upper()
    to_currency = to_currency.upper()
    
    try:
        logger.info(f"Converting {amount} from {from_currency} to {to_currency} for user: {current_user.id}")
        
        # If same currency, no conversion needed
        if from_currency == to_currency:
            return {
                "from": from_currency,
                "to": to_currency,
                "amount": amount,
                "converted": amount,
                "rate": 1.0
            }
        
        # Get rates for the from_currency
        if from_currency in DEMO_RATES and to_currency in DEMO_RATES[from_currency]:
            rate = DEMO_RATES[from_currency][to_currency]
            converted = amount * rate
            
            return {
                "from": from_currency,
                "to": to_currency,
                "amount": amount,
                "converted": round(converted, 2),
                "rate": rate
            }
        else:
            # Try the reverse lookup
            if to_currency in DEMO_RATES and from_currency in DEMO_RATES[to_currency]:
                rate = 1 / DEMO_RATES[to_currency][from_currency]
                converted = amount * rate
                
                return {
                    "from": from_currency,
                    "to": to_currency,
                    "amount": amount,
                    "converted": round(converted, 2),
                    "rate": rate
                }
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Exchange rate not found for {from_currency} to {to_currency}"
                )
    except Exception as e:
        logger.error(f"Error converting currency: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error converting currency: {str(e)}"
        )