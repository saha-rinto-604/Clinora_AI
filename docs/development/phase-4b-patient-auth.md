# Clinora AI — Phase 4B Patient Authentication

**Status:** implementation
**Patch base:** `main` at Phase 4A merge `15896564b1c7502454d71e60b9b19dae8005f8a4`

## Scope

Phase 4B implements:

- Patient-only self-registration;
- real email verification;
- login;
- 15-minute JWT access token;
- 7-day rotating server-side refresh session;
- logout;
- authenticated account identity;
- forgot/reset password;
- authenticated password change;
- session listing/revocation;
- protected `/account`;
- real transactional email through the existing provider abstraction.

Doctor/Researcher applications remain Phase 4C. System Admin access review and Doctor interviews remain Phase 4D.

## Security decisions

- registration accepts no role field and always creates `PATIENT`;
- email verification link lifetime: 24 hours;
- password reset link lifetime: 30 minutes;
- BCrypt strength remains 12;
- access token remains memory-only in the browser;
- refresh token remains an opaque rotating token in an HttpOnly `clinora_refresh` cookie;
- local cookie uses `SameSite=Lax` and `Secure=false`;
- production defaults to `Secure=true`;
- password reset revokes all sessions;
- password change revokes other sessions and rotates the current refresh token;
- refresh checks current account state before rotation;
- sensitive auth endpoints use Redis-backed rate limiting;
- forgot-password and verification-resend responses are enumeration-resistant;
- no password, raw verification/reset token, or raw refresh token is logged or stored in PostgreSQL.

## Real email on localhost

Use backend environment configuration:

```text
EMAIL_PROVIDER=resend
RESEND_API_KEY=<backend-only-secret>
MAIL_FROM=Clinora AI <verified-sender@your-domain>
APP_FRONTEND_URL=http://localhost:5173
```

The React frontend never receives the provider key.

## Frontend routes

```text
/login
/register
/verify-email
/forgot-password
/reset-password
/account
```

## Backend routes

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
PATCH  /api/v1/auth/change-password
GET    /api/v1/auth/me
GET    /api/v1/auth/sessions
DELETE /api/v1/auth/sessions/{sessionId}
POST   /api/v1/auth/sessions/revoke-others
```

Phase 4B intentionally does not create dashboards, medical profiles, report upload, OCR, AI, appointments, Doctor applications, Researcher applications, or Admin review.
