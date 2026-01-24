# Competitor App Review Analysis

**Date:** January 2026
**Purpose:** Identify user pain points and feature opportunities for FiredUp app
**Sources:** Google Play Store reviews for EveryDollar (4.3★, 14.8K reviews) and YNAB (4.5★, 23K reviews)

---

## Executive Summary

Analysis of 60+ user reviews from two leading budget apps reveals consistent pain points that FiredUp can avoid:

| App | Core Strength | Core Weakness |
|-----|---------------|---------------|
| **EveryDollar** | Simple zero-based budgeting | Data rigidity, bank sync failures, destroys historical data |
| **YNAB** | Powerful envelope system | UI bloat, steep learning curve, workflow friction |

**Key Insight:** Users want **speed** and **flexibility**. They open budget apps while standing in checkout lines - not to admire dashboards.

---

## Part 1: EveryDollar Analysis

### 1.1 Connectivity & Stability Crisis

**The Problem:**
Users report constant disconnection from bank accounts (Plaid), missing transactions, and delayed syncing.

> *"The latest update with Plaid is HORRIBLE!!! I have not been able to get my transactions this whole week."* - Review #10

> *"Every once in a while some charges won't show up in the app. There's no rhyme or reason to it."* - Review #27

**Lessons for FiredUp:**

- [ ] **Status Dashboard:** Show clear visual indicators of last sync time
- [ ] **Manual Fallback:** Allow CSV import when API fails
- [ ] **Deduplication Logic:** Detect internal transfers (Savings → Checking is NOT income)

### 1.2 Authentication Friction

**The Problem:**
Users are logged out constantly, no biometric support, session doesn't persist across devices.

> *"Logging in is annoying for this app. It seems like I have to reset my password almost every time. Can you make logging in by a fingerprint available?"* - Review #4

**Lessons for FiredUp:**

- [x] **Biometric Auth:** FaceID/TouchID (already implemented via expo-secure-store)
- [ ] **Persistent Sessions:** "Remember Me" for trusted devices
- [ ] **Cross-device sync:** Don't force re-login when switching phone ↔ computer

### 1.3 Budgeting Logic Rigidity

**The Problem:**
App assumes predictable monthly salary. Can't handle irregular income, annual expenses, or rollover balances.

> *"Once I realized it pretty much requires foreknowledge of monthly earnings, which, in my case are unpredictable, it became harder to calculate expenses."* - Review #1

> *"You can't plan for annual expenses on it. When you click on the expense, there's a scheduling tab. It is grayed out."* - Review #18

**Lessons for FiredUp:**

- [ ] **Rollover Budgets:** Toggle to carry positive/negative balance to next month
- [ ] **Sinking Funds:** Annual expense module that divides cost by 12 automatically
- [ ] **Irregular Income Mode:** Don't require full month's income upfront

### 1.4 Data Integrity Failures (CRITICAL)

**The Problem:**
Changing categories in current month DELETES historical data. This is unforgivable.

> *"I wanted to move my gas budget from 'spending' to 'bills' section. It DELETED all prior months gas transactions when I did it for my current month."* - Review #3

**Lessons for FiredUp:**

- [ ] **Immutable History:** Category changes should NEVER alter past transactions
- [ ] **Soft Deletes:** Archive deleted categories, don't wipe transaction history
- [ ] **Version Control:** If user renames "Gas" to "Transport" in October, September logs stay as "Gas"

### 1.5 UI/UX Click Fatigue

**The Problem:**
Updates moved primary actions to harder-to-reach spots. Text fields don't auto-focus.

> *"I used to be able to open the app and log a transaction in the time that it now takes to just open the app."* - Review #21

**Lessons for FiredUp:**

- [ ] **Floating Action Button:** "Add Transaction" always visible and accessible
- [ ] **Smart Defaults:** Opening category → cursor auto-focuses on Amount field
- [ ] **One-tap entry:** Minimize taps to log a purchase

---

## Part 2: YNAB Analysis

### 2.1 The "Home Screen" Rebellion

**The Problem:**
YNAB added a mandatory "Home" dashboard. Users HATE it. They want direct access to their budget.

> *"I just want to open the app and go straight to my budget... I mean plan. I now need to bounce between tabs. I don't want a 'social experience'."* - Review #9

> *"Home is genuinely maddening to deal with, and offers nothing that wasn't easier with the Plan page."* - Review #7

**Lessons for FiredUp:**

- [ ] **Configurable Landing Page:** Let user choose startup screen in Settings
- [ ] **Persistent State:** Reopen on the last-used tab, not a forced dashboard
- [ ] **Respect User Time:** Budget apps are utilities, not social platforms

### 2.2 Terminology Confusion

**The Problem:**
YNAB renamed "Budget" to "Plan". Users find it pretentious and confusing.

> *"Please... name the budget the budget."* - Review #16

> *"Changing the word 'budget' to 'plan' a while back..."* - Review #14

**Lessons for FiredUp:**

- [x] **Standard Taxonomy:** Use "Budget", "Income", "Expenses", "Reports" (we do this)
- [ ] **Tooltips:** Explain unique concepts (like Baby Steps) without renaming standard terms

### 2.3 Mobile Bulk Actions Missing

**The Problem:**
No checkboxes for bulk transaction approval. Must tap each one manually.

> *"No checkboxes for the transactions to approve? I have to click EACH ONE manually?"* - Review #21

**Lessons for FiredUp:**

- [ ] **Batch Operations:** Long-press to select multiple, then "Approve All" / "Categorize All"
- [ ] **Smart Categorization:** If "Starbucks" = "Food" once, offer to apply to all similar

