# Tink API Integration Implementation Guide

**Date:** January 12, 2026
**Author:** Architecture Analysis & Implementation Plan
**Version:** 1.0

---

## Executive Summary

This document outlines the implementation plan for integrating Tink API into the Home Budget application to **replace manual transaction entry with automatic bank transaction import**. The primary goal is to eliminate the tedious manual input of income and expenses by automatically fetching and categorizing transactions from connected bank accounts (ING, PKO BP, mBank).

**Key Benefits:**
- ✅ **Automatic transaction import** from Polish banks (ING, PKO BP, mBank)
- ✅ **AI-powered categorization** with 14 expense categories & 21 income subtypes
- ✅ **Reduced manual work** - users only review and confirm imported transactions
- ✅ **Cost-effective** - €0.50/user/month (easily included in subscription pricing)
- ✅ **Better data accuracy** - transactions match real bank statements
- ✅ **Enriched data** - merchant names, transaction descriptions, amounts in correct currency

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Tink API Overview](#2-tink-api-overview)
3. [Key Implementation Goals](#3-key-implementation-goals)
4. [Technical Architecture](#4-technical-architecture)
5. [Database Schema Changes](#5-database-schema-changes)
6. [API Endpoints](#6-api-endpoints)
7. [Data Flow](#7-data-flow)
8. [Implementation Phases](#8-implementation-phases)
9. [Code Changes Required](#9-code-changes-required)
10. [Testing Strategy](#10-testing-strategy)
11. [Rollout Plan](#11-rollout-plan)
12. [References](#12-references)

---

## 1. Current State Analysis

### 1.1 Existing Banking Integration (GoCardless)

Your app currently has **GoCardless Bank Account Data API** integrated:

**File:** `backend/app/routers/banking.py`

**Capabilities:**
- ✅ Connect to banks (ING, PKO BP, mBank supported)
- ✅ Fetch transactions via `/accounts/{account_id}/transactions`
- ✅ Store bank connections in `banking_connections` table
- ✅ OAuth flow for bank authorization (90-day requisitions)

**Transaction Data Structure (GoCardless):**
```json
{
  "transactions": {
    "booked": [
      {
        "transactionId": "...",
        "debtorName": "John Doe",
        "transactionAmount": {
          "currency": "PLN",
          "amount": "150.00"
        },
        "bookingDate": "2026-01-10",
        "remittanceInformationUnstructured": "TESCO GROCERIES"
      }
    ],
    "pending": [...]
  }
}
```

**Current Limitations:**
- ❌ **No automatic import** - transactions are fetched but not saved to Income/Expense tables
- ❌ **No categorization** - raw transaction data, no income vs expense detection
- ❌ **Manual entry still required** - users must manually type in each transaction
- ❌ **Disconnected data** - bank transactions and Income/Expense tables are separate

### 1.2 Current Manual Entry Flow

**User Journey:**
1. User logs into Home Budget app
2. Navigates to Income or Expenses page
3. Clicks "Add Income" or "Add Expense"
4. Manually fills out form:
   - Category (dropdown)
   - Description (text)
   - Amount (number)
   - Date (date picker)
   - Recurring (checkbox)
5. Submits form → Saved to `income` or `expenses` table

**Pain Points:**
- ⚠️ **Time-consuming** - typing each transaction takes 30-60 seconds
- ⚠️ **Error-prone** - typos in amounts, wrong dates, missed transactions
- ⚠️ **Low adoption** - users give up after a few weeks
- ⚠️ **Duplicate work** - bank already has this data

### 1.3 Database Models (Current)

**Income Table:**
```python
class Income(Base):
    __tablename__ = "income"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)          # e.g., "Salary", "Freelance"
    description = Column(String)        # e.g., "December salary"
    amount = Column(Float)              # e.g., 5000.00
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

**Expense Table:**
```python
class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    category = Column(String)          # e.g., "Groceries", "Utilities"
    description = Column(String)        # e.g., "Tesco shopping"
    amount = Column(Float)              # e.g., 150.00
    is_recurring = Column(Boolean, default=False)
    date = Column(Date)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
```

**BankingConnection Table:**
```python
class BankingConnection(Base):
    __tablename__ = "banking_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    institution_id = Column(String)
    institution_name = Column(String)
    requisition_id = Column(String, unique=True)
    accounts = Column(JSON)            # List of account IDs
    account_names = Column(JSON)       # Map of account_id → name
    expires_at = Column(DateTime)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
```

**Key Observation:**
- No linkage between `BankingConnection` and `Income`/`Expense` tables
- No storage of raw bank transactions
- No deduplication mechanism

---

## 2. Tink API Overview

### 2.1 What is Tink?

**Tink** (owned by Visa) is Europe's leading open banking platform with:
- 6,000+ bank connections across Europe
- Strong PSD2 compliance
- **Automatic transaction categorization** with AI/ML
- Enriched transaction data (merchant info, categories)
- €0.50/user/month pricing (Standard tier)

### 2.2 Tink API Capabilities

#### Authentication Flow (Tink Link)
- **OAuth 2.0** standard
- **Tink Link SDK** - pre-built UI for bank connection
- User flow:
  1. User clicks "Connect Bank"
  2. Redirected to `https://link.tink.com/...`
  3. Selects bank (ING, PKO BP, mBank)
  4. Authenticates with bank credentials
  5. Grants consent for data access
  6. Redirected back to your app with authorization code
  7. Exchange code for access token

#### Transaction Endpoints
```
GET /api/v1/transactions
GET /api/v1/accounts/{accountId}/transactions
```

#### Transaction Response Format (Tink)
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
          "unscaledValue": "-15000"  // -150.00 PLN
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
      "enrichedData": {
        "categories": {
          "pfm": {
            "id": "groceries",
            "name": "Groceries"
          }
        }
      },
      "identifiers": {
        "providerTransactionId": "500015d3-acf3-48cc-9918-9e53738d3692"
      },
      "merchantInformation": {
        "merchantCategoryCode": "5411",
        "merchantName": "Tesco"
      },
      "types": ["DEFAULT"]
    }
  ]
}
```

#### Automatic Categorization

**Expense Categories (14 total):**
- Groceries
- Restaurants & Dining
- Transportation
- Utilities
- Insurance
- Housing (mortgage, rent, cleaning)
- Entertainment
- Shopping
- Healthcare
- Education
- Loan Payments
- Taxes
- Collections (debt)
- Other

**Income Subtypes (21 total):**
- Salary
- Pension
- Benefits
- Rental Income
- Investment Income
- Business Income
- Freelance Income
- Bonus
- Tax Refund
- etc.

**How it works:**
- Tink analyzes transaction date, frequency, size, stability, and description
- Uses ML models trained on millions of transactions
- Automatically assigns category with high accuracy (~85-95%)

### 2.3 Pricing

**Standard Tier:**
- €0.50/user/month for transaction data
- €0.25/verification for account checks
- 6,000+ bank connections included
- Basic support

**Your cost structure (example):**
- 100 users: €50/month (€600/year)
- 1,000 users: €500/month (€6,000/year)
- Easily covered by charging €4.99-9.99/month subscription

---

## 3. Key Implementation Goals

### 3.1 Primary Goal
**Replace manual transaction entry with automatic bank import.**

Users should:
1. Connect their bank account (one-time setup)
2. Transactions automatically sync daily
3. Review imported transactions (accept/reject/edit)
4. Transactions auto-categorized as Income or Expense

### 3.2 Secondary Goals
- **Deduplication:** Prevent duplicate entries if user manually added same transaction
- **Reconciliation:** Allow users to link manual entries with imported transactions
- **Multi-account support:** Users with multiple bank accounts (ING + PKO + mBank)
- **Historical import:** Fetch past 90 days of transactions on first connection
- **Recurring detection:** Identify recurring transactions (salary, rent, subscriptions)

### 3.3 Success Metrics
- **Manual entries reduced by 80%+**
- **User engagement increased** (fewer dropoffs)
- **Data accuracy improved** (amounts match bank statements)
- **Time saved:** 10-15 minutes per week per user

---

## 4. Technical Architecture

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │   Income     │  │   Expenses   │          │
│  │  - Summary   │  │  - Review    │  │  - Review    │          │
│  │  - Activity  │  │  - Sync      │  │  - Sync      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │
          │         API Calls (JSON)            │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼───────────────────┐
│                    Next.js Frontend (Port 3000)                    │
│  /api/banking/connect      /api/transactions/sync                 │
│  /api/transactions/import  /api/income/import                     │
│  /api/expenses/import      /api/transactions/review               │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                    HTTP Requests
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                 FastAPI Backend (Port 8000)                        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Banking Router                                              │ │
│  │  - /banking/tink/connect     (initiate Tink Link)          │ │
│  │  - /banking/tink/callback    (handle OAuth callback)       │ │
│  │  - /banking/tink/accounts    (list connected accounts)     │ │
│  │  - /banking/tink/disconnect  (remove connection)           │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Transactions Router                                         │ │
│  │  - /transactions/sync        (trigger manual sync)          │ │
│  │  - /transactions/pending     (get unreviewed transactions)  │ │
│  │  - /transactions/accept      (accept as income/expense)     │ │
│  │  - /transactions/reject      (mark as ignored)              │ │
│  │  - /transactions/edit        (edit before accepting)        │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Background Tasks (Celery/APScheduler)                       │ │
│  │  - Daily sync job (fetch new transactions for all users)    │ │
│  │  - Auto-categorization engine                               │ │
│  │  - Deduplication checker                                    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                    Database Queries
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                      PostgreSQL Database                            │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   users     │  │   income    │  │  expenses   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │   bank_transactions (NEW)                                   │  │
│  │   - Raw transactions from Tink                              │  │
│  │   - Status: pending/accepted/rejected/ignored               │  │
│  │   - Linked to income_id or expense_id when accepted         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │   tink_connections (NEW)                                    │  │
│  │   - Tink user access tokens                                 │  │
│  │   - Account IDs, refresh tokens                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└────────────────────────────┬───────────────────────────────────────┘
                             │
┌────────────────────────────▼───────────────────────────────────────┐
│                     Tink API (External)                             │
│  - OAuth endpoints                                                  │
│  - Transaction endpoints                                            │
│  - Account endpoints                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Key Components

#### 4.2.1 Tink Connection Service
**Purpose:** Handle OAuth flow and maintain Tink API tokens

**Responsibilities:**
- Initiate Tink Link flow
- Handle OAuth callback
- Store/refresh access tokens
- Manage user consent

#### 4.2.2 Transaction Sync Service
**Purpose:** Fetch transactions from Tink and store in database

**Responsibilities:**
- Fetch transactions from Tink API (paginated)
- Parse Tink response format
- Store in `bank_transactions` table
- Check for duplicates
- Trigger categorization

#### 4.2.3 Categorization Engine
**Purpose:** Map Tink categories to app Income/Expense categories

**Responsibilities:**
- Analyze transaction amount (negative = expense, positive = income)
- Map Tink category to app category
- Detect recurring patterns
- Calculate confidence score

#### 4.2.4 Deduplication Service
**Purpose:** Prevent duplicate transactions

**Responsibilities:**
- Check if transaction already imported
- Check if user manually entered same transaction
- Use fuzzy matching (date ±2 days, amount ±1%, description similarity)
- Suggest merge if duplicate found

#### 4.2.5 Review UI
**Purpose:** User interface for reviewing imported transactions

**Responsibilities:**
- Display pending transactions
- Allow accept/reject/edit
- Show suggested category
- Bulk actions (accept all, reject all)

---

## 5. Database Schema Changes

### 5.1 New Tables

#### Table: `tink_connections`
Stores Tink API connections and tokens per user.

```python
class TinkConnection(Base):
    __tablename__ = "tink_connections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Tink OAuth tokens
    tink_user_id = Column(String, unique=True, nullable=False)  # Tink's internal user ID
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    token_expires_at = Column(DateTime, nullable=False)

    # Tink authorization metadata
    authorization_code = Column(String, nullable=True)
    scopes = Column(String, default="accounts:read,transactions:read")

    # Connected accounts
    accounts = Column(JSON)  # List of Tink account IDs
    account_details = Column(JSON)  # Map of account_id → {name, iban, currency}

    # Status
    is_active = Column(Boolean, default=True)
    last_sync_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationship
    user = relationship("User", back_populates="tink_connections")

    __table_args__ = (
        Index('idx_tink_connections_user_id', 'user_id'),
        Index('idx_tink_connections_tink_user_id', 'tink_user_id'),
    )
```

#### Table: `bank_transactions`
Stores raw transactions fetched from Tink before they're accepted as Income/Expense.

```python
from sqlalchemy.dialects.postgresql import JSONB

class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))

    # Tink transaction identifiers
    tink_transaction_id = Column(String, unique=True, nullable=False, index=True)
    tink_account_id = Column(String, nullable=False)
    provider_transaction_id = Column(String, nullable=True)

    # Transaction details
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=False, default="PLN")
    date = Column(Date, nullable=False, index=True)
    booked_datetime = Column(DateTime, nullable=True)

    # Descriptions
    description_display = Column(String, nullable=False)  # "Tesco"
    description_original = Column(String, nullable=True)  # "TESCO STORES 3297"
    description_detailed = Column(String, nullable=True)  # Full unstructured text

    # Merchant info
    merchant_name = Column(String, nullable=True)
    merchant_category_code = Column(String, nullable=True)

    # Categorization (from Tink)
    tink_category_id = Column(String, nullable=True)
    tink_category_name = Column(String, nullable=True)

    # Our categorization
    suggested_type = Column(String, nullable=True)  # "income" or "expense"
    suggested_category = Column(String, nullable=True)  # "Groceries", "Salary", etc.
    confidence_score = Column(Float, default=0.0)  # 0.0 to 1.0

    # Status workflow
    status = Column(String, default="pending", nullable=False)
    # Status values:
    # - "pending": Awaiting user review
    # - "accepted": User accepted, converted to Income/Expense
    # - "rejected": User rejected (not relevant)
    # - "ignored": System flagged as duplicate/irrelevant
    # - "edited": User edited before accepting

    # Linkage to Income/Expense
    linked_income_id = Column(Integer, ForeignKey("income.id"), nullable=True)
    linked_expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)

    # Raw data from Tink (for debugging/audit)
    raw_data = Column(JSONB, nullable=True)

    # Metadata
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="bank_transactions")
    linked_income = relationship("Income", foreign_keys=[linked_income_id])
    linked_expense = relationship("Expense", foreign_keys=[linked_expense_id])

    __table_args__ = (
        Index('idx_bank_transactions_user_id', 'user_id'),
        Index('idx_bank_transactions_status', 'status'),
        Index('idx_bank_transactions_date', 'date'),
        Index('idx_bank_transactions_tink_id', 'tink_transaction_id'),
    )
```

### 5.2 Modified Tables

#### Update: `users` table
Add relationship to new tables:

```python
class User(Base):
    # ... existing fields ...

    # Add new relationships
    tink_connections = relationship("TinkConnection", back_populates="user", cascade="all, delete-orphan")
    bank_transactions = relationship("BankTransaction", back_populates="user", cascade="all, delete-orphan")
```

#### Update: `income` table
Add field to track if from bank import:

```python
class Income(Base):
    # ... existing fields ...

    # New fields
    source = Column(String, default="manual")  # "manual" or "bank_import"
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
```

#### Update: `expenses` table
Add field to track if from bank import:

```python
class Expense(Base):
    # ... existing fields ...

    # New fields
    source = Column(String, default="manual")  # "manual" or "bank_import"
    bank_transaction_id = Column(Integer, ForeignKey("bank_transactions.id"), nullable=True)
```

### 5.3 Database Migrations

**Using Alembic:**

```bash
# Create migration
cd backend
alembic revision -m "Add Tink integration tables"

# Apply migration
alembic upgrade head
```

**Migration script:** `/backend/alembic/versions/xxxx_add_tink_integration.py`

---

## 6. API Endpoints

### 6.1 Tink Connection Endpoints

#### `POST /api/banking/tink/connect`
Initiate Tink Link flow to connect user's bank account.

**Request:**
```json
{
  "redirect_uri": "https://yourapp.com/banking/callback",
  "locale": "pl_PL"
}
```

**Response:**
```json
{
  "tink_link_url": "https://link.tink.com/1.0/authorize/?client_id=...&redirect_uri=...",
  "state": "random_state_token"
}
```

**Frontend action:** Redirect user to `tink_link_url`

---

#### `GET /api/banking/tink/callback`
Handle OAuth callback after user authorizes bank connection.

**Query params:**
- `code`: Authorization code from Tink
- `state`: State token for CSRF protection

**Process:**
1. Exchange authorization code for access token
2. Fetch Tink user ID
3. Store in `tink_connections` table
4. Fetch and store connected accounts
5. Trigger initial transaction sync

**Response:**
```json
{
  "success": true,
  "connection_id": 123,
  "accounts": [
    {
      "id": "tink_account_id_1",
      "name": "ING Checking Account",
      "iban": "PL...",
      "currency": "PLN"
    }
  ]
}
```

---

#### `GET /api/banking/tink/connections`
List user's Tink connections and connected accounts.

**Response:**
```json
{
  "connections": [
    {
      "id": 123,
      "is_active": true,
      "last_sync_at": "2026-01-12T10:30:00Z",
      "accounts": [
        {
          "id": "tink_account_id_1",
          "name": "ING Checking",
          "iban": "PL...",
          "currency": "PLN"
        }
      ]
    }
  ]
}
```

---

#### `DELETE /api/banking/tink/connections/{connection_id}`
Disconnect a Tink connection.

**Response:**
```json
{
  "success": true,
  "message": "Tink connection disconnected"
}
```

---

### 6.2 Transaction Sync Endpoints

#### `POST /api/transactions/sync`
Manually trigger transaction sync for current user.

**Request:**
```json
{
  "account_id": "tink_account_id_1",  // Optional, sync specific account
  "from_date": "2026-01-01",           // Optional, default: last sync date
  "to_date": "2026-01-12"              // Optional, default: today
}
```

**Response:**
```json
{
  "success": true,
  "synced_count": 45,
  "new_transactions": 12,
  "duplicates_found": 3,
  "pending_review": 12
}
```

---

#### `GET /api/transactions/pending`
Get transactions awaiting user review.

**Query params:**
- `type`: Filter by "income" or "expense" (optional)
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset

**Response:**
```json
{
  "transactions": [
    {
      "id": 456,
      "tink_transaction_id": "...",
      "date": "2026-01-10",
      "amount": -150.00,
      "currency": "PLN",
      "description": "Tesco",
      "merchant_name": "Tesco Stores",
      "suggested_type": "expense",
      "suggested_category": "Groceries",
      "confidence_score": 0.95,
      "status": "pending"
    }
  ],
  "total": 12,
  "has_more": false
}
```

---

#### `POST /api/transactions/{transaction_id}/accept`
Accept a transaction and create Income or Expense entry.

**Request:**
```json
{
  "type": "expense",  // "income" or "expense"
  "category": "Groceries",
  "description": "Tesco shopping",  // Optional override
  "amount": 150.00,                 // Optional override
  "date": "2026-01-10",             // Optional override
  "is_recurring": false
}
```

**Process:**
1. Create `Income` or `Expense` record
2. Update `bank_transactions.status` to "accepted"
3. Link via `linked_income_id` or `linked_expense_id`
4. Mark `bank_transactions.reviewed_at`

**Response:**
```json
{
  "success": true,
  "created_type": "expense",
  "created_id": 789,
  "message": "Transaction accepted and added to expenses"
}
```

---

#### `POST /api/transactions/{transaction_id}/reject`
Reject a transaction (mark as not relevant).

**Response:**
```json
{
  "success": true,
  "message": "Transaction rejected"
}
```

---

#### `POST /api/transactions/bulk-accept`
Accept multiple transactions at once.

**Request:**
```json
{
  "transaction_ids": [456, 457, 458],
  "accept_all": true  // Accept with suggested categories
}
```

**Response:**
```json
{
  "success": true,
  "accepted_count": 3,
  "created": {
    "income": 1,
    "expenses": 2
  }
}
```

---

### 6.3 Category Mapping Endpoints

#### `GET /api/transactions/category-mappings`
Get Tink category → App category mappings.

**Response:**
```json
{
  "expense_mappings": {
    "groceries": "Groceries",
    "restaurants-dining": "Food & Dining",
    "transportation": "Transportation",
    "utilities": "Utilities"
  },
  "income_mappings": {
    "salary": "Salary",
    "pension": "Pension",
    "freelance": "Freelance"
  }
}
```

---

## 7. Data Flow

### 7.1 Initial Connection Flow

```
┌──────────┐                                      ┌──────────┐
│  User    │                                      │  Tink    │
└────┬─────┘                                      └────┬─────┘
     │                                                  │
     │ 1. Click "Connect Bank"                         │
     ├─────────────────────────────────────────────────┤
     │                                                  │
     │ 2. Redirect to Tink Link                        │
     │    (with client_id, redirect_uri, scope)        │
     ├─────────────────────────────────────────────────▶
     │                                                  │
     │ 3. User selects bank (ING/PKO/mBank)            │
     │                                                  │
     │ 4. User authenticates with bank credentials     │
     │                                                  │
     │ 5. User grants consent for data access          │
     │                                                  │
     │ 6. Redirect back with authorization code        │
     ◀─────────────────────────────────────────────────┤
     │                                                  │
┌────▼─────┐                                      ┌────▼─────┐
│  Backend │                                      │  Tink    │
└────┬─────┘                                      └────┬─────┘
     │                                                  │
     │ 7. Exchange code for access token               │
     ├─────────────────────────────────────────────────▶
     │                                                  │
     │ 8. Receive access_token + refresh_token         │
     ◀─────────────────────────────────────────────────┤
     │                                                  │
     │ 9. Fetch user's accounts                        │
     ├─────────────────────────────────────────────────▶
     │                                                  │
     │ 10. Receive account list                        │
     ◀─────────────────────────────────────────────────┤
     │                                                  │
     │ 11. Store in tink_connections table             │
     │                                                  │
     │ 12. Trigger initial transaction sync            │
     │     (fetch last 90 days)                        │
     ├─────────────────────────────────────────────────▶
     │                                                  │
     │ 13. Receive transactions (paginated)            │
     ◀─────────────────────────────────────────────────┤
     │                                                  │
     │ 14. Parse and store in bank_transactions        │
     │                                                  │
     │ 15. Run categorization engine                   │
     │                                                  │
     │ 16. Check for duplicates                        │
     │                                                  │
┌────▼─────┐                                           │
│ Database │                                           │
└──────────┘                                           │
     │                                                  │
     │ 17. Transactions ready for user review          │
     │                                                  │
```

### 7.2 Daily Sync Flow (Automated)

```
┌────────────┐                                    ┌──────────┐
│  Scheduler │                                    │  Tink    │
│  (Daily)   │                                    │   API    │
└─────┬──────┘                                    └────┬─────┘
      │                                                │
      │ 1. Trigger sync job (all active users)        │
      │                                                │
      │ For each user with tink_connection:           │
      │                                                │
      │ 2. Check if token expired                     │
      │                                                │
      │ 3. Refresh token if needed                    │
      ├───────────────────────────────────────────────▶
      │                                                │
      │ 4. Fetch new transactions                     │
      │    (from last_sync_at to now)                 │
      ├───────────────────────────────────────────────▶
      │                                                │
      │ 5. Receive new transactions                   │
      ◀───────────────────────────────────────────────┤
      │                                                │
      │ 6. Check each transaction:                    │
      │    - Already imported? (by tink_transaction_id)
      │    - Duplicate of manual entry?               │
      │                                                │
      │ 7. Store new transactions in bank_transactions│
      │                                                │
      │ 8. Run categorization:                        │
      │    - Positive amount → Income                 │
      │    - Negative amount → Expense                │
      │    - Map Tink category to app category        │
      │                                                │
      │ 9. Set suggested_type, suggested_category     │
      │                                                │
      │ 10. Update last_sync_at timestamp             │
      │                                                │
      │ 11. Send notification to user (optional)      │
      │     "12 new transactions ready for review"    │
      │                                                │
```

### 7.3 User Review Flow

```
┌──────────┐                                    ┌──────────┐
│  User    │                                    │ Backend  │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │ 1. Navigate to "Review Transactions"          │
     ├───────────────────────────────────────────────▶
     │                                                │
     │ 2. GET /api/transactions/pending              │
     ◀───────────────────────────────────────────────┤
     │                                                │
     │ 3. Display list of pending transactions       │
     │    with suggested categories                  │
     │                                                │
     │ User reviews transaction #456:                │
     │ - Amount: -150 PLN                            │
     │ - Description: "Tesco"                        │
     │ - Suggested: Expense → Groceries              │
     │                                                │
     │ 4. User clicks "Accept"                       │
     ├───────────────────────────────────────────────▶
     │                                                │
     │ 5. POST /api/transactions/456/accept          │
     │    { type: "expense", category: "Groceries" } │
     │                                                │
     │ Backend process:                              │
     │ 6. Create Expense record:                     │
     │    - user_id                                  │
     │    - category: "Groceries"                    │
     │    - description: "Tesco"                     │
     │    - amount: 150.00                           │
     │    - date: 2026-01-10                         │
     │    - source: "bank_import"                    │
     │    - bank_transaction_id: 456                 │
     │                                                │
     │ 7. Update BankTransaction #456:               │
     │    - status: "accepted"                       │
     │    - linked_expense_id: 789                   │
     │    - reviewed_at: now()                       │
     │                                                │
     │ 8. Create Activity log entry                  │
     │                                                │
     │ 9. Mark insights cache as stale               │
     │                                                │
     │ 10. Return success response                   │
     ◀───────────────────────────────────────────────┤
     │                                                │
     │ 11. Update UI, remove from pending list       │
     │                                                │
```

---

## 8. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up Tink API integration and database schema

**Tasks:**
- [ ] Sign up for Tink account, get API credentials
- [ ] Create Tink app in Tink Console
- [ ] Set up redirect URIs (dev + production)
- [ ] Add Tink credentials to `.env` files
- [ ] Create database migrations for new tables
- [ ] Create `TinkConnection` model
- [ ] Create `BankTransaction` model
- [ ] Update `Income` and `Expense` models
- [ ] Run migrations on dev database
- [ ] Write unit tests for models

**Deliverables:**
- ✅ Tink account created
- ✅ Database schema updated
- ✅ Models created and tested

---

### Phase 2: Tink Authentication (Week 2-3)

**Goal:** Implement Tink Link OAuth flow

**Backend tasks:**
- [ ] Create `/banking/tink/connect` endpoint
- [ ] Create `/banking/tink/callback` endpoint
- [ ] Implement token exchange logic
- [ ] Implement token refresh logic
- [ ] Store connection in `tink_connections` table
- [ ] Create service class: `TinkAuthService`
- [ ] Add error handling for failed connections
- [ ] Write integration tests

**Frontend tasks:**
- [ ] Create "Connect Bank" button in Settings page
- [ ] Implement redirect to Tink Link
- [ ] Create callback page `/banking/callback`
- [ ] Handle connection success/failure states
- [ ] Display connected accounts in Settings
- [ ] Add "Disconnect" button

**Deliverables:**
- ✅ Users can connect bank accounts via Tink
- ✅ Connections stored in database
- ✅ UI shows connected accounts

---

### Phase 3: Transaction Sync (Week 3-4)

**Goal:** Fetch transactions from Tink and store in database

**Backend tasks:**
- [ ] Create `TinkTransactionService` class
- [ ] Implement `fetch_transactions()` method
  - Pagination handling
  - Date range filtering
  - Error handling (rate limits, timeouts)
- [ ] Parse Tink transaction response
- [ ] Map to `BankTransaction` model
- [ ] Store in database
- [ ] Implement initial sync (90 days history)
- [ ] Create `/transactions/sync` endpoint
- [ ] Write tests for sync logic

**Frontend tasks:**
- [ ] Create "Sync Transactions" button
- [ ] Show sync progress (loading state)
- [ ] Display sync results (e.g., "12 new transactions imported")
- [ ] Handle sync errors gracefully

**Deliverables:**
- ✅ Transactions fetched from Tink
- ✅ Stored in `bank_transactions` table
- ✅ Manual sync working

---

### Phase 4: Categorization Engine (Week 4-5)

**Goal:** Auto-categorize transactions as Income or Expense

**Backend tasks:**
- [ ] Create `CategorizationService` class
- [ ] Implement amount-based logic:
  - Positive amount → Income
  - Negative amount → Expense
- [ ] Map Tink categories to app categories:
  - Create mapping dictionary (Tink category → App category)
  - Handle unmapped categories (default to "Other")
- [ ] Calculate confidence score:
  - 1.0 if Tink category exists
  - 0.5 if no Tink category (amount-based only)
- [ ] Set `suggested_type` and `suggested_category`
- [ ] Handle recurring transaction detection (optional)
- [ ] Write unit tests for categorization logic

**Category Mapping Example:**
```python
TINK_TO_APP_CATEGORY_MAPPING = {
    # Expenses
    "groceries": "Groceries",
    "restaurants-dining": "Food & Dining",
    "transportation": "Transportation",
    "utilities": "Utilities",
    "insurance": "Insurance",
    "housing": "Housing",
    "entertainment": "Entertainment",
    "shopping": "Shopping",
    "healthcare": "Health & Fitness",
    "education": "Education",
    "loan-payments": "Debt Payment",
    "taxes": "Taxes",

    # Income
    "salary": "Salary",
    "pension": "Pension",
    "benefits": "Benefits",
    "rental-income": "Rental Income",
    "investment-income": "Investment Income",
    "business-income": "Business Income",
    "freelance": "Freelance",
}
```

**Deliverables:**
- ✅ Transactions auto-categorized
- ✅ `suggested_type` and `suggested_category` populated
- ✅ Confidence scores calculated

---

### Phase 5: Deduplication (Week 5)

**Goal:** Detect and prevent duplicate transactions

**Backend tasks:**
- [ ] Create `DeduplicationService` class
- [ ] Implement duplicate detection logic:
  - Check by `tink_transaction_id` (exact duplicate from Tink)
  - Check against manual entries:
    - Same user_id
    - Same date (±2 days tolerance)
    - Same amount (±1% tolerance)
    - Description similarity (fuzzy match, >80% similarity)
- [ ] Mark duplicates:
  - Set `is_duplicate = True`
  - Set `duplicate_of` foreign key
  - Set `status = "ignored"`
- [ ] Create endpoint to suggest merges
- [ ] Write tests for deduplication

**Frontend tasks:**
- [ ] Show duplicate warnings in review UI
- [ ] Allow user to confirm "not a duplicate"
- [ ] Allow user to merge with existing entry

**Deliverables:**
- ✅ Duplicate transactions detected
- ✅ Users can resolve duplicates

---

### Phase 6: Review UI (Week 6-7)

**Goal:** Build user interface for reviewing pending transactions

**Frontend tasks:**
- [ ] Create new page: `/transactions/review`
- [ ] Create component: `TransactionReviewCard`
  - Display transaction details
  - Show suggested category (with confidence badge)
  - Action buttons: Accept / Reject / Edit
- [ ] Implement filtering:
  - Filter by type (Income / Expense)
  - Filter by date range
  - Filter by status
- [ ] Implement bulk actions:
  - "Accept All" button
  - "Reject All" button
  - Select multiple transactions
- [ ] Create "Edit Transaction" modal
  - Allow override of category, description, amount
- [ ] Add to navigation menu
- [ ] Add badge showing pending count

**API Integration:**
- [ ] Connect to `/api/transactions/pending`
- [ ] Connect to `/api/transactions/{id}/accept`
- [ ] Connect to `/api/transactions/{id}/reject`
- [ ] Connect to `/api/transactions/bulk-accept`

**Deliverables:**
- ✅ Review page created
- ✅ Users can accept/reject transactions
- ✅ Bulk actions working

---

### Phase 7: Background Sync (Week 7-8)

**Goal:** Automate daily transaction sync

**Backend tasks:**
- [ ] Choose scheduler: APScheduler or Celery
- [ ] Create background job: `daily_transaction_sync`
- [ ] Iterate over all active `tink_connections`
- [ ] For each user:
  - Refresh token if expired
  - Fetch new transactions (from `last_sync_at` to now)
  - Store in database
  - Run categorization
  - Update `last_sync_at`
- [ ] Schedule job to run daily at 6 AM
- [ ] Add error handling and retry logic
- [ ] Log sync results
- [ ] Send optional notification to user

**Optional: Real-time sync**
- [ ] Implement webhook from Tink (if supported)
- [ ] Handle webhook events

**Deliverables:**
- ✅ Daily sync running automatically
- ✅ Users' transactions always up-to-date

---

### Phase 8: UI Polish & Integration (Week 8-9)

**Goal:** Integrate review flow into existing app

**Tasks:**
- [ ] Add "Review Transactions" link to Dashboard
- [ ] Show pending transaction count in Dashboard summary
- [ ] Add quick-review widget to Dashboard:
  - Show 3-5 pending transactions
  - Inline accept/reject buttons
- [ ] Update Income/Expenses pages:
  - Show source badge ("Manual" vs "Bank Import")
  - Allow filtering by source
- [ ] Add tooltips explaining auto-categorization
- [ ] Add onboarding tour for new users
- [ ] Update Settings page:
  - Show sync status
  - Show last sync time
  - Manual sync button
- [ ] Improve mobile responsiveness

**Deliverables:**
- ✅ Seamless user experience
- ✅ Bank imports visible throughout app

---

### Phase 9: Testing & QA (Week 9-10)

**Goal:** Comprehensive testing before production launch

**Tasks:**
- [ ] Unit tests (backend services)
- [ ] Integration tests (API endpoints)
- [ ] E2E tests (Playwright/Cypress)
  - Connect bank flow
  - Sync transactions flow
  - Accept transaction flow
  - Reject transaction flow
- [ ] Manual QA testing:
  - Test with real Polish banks (ING, PKO, mBank)
  - Test edge cases (zero amounts, refunds, transfers)
  - Test error scenarios (expired token, rate limits)
- [ ] Performance testing:
  - Large transaction volumes (1000+ transactions)
  - Multiple bank connections
  - Concurrent sync jobs
- [ ] Security review:
  - Token storage security
  - API authentication
  - Data encryption

**Deliverables:**
- ✅ All tests passing
- ✅ No critical bugs

---

### Phase 10: Production Deployment (Week 10-11)

**Goal:** Deploy to production and migrate existing users

**Tasks:**
- [ ] Set up production Tink credentials
- [ ] Run database migrations on production
- [ ] Deploy backend changes
- [ ] Deploy frontend changes
- [ ] Update documentation
- [ ] Create user guide (with screenshots)
- [ ] Announce feature to users
- [ ] Monitor error logs
- [ ] Gather user feedback

**Migration strategy:**
- [ ] Enable feature for beta users first (10-20 users)
- [ ] Monitor for 1 week
- [ ] Fix any issues
- [ ] Roll out to 50% of users
- [ ] Monitor for 1 week
- [ ] Roll out to 100% of users

**Deliverables:**
- ✅ Feature live in production
- ✅ Users connecting banks and importing transactions

---

## 9. Code Changes Required

### 9.1 Backend Changes

#### File: `backend/app/routers/tink.py` (NEW)

```python
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, TinkConnection
from ..services.tink_auth_service import TinkAuthService
from pydantic import BaseModel

router = APIRouter(
    prefix="/banking/tink",
    tags=["tink"],
)

tink_auth = TinkAuthService()

class ConnectRequest(BaseModel):
    redirect_uri: str
    locale: str = "pl_PL"

@router.post("/connect")
async def connect_bank(
    request: ConnectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initiate Tink Link flow"""
    try:
        tink_link_url, state = tink_auth.generate_tink_link_url(
            user_id=current_user.id,
            redirect_uri=request.redirect_uri,
            locale=request.locale
        )

        return {
            "tink_link_url": tink_link_url,
            "state": state
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/callback")
async def handle_callback(
    code: str = Query(...),
    state: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Handle OAuth callback from Tink"""
    try:
        # Verify state token
        # Exchange code for tokens
        # Store connection
        # Trigger initial sync
        connection = await tink_auth.handle_callback(
            code=code,
            state=state,
            user_id=current_user.id,
            db=db
        )

        return {
            "success": True,
            "connection_id": connection.id,
            "accounts": connection.accounts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ... more endpoints ...
```

#### File: `backend/app/services/tink_auth_service.py` (NEW)

```python
import httpx
import os
from datetime import datetime, timedelta
from ..models import TinkConnection

class TinkAuthService:
    def __init__(self):
        self.client_id = os.getenv("TINK_CLIENT_ID")
        self.client_secret = os.getenv("TINK_CLIENT_SECRET")
        self.api_url = "https://api.tink.com"

    def generate_tink_link_url(self, user_id: str, redirect_uri: str, locale: str):
        """Generate Tink Link URL for user to connect bank"""
        # Generate state token
        state = self._generate_state_token(user_id)

        # Build Tink Link URL
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "scope": "accounts:read,transactions:read",
            "state": state,
            "locale": locale,
            "market": "PL"
        }

        tink_link_url = f"https://link.tink.com/1.0/authorize/?{urlencode(params)}"

        return tink_link_url, state

    async def handle_callback(self, code: str, state: str, user_id: str, db):
        """Exchange authorization code for access token"""
        # Verify state token
        # Exchange code for tokens
        # Create TinkConnection record
        # Fetch accounts
        # Trigger initial sync
        pass

    # ... more methods ...
```

#### File: `backend/app/services/tink_transaction_service.py` (NEW)

```python
import httpx
from datetime import datetime, timedelta
from ..models import BankTransaction, TinkConnection

class TinkTransactionService:
    def __init__(self):
        self.api_url = "https://api.tink.com"

    async def fetch_transactions(
        self,
        tink_connection: TinkConnection,
        account_id: str,
        from_date: datetime,
        to_date: datetime
    ):
        """Fetch transactions from Tink API"""
        access_token = tink_connection.access_token

        headers = {
            "Authorization": f"Bearer {access_token}"
        }

        params = {
            "accountIds": account_id,
            "minBookingDate": from_date.isoformat(),
            "maxBookingDate": to_date.isoformat(),
            "pageSize": 100
        }

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_url}/data/v2/transactions",
                headers=headers,
                params=params
            )

            if response.status_code != 200:
                raise Exception(f"Error fetching transactions: {response.text}")

            data = response.json()
            return data["transactions"]

    def parse_transaction(self, tink_transaction: dict, user_id: str):
        """Parse Tink transaction to BankTransaction model"""
        amount_value = float(tink_transaction["amount"]["value"]["unscaledValue"]) / (10 ** tink_transaction["amount"]["value"]["scale"])

        return BankTransaction(
            user_id=user_id,
            tink_transaction_id=tink_transaction["id"],
            tink_account_id=tink_transaction["accountId"],
            amount=amount_value,
            currency=tink_transaction["amount"]["currencyCode"],
            date=datetime.fromisoformat(tink_transaction["dates"]["booked"]).date(),
            description_display=tink_transaction["descriptions"]["display"],
            description_original=tink_transaction["descriptions"].get("original"),
            merchant_name=tink_transaction.get("merchantInformation", {}).get("merchantName"),
            tink_category_id=tink_transaction.get("enrichedData", {}).get("categories", {}).get("pfm", {}).get("id"),
            raw_data=tink_transaction,
            status="pending"
        )

    # ... more methods ...
```

#### File: `backend/app/services/categorization_service.py` (NEW)

```python
class CategorizationService:
    TINK_TO_APP_MAPPING = {
        "groceries": "Groceries",
        "restaurants-dining": "Food & Dining",
        # ... full mapping ...
    }

    def categorize_transaction(self, bank_transaction: BankTransaction):
        """Auto-categorize transaction"""
        # Determine type (income vs expense)
        if bank_transaction.amount > 0:
            suggested_type = "income"
        else:
            suggested_type = "expense"

        # Map Tink category to app category
        tink_category = bank_transaction.tink_category_id
        if tink_category and tink_category in self.TINK_TO_APP_MAPPING:
            suggested_category = self.TINK_TO_APP_MAPPING[tink_category]
            confidence_score = 0.95
        else:
            # Default category
            suggested_category = "Other"
            confidence_score = 0.50

        # Update transaction
        bank_transaction.suggested_type = suggested_type
        bank_transaction.suggested_category = suggested_category
        bank_transaction.confidence_score = confidence_score

        return bank_transaction
```

### 9.2 Frontend Changes

#### File: `frontend/src/app/transactions/review/page.tsx` (NEW)

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import TransactionReviewCard from "@/components/transactions/TransactionReviewCard";

interface PendingTransaction {
  id: number;
  date: string;
  amount: number;
  currency: string;
  description: string;
  suggested_type: "income" | "expense";
  suggested_category: string;
  confidence_score: number;
}

export default function ReviewTransactionsPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const fetchPendingTransactions = async () => {
    const response = await fetch("/api/transactions/pending");
    const data = await response.json();
    setTransactions(data.transactions);
    setLoading(false);
  };

  const handleAccept = async (transactionId: number) => {
    await fetch(`/api/transactions/${transactionId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ /* ... */ }),
    });

    // Refresh list
    fetchPendingTransactions();
  };

  const handleReject = async (transactionId: number) => {
    await fetch(`/api/transactions/${transactionId}/reject`, {
      method: "POST",
    });

    // Refresh list
    fetchPendingTransactions();
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Review Transactions</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <TransactionReviewCard
              key={transaction.id}
              transaction={transaction}
              onAccept={() => handleAccept(transaction.id)}
              onReject={() => handleReject(transaction.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

#### File: `frontend/src/components/transactions/TransactionReviewCard.tsx` (NEW)

```typescript
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface TransactionReviewCardProps {
  transaction: {
    id: number;
    date: string;
    amount: number;
    currency: string;
    description: string;
    suggested_type: "income" | "expense";
    suggested_category: string;
    confidence_score: number;
  };
  onAccept: () => void;
  onReject: () => void;
}

export default function TransactionReviewCard({
  transaction,
  onAccept,
  onReject,
}: TransactionReviewCardProps) {
  const isExpense = transaction.suggested_type === "expense";
  const amount = Math.abs(transaction.amount);

  return (
    <Card className="p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">{transaction.date}</p>
          <p className="text-lg font-semibold">{transaction.description}</p>
          <p className="text-sm">
            Suggested: {transaction.suggested_category}
            {transaction.confidence_score > 0.8 && (
              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                High confidence
              </span>
            )}
          </p>
        </div>

        <div className="text-right">
          <p className={`text-xl font-bold ${isExpense ? "text-red-600" : "text-green-600"}`}>
            {isExpense ? "-" : "+"}{amount} {transaction.currency}
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Button onClick={onAccept} variant="primary">
          Accept
        </Button>
        <Button onClick={onReject} variant="secondary">
          Reject
        </Button>
      </div>
    </Card>
  );
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Backend:**
- [ ] Test `TinkAuthService.generate_tink_link_url()`
- [ ] Test `TinkTransactionService.parse_transaction()`
- [ ] Test `CategorizationService.categorize_transaction()`
- [ ] Test `DeduplicationService.find_duplicates()`

**Frontend:**
- [ ] Test `TransactionReviewCard` component
- [ ] Test accept/reject button handlers

### 10.2 Integration Tests

- [ ] Test full OAuth flow (mock Tink API)
- [ ] Test transaction sync (mock Tink API)
- [ ] Test accept transaction flow (creates Income/Expense)
- [ ] Test bulk accept flow

### 10.3 E2E Tests

- [ ] User connects bank account
- [ ] User syncs transactions
- [ ] User reviews and accepts transactions
- [ ] Transactions appear in Income/Expenses pages

### 10.4 Manual QA

- [ ] Test with real ING account
- [ ] Test with real PKO BP account
- [ ] Test with real mBank account
- [ ] Test edge cases (refunds, transfers, foreign currency)

---

## 11. Rollout Plan

### 11.1 Beta Phase (Week 11-12)

**Goal:** Test with 10-20 real users

**Steps:**
1. Enable feature flag for beta users
2. Send invitation email with instructions
3. Monitor error logs daily
4. Gather feedback via survey
5. Fix critical bugs
6. Iterate on UX based on feedback

**Success criteria:**
- 80%+ beta users successfully connect bank
- 70%+ beta users accept at least 10 transactions
- No critical bugs reported

### 11.2 Gradual Rollout (Week 13-14)

**Goal:** Roll out to 50% of users

**Steps:**
1. Enable feature for 50% of active users
2. Monitor metrics:
   - Connection success rate
   - Transaction sync success rate
   - User engagement (% users reviewing transactions)
3. A/B test: Compare manual entry vs auto-import retention
4. Adjust based on data

### 11.3 Full Launch (Week 15)

**Goal:** 100% rollout

**Steps:**
1. Enable feature for all users
2. Send announcement email
3. Update homepage with feature highlight
4. Monitor support tickets
5. Celebrate! 🎉

---

## 12. References

### Official Documentation
- [Tink API Documentation](https://docs.tink.com/api)
- [Tink Link SDK Guide](https://docs.tink.com/entries/articles/tink-link-web-api-reference-transactions)
- [Tink Authentication Flow](https://docs.tink.com/resources/getting-started/get-access-token)
- [Tink Transaction Categorization](https://docs.tink.com/entries/articles/transaction-categories)
- [Fetch Enriched Transactions](https://docs.tink.com/entries/articles/fetch-enriched-transactions-for-a-user)

### Pricing & Product Info
- [Tink Pricing](https://tink.com/pricing/)
- [Tink Transactions Product](https://tink.com/products/transactions/)
- [Tink Expense Check](https://tink.com/products/expense-check/)
- [Tink Platform Overview](https://tink.com/platform/)

### Comparisons & Guides
- [Plaid vs Tink vs TrueLayer (2026)](https://www.fintegrationfs.com/post/plaid-vs-tink-vs-truelayer-which-open-banking-api-is-best-for-your-fintech)
- [Tink Reviews & Pricing (Merchant Machine)](https://merchantmachine.co.uk/open-banking-payments/tink/)

### Related Articles
- [Using Tink Link for User Authentication](https://tink.com/blog/product/tink-link-user-authentication/)
- [Deep Dive: Expense Categories](https://tink.com/blog/product/deep-dive-into-expense-categories/)

---

## Appendices

### Appendix A: Environment Variables

**Backend `.env`:**
```env
# Existing
DATABASE_URL=postgresql://user:password@localhost:5432/homebudget
SECRET_KEY=your_secret_key
CORS_ORIGINS=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key

# NEW - Tink API
TINK_CLIENT_ID=your_tink_client_id
TINK_CLIENT_SECRET=your_tink_client_secret
TINK_REDIRECT_URI=http://localhost:3000/banking/callback
```

**Frontend `.env.local`:**
```env
# Existing
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# NEW - Tink (public)
NEXT_PUBLIC_TINK_CLIENT_ID=your_tink_client_id
```

### Appendix B: Cost Estimation

**Tink API Costs:**
- 100 users: €50/month (€600/year)
- 500 users: €250/month (€3,000/year)
- 1,000 users: €500/month (€6,000/year)

**Your pricing (suggested):**
- Free tier: Manual entry only
- Premium tier: €4.99/month - Bank sync included
  - Margin: €4.49/user
  - Break-even: ~12 paying users

**ROI Analysis:**
- 100 paying users: €499/month revenue - €50 Tink cost = €449 profit
- 1,000 paying users: €4,990/month revenue - €500 Tink cost = €4,490 profit

### Appendix C: Security Considerations

**Token Storage:**
- Store Tink access tokens encrypted in database
- Use environment variables for API credentials
- Never expose tokens in frontend

**API Authentication:**
- All endpoints require authenticated user
- Verify user_id matches requested resources
- Rate limiting on sync endpoints

**Data Privacy:**
- User can delete bank connection anytime
- Deletion cascades to transactions
- GDPR compliance: data export/deletion

**PSD2 Compliance:**
- Tink is PSD2-compliant AISP
- You inherit their compliance
- Ensure proper consent flows

---

## Summary

This implementation guide provides a comprehensive roadmap for integrating Tink API into your Home Budget application. By following these 11 phases over ~15 weeks, you'll transform your app from manual entry to automatic bank import, dramatically improving user experience and retention.

**Key Takeaways:**
- ✅ Tink is perfect for Polish banks (ING, PKO, mBank supported)
- ✅ €0.50/user/month is affordable and scalable
- ✅ Automatic categorization with 85-95% accuracy
- ✅ Implementation is straightforward with clear phases
- ✅ ROI is strong: charge €4.99/month, profit €4.49/user

**Next Steps:**
1. Review this document with your team
2. Sign up for Tink account
3. Start Phase 1: Foundation

Good luck! 🚀

---

**Document Version:** 1.0
**Last Updated:** January 12, 2026
**Author:** Architecture & Implementation Analysis
