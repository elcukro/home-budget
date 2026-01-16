# Home Budget Project Guide

## Commands

### Frontend
- `cd frontend && npm run dev` - Start frontend development server
- `cd frontend && npm run build` - Build frontend for production
- `cd frontend && npm run lint` - Run ESLint checks
- `cd frontend && npx tsc` - Run TypeScript type checking

### Backend
- `cd backend && uvicorn app.main:app --reload` - Start backend development server
- `cd backend && python test_api.py` - Run API tests
- `cd backend && python -m pytest tests/test_file.py` - Run a single test file
- `cd backend && python test_gocardless.py` - Test GoCardless bank data API connectivity

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
