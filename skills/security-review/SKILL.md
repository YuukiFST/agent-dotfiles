---
name: security-review
description: Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive security checklist and patterns.
metadata:
  origin: ECC
disable-model-invocation: true
---

# Security Review Skill

This skill ensures all code follows security best practices and identifies potential vulnerabilities.

## When to Activate

- Implementing authentication or authorization
- Handling user input or file uploads
- Creating new API endpoints
- Working with secrets or credentials
- Implementing payment features
- Storing or transmitting sensitive data
- Integrating third-party APIs

## How to Use This Skill (MANDATORY)

The deep checklists live in `references/`. For every surface the change touches, you MUST read the matching reference file before reviewing or writing that code — the pointers below are not optional. Content there is the authoritative rule set (FAIL/PASS patterns + per-category verification steps).

| Surface touched | Read (mandatory) |
|---|---|
| Secrets, credentials, env vars, API keys | `references/secrets.md` |
| User input, forms, file uploads, database queries / SQL | `references/input-validation.md` |
| Authentication, authorization, sessions, JWT, RLS, roles | `references/auth.md` |
| Rendering user content, HTML, CSP, cookies, CSRF, rate limiting, API endpoints | `references/web-hardening.md` |
| Logging, error messages, sensitive data display | `references/data-exposure.md` |
| Blockchain / Solana wallets or transactions | `references/blockchain.md` |
| Dependencies, npm packages, or writing security tests | `references/dependencies-and-testing.md` |
| Cloud infra (IAM, buckets, networking, CI/CD, containers) | `cloud-infrastructure-security.md` |

A full security review reads ALL of the above. When unsure whether a surface applies, read its file — err on the side of reading.

## Security Checklist — Categories

1. Secrets Management — no hardcoded secrets, env vars only
2. Input Validation — schema-validate everything, restrict uploads
3. SQL Injection Prevention — parameterized queries only
4. Authentication & Authorization — httpOnly cookies, authz checks, RLS
5. XSS Prevention — sanitize HTML, strict CSP
6. CSRF Protection — tokens + SameSite=Strict
7. Rate Limiting — all endpoints, stricter on expensive ops
8. Sensitive Data Exposure — redact logs, generic user-facing errors
9. Blockchain Security — verify signatures and transactions
10. Dependency Security — audit, update, commit lock files

## Pre-Deployment Security Checklist

Before ANY production deployment:

- [ ] **Secrets**: No hardcoded secrets, all in env vars
- [ ] **Input Validation**: All user inputs validated
- [ ] **SQL Injection**: All queries parameterized
- [ ] **XSS**: User content sanitized
- [ ] **CSRF**: Protection enabled
- [ ] **Authentication**: Proper token handling
- [ ] **Authorization**: Role checks in place
- [ ] **Rate Limiting**: Enabled on all endpoints
- [ ] **HTTPS**: Enforced in production
- [ ] **Security Headers**: CSP, X-Frame-Options configured
- [ ] **Error Handling**: No sensitive data in errors
- [ ] **Logging**: No sensitive data logged
- [ ] **Dependencies**: Up to date, no vulnerabilities
- [ ] **Row Level Security**: Enabled in Supabase
- [ ] **CORS**: Properly configured
- [ ] **File Uploads**: Validated (size, type)
- [ ] **Wallet Signatures**: Verified (if blockchain)

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/auth)
- [Web Security Academy](https://portswigger.net/web-security)

---

**Remember**: Security is not optional. One vulnerability can compromise the entire platform. When in doubt, err on the side of caution.
