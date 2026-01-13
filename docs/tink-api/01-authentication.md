# Tink API Authentication

## Overview

Tink uses OAuth 2.0 for authentication. There are two types of tokens:

1. **Client Access Token** - For app-level operations (create users, generate auth codes)
2. **User Access Token** - For accessing user's financial data

## Endpoints

### 1. Get Client Access Token

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
  "token_type": "bearer",
  "expires_in": 1800,
  "scope": "user:create,authorization:grant"
}
```

### 2. Create Permanent User

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

### 3. Generate Delegated Authorization Code

This is for Tink Link to use on behalf of our app.

```bash
POST https://api.tink.com/api/v1/oauth/authorization-grant/delegate
Authorization: Bearer CLIENT_TOKEN
Content-Type: application/x-www-form-urlencoded

response_type=code
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
- `actor_client_id=df05e4b379934cd09963197cc855bfe9` is Tink Link's official client ID (constant)
- Save this `code` - we will exchange it for user tokens AFTER the user connects their bank

### 4. Exchange Authorization Code for User Token

Use the code generated in step 3 (NOT any code from callback).

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
  "token_type": "bearer",
  "expires_in": 7200,
  "scope": "accounts:read,transactions:read,credentials:write,credentials:read"
}
```

## Token Scopes

### Client Token Scopes
- `user:create` - Create Tink users
- `authorization:grant` - Generate delegated auth codes

### User Token Scopes
- `accounts:read` - Read user's accounts
- `transactions:read` - Read user's transactions
- `credentials:read` - Read credentials
- `credentials:write` - Create/update credentials
- `balances:read` - Read account balances

## Important Notes

1. Codes generated via `authorization-grant/delegate` are short-lived
2. Always use HTTPS in production
3. Store tokens securely (encrypted in database)
4. Implement token refresh logic for long-lived access
