# FamVacay — Family Vacation Optimizer

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](renovate.json)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7--alpine-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Arch-2496ED.svg)](Dockerfile)
[![Coverage](https://img.shields.io/badge/Coverage-96.06%25-brightgreen.svg)](vitest.config.ts)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Planning memorable family vacations shouldn't mean drowning in spreadsheets, cross-referencing school calendars, or paying peak-season flight premiums. 

**FamVacay** is a self-hostable web application designed for parents and families. It mathematically solves the vacation constraint satisfaction problem by harmonizing school holiday calendars, taking advantage of neighboring-state departure arbitrage, matching weather comfort profiles, and maximizing public holiday bridge days so you use fewer hard-earned days off.

Engineered with modern cloud-agnostic standards, FamVacay runs seamlessly on your home lab or cluster via Docker Compose or Kubernetes behind your preferred reverse proxy (Traefik, Nginx, Nginx Proxy Manager, or Caddy).

---

## ✈️ Core Family Features

### 1. Smart School Holiday Enforcement
When you travel with school-aged children (ages 6 and above), missing school is rarely an option. FamVacay automatically pulls statutory school break schedules from the OpenHolidays API (cached locally in Redis for 30 days) and guarantees that vacation proposals fit strictly within approved school holidays.

### 2. Cross-Border Flight Arbitrage
School holidays in neighboring federal states or countries rarely start on the exact same date. FamVacay scans departure airports in adjacent jurisdictions (e.g., flying out of Frankfurt/Hessen while Baden-Württemberg is on summer break) to reveal savings of 25% to 45% compared to home airports in high season.

### 3. PTO & Bridge Day Maximization
Parental leave is precious. The optimization engine counts weekdays and public holidays inside candidate windows to minimize consumed vacation days:
$$\text{PTO\_days\_consumed} = \text{total\_weekdays} - \text{public\_holidays}$$
You get clear recommendations for long getaways that cost the fewest PTO days from work.

### 4. Family Profile & Child Age Tiers
Every family member is unique. In your dedicated Family Profile, you can:
- Register participating family members and exact birth dates.
- Automatically calculate airline pricing tiers: infants (<2 years at ~10% fare), children (2–11 years at ~75% fare), and teens/adults (12+ years at 100%).
- Set travel comfort settings, including maximum driving radius to airports and cabin class preferences.
- Enable automated passport expiry tracking to prevent surprise airport rejections.

### 5. Multi-User Authentication & Passkeys
Families can safely store their trip plans and profiles with modern, passwordless login options:
- Traditional Email & Password (secured with bcrypt).
- Biometric Passkeys & WebAuthn (Touch ID, Face ID, Windows Hello, YubiKey).
- Social Logins (Google and Apple).
- Account linking to bind multiple authentication methods to one family account.

---

## 🛠️ Architecture & Network Hardening

FamVacay exposes plain internal HTTP on port `3000` and assumes TLS termination is handled externally.

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

- **Header Trust & Leak Prevention**: All absolute redirects and canonical URLs are derived strictly from `APP_URL` or forwarded headers, preventing internal port 3000 leaks.
- **CSRF Protection in Server Actions**: `next.config.js` dynamically populates `experimental.serverActions.allowedOrigins` using `APP_URL` and `ALLOWED_ORIGINS`.
- **Zero Host Port Exposure**: PostgreSQL and Redis communicate exclusively over an internal Docker bridge network (`internal: true`).

---

## 📦 Automated Dependency Updates (Renovate)

To keep the application secure, resilient, and up to date without overwhelming maintainers with notifications, FamVacay utilizes **Renovate Bot** (`renovate.json`):

- **Noise Reduction via Grouping**:
  - Minor and patch updates for production dependencies are bundled into a single weekly update pull request (`production minor and patch updates`).
  - Linters, TypeScript tools, Tailwind, PostCSS, and test runners (Vitest, Playwright) are grouped together (`development & quality toolchain`).
  - Major version updates are generated as isolated pull requests with explicit `major-update` labels for focused review.
- **Immediate Security Alerts**:
  - Vulnerability and CVE alerts bypass standard schedules and generate prioritized PRs immediately.
- **Predictable Schedule**:
  - Non-critical routine updates run outside working hours (before 5:00 AM UTC on Mondays) with rate limits (maximum 2 PRs per hour, 5 concurrent PRs).
- **Supply Chain Security**:
  - GitHub Actions workflows pin immutable commit SHAs with inline release tag comments.
  - Automated CI validation (`.github/workflows/renovate-validator.yml`) verifies the Renovate configuration on every change.

---

## 📋 Database Models (Prisma)

The application schema is defined in `prisma/schema.prisma`:

- **User**: User credentials, email verification status, and relations to sessions and profiles.
- **Account**: OAuth tokens for Google and Apple social sign-in.
- **Session**: Active user session tokens.
- **Authenticator**: WebAuthn credential metadata (credential ID, public key, counter) for Passkeys.
- **FamilyProfile**: Centralized family entity containing `homeLocation`, `federalState`, `originAirports`, `maxDrivingHours`, `preferredCabinClass`, `climatePreference`, and `passportCheckRequired`.
- **FamilyMember**: Family members with individual `firstName`, `role` (`PARENT`, `CHILD`, `INFANT`, `OTHER`), `birthDate`, `schoolRequired`, `passportExpiry`, and dietary preferences.
- **BlackoutDate**: Hard excluded dates (e.g. work project deadlines or family commitments).
- **TripPlan**: Vacation search configurations, durations, and budget boundaries.

---

## 🔌 API Reference

### Authentication
- `POST /api/auth/register` — Create a new account with email and password.
- `POST /api/auth/[...nextauth]` — NextAuth endpoint handling credentials and social logins.
- `POST /api/auth/passkeys/register-options` — Generate WebAuthn passkey registration options.
- `POST /api/auth/passkeys/verify-registration` — Verify and persist a new biometric passkey.
- `GET /api/auth/linked-accounts` — View active authentication methods linked to the user account.

### Family Profile
- `GET /api/family-profile` — Fetch the current family profile, member roster, and travel preferences.
- `POST /api/family-profile` — Create or update family profile attributes and member details.

### Vacation Optimizer
- `POST /api/vacations/optimize` — Run the constraint satisfaction engine against family constraints, school holiday schedules, and climate benchmarks.

### System Health
- `GET /api/health` — Liveness and readiness probe reporting status of application, PostgreSQL, and Redis.

---

## 🚀 Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `APP_URL` | Public-facing URL behind your reverse proxy | `https://vacations.example.com` |
| `ALLOWED_ORIGINS` | Whitelist for Server Actions CSRF protection | `vacations.example.com,localhost:3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://famvacay:secret@postgres:5432/famvacay_db?schema=public` |
| `REDIS_URL` | Redis instance URL | `redis://redis:6379` |
| `NEXTAUTH_SECRET` | Secret key used to sign session cookies | Secure random 32+ character string |
| `NEXTAUTH_URL` | Base URL for NextAuth authentication | `https://vacations.example.com` |
| `GOOGLE_CLIENT_ID` | Optional Google OAuth Client ID | Empty |
| `GOOGLE_CLIENT_SECRET` | Optional Google OAuth Client Secret | Empty |
| `APPLE_ID` | Optional Apple Sign-In Client ID | Empty |
| `APPLE_SECRET` | Optional Apple Sign-In Secret | Empty |
| `AMADEUS_CLIENT_ID` | Optional Amadeus API flight pricing key | Empty (falls back to benchmark) |
| `AMADEUS_CLIENT_SECRET` | Optional Amadeus API flight pricing secret | Empty (falls back to benchmark) |

### 2. Deploy with Docker Compose

1. Create the reverse proxy external network if it does not already exist:
   ```bash
   docker network create proxy-network
   ```

2. Start the FamVacay container stack:
   ```bash
   docker compose up -d --build
   ```

The container automatically applies Prisma migrations upon startup before serving traffic on internal port `3000`.

### 3. Deploy on Kubernetes

Clean, Kustomize-ready manifests are located in the `k8s/` directory.

1. Adjust values in `k8s/secret.yaml` and `k8s/configmap.yaml`.
2. Apply the configuration:
   ```bash
   kubectl apply -k k8s/
   ```

The web deployment runs `prisma migrate deploy` in an `initContainers` step to prevent race conditions during multi-replica rollouts.

---

## 🧪 Testing & Verification

FamVacay maintains strict test coverage standards across core optimizer logic, holiday calculations, and security utilities:

```bash
# Run unit and algorithm test suite
npm test

# Run Vitest test coverage check (>80% required)
npm run test:coverage

# Run TypeScript typecheck
npm run typecheck

# Run Playwright E2E journey tests
npm run test:e2e
```

**Quality Metrics**:
- Statements: 96.06%
- Branches: 92.43%
- Functions: 100.00%
- Lines: 96.06%
