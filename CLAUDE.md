# Home Budget Project Guide

## Commands

### Frontend
- `cd frontend && npm run dev` - Start frontend development server
- `cd frontend && npm run build` - Build frontend for production
- `cd frontend && npm run lint` - Run ESLint checks
- `cd frontend && npx tsc` - Run TypeScript type checking
- `cd frontend && npm run test` - Run Vitest tests in watch mode
- `cd frontend && npm run test:coverage` - Run tests with coverage report

### Backend
- `cd backend && uvicorn app.main:app --reload` - Start backend development server
- `cd backend && source venv/bin/activate && pytest` - Run all pytest tests
- `cd backend && source venv/bin/activate && pytest --cov=app` - Run tests with coverage
- `cd backend && source venv/bin/activate && pytest tests/unit/` - Run only unit tests
- `cd backend && source venv/bin/activate && pytest tests/integration/` - Run only integration tests
- `cd backend && python test_gocardless.py` - Test GoCardless bank data API connectivity

### Mobile (Expo/React Native)
- `cd mobile && npm install` - Install mobile app dependencies
- `cd mobile && npx expo start` - Start Expo development server
- `cd mobile && npx expo start --ios` - Start and open iOS Simulator
- `cd mobile && npx expo start --android` - Start and open Android Emulator
- `cd mobile && npx expo-doctor` - Check Expo configuration
- `cd mobile && npx tsc --noEmit` - Run TypeScript type checking
- `cd mobile && npx expo export --platform web` - Test build for web

### Production Services (firedup.app)

**Server access:** `ssh root@firedup.app`
**Project path:** `/opt/home-budget`

#### Deploy from local machine:

```bash
# Frontend: pull and restart (build runs automatically)
ssh root@firedup.app "cd /opt/home-budget/frontend && git pull && sudo systemctl restart home-budget-frontend"

# Backend: pull and restart
ssh root@firedup.app "cd /opt/home-budget/backend && git pull && sudo systemctl restart home-budget-backend"
```

#### On server - manage services via systemctl:

```bash
# Restart services
sudo systemctl restart home-budget-frontend
sudo systemctl restart home-budget-backend

# Check status
systemctl status home-budget-frontend
systemctl status home-budget-backend

# View logs
journalctl -u home-budget-frontend -f
journalctl -u home-budget-backend -f
```

**Frontend** (port 3000): Needs restart after code changes (runs `npm run build` automatically on restart)

**Backend** (port 8000): Has `--reload` flag, auto-reloads on Python changes. Manual restart rarely needed.

## Style Guidelines

### Frontend
- Use TypeScript with strict typing
- Follow Next.js app router patterns
- Use named exports for components
- Prefix interfaces with 'I' (e.g., IUser)
- Import order: React/Next, third-party, local
- Handle errors with try/catch and toast notifications
- Use internationalization for all UI text

### Backend
- Use FastAPI for all API endpoints
- Use SQLAlchemy for DB operations
- Validate requests with Pydantic models
- Handle exceptions with appropriate status codes
- Always check API schema against DB schema when adding new structures

## Features

### Banking Integration (Tink)
- Primary integration: Tink API for Polish banks (ING, PKO BP, mBank, etc.)
- Requires TINK_CLIENT_ID, TINK_CLIENT_SECRET, TINK_REDIRECT_URI in backend .env
- Uses one-time access flow (simpler than permanent users)
- Test page: `/banking/tink/test` - shows all API data (accounts, transactions, balances)
- Documentation: `docs/tink-api/` folder
- Flow: generate Tink Link URL → user authenticates → callback with code → exchange for tokens → fetch data

### Banking Integration (GoCardless) - Legacy
- Uses GoCardless API for secure bank account connection
- Requires GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in .env file
- Requisition IDs are stored and persist for 90 days (varies by bank)
- Connection management is handled in user settings
- Flow: get token → select bank → create requisition → get accounts → access data

### Mobile App (FiredUp)

