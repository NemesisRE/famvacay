# ADR 0001: Authentication Architecture & Self-Hosted Session Management

## Status
Accepted

## Context
FamVacay requires self-hostable authentication supporting:
1. Traditional email & password credentials (with bcrypt hashing, email verification, password reset).
2. Modern WebAuthn Passkeys (biometric/hardware keys via FIDO2/WebAuthn).
3. Social OAuth providers (Google, Apple, etc. enabled strictly via environment variables).
4. Account linking and unlinking with lockout prevention (cannot remove the last authentication method).
5. GDPR-compliant user and session lifecycle, active session revocation, and data export.

We evaluated Better Auth and Auth.js / NextAuth:
- **Better Auth:** A comprehensive modern TypeScript auth framework with built-in passkey support, two-factor authentication, and multi-tenant plugin architecture. Highly recommended for greenfield deployments.
- **NextAuth v4 / Auth.js with @simplewebauthn:** The existing implementation leverages NextAuth with the Prisma Adapter, complemented by `@simplewebauthn/server` and `@simplewebauthn/browser` for FIDO2 passkeys, and direct Prisma models for credentials and session revocation.

## Decision
We maintain the battle-tested, zero-external-cloud NextAuth + `@simplewebauthn` foundation, hardened with:
- Server-side session verification and manual session revocation.
- Strict lockout prevention in the account unlinking API: querying total active credential mechanisms (password, passkeys, linked OAuth accounts) and rejecting unlinking if only 1 method remains.
- Complete GDPR data export and deletion endpoints honoring multi-user flat family memberships (deleting the user's membership without corrupting other family members, and only cascading to delete the family profile when the last member departs).

## Consequences
- No cloud auth dependencies (e.g. Supabase, Clerk, Firebase); 100% self-hosted on PostgreSQL.
- Sessions run with HttpOnly, Secure, SameSite=Lax cookies and server-side invalidation.
- Future migration to Better Auth can be performed with minimal schema adjustments because tables follow standard OAuth/Authenticator relational schemas.

