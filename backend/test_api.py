import httpx
import json
from datetime import datetime
import asyncio
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000"
TEST_USER_ID = "test@example.com"  # This should match a user ID in your database

async def test_endpoint(client: httpx.AsyncClient, method: str, endpoint: str, headers: dict, data: dict = None) -> dict:
    """Test an API endpoint and return the result."""
    try:
        logger.info(f"\nTesting {method} {endpoint}")
        
        if method == "GET":
            response = await client.get(endpoint, headers=headers)
        elif method == "PUT":
            response = await client.put(endpoint, headers=headers, json=data)
        elif method == "DELETE":
            response = await client.delete(endpoint, headers=headers)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        logger.info(f"Status: {response.status_code}")
        
        if response.status_code == 204:  # No content
            logger.info("Response: No content (204)")
            return None
            
        response_data = response.json() if response.status_code != 204 else None
        logger.info(f"Response: {json.dumps(response_data, indent=2) if response_data else 'None'}")
        
        if response.status_code >= 400:
            logger.error(f"Error response: {response.text}")
            
        return response_data
    except httpx.RequestError as e:
        logger.error(f"Request error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Error testing endpoint: {str(e)}")
        raise

async def test_financial_freedom_api():
    """Test the financial freedom API endpoints."""
    headers = {
        "X-User-ID": TEST_USER_ID,
        "Content-Type": "application/json"
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test GET endpoint
            get_response = await test_endpoint(
                client=client,
                method="GET",
                endpoint=f"{API_URL}/financial-freedom",
                headers=headers
            )
            
            # Test PUT endpoint
            put_data = {
                "steps": [
                    {
                        "id": 1,
                        "titleKey": "financialFreedom.steps.step1.title",
                        "descriptionKey": "financialFreedom.steps.step1.description",
                        "isCompleted": False,
                        "progress": 50,
                        "targetAmount": 1000,
                        "currentAmount": 500,
                        "notes": "Making good progress!"
                    }
                ],
                "startDate": datetime.now().isoformat()  # Add startDate
            }
            put_response = await test_endpoint(
                client=client,
                method="PUT",
                endpoint=f"{API_URL}/financial-freedom",
                headers=headers,
                data=put_data
            )
            
            # Test DELETE endpoint
            delete_response = await test_endpoint(
                client=client,
                method="DELETE",
                endpoint=f"{API_URL}/financial-freedom",
                headers=headers
            )
            
            logger.info("\nAll tests completed successfully!")
            
    except Exception as e:
        logger.error(f"\nTest failed: {str(e)}")
        raise

if __name__ == "__main__":
    try:
        asyncio.run(test_financial_freedom_api())
    except KeyboardInterrupt:
        logger.info("\nTests interrupted by user")
    except Exception as e:
        logger.error(f"\nTests failed: {str(e)}")
        raise 