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
- React Native with Expo SDK 52 and Expo Router
- Located in `mobile/` directory (standalone, not monorepo)
- Communicates with production API at https://firedup.app
- Uses JWT authentication (separate from web's NextAuth)
- Auth flow: Google Sign-In → exchange Google token for app JWT → Bearer token auth
- State management: Zustand with expo-secure-store for token persistence
- Screens: Dashboard, Transactions, Goals (Baby Steps), Settings
- Backend endpoints for mobile auth: `/api/auth/mobile/google`, `/api/auth/mobile/me`
- Requires JWT_SECRET and GOOGLE_CLIENT_ID in backend .env for production

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