### 2.4 Steep Learning Curve

**The Problem:**
New users don't understand zero-based budgeting logic.

> *"I also don't understand how it's supposed to work. Do I only assign money that has been spent? There is a definite learning curve and no real instructions."* - Review #3

**Lessons for FiredUp:**

- [x] **Onboarding Flow:** We have this (onboarding screens)
- [ ] **Sandbox/Demo Mode:** Pre-filled fake data so users can experiment safely
- [ ] **Wizard-Style Setup:** "How much is your Rent?" → auto-create category

### 2.5 Subscription Trust Issues

**The Problem:**
Users can't cancel subscription in-app. Feels predatory.

> *"Canceling a paid subscription requires logging into a desktop web interface. No in-app or mobile cancellation. This is intentional friction."* - Review #25

> *"USER BEWARE: PREDATORY AUTO SUBSCRIPTION... I used this app for all of 10 minutes."* - Review #26

**Lessons for FiredUp:**

- [ ] **In-App Subscription Management:** Visible in Profile settings
- [ ] **Grace Period:** Allow "undo" within 48 hours of accidental renewal
- [ ] **Transparent Pricing:** Show cost before any commitment

---

## Part 3: Feature Priority Matrix

Based on competitor failures, here's what FiredUp should prioritize:

### P0 - Critical (Competitor Failures to NEVER Repeat)

| Feature | Why Critical | Competitor Failure |
|---------|--------------|-------------------|
| **Immutable History** | Users lose years of data | EveryDollar deletes history on category change |
| **Biometric Login** | Daily friction killer | EveryDollar lacks fingerprint support |
| **Direct Budget Access** | Speed is everything | YNAB forces "Home" tab first |
| **Reliable Bank Sync** | Core premium value | Both apps have Plaid issues |

### P1 - High Priority (Competitive Advantage)

| Feature | Why Important | Gap in Market |
|---------|---------------|---------------|
| **Configurable Start Screen** | Power users want control | YNAB doesn't allow |
| **Bulk Transaction Actions** | Catch-up workflow | YNAB lacks on mobile |
| **Transfer Detection** | Prevents double-counting | EveryDollar treats transfers as income+expense |
| **Rollover Budgets** | Real life is fluid | EveryDollar resets monthly |

### P2 - Medium Priority (Nice to Have)

| Feature | Why Useful | Notes |
|---------|------------|-------|
| **Sinking Funds** | Annual expenses | Divide by 12 automatically |
| **Sandbox Mode** | Reduce learning curve | Pre-filled demo budget |
| **Smart Categorization** | ML-based suggestions | Learn from user patterns |
| **Offline Mode** | Works without connection | Manual entry always available |

---

## Part 4: FiredUp Current State Assessment

### What We Already Do Well

| Feature | Status | Notes |
|---------|--------|-------|
| Biometric Auth | ✅ | expo-local-authentication (Face ID/Touch ID) |
| Standard Terminology | ✅ | Budget, Income, Expenses |
| Onboarding Flow | ✅ | Multi-screen wizard |
| Gamification | ✅ | XP, badges, streaks (unique differentiator!) |
| Baby Steps Integration | ✅ | Dave Ramsey methodology |
| Polish Language | ✅ | Native PL support |

### What We Need to Improve

| Feature | Status | Priority |
|---------|--------|----------|
| Bank Sync (Tink) | 🟡 Partial | P1 |
| Bulk Transaction Actions | ❌ Missing | P1 |
| Configurable Start Screen | ❌ Missing | P1 |
| Transfer Detection | ❌ Missing | P1 |
| Rollover Budgets | ❌ Missing | P2 |
| Offline Mode | 🟡 Partial | P2 |

---

## Part 5: Recommended Action Items

### Immediate (This Sprint)

1. **Fix Income Screen Navigation** - Back button not working properly
2. **Add Floating Action Button** - Quick transaction entry from any screen
3. **Implement "Last Tab" Memory** - Don't force users to a specific tab on launch

### Short Term (Next Month)

1. **Transfer Detection Logic** - When transaction appears in 2 accounts simultaneously
2. **Bulk Select Transactions** - Long-press to select multiple
3. **Category Change Protection** - Warn before any action that affects history

### Medium Term (Next Quarter)

1. **Rollover Budget Option** - Per-category toggle
2. **Sinking Funds Module** - Annual expense planning
3. **Smart Categorization** - ML-based suggestions from transaction descriptions

---

## Part 6: Key Quotes to Remember

> *"The entire reason my husband and I liked using this app was because it was easy and quick access to the budget so we can take one glance and be good."* - EveryDollar Review #20

> *"I used to be able to open the app and log a transaction in the time that it now takes to just open the app."* - EveryDollar Review #21

> *"Push through the steep learning curve, friends! It's the kind of software that you'll learn incrementally."* - YNAB Review #2 (7-year user)

> *"The classic pencil and paper method is still the best road."* - YNAB Review #23 (frustrated user)

**The lesson:** Users will forgive complexity if it provides value. They won't forgive friction that wastes their time.

---

## Appendix: Review Sources

### EveryDollar (36 Reviews Analyzed)
- App Rating: 4.3★ (14.8K total reviews)
- Developer: Ramsey Solutions
- Key Issues: Bank sync, data deletion, rigidity

### YNAB (26 Reviews Analyzed)
- App Rating: 4.5★ (23K total reviews)
- Developer: ynab.com
- Key Issues: UI bloat, learning curve, subscription friction

---

*Document maintained by FiredUp development team*
*Last updated: January 2026*
