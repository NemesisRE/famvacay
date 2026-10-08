# System Architecture & Technical Specifications

This document outlines the architectural patterns, data models, authentication flows, and network configurations powering FamVacay.

---

## High-Level Topology

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
|   |  * Internationalization Context & Catalogs (src/lib/i18n/)                |   |
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

## Reverse Proxy & Network Hardening

1. **Protocol and Host Awareness (`src/lib/proxy/headers.ts`)**:
   - The application expects plain HTTP internally on port `3000` and trusts standard forwarding headers (`X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`).
   - Absolute redirects and canonical URLs are generated from `APP_URL` to prevent internal port leakage (`3000`).
2. **CSRF Protection in Next.js Server Actions**:
   - `next.config.js` sets `experimental.serverActions.allowedOrigins` dynamically based on `APP_URL` and `ALLOWED_ORIGINS`.
3. **Database & Cache Isolation**:
   - In `docker-compose.yml`, the `backend-internal` network uses `internal: true`. PostgreSQL and Redis use `expose:` instead of `ports:` to block direct host access.

---

## Authentication Architecture

The multi-user system is implemented via NextAuth with JWT sessions and Prisma Adapter persistence:

- **Email & Password**: Password hashes are salted and hashed using `bcrypt` (cost factor 12).
- **Passkeys & WebAuthn**: Supported via `@simplewebauthn/server` and `@simplewebauthn/browser`.
  - Registration Options: `POST /api/auth/passkeys/register-options`
  - Verification & Persistence: `POST /api/auth/passkeys/verify-registration`
  - Challenges are stored in Redis with a 5-minute TTL.
- **Social Logins**: OAuth2 integration with Google (`GoogleProvider`) and Apple (`AppleProvider`).
- **Account Linking**: Users can connect multiple login mechanisms to a single profile.

---

## Data Models (`prisma/schema.prisma`)

```prisma
model User {
  id            String          @id @default(uuid())
  name          String?
  email         String?         @unique
  emailVerified DateTime?
  passwordHash  String?
  image         String?
  accounts      Account[]
  sessions      Session[]
  passkeys      Authenticator[]
  familyProfile FamilyProfile?
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt
}

model FamilyProfile {
  id                    String         @id @default(uuid())
  userId                String         @unique
  user                  User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  familyName            String?
  homeLocation          String         // Postal code / City
  federalState          String         // e.g. "DE-BW"
  originAirports        String[]       // e.g. ["STR", "FRA", "BSL"]
  maxDrivingHours       Float?         @default(2.5)
  preferredCabinClass   String?        @default("ECONOMY")
  climatePreference     String?        @default("MODERATE")
  passportCheckRequired Boolean        @default(false)
  travelModes           String[]       @default(["FLIGHT", "CAR"]) // e.g. ["CAR", "TRAIN", "FLIGHT", "CAMPER"]
  membersCount          Int            @default(1)
  members               FamilyMember[]
  blackoutRanges        BlackoutDate[]
  trips                 TripPlan[]
}

model FamilyMember {
  id              String        @id @default(uuid())
  familyProfileId String
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)
  firstName       String?
  role            String        // "PARENT", "CHILD", "INFANT", "OTHER"
  birthDate       DateTime
  schoolRequired  Boolean       @default(false)
  passportExpiry  DateTime?
  specialDiet     String?
}
```

---

## Optimization Engine (CSP)

The optimization engine (`src/lib/optimizer/engine.ts`) solves candidate windows $[Start\_Date, End\_Date]$ of length $N$:

1. **School Holiday Hard Constraint**:
   If any member is $\ge 6$ years old, candidate windows must fall completely inside the state's school holiday interval.
2. **Flight Arbitrage Detection**:
   Evaluates departure airports located in neighboring jurisdictions where schools remain in session.
3. **Parental Leave Minimization**:
   Calculates consumed PTO:
   $$\text{PTO\_days} = \text{total\_weekdays} - \text{public\_holidays}$$
4. **Multi-Objective Scoring**:
   $$\text{Score} = (w_1 \cdot \text{Price}) + (w_2 \cdot \text{Weather}) + (w_3 \cdot \text{PTO}) - (w_4 \cdot \text{Friction})$$

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user with email and password |
| `POST` | `/api/auth/[...nextauth]` | NextAuth authentication handler |
| `POST` | `/api/auth/passkeys/register-options` | Generate WebAuthn passkey options |
| `POST` | `/api/auth/passkeys/verify-registration` | Verify and save WebAuthn passkey |
| `GET` | `/api/auth/linked-accounts` | List linked authentication methods |
| `GET` | `/api/family-profile` | Retrieve family profile and member roster |
| `POST` | `/api/family-profile` | Create or update family profile |
| `POST` | `/api/vacations/optimize` | Execute CSP vacation optimization engine |
| `GET` | `/api/health` | Application, database, and Redis health check |

