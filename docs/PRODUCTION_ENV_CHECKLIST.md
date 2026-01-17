# Production Environment Variables Checklist

This document lists all environment variables required for production deployment of FiredUp.

## Frontend (.env.local)

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Public URL of the app | `https://firedup.app` |
| `NEXTAUTH_URL` | NextAuth callback URL | `https://firedup.app` |
| `NEXTAUTH_SECRET` | Random secret for NextAuth (32+ chars) | `openssl rand -base64 32` |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API URL | `https://firedup.app/api/backend` |

### Authentication (Google OAuth)

| Variable | Description | Status |
|----------|-------------|--------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Required |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Required |

### Payments (Stripe)

| Variable | Description | Status |
|----------|-------------|--------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | **Use live key** |
| `STRIPE_SECRET_KEY` | Stripe secret key | **Use live key** |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Required |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Monthly plan price ID | Create in Stripe |
| `NEXT_PUBLIC_STRIPE_PRICE_YEARLY` | Yearly plan price ID | Create in Stripe |
| `NEXT_PUBLIC_STRIPE_PRICE_LIFETIME` | Lifetime plan price ID | Create in Stripe |

### Analytics & Monitoring

| Variable | Description | Status |
|----------|-------------|--------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | Configured |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog instance URL | `https://eu.i.posthog.com` |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for frontend | Create project |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for sourcemaps) | Optional |

---

## Backend (.env)

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |

### CORS

| Variable | Description | Status |
|----------|-------------|--------|
| `CORS_ORIGINS` | Additional CORS origins | Comma-separated |

### Payments (Stripe)

| Variable | Description | Status |
|----------|-------------|--------|
| `STRIPE_SECRET_KEY` | Stripe secret key | **Use live key** |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Required |

### Banking (Tink)

| Variable | Description | Status |
|----------|-------------|--------|
| `TINK_CLIENT_ID` | Tink client ID | **Use production** |
| `TINK_CLIENT_SECRET` | Tink client secret | **Use production** |
| `TINK_REDIRECT_URI` | Callback URL | `https://firedup.app/banking/tink/callback` |

### AI Features

| Variable | Description | Status |
|----------|-------------|--------|
| `OPENAI_API_KEY` | OpenAI API key | Required for AI insights |
| `ANTHROPIC_API_KEY` | Claude API key (alternative) | Optional |

### Monitoring

| Variable | Description | Status |
|----------|-------------|--------|
| `SENTRY_DSN` | Sentry DSN for backend | Create project |

---

## Pre-Launch Checklist

### Stripe Setup
- [ ] Create live products and prices in Stripe Dashboard
- [ ] Update price IDs in frontend env
- [ ] Configure webhook endpoint: `https://firedup.app/api/billing/webhook`
- [ ] Test payment flow with live mode

### Tink Setup
- [ ] Apply for production access at Tink
- [ ] Update credentials to production
- [ ] Verify bank connections work

### Monitoring Setup
- [ ] Create Sentry project for frontend (Next.js)
- [ ] Create Sentry project for backend (FastAPI)
- [ ] Add DSNs to environment variables
- [ ] Verify PostHog is receiving events

### SEO & Assets
- [ ] Create OG image at `frontend/public/images/og-image.png` (1200x630px)
- [ ] Verify robots.txt is accessible: `https://firedup.app/robots.txt`
- [ ] Verify sitemap is accessible: `https://firedup.app/sitemap.xml`
- [ ] Test Open Graph tags with Facebook/Twitter debug tools

### Security
- [ ] Verify CORS only allows firedup.app origins
- [ ] Test rate limiting is working
- [ ] Verify all sensitive routes require authentication
- [ ] Review cookie consent compliance

### Final Checks
- [ ] Test health endpoint: `https://firedup.app/api/backend/health`
- [ ] Test 404 page: `https://firedup.app/nonexistent-page`
- [ ] Test error boundaries work correctly
- [ ] Test full user journey (signup → payment → dashboard)
