# Tink API Integration Flow

## Overview

For **Transactions** product, we use **Connectivity v1** API (NOT v2).
v2/consents is only for VRP (Variable Recurring Payments).

## Complete Flow with Tink Link

### Step 1: Get Client Access Token

```bash
POST https://api.tink.com/api/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
grant_type=client_credentials
scope=user:create,authorization:grant
```

**Response:**
```json
{
  "access_token": "CLIENT_TOKEN",
  "expires_in": 1800,
  "token_type": "bearer"
}
```

### Step 2: Create Tink User (if not exists)

```bash
POST https://api.tink.com/api/v1/user/create
Authorization: Bearer CLIENT_TOKEN
Content-Type: application/json

{
  "external_user_id": "user_abc123",
  "market": "PL",
  "locale": "en_US"
}
```

**Response:**
```json
{
  "user_id": "6e68cc6287704273984567b3300c5823",
  "external_user_id": "user_abc123"
}
```

**Note:** 409 response means user already exists (this is OK).

### Step 3: Generate Delegated Authorization Code

This is for Tink Link to use on behalf of our app.

```bash
POST https://api.tink.com/api/v1/oauth/authorization-grant/delegate
Authorization: Bearer CLIENT_TOKEN
Content-Type: application/x-www-form-urlencoded

external_user_id=user_abc123
actor_client_id=df05e4b379934cd09963197cc855bfe9
scope=accounts:read,transactions:read,credentials:write,credentials:read
```

**Response:**
```json
{
  "code": "c50cd6960a6f44ffb701ef60fafa7761"
}
```

**Important:**
- `actor_client_id=df05e4b379934cd09963197cc855bfe9` is Tink Link's official client ID
- Save this `code` - we will exchange it for user tokens AFTER the user connects their bank

### Step 4: Build Tink Link URL

```
https://link.tink.com/1.0/transactions/connect-accounts?
  client_id=YOUR_CLIENT_ID
  redirect_uri=https://firedup.app/banking/tink/callback
  authorization_code=CODE_FROM_STEP_3
  market=PL
  locale=en_US
  state=YOUR_STATE_TOKEN
```

User is redirected to this URL to connect their bank.

### Step 5: Handle Callback

Tink Link redirects back to your redirect_uri with:
- `credentialsId` - The ID of the created credentials (bank connection)
- `state` - Your state token for CSRF verification

**Note:** The callback does NOT contain a code to exchange. We use the code from Step 3!

### Step 6: Exchange Authorization Code for User Access Token

Use the code we generated in Step 3 (NOT anything from the callback).

```bash
POST https://api.tink.com/api/v1/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
code=CODE_FROM_STEP_3
grant_type=authorization_code
```

**Response:**
```json
{
  "access_token": "USER_ACCESS_TOKEN",
  "expires_in": 7200,
  "scope": "accounts:read,transactions:read,credentials:write,credentials:read",
  "token_type": "bearer"
}
```

### Step 7: Use User Token to Access Data

Now we can fetch accounts and transactions:

```bash
GET https://api.tink.com/data/v2/accounts
Authorization: Bearer USER_ACCESS_TOKEN
```

```bash
GET https://api.tink.com/data/v2/transactions
Authorization: Bearer USER_ACCESS_TOKEN
```

## Key Points

1. **Two types of tokens:**
   - Client Token: For app-level operations (create user, generate auth codes)
   - User Token: For accessing user's financial data

2. **For Transactions product, use Connectivity v1:**
   - `/api/v1/credentials` endpoints
   - `/api/v1/provider-consents` for continuous access

3. **The delegation flow:**
   - We generate an auth code using `authorization-grant/delegate`
   - Tink Link uses this code on behalf of our app
   - After the user connects, we exchange THE SAME code for user tokens

4. **external_user_id requirements:**
   - Should be alphanumeric
   - Hash or sanitize email addresses

## Error Handling

- 409 on user creation = User already exists (OK)
- REQUEST_FAILED_FETCH_EXISTING_USER = Problem with user ID or delegation

## References

- Connectivity v1 API: https://docs.tink.com/api-connectivity-v1
- General API (OAuth, Users): https://docs.tink.com/api-general
- Tink Link Reference: https://docs.tink.com/entries/articles/api-reference-bundled-flow
