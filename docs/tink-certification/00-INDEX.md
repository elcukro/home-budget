# Tink Production Certification Documentation Package

**Application:** FiredUp
**Company:** FiredUp Łukasz Górski
**Prepared:** February 2026
**Version:** 1.0

---

## Overview

This documentation package has been prepared to support FiredUp's application for Tink API production access. FiredUp is a personal finance management SaaS application targeting Polish consumers, providing read-only access to bank account data for budgeting and expense tracking purposes.

---

## Table of Contents

| Document | Description | Status |
|----------|-------------|--------|
| [01-COMPANY-PROFILE.md](./01-COMPANY-PROFILE.md) | Company registration, contact details, and business information | Complete |
| [02-PRODUCT-DESCRIPTION.md](./02-PRODUCT-DESCRIPTION.md) | Product overview, use case, target market, and business model | Complete |
| [03-TECHNICAL-ARCHITECTURE.md](./03-TECHNICAL-ARCHITECTURE.md) | System architecture, data flow diagrams, and integration design | Complete |
| [04-SECURITY-MEASURES.md](./04-SECURITY-MEASURES.md) | Security controls, encryption, access management, and monitoring | Complete |
| [05-DATA-HANDLING.md](./05-DATA-HANDLING.md) | GDPR compliance, data retention policies, and deletion procedures | Complete |
| [06-API-INTEGRATION.md](./06-API-INTEGRATION.md) | Tink API endpoints used, OAuth scopes, and implementation details | Complete |
| [07-TESTING-EVIDENCE.md](./07-TESTING-EVIDENCE.md) | Sandbox testing results, test coverage, and validation evidence | Complete |

---

## Quick Reference

### Use Case Summary
- **Type:** Account Information Service (AISP) - read-only
- **Market:** Poland (PL)
- **Target Users:** Polish consumers for personal finance management
- **Estimated Volume:** 100-1,000 users, ~1,000 API requests/day

### Tink Products Required
- Transactions (Standard Plan)
- Account Check (Standard Plan)
- Balance Check (Standard Plan)

### Key Links
- **Production Application:** https://firedup.app
- **Privacy Policy:** https://firedup.app/privacy
- **Terms of Service:** https://firedup.app/terms

---

## Compliance Checklist

### Legal Documentation
- [x] Privacy Policy with Tink data handling disclosure
- [x] Terms of Service with banking integration consent
- [x] GDPR compliance (data retention, user rights, deletion procedures)
- [x] Company registration (NIP, address)

### Technical Requirements
- [x] HTTPS/TLS for all connections
- [x] Secure token storage in database
- [x] No bank credential storage
- [x] State token CSRF protection (HMAC-SHA256)
- [x] Retry logic with exponential backoff
- [x] Rate limiting per user per endpoint
- [x] Audit logging (TinkAuditLog)
- [x] Error monitoring (Sentry)

### Testing
- [x] Sandbox integration complete
- [x] Demo bank testing (Poland market)
- [x] Unit tests for Tink service
- [x] Integration tests for API endpoints

---

## Contact Information

**For Tink Certification Questions:**
- Email: contact@firedup.app
- Website: https://firedup.app

**Technical Contact:**
- Łukasz Górski
- Email: privacy@firedup.app

---

## Related Documentation

### Internal Documentation
- [Tink API Integration Guide](../tink-api/00-integration-status.md)
- [Authentication Flow](../tink-api/01-authentication.md)
- [Tink Link Integration](../tink-api/02-tink-link.md)
- [Accounts & Transactions](../tink-api/03-accounts-transactions.md)
- [Sandbox Testing](../tink-api/04-sandbox-testing.md)
- [Production Requirements](../tink-api/05-production-requirements.md)
- [Production Deployment Plan](../tink-api/06-production-deployment-plan.md)

### External Resources
- [Tink Documentation](https://docs.tink.com)
- [Tink Console](https://console.tink.com)
- [Tink Privacy Policy](https://tink.com/legal/privacy-policy)
- [Tink End User Terms](https://tink.com/legal/end-user-terms)
- [Consumer Revocation Portal](https://tink.com/consumer/revocation)
