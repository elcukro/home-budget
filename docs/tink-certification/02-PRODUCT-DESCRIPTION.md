# Product Description

## Executive Summary

**FiredUp** is a personal finance management SaaS application designed for Polish consumers. It helps users track their income, expenses, savings goals, and loans through an intuitive web interface and mobile application.

The application offers optional bank account connectivity through Tink, enabling automatic import of transactions for more accurate and convenient budget tracking.

---

## Product Overview

### Name
FiredUp

### Category
Personal Finance Management / Budgeting Application

### Platform
- **Web Application:** https://firedup.app (Next.js, React)
- **Mobile Application:** iOS and Android (React Native/Expo)
- **Backend API:** Python FastAPI

### Target Market
- **Primary:** Polish consumers (PL market)
- **Demographics:** Individuals and families managing household budgets
- **Language:** Polish (with English interface option)

---

## Core Features

### 1. Manual Expense & Income Tracking
- Add individual transactions with amount, date, description, and category
- Recurring transactions support
- Receipt photo attachment (optional)

### 2. Category Management
- Predefined expense categories (Food, Transport, Housing, etc.)
- Custom category creation
- Category-based spending analysis

### 3. Budget Planning
- Monthly budget limits per category
- Spending alerts and notifications
- Budget vs. actual comparison

### 4. Bank Account Integration (via Tink)
- **Optional feature** - users choose whether to connect
- Automatic transaction import from connected banks
- Read-only access (no payment initiation)
- Support for major Polish banks (ING, PKO BP, mBank, Santander, etc.)

### 5. Financial Goals
- Baby Steps methodology for debt payoff
- Savings goals with progress tracking
- Emergency fund planning

### 6. Loan Management
- Track mortgages, car loans, personal loans
- Payment schedule visualization
- Extra payment planning (snowball/avalanche methods)

### 7. Reports & Analytics
- Monthly/yearly spending summaries
- Category breakdown charts
- Net worth tracking
- Export to CSV/PDF

---

## Banking Integration Use Case

### Purpose
FiredUp uses Tink to provide users with the option to automatically import their bank transactions. This eliminates manual data entry and ensures more accurate budget tracking.

### Data Access
We request **read-only access** to:
- **Account Information:** Account name, IBAN, balance
- **Transaction History:** Date, amount, description, category (from Tink enrichment)

### What We Do NOT Access
- Bank login credentials (handled by Tink Link)
- Payment initiation capabilities
- Credit card CVV or security codes
- Account modification capabilities

### User Flow

1. **User Decision:** User navigates to Settings → Bank Connections
2. **Consent:** User clicks "Connect Bank" and is informed about data access
3. **Tink Link:** User is redirected to Tink Link interface
4. **Bank Selection:** User selects their bank from the list
5. **Bank Authentication:** User logs in directly on their bank's website
6. **Authorization:** User grants consent to share data
7. **Callback:** User returns to FiredUp with successful connection
8. **Data Import:** Transactions are imported and available for review
9. **Categorization:** User can accept, modify, or reject imported transactions

### Disconnect Flow

Users can disconnect their bank at any time:
- **In-App:** Settings → Bank Connections → Disconnect
- **Via Tink:** https://tink.com/consumer/revocation

Upon disconnection:
- No new data is fetched
- Raw bank data is deleted within 30 days
- Previously categorized expenses/incomes remain (until manually deleted)

---

## Business Model

### Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Free** | €0/month | Manual tracking, basic reports, 1 goal |
| **Premium** | €4.99/month | Bank integration, unlimited goals, advanced reports |

### Revenue Model
- Freemium SaaS with subscription upsell
- Bank integration is a Premium feature
- No selling of user data
- No advertising

---

## Estimated Usage Metrics

| Metric | Estimate |
|--------|----------|
| **Initial Users** | 100-500 |
| **Year 1 Target** | 500-1,000 |
| **Year 2 Target** | 1,000-5,000 |
| **Bank Connection Rate** | ~30% of active users |
| **API Requests/Day** | ~1,000 (at 500 users) |
| **Sync Frequency** | Once daily + on-demand |

### API Request Breakdown (per connected user/day)
- Token refresh: 1 request
- Account list: 1 request
- Transactions fetch: 1-2 requests
- Balance check: 1 request
- **Total per user:** ~4-5 requests/day

---

## Competitive Positioning

### Similar Products in Poland
- Kontomierz (now part of ING)
- BudgetBakers (international)
- YNAB (You Need A Budget)
- Moje Finanse (mBank internal)

### FiredUp Differentiators
1. **Focus on Polish Market:** Native Polish language, PLN-centric, Polish bank support
2. **Baby Steps Methodology:** Debt payoff framework inspired by Dave Ramsey
3. **Mobile-First Design:** Full-featured mobile app with biometric login
4. **Gamification:** XP system, badges, and streaks for engagement
5. **Privacy-Focused:** EU hosting, GDPR compliant, no data selling

---

## Technical Stack

| Component | Technology |
|-----------|------------|
| **Frontend Web** | Next.js 14, React, TypeScript, Tailwind CSS |
| **Mobile App** | React Native, Expo SDK 52 |
| **Backend API** | Python 3.11, FastAPI |
| **Database** | PostgreSQL |
| **Authentication** | NextAuth.js (Web), JWT (Mobile) |
| **Hosting** | Vercel (Frontend), VPS (Backend) |
| **Banking Provider** | Tink AB |

---

## Compliance

| Regulation | Status |
|------------|--------|
| **GDPR** | Compliant |
| **PSD2** | Via Tink (licensed AISP) |
| **Polish Data Protection Act** | Compliant |
| **Cookie Consent** | Implemented |

---

## Screenshots

*Note: Screenshots of the application can be provided upon request, including:*
- Dashboard view
- Expense tracking interface
- Bank connection flow
- Settings page with bank management
- Transaction review screen

---

## Links

| Resource | URL |
|----------|-----|
| **Application** | https://firedup.app |
| **Privacy Policy** | https://firedup.app/privacy |
| **Terms of Service** | https://firedup.app/terms |
| **Support** | support@firedup.app |

---

## Document Revision

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 2026 | Initial version |
