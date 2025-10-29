#!/usr/bin/env python
"""
Simple script to test GoCardless API credentials directly.
"""

import os
import sys
import json
import httpx
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get credentials from environment
GOCARDLESS_SECRET_ID = os.getenv("GOCARDLESS_SECRET_ID", "")
GOCARDLESS_SECRET_KEY = os.getenv("GOCARDLESS_SECRET_KEY", "")

# Check credentials
print(f"GOCARDLESS_SECRET_ID present: {'YES' if GOCARDLESS_SECRET_ID else 'NO'}")
print(f"GOCARDLESS_SECRET_KEY present: {'YES' if GOCARDLESS_SECRET_KEY else 'NO'}")

if not GOCARDLESS_SECRET_ID or not GOCARDLESS_SECRET_KEY:
    print("Error: Missing GoCardless credentials. Please set GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in your .env file.")
    sys.exit(1)

# API endpoint
API_URL = "https://bankaccountdata.gocardless.com/api/v2"

# Function to get token
async def get_token():
    print(f"Requesting token from: {API_URL}/token/new/")
    print(f"Using credentials: {GOCARDLESS_SECRET_ID[:4]}...{GOCARDLESS_SECRET_ID[-4:]} (Secret ID)")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{API_URL}/token/new/",
                json={
                    "secret_id": GOCARDLESS_SECRET_ID,
                    "secret_key": GOCARDLESS_SECRET_KEY
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                }
            )
            
            print(f"Response status code: {response.status_code}")
            print(f"Response headers: {response.headers}")
            
            try:
                response_data = response.json()
                print(f"Response JSON: {json.dumps(response_data, indent=2)}")
                return response_data.get("access") if response.status_code == 200 else None
            except:
                print(f"Raw response text: {response.text}")
                return None
                
        except Exception as e:
            print(f"Error making request: {str(e)}")
            return None

# Function to test institutions endpoint
async def test_institutions(token, country="gb"):
    print(f"\nTesting institutions endpoint for country: {country}")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{API_URL}/institutions/?country={country}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json"
                }
            )
            
            print(f"Response status code: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"Found {len(response_data)} institutions")
                for inst in response_data[:3]:  # Show first 3 institutions only
                    print(f"  - {inst.get('name', 'N/A')} (ID: {inst.get('id', 'N/A')})")
                if len(response_data) > 3:
                    print(f"  - ...and {len(response_data) - 3} more")
            except:
                print(f"Raw response text: {response.text}")
                
        except Exception as e:
            print(f"Error making request: {str(e)}")

# Main function
async def main():
    print("Testing GoCardless API connection...")
    token = await get_token()
    
    if token:
        print("\nToken received successfully!")
        await test_institutions(token)
    else:
        print("\nFailed to get access token.")

# Run the script
if __name__ == "__main__":
    import asyncio
    asyncio.run(main())