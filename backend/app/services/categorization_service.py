"""
AI-powered transaction categorization service using OpenAI.
"""

import os
import json
import logging
from typing import List, Dict, Optional, Tuple
import httpx

logger = logging.getLogger(__name__)

# Our expense and income categories
EXPENSE_CATEGORIES = [
    "housing",        # rent, mortgage, property taxes
    "transportation", # car, fuel, public transport, uber
    "food",           # groceries, restaurants, delivery
    "utilities",      # electricity, gas, water, internet, phone
    "insurance",      # health, car, life, home insurance
    "healthcare",     # doctors, pharmacy, medical procedures
    "entertainment",  # movies, games, subscriptions, hobbies
    "other"           # anything else
]

INCOME_CATEGORIES = [
    "salary",      # regular employment income
    "freelance",   # contract work, gigs
    "investments", # dividends, interest, capital gains
    "rental",      # rental income from property
    "other"        # gifts, refunds, other income
]

# Category descriptions for better AI understanding
CATEGORY_DESCRIPTIONS = {
    # Expenses
    "housing": "rent, mortgage payments, property taxes, home repairs, furniture",
    "transportation": "car payments, fuel, gas station, public transport, uber, taxi, parking, car service",
    "food": "groceries, supermarket, restaurants, cafes, coffee shops, food delivery, takeaway",
    "utilities": "electricity, gas, water, internet, phone bill, mobile, TV subscription",
    "insurance": "health insurance, car insurance, life insurance, home insurance premiums",
    "healthcare": "doctors, dentist, pharmacy, medications, medical procedures, hospital",
    "entertainment": "movies, cinema, games, Netflix, Spotify, hobbies, sports, gym, books",
    "other": "anything that doesn't fit other expense categories",
    # Income
    "salary": "regular employment paycheck, wages, work income",
    "freelance": "contract work, consulting, gig economy, self-employment income",
    "investments": "dividends, interest, stock sales, capital gains, crypto",
    "rental": "rental income from property, Airbnb income",
    "other_income": "gifts, refunds, tax returns, bonuses not from employer, unexpected income"
}


async def categorize_transactions(
    transactions: List[Dict],
    api_key: Optional[str] = None
) -> List[Dict]:
    """
    Categorize a batch of transactions using OpenAI.

    Args:
        transactions: List of transaction dicts with fields:
            - id: transaction ID
            - description: transaction description
            - merchant_name: merchant name (optional)
            - amount: transaction amount (negative = expense, positive = income)
            - tink_category: Tink's category (optional, for context)
        api_key: OpenAI API key (uses env var if not provided)

    Returns:
        List of categorization results with fields:
            - id: transaction ID
            - type: "expense" or "income"
            - category: one of our categories
            - confidence: 0.0 to 1.0
    """
    if not api_key:
        api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        logger.warning("No OpenAI API key available for categorization")
        return []

    if not transactions:
        return []

    # Build prompt with transaction data
    tx_list = []
    for tx in transactions:
        tx_entry = {
            "id": tx["id"],
            "description": tx.get("description", ""),
            "merchant": tx.get("merchant_name", ""),
            "amount": tx.get("amount", 0),
            "tink_category": tx.get("tink_category", "")
        }
        tx_list.append(tx_entry)

    prompt = f"""You are a financial transaction categorizer for a Polish household budget app.

Categorize each transaction into the appropriate type and category.

EXPENSE CATEGORIES (for negative amounts / spending):
- housing: {CATEGORY_DESCRIPTIONS["housing"]}
- transportation: {CATEGORY_DESCRIPTIONS["transportation"]}
- food: {CATEGORY_DESCRIPTIONS["food"]}
- utilities: {CATEGORY_DESCRIPTIONS["utilities"]}
- insurance: {CATEGORY_DESCRIPTIONS["insurance"]}
- healthcare: {CATEGORY_DESCRIPTIONS["healthcare"]}
- entertainment: {CATEGORY_DESCRIPTIONS["entertainment"]}
- other: {CATEGORY_DESCRIPTIONS["other"]}

INCOME CATEGORIES (for positive amounts / money received):
- salary: {CATEGORY_DESCRIPTIONS["salary"]}
- freelance: {CATEGORY_DESCRIPTIONS["freelance"]}
- investments: {CATEGORY_DESCRIPTIONS["investments"]}
- rental: {CATEGORY_DESCRIPTIONS["rental"]}
- other: {CATEGORY_DESCRIPTIONS["other_income"]}

TRANSACTIONS TO CATEGORIZE:
{json.dumps(tx_list, ensure_ascii=False, indent=2)}

RESPOND WITH JSON ONLY. Format:
{{
  "results": [
    {{
      "id": <transaction_id>,
      "type": "expense" or "income",
      "category": "<category_name>",
      "confidence": <0.0 to 1.0>
    }}
  ]
}}

Rules:
1. Use "expense" type for negative amounts, "income" for positive
2. Match category from the lists above EXACTLY (lowercase)
3. confidence: 0.9+ if obvious, 0.7-0.9 if likely, 0.5-0.7 if guessing
4. Polish merchant names are common - interpret them correctly
5. Consider tink_category as a hint but make your own judgment"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4.1-mini",
                    "max_tokens": 4096,
                    "messages": [
                        {"role": "system", "content": "You are a transaction categorization engine. Respond with valid JSON only."},
                        {"role": "user", "content": prompt}
                    ]
                }
            )

        if response.status_code != 200:
            logger.error(f"OpenAI API error: {response.status_code} - {response.text}")
            return []

        # Parse response
        data = response.json()
        choices = data.get("choices", [])

        if not choices:
            logger.error("Empty response from OpenAI")
            return []

        # Extract text from the first choice
        text = choices[0].get("message", {}).get("content", "")

        # Try to extract JSON from response
        try:
            # Handle potential markdown code blocks
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            result = json.loads(text.strip())
            return result.get("results", [])
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.debug(f"Response text: {text}")
            return []

    except httpx.TimeoutException:
        logger.error("Timeout calling OpenAI API")
        return []
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {e}")
        return []


async def categorize_in_batches(
    transactions: List[Dict],
    batch_size: int = 30,
    api_key: Optional[str] = None
) -> List[Dict]:
    """
    Categorize transactions in batches for efficiency.

    Args:
        transactions: List of all transactions to categorize
        batch_size: Number of transactions per API call
        api_key: OpenAI API key

    Returns:
        Combined list of all categorization results
    """
    all_results = []

    for i in range(0, len(transactions), batch_size):
        batch = transactions[i:i + batch_size]
        logger.info(f"Categorizing batch {i // batch_size + 1} ({len(batch)} transactions)")

        results = await categorize_transactions(batch, api_key)
        all_results.extend(results)

    return all_results
