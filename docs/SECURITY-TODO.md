# FiredUp Infrastructure & Security Audit Report

**Report Generated**: 2026-01-17
**Audited By**: InfraAuditor (Claude Code)

---

## Executive Summary

The FiredUp home budget application has a solid technical foundation with modern technologies and good architectural patterns. However, **immediate action is required** to address critical security vulnerabilities.

**Overall Assessment**: Good foundation with rate limiting, CORS protection, and proper authentication flow. Critical issues with exposed secrets and authentication bypass need immediate attention.

---

## Risk Assessment Table

| Component | Issue | Priority | Status |
|-----------|-------|----------|--------|
| Backend .env | Hardcoded production secrets exposed | 🔴 CRITICAL | [ ] |
| Frontend .env | Hardcoded Google OAuth secrets | 🔴 CRITICAL | [ ] |
| Authentication | X-User-ID header can be spoofed | 🔴 CRITICAL | [ ] |
| Security Headers | Missing CSP, X-Frame-Options, HSTS | 🟠 HIGH | [x] ✅ |
| CI/CD | No automated deployment pipeline | 🟠 HIGH | [ ] |
| Database | Default password fallback in code | 🟠 HIGH | [x] ✅ |
| Backup Strategy | No database backup automation | 🟠 HIGH | [ ] |
| Environment Files | World-readable permissions (644) | 🟡 MEDIUM | [ ] |
| Systemd Services | Service definitions not in repository | 🟡 MEDIUM | [ ] |
| Monitoring | No infrastructure monitoring | 🟡 MEDIUM | [ ] |
| Logging | Application logs not centralized | 🟡 MEDIUM | [ ] |
| CORS Headers | allow_headers=["*"] too permissive | 🟡 MEDIUM | [x] ✅ |

---

## 🔴 Critical Issues

### 1. Exposed Secrets in .env Files

**Locations**:
- `/backend/.env`
- `/frontend/.env`
- `/frontend/.env.local`

**Exposed Secrets**:
- GOCARDLESS_SECRET_KEY
- TINK_CLIENT_SECRET
- GOOGLE_CLIENT_SECRET
- NEXTAUTH_SECRET

**Remediation**:
1. Rotate ALL secrets IMMEDIATELY
2. Remove secrets from git history
3. Use environment variables on production server only
4. Consider secrets manager (Doppler, AWS Secrets Manager, Vault)

```bash
# Generate new NEXTAUTH_SECRET
openssl rand -base64 32

# Remove from git history
git filter-repo --path backend/.env --invert-paths
git filter-repo --path frontend/.env --invert-paths
```

---

### 2. Insecure Authentication Pattern

**Location**: `/backend/app/dependencies.py`

**Problem**: Backend trusts `X-User-ID` header without verification. Any client can impersonate any user.

**Impact**: Complete authentication bypass - attackers can access any user's financial data.

**Remediation**: Implement JWT verification

```python
from jose import jwt, JWTError

async def get_current_user(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
) -> User:
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, NEXTAUTH_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
```

---

### 3. Missing Security Headers ✅ FIXED

**Add to nginx config** (`/etc/nginx/sites-enabled/firedup.app`):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

---

## 🟠 High Priority Issues

### 4. No CI/CD Pipeline

**Current**: Manual SSH deployments

**Recommended**: GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Backend
        run: |
          ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} \
            "cd /opt/home-budget/backend && git pull && sudo systemctl restart home-budget-backend"
```

---

### 5. No Database Backups

**Create backup script** (`/opt/backups/backup-homebudget.sh`):

```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
pg_dump -U postgres homebudget | gzip > "$BACKUP_DIR/homebudget_$DATE.sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
```

**Add to crontab**: `0 2 * * * /opt/backups/backup-homebudget.sh`

---

### 6. Default Password Fallback ✅ FIXED

**Location**: `/backend/app/database.py`

**Problem**:
```python
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "SuperSecret123!")  # ❌
```

**Fix**:
```python
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD")
if not POSTGRES_PASSWORD:
    raise ValueError("POSTGRES_PASSWORD environment variable is required")
```

---

## 🟡 Medium Priority Issues

### 7. Fix .env File Permissions

```bash
chmod 600 /opt/home-budget/backend/.env
chmod 600 /opt/home-budget/frontend/.env
```

### 8. Restrict CORS Headers ✅ FIXED

**Location**: `/backend/app/main.py`

**Change**:
```python
allow_headers=["*"]  # ❌ Too permissive
```

**To**:
```python
allow_headers=["Content-Type", "Authorization", "X-User-ID", "X-Requested-With"]
```

### 9. Add Infrastructure Monitoring

- Set up Uptime Robot (free) for HTTP monitoring
- Consider Prometheus + Grafana for detailed metrics
- Add SSL certificate expiry alerts

---

## ✅ What's Working Well

- Rate Limiting (SlowAPI)
- SSL/TLS (Let's Encrypt)
- CORS with specific origins
- Pydantic validation
- Excellent `backend/start.sh` script
- Sentry + PostHog monitoring
- Error boundaries in frontend
- Database connection pooling

---

## Quick Wins Checklist

- [ ] Rotate all secrets (30 min)
- [x] Add security headers to nginx ✅
- [ ] Fix .env file permissions (5 min)
- [ ] Remove secrets from git history (20 min)
- [ ] Implement database backups (30 min)

---

## Timeline

| Priority | Action | Timeline |
|----------|--------|----------|
| 🔴 CRITICAL | Rotate all secrets | **TODAY** |
| 🔴 CRITICAL | Fix authentication vulnerability | **This Week** |
| 🔴 CRITICAL | Remove secrets from git history | **This Week** |
| ✅ DONE | Add security headers | ~~This Week~~ |
| 🟠 HIGH | Implement database backups | **This Week** |
| 🟡 MEDIUM | Set up CI/CD pipeline | **2 Weeks** |
| 🟡 MEDIUM | Add infrastructure monitoring | **2 Weeks** |
| 🟡 MEDIUM | Update dependencies | **2 Weeks** |
