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

### Docker
- `docker-compose up` - Start all services
- `docker-compose up -d` - Start in detached mode
- `docker-compose exec backend bash` - Access backend container shell
- `docker-compose exec backend python migrations/add_banking_connections.py` - Run banking migrations

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

### Banking Integration
- Uses GoCardless API for secure bank account connection
- Requires GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY in .env file
- Requisition IDs are stored and persist for 90 days (varies by bank)
- Connection management is handled in user settings
- Flow: get token → select bank → create requisition → get accounts → access data
