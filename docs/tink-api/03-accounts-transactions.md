# Tink Accounts & Transactions API

## Accounts

### GET /data/v2/accounts

Fetch user's connected bank accounts.

```bash
GET https://api.tink.com/data/v2/accounts
Authorization: Bearer USER_ACCESS_TOKEN
```

**Response:**
```json
{
  "accounts": [
    {
      "id": "4a2945d1481c4f4b98ab1b135afd96c0",
      "name": "Checking Account",
      "type": "CHECKING",
      "identifiers": {
        "iban": {
          "iban": "PL61109010140000071219812874"
        }
      },
      "balances": {
        "booked": {
          "amount": {
            "currencyCode": "PLN",
            "value": {
              "scale": "2",
              "unscaledValue": "1050000"
            }
          }
        }
      },
      "financialInstitutionId": "string"
    }
  ],
  "nextPageToken": "string"
}
```

### GET /data/v2/accounts/{id}/balances

Get specific account balances.

```bash
GET https://api.tink.com/data/v2/accounts/{ACCOUNT_ID}/balances
Authorization: Bearer USER_ACCESS_TOKEN
```

**Response:**
```json
{
  "accountId": "a6bb87e57a8c4dd4874b241471a2b9e8",
  "balances": {
    "availableBalanceExcludingCredit": {
      "amount": {
        "currencyCode": "PLN",
        "value": {
          "scale": 2,
          "unscaledValue": 1050000
        }
      }
    },
    "bookedBalance": {
      "amount": {
        "currencyCode": "PLN",
        "value": {
          "scale": 2,
          "unscaledValue": 1050000
        }
      }
    }
  },
  "refreshed": "2022-09-27T15:01:40Z"
}
```

## Transactions

### GET /data/v2/transactions

Fetch user's transactions.

```bash
GET https://api.tink.com/data/v2/transactions
Authorization: Bearer USER_ACCESS_TOKEN
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountIdIn` | string | Filter by account ID |
| `bookedDateGte` | string | Start date (YYYY-MM-DD) |
| `bookedDateLte` | string | End date (YYYY-MM-DD) |
| `pageSize` | integer | Results per page (max 100) |
| `pageToken` | string | Pagination token |

**Response:**
```json
{
  "nextPageToken": "...",
  "transactions": [
    {
      "id": "d8f37f7d19c240abb4ef5d5dbebae4ef",
      "accountId": "4a2945d1481c4f4b98ab1b135afd96c0",
      "amount": {
        "currencyCode": "PLN",
        "value": {
          "scale": "2",
          "unscaledValue": "-15000"
        }
      },
      "bookedDateTime": "2026-01-10T09:25:12Z",
      "dates": {
        "booked": "2026-01-10",
        "value": "2026-01-10"
      },
      "descriptions": {
        "display": "Tesco",
        "original": "TESCO STORES 3297",
        "detailed": {
          "unstructured": "TESCO STORES 3297 Warszawa"
        }
      },
      "status": "BOOKED",
      "types": {
        "type": "DEFAULT"
      }
    }
  ]
}
```

### Enriched Transactions

### GET /enrichment/v1/transactions

Fetch transactions with AI-powered categorization.

```bash
GET https://api.tink.com/enrichment/v1/transactions
Authorization: Bearer USER_ACCESS_TOKEN
```

**Response includes enriched data:**
```json
{
  "transactions": [
    {
      "id": "d8f37f7d19c240abb4ef5d5dbebae4ef",
      "accountId": "4a2945d1481c4f4b98ab1b135afd96c0",
      "amount": {
        "currencyCode": "PLN",
        "value": {
          "scale": "2",
          "unscaledValue": "-15000"
        }
      },
      "descriptions": {
        "display": "Tesco",
        "original": "TESCO STORES 3297"
      },
      "enrichedData": {
        "categories": {
          "pfm": {
            "id": "groceries",
            "name": "Groceries"
          }
        }
      },
      "merchantInformation": {
        "merchantCategoryCode": "5411",
        "merchantName": "Tesco"
      },
      "counterparties": {
        "payer": {
          "name": "Joe Doe"
        },
        "payee": {
          "name": "Tesco Stores"
        }
      }
    }
  ]
}
```

## Amount Parsing

Tink uses scaled values for amounts:

```javascript
// Example: unscaledValue: "-15000", scale: "2"
// Actual amount = -15000 / (10^2) = -150.00 PLN

function parseAmount(amount) {
  const scale = parseInt(amount.value.scale);
  const unscaled = parseInt(amount.value.unscaledValue);
  return unscaled / Math.pow(10, scale);
}
```

## Transaction Categories (PFM)

Tink provides automatic categorization:

### Expense Categories
- groceries
- restaurants-dining
- transportation
- utilities
- insurance
- housing
- entertainment
- shopping
- healthcare
- education
- loan-payments
- taxes
- other

### Income Categories
- salary
- pension
- benefits
- rental-income
- investment-income
- business-income
- freelance
- bonus
- tax-refund
- other

## Pagination

For large result sets, use pagination tokens:

```bash
# First request
GET /data/v2/transactions?pageSize=100

# Response includes nextPageToken
{
  "nextPageToken": "abc123...",
  "transactions": [...]
}

# Subsequent requests
GET /data/v2/transactions?pageSize=100&pageToken=abc123...
```
