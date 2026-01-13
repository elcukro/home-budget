# Tink Link Integration

## Overview

Tink Link is a pre-built UI component that handles bank authentication securely. Users are redirected to Tink Link to select their bank and authenticate.

## Tink Link URL Structure

### For Transactions (connect-accounts)

```
https://link.tink.com/1.0/transactions/connect-accounts?
  client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/banking/tink/callback
  &authorization_code=CODE_FROM_DELEGATE
  &market=PL
  &locale=en_US
  &state=YOUR_STATE_TOKEN
```

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Your Tink application client ID |
| `redirect_uri` | Yes | URL to redirect after completion |
| `authorization_code` | Yes | Code from `/authorization-grant/delegate` |
| `market` | Yes | Two-letter country code (e.g., PL, SE, GB) |
| `locale` | No | User's locale (e.g., en_US, pl_PL) |
| `state` | Yes | CSRF protection token (returned in callback) |

## Callback Handling

### Successful Connection

After successful bank connection, Tink Link redirects to your `redirect_uri` with:

```
https://yourapp.com/banking/tink/callback?
  credentialsId=6915ab99857fec1e6f2f6c078
  &state=YOUR_STATE_TOKEN
```

| Parameter | Description |
|-----------|-------------|
| `credentialsId` | ID of the created bank credentials |
| `state` | Your original state token (verify this!) |

**Note:** The callback does NOT contain a code to exchange. Use the code from step 3 of authentication!

### Error Response

```
https://yourapp.com/banking/tink/callback?
  error=BAD_REQUEST
  &error_reason=INVALID_PARAMETER_CLIENT_ID
  &message=We're sorry, an error has occurred.
  &tracking_id=83526f84-226a-43cc-ae2d-2747f394d71b
  &state=YOUR_STATE_TOKEN
```

| Parameter | Description |
|-----------|-------------|
| `error` | Error category code |
| `error_reason` | Specific error reason |
| `message` | User-facing error message |
| `tracking_id` | Tink's internal tracking ID |
| `state` | Your original state token |

### Common Errors

| Error | Reason | Solution |
|-------|--------|----------|
| `BAD_REQUEST` | `INVALID_PARAMETER_CLIENT_ID` | Check client_id |
| `AUTHENTICATION_ERROR` | Various | User failed bank auth |
| `TEMPORARY_ERROR` | Various | Retry later |
| `USER_CANCELLED` | User cancelled | Prompt to try again |

## Complete Flow

```
1. User clicks "Connect Bank"
   ↓
2. Backend: Get client access token
   POST /api/v1/oauth/token (client_credentials)
   ↓
3. Backend: Create Tink user (if not exists)
   POST /api/v1/user/create
   ↓
4. Backend: Generate delegated auth code
   POST /api/v1/oauth/authorization-grant/delegate
   ↓
5. Backend: Build Tink Link URL and return to frontend
   ↓
6. Frontend: Redirect user to Tink Link URL
   ↓
7. User: Selects bank and authenticates
   ↓
8. Tink Link: Redirects back with credentialsId + state
   ↓
9. Frontend: Sends state to backend
   ↓
10. Backend: Exchange stored auth code for user tokens
    POST /api/v1/oauth/token (authorization_code)
    ↓
11. Backend: Fetch accounts using user token
    GET /data/v2/accounts
    ↓
12. Backend: Store connection in database
    ↓
13. Done! User's bank is connected
```

## Supported Markets

Tink supports 6,000+ banks across Europe including:

- **PL (Poland):** ING, PKO BP, mBank, Santander, BNP Paribas
- **SE (Sweden):** Swedbank, Nordea, SEB, Handelsbanken
- **GB (United Kingdom):** Barclays, HSBC, Lloyds, NatWest
- **DE (Germany):** Deutsche Bank, Commerzbank, N26
- **And many more...**