#### Overview
- React Native with Expo SDK 52 and Expo Router
- Located in `mobile/` directory (standalone, not monorepo)
- Communicates with production API at https://firedup.app
- Uses JWT authentication (separate from web's NextAuth)

#### Project Structure
```
mobile/
├── app/                    # Expo Router screens
│   ├── (auth)/            # Auth screens (sign-in)
│   ├── (onboarding)/      # Onboarding flow screens
│   ├── (tabs)/            # Main tab navigation
│   │   ├── _layout.tsx    # Tab bar configuration
│   │   ├── index.tsx      # Dashboard (Home)
│   │   ├── transactions.tsx # Wydatki
│   │   ├── loans.tsx      # Kredyty
│   │   ├── goals.tsx      # Fire (Baby Steps)
│   │   └── settings.tsx   # Profil
│   ├── loans/
│   │   └── [id].tsx       # Loan detail screen
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry point (routing logic)
├── components/            # Reusable components
├── hooks/                 # Custom React hooks
├── lib/
│   └── api.ts            # API client (all endpoints)
├── stores/               # Zustand stores
│   ├── auth.ts           # Authentication state
│   ├── gamification.ts   # XP, badges, celebrations
│   └── onboarding.ts     # Onboarding state
├── constants/            # App constants
├── utils/                # Utility functions
└── assets/               # Images, fonts, icons
```

#### Development Workflow

**Starting the app:**
```bash
cd mobile
npm install              # First time only
npx expo start           # Start dev server
# Press 'i' for iOS Simulator
# Press 'a' for Android Emulator
# Scan QR with Expo Go app for physical device
```

**Type checking:**
```bash
npx tsc --noEmit         # Check for TypeScript errors
```

**Expo Doctor:**
```bash
npx expo-doctor          # Check for configuration issues
```

#### API Integration

**Base URL:** Production API at `https://firedup.app`

**Authentication:**
- Google Sign-In → exchange Google token for app JWT
- JWT stored in expo-secure-store
- All API requests include `Authorization: Bearer <token>` header

**API Client Location:** `mobile/lib/api.ts`

**Endpoint Prefixes:**
- `/api/auth/mobile/*` - Mobile authentication
- `/internal-api/*` - Mobile-specific endpoints (bypasses Next.js)
- `/users/{email}/*` - User data (shared with web)

**Why `/internal-api/` prefix?**
Next.js intercepts routes like `/loans` for web pages. Mobile uses `/internal-api/loans` to reach FastAPI directly.

**Key API Methods:**
```typescript
api.auth.me()                          // Get current user
api.dashboard.get()                    // Dashboard data
api.transactions.list()                // List expenses
api.loans.list()                       // List loans
api.loans.create(data)                 // Create loan
api.loans.createPayment(userId, loanId, data)  // Make payment
api.gamification.getOverview()         // Gamification stats
api.gamification.checkin()             // Daily check-in
```

#### State Management (Zustand)

**Auth Store (`stores/auth.ts`):**
- `user` - Current user data
- `token` - JWT token
- `isAuthenticated` - Auth status
- `login()` / `logout()` - Auth actions

**Gamification Store (`stores/gamification.ts`):**
- `stats` - XP, level, streaks
- `unlockedBadges` - User's badges
- `pendingCelebrations` - Queue of modals to show
- `addCelebration()` - Add celebration to queue
- `dismissCelebration()` - Remove first celebration
- `checkIn()` - Daily check-in

**Celebration Types:**
- `badge` - New badge unlocked
- `level_up` - Level increased
- `streak_milestone` - 7, 30, 90, 365 day streaks
- `mortgage_paid_off` - Loan fully paid
- `xp_reward` - XP earned (e.g., overpayment)

#### Navigation Structure (5 Tabs)

| Tab | Route | Icon | Description |
|-----|-------|------|-------------|
| 1. Home | `index` | `home` | Dashboard with overview |
| 2. Wydatki | `transactions` | `list` | Expense tracking |
| 3. Kredyty | `loans` | `card` | Loan management |
| 4. Fire | `goals` | `flame` | Baby Steps progress |
| 5. Profil | `settings` | `person` | User settings |

#### Component Conventions

**File naming:**
- Components: PascalCase (`LoanCard.tsx`)
- Screens: lowercase (`loans.tsx`)
- Stores: camelCase (`gamification.ts`)

**Component structure:**
```typescript
// 1. Imports
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
}

// 3. Component
export default function MyComponent({ title }: MyComponentProps) {
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
}

// 4. Styles at bottom
const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

**Common patterns:**
- Use `Pressable` instead of `TouchableOpacity` for buttons
- Use `Ionicons` from `@expo/vector-icons` for icons
- Use `useCallback` for functions passed to children
- Use `useMemo` for expensive calculations
- Bottom sheets: Use `Modal` with custom slide animation

#### Adding New API Endpoints

1. **Backend:** Add endpoint to `backend/app/main.py`
   - For mobile-only: use `/internal-api/` prefix
   - For shared: use existing patterns

2. **Mobile API client:** Update `mobile/lib/api.ts`
   - Add types for request/response
   - Add method to appropriate namespace

3. **Example:**
```typescript
// In api.ts
interface NewFeatureData { /* ... */ }

// In the Api class:
newFeature = {
  list: () => this.request<NewFeatureData[]>('/internal-api/new-feature'),
  create: (data: CreateInput) =>
    this.request<NewFeatureData>('/internal-api/new-feature', {
      method: 'POST',
      body: data,
    }),
};
```

#### Gamification Integration

**Awarding XP:**
Backend automatically awards XP for actions:
- `expense_logged`: 5 XP
- `income_logged`: 5 XP
- `saving_deposit`: 10 XP
- `loan_payment`: 10 XP
- `loan_overpayment`: 20 XP
- `daily_checkin`: 10 XP
- `streak_continued`: 5 XP bonus

**Showing celebrations:**
```typescript
import { useGamificationStore } from '@/stores/gamification';

// In component:
const addCelebration = useGamificationStore(s => s.addCelebration);

// After action:
addCelebration({
  type: 'xp_reward',
  xpEarned: 20,
  title: 'Świetna robota!',
  message: 'Zdobyłeś punkty!',
});
```

#### Building & Deployment

**Development build:**
```bash
npx expo run:ios        # Native iOS build
npx expo run:android    # Native Android build
```

**Production build (EAS):**
```bash
npx eas build --platform ios
npx eas build --platform android
```

**Preview/Testing:**
- Use Expo Go app for quick testing
- Use development builds for native features
- Test on both iOS and Android

#### Troubleshooting

**"JSON Parse error: Unexpected character: <"**
- API returning HTML instead of JSON
- Check endpoint prefix (`/internal-api/` vs `/`)
- Verify backend has the endpoint

**Authentication issues:**
- Check token in expo-secure-store
- Verify JWT_SECRET matches between mobile config and backend
- Check token expiration

**Metro bundler issues:**
```bash
npx expo start --clear   # Clear cache and restart
```

### Mobile Loans Feature

#### Screens
- **List (`loans.tsx`):** Summary card + loan cards with progress
- **Detail (`loans/[id].tsx`):** Full details, payment schedule, overpayment

#### Loan Types (10)
| Type | Label | Icon |
|------|-------|------|
| `mortgage` | Kredyt hipoteczny | `home-outline` |
| `car` | Kredyt samochodowy | `car-outline` |
| `personal` | Kredyt gotówkowy | `cash-outline` |
| `student` | Kredyt studencki | `school-outline` |
| `credit_card` | Karta kredytowa | `card-outline` |
| `cash_loan` | Pożyczka | `hand-left-outline` |
| `installment` | Raty 0% | `cart-outline` |
| `leasing` | Leasing | `document-text-outline` |
| `overdraft` | Debet | `wallet-outline` |
| `other` | Inny | `ellipse-outline` |

#### Backend Endpoints
- `GET /internal-api/loans` - List all loans
- `POST /internal-api/loans` - Create new loan
- `GET /internal-api/loans/{id}` - Get single loan
- `POST /internal-api/loans/{id}/archive` - Archive paid-off loan
- `POST /users/{email}/loans/{id}/payments` - Create payment (shared)

## Skills

### /security-check
Run `/security-check` after completing complex implementations or changes that could introduce security vulnerabilities. This includes:
- Authentication/authorization changes
- New API endpoints
- User input handling
- File uploads or downloads
- Payment or financial data processing
- Third-party integrations
- Database queries with user-provided data

The skill performs a red-team style security audit and suggests specific fixes.

### /launch-readiness
Run `/launch-readiness` before commercial launch to perform a comprehensive audit of production readiness. The skill checks:

**Dokumentacja i prawne:**
- Regulamin, Polityka Prywatności, RODO compliance
- Cookie consent, dane administratora

**Emaile transakcyjne:**
- Welcome email, potwierdzenie płatności, przypomnienie o trialu
- Konfiguracja SMTP/SendGrid/Resend

**Zaślepki w kodzie:**
- TODO/FIXME/HACK/PLACEHOLDER
- Testowe dane, localhost URLs, testowe klucze API

**Konfiguracja produkcyjna:**
- Zmienne środowiskowe, klucze Stripe (live vs test)
- HTTPS, CORS, rate limiting

**Monitoring:**
- Error tracking (Sentry), logi, health checks, alerty

**Płatności:**
- Stripe webhooks, obsługa błędów, refund flow

**Infrastruktura:**
- Backup, CI/CD, staging, rollback

**Support:**
- Formularz kontaktowy, FAQ, dokumentacja wewnętrzna

Generuje raport z priorytetyzacją: Blokery > Ważne > Rekomendacje.
