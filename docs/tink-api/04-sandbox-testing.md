# Tink Sandbox Testing

## Overview

Tink provides a Sandbox environment for testing your integration without connecting to real banks. The Sandbox includes demo banks with pre-made test users.

## Sandbox vs Production

| Feature | Sandbox | Production |
|---------|---------|------------|
| API URL | `https://api.tink.com` | `https://api.tink.com` |
| Tink Link URL | `https://link.tink.com` | `https://link.tink.com` |
| Bank connections | Demo banks only | Real banks |
| Test users | Pre-made users available | Real user data |
| Credentials | Sandbox app credentials | Production app credentials |

**Note:** Same API endpoints for both, but different client credentials.

## Demo Banks

Tink Sandbox includes demo banks for each market:

### Poland (PL)
- Demo Bank PL
- Sandbox test credentials available in Tink Console

### Other Markets
- SE: Demo Bank SE
- GB: Demo Bank GB
- DE: Demo Bank DE
- etc.

## Test Users (Demo Bank PL)

Tink provides pre-made test users with different scenarios.

### Account Check Users

| User | Username | Password | Description | Scenario |
|------|----------|----------|-------------|----------|
| User 1 | `u51613239` | `cty440` | No account information found | Successful |
| User 2 | `u62019187` | `tod416` | Account Check report with full data | Successful |
| User 3 | `u31492680` | `mmk639` | Account Check report with partial data | Successful |
| User 4 | `u92721594` | `nbs589` | User failed to authenticate | Authentication error |
| User 5 | `u91902655` | `jtx720` | Temporary error with Tink | Temporary error |

### Transactions Users (USE THESE FOR TESTING!)

| User | Username | Password | Description | Scenario |
|------|----------|----------|-------------|----------|
| **User 1** | `u11577912` | `uvj476` | **User with multiple accounts and transactions** | **Successful** |
| User 2 | `u92721594` | `nbs589` | User failed to authenticate | Authentication error |
| User 3 | `u91902655` | `jtx720` | Temporary error with Tink | Temporary error |

**IMPORTANT:** For testing transactions, use **User 1** (`u11577912` / `uvj476`) - this is the only user with transaction data!

## Using Sandbox

### 1. Get Sandbox Credentials

1. Log into Tink Console (https://console.tink.com)
2. Create a Sandbox app (or use existing)
3. Copy Client ID and Client Secret

### 2. Configure Environment

```env
# .env file
TINK_CLIENT_ID=your_sandbox_client_id
TINK_CLIENT_SECRET=your_sandbox_client_secret
TINK_REDIRECT_URI=http://localhost:3000/banking/tink/callback
```

### 3. Test the Flow

1. Start your app locally
2. Click "Connect Bank"
3. Select "Demo Bank" from the list
4. Use demo credentials to login
5. Grant consent
6. Verify callback handling

## Sample Test Data

Demo banks return sample transactions like:

```json
{
  "transactions": [
    {
      "id": "test-txn-001",
      "amount": {
        "currencyCode": "PLN",
        "value": {
          "scale": "2",
          "unscaledValue": "-15000"
        }
      },
      "descriptions": {
        "display": "Test Grocery Store",
        "original": "TEST GROCERY 001"
      },
      "dates": {
        "booked": "2026-01-10"
      }
    }
  ]
}
```

## Moving to Production

When ready for production:

1. Apply for production access in Tink Console
2. Complete KYC/compliance requirements
3. Get production credentials
4. Update environment variables
5. Test with real bank (your own account first)

## Debugging Tips

### Check Credentials
```bash
# Test client credentials grant
curl -X POST https://api.tink.com/api/v1/oauth/token \
  -d "client_id=$TINK_CLIENT_ID" \
  -d "client_secret=$TINK_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=user:create"
```

### Common Sandbox Issues

1. **Invalid client_id**: Verify you're using sandbox credentials
2. **User already exists**: 409 is OK, just proceed
3. **Token expired**: Generate a new auth code
4. **Demo bank not showing**: Check market parameter matches your app config

## Rate Limits

Sandbox has lower rate limits than production:
- 100 requests/minute
- 1000 requests/day

Production limits are higher and based on your plan.
