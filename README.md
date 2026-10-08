# FamVacay (Family Vacation Optimizer)

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7--alpine-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Arch-2496ED.svg)](Dockerfile)
[![Coverage](https://img.shields.io/badge/Coverage-96.06%25-brightgreen.svg)](vitest.config.ts)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

FamVacay is a self-hostable Web Application engineered to identify mathematically optimal vacation windows for families. It solves a multi-objective constraint satisfaction problem by correlating statutory school holiday schedules, cross-border flight arbitrage, historical weather indices, and bridge day parental leave minimization.

The application is cloud-agnostic, requires no proprietary platform dependencies, and is designed to run behind external TLS-terminating reverse proxies (such as Traefik, Nginx, Nginx Proxy Manager, or Caddy) via Docker Compose or Kubernetes.

---

## Architecture Overview

```
                      +-----------------------------------+
                      |   Host Reverse Proxy (TLS / 443)  |
                      |   Traefik / Nginx / NPM / Caddy   |
                      +-----------------+-----------------+
                                        | Plain HTTP (Port 3000)
                                        | Headers: X-Forwarded-Host, Proto, For
                                        v
+-----------------------------------------------------------------------------------+
| Container Network: proxy-network                                                  |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | Next.js Standalone Container (famvacay-web, UID 10001: nextjs)           |   |
|   |                                                                           |   |
|   |  * Proxy Header Resolver (src/lib/proxy/headers.ts)                       |   |
|   |  * Multi-Provider NextAuth & WebAuthn / Passkeys (src/lib/auth/)          |   |
|   |  * CSP Vacation Optimizer Engine (src/lib/optimizer/)                     |   |
|   +-------------------------------------+-------------------------------------+   |
+-----------------------------------------|-----------------------------------------+
                                          |
+-----------------------------------------|-----------------------------------------+
| Container Network: backend-internal (internal: true, zero host exposure)          |
|                                         |                                         |
|         +-------------------------------+-------------------------------+         |
|         |                                                               |         |
|         v                                                               v         |
|  +--------------------+                                         +---------------+ |
|  | PostgreSQL 16      |                                         | Redis 7       | |
|  | Prisma Schema      |                                         | Cache Engine  | |
|  | Port 5432 (expose) |                                         | Port 6379     | |
|  +--------------------+                                         +---------------+ |
+-----------------------------------------------------------------------------------+
```

---

## Key Capabilities

1. **Constraint Satisfaction Problem (CSP) Engine**
   - Hard School Holiday Enforcement: Constrains date windows when school-age children (6 years or older) are registered.
   - Neighboring State Flight Arbitrage: Identifies pricing opportunities by cross-referencing departure airports in adjacent jurisdictions where schools remain in session.
   - Parental Leave / Bridge Day Minimization: Calculates consumed parental leave (`PTO_days_consumed = total_weekdays - public_holidays`).
   - Climate Suitability Validation: Filters destination options based on historical Open-Meteo climate records.
   - Multi-Objective Scoring: Applies weighted normalized scoring across price, weather, parental leave efficiency, and logistical travel friction.

2. **Authentication and Multi-User Support**
   - Credential Authentication: Secure email and password registration with bcrypt password hashing.
   - Passkeys and WebAuthn: Hardware security keys and biometric authentication (Windows Hello, Touch ID, YubiKey) powered by `@simplewebauthn`.
   - Social Authentication: OAuth2 providers for Google and Apple accounts.
   - Account Linking: Enables binding multiple authentication mechanisms to a single family profile.

3. **Family Profile Management**
   - Registration of all participating family members, roles, and birth dates.
   - Automated age tier classification (Infant <2 years, Child 2-11 years, Teen/Adult 12+ years).
   - Configurable departure airport radius and maximum acceptable transit duration.
   - Tracking of international travel constraints, including passport validity warnings.

4. **Self-Hosting and Reverse Proxy Hardening**
   - Header Resolution: Fully trusts `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`.
   - Port Leak Prevention: Canonical URLs and absolute redirects strictly derive from the configured public `APP_URL`.
   - Dynamic CSRF Origins: Configures `experimental.serverActions.allowedOrigins` dynamically from `APP_URL` and `ALLOWED_ORIGINS`.
   - Zero Host Port Leaks: Internal data services (PostgreSQL, Redis) are isolated to internal Docker bridge networks with zero host port bindings.

---

## Database Models (Prisma)

The application schema is managed in `prisma/schema.prisma`:

- **User**: Root account entity holding credentials, verification state, and references to authenticators and family data.
- **Account**: NextAuth OAuth token storage for Google and Apple sign-in.
- **Session**: Stateful or JWT-backed session records.
- **VerificationToken**: Email verification and password reset tokens.
- **Authenticator**: WebAuthn credential metadata (credentialID, credentialPublicKey, counter, transports) for Passkey support.
- **FamilyProfile**: Centralized profile tracking `homeLocation`, `federalState`, `originAirports`, `maxDrivingHours`, `preferredCabinClass`, `climatePreference`, and `passportCheckRequired`.
- **FamilyMember**: Participating travelers linked to `FamilyProfile` tracking `firstName`, `role`, `birthDate`, `schoolRequired`, `passportExpiry`, and `specialDiet`.
- **BlackoutDate**: Excluded date intervals representing professional freezes or immutable commitments.
- **TripPlan**: Vacation search configurations and constraints.

---

## API Endpoints

### Authentication
- `POST /api/auth/register`: Create a new user account via email and password.
- `POST /api/auth/[...nextauth]`: NextAuth handler supporting credentials and OAuth providers.
- `POST /api/auth/passkeys/register-options`: Generate WebAuthn attestation options for passkey enrollment.
- `POST /api/auth/passkeys/verify-registration`: Verify and store passkey credentials.
- `GET /api/auth/linked-accounts`: Retrieve active authentication methods for the current session.

### Family Profile
- `GET /api/family-profile`: Retrieve the authenticated user's family profile, member roster, and blackout dates.
- `POST /api/family-profile`: Create or update family profile attributes, member definitions, and preferences.

### Vacation Optimizer
- `POST /api/vacations/optimize`: Execute the CSP vacation engine against input dates, destinations, and family constraints.

### System & Health
- `GET /api/health`: Liveness and readiness probe reporting status of application, PostgreSQL connection, and Redis availability.

---

## Environment Variables

Copy `.env.example` to `.env` and configure appropriate values:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_URL` | Public canonical base URL behind reverse proxy | `https://vacations.example.com` |
| `ALLOWED_ORIGINS` | Comma-separated domains for Next.js Server Actions CSRF whitelist | `vacations.example.com,localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://famvacay:secret@postgres:5432/famvacay_db?schema=public` |
| `REDIS_URL` | Redis connection URL | `redis://redis:6379` |
| `NEXTAUTH_SECRET` | Cryptographic secret for signing session tokens | Secure random string (min 32 chars) |
| `NEXTAUTH_URL` | Canonical URL for NextAuth callbacks | `https://vacations.example.com` |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth client identifier | Empty |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth client secret | Empty |
| `APPLE_ID` | Optional Apple Services identifier | Empty |
| `APPLE_SECRET` | Optional Apple private key / secret | Empty |
| `AMADEUS_CLIENT_ID` | Optional Amadeus API key for live flight pricing | Empty (falls back to benchmark) |
| `AMADEUS_CLIENT_SECRET` | Optional Amadeus API secret | Empty (falls back to benchmark) |

---

## Deployment Instructions

### Method 1: Docker Compose (Recommended)

1. Ensure the reverse proxy external network exists:
   ```bash
   docker network create proxy-network
   ```

2. Create and populate configuration:
   ```bash
   cp .env.example .env
   # Edit .env with your domain and database credentials
   ```

3. Launch services:
   ```bash
   docker compose up -d --build
   ```

The application automatically executes database migrations via `docker-entrypoint.sh` prior to listening on internal port `3000`.

### Method 2: Kubernetes Manifests

Clean, Kustomize-compatible manifests are provided in the `k8s/` directory.

1. Configure secrets and parameters in `k8s/secret.yaml` and `k8s/configmap.yaml`.
2. Apply manifests using Kustomize:
   ```bash
   kubectl apply -k k8s/
   ```

The Kubernetes deployment utilizes an `initContainers` pattern (`prisma migrate deploy`) on the `famvacay-web` deployment to prevent database race conditions across multi-replica rollouts.

---

## Testing & Quality Gates

Run the automated test suite locally:

```bash
# Execute unit and algorithm tests
npm test

# Run test coverage verification (>80% required on core logic)
npm run test:coverage

# Run TypeScript typechecking
npm run typecheck

# Execute end-to-end user journey tests
npm run test:e2e
```

Current test metrics:
- Statements: 96.06%
- Branches: 92.43%
- Functions: 100.00%
- Lines: 96.06%
