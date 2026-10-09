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
|   |  * Account & Credential Management (src/app/api/account/)                 |   |
|   |  * Dynamic Airport & Flight Corridor Engine (airport-service.ts)          |   |
|   |  * Forward Geocoding Engine (src/lib/geo/geocoding.ts)                    |   |
|   |  * Multi-Destination Resolver (src/lib/optimizer/destinations.ts)         |   |
|   |  * CSP Vacation Optimizer Engine (src/lib/optimizer/engine.ts)            |   |
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

## Authentication & Account Architecture

The multi-user system is implemented via NextAuth with JWT sessions and Prisma Adapter persistence:

- **Email & Password**: Password hashes are salted and hashed using `bcrypt` (cost factor 12).
- **Passkeys & WebAuthn**: Supported via `@simplewebauthn/server` and `@simplewebauthn/browser`.
  - Registration Options: `POST /api/auth/passkeys/register-options`
  - Verification & Persistence: `POST /api/auth/passkeys/verify-registration`
  - Challenges are stored in Redis with a 5-minute TTL.
- **Social Logins**: OAuth2 integration with Google (`GoogleProvider`) and Apple (`AppleProvider`).
- **Account Linking**: Users can connect multiple login mechanisms to a single profile.
- **Account Management & Credential Lifecycle (`src/app/api/account/`)**:
  - `POST /api/account/email`: Validates format and checks for duplicate collisions across user accounts.
  - `POST /api/account/password`: Enforces current password verification and 8+ character strength rules.
  - `GET /api/account/passkeys`: Returns enrolled WebAuthn authenticators with counter and device metadata.
  - `DELETE /api/account/passkeys`: Removes selected authenticators while enforcing lockout protection.
  - `POST /api/account/unlink`: Unlinks third-party OAuth providers with lockout protection.
  - `DELETE /api/account`: Executes cascading deletion of user account, sessions, authenticators, linked accounts, and family profile records pursuant to GDPR requirements.
- **Lockout Prevention Rules**:
  - A user cannot delete their last WebAuthn passkey if no password and no third-party OAuth accounts are connected.
  - A user cannot unlink an OAuth account if doing so would leave them without any valid login mechanism (neither password nor passkey).

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
  homeLocation          String         // Postal code / City / Address
  federalState          String         // e.g. "DE-BW"
  originAirports        String[]       // e.g. ["STR", "FKB", "FRA", "CDG"]
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

## Regional Subdivisions & International School Calendars

The system coordinates jurisdictional school calendars across administrative subdivisions (`src/lib/regions/subdivisions.ts`):

- **Germany (`DE`)**: Complete coverage of all 16 federal states (`DE-BW`, `DE-BY`, `DE-BE`, `DE-BB`, `DE-HB`, `DE-HH`, `DE-HE`, `DE-MV`, `DE-NI`, `DE-NW`, `DE-RP`, `DE-SL`, `DE-SN`, `DE-ST`, `DE-SH`, `DE-TH`).
- **Austria (`AT`)**: All 9 Bundesländer (`AT-1` through `AT-9`).
- **Switzerland (`CH`)**: 10 primary Cantons (`CH-ZH`, `CH-BE`, `CH-BS`, `CH-BL`, `CH-GE`, `CH-VD`, etc.).
- **France (`FR`)**: Academic zones and administrative regions (`FR-IDF`, `FR-ARA`, `FR-GES`, etc.).
- **Spain (`ES`)**: Autonomous communities (`ES-MD`, `ES-CT`, `ES-AN`, `ES-VC`, etc.).
- **Italy (`IT`)**: Regional administrative authorities (`IT-LOM`, `IT-LAZ`, `IT-VEN`, etc.).

---

## Dynamic Departure Coordinates & Airport Proximity Engine

Departure hubs are resolved dynamically to eliminate fixed lists and inaccurate state-centroid approximations (`src/lib/airports/airport-service.ts`):

1. **Exact Coordinate Geocoding (`src/lib/geo/geocoding.ts`)**:
   - Departure distances are calculated strictly from the user's specific starting coordinates (`departureLat`, `departureLon`), rather than regional capital centroids.
   - Coordinates are resolved via OpenStreetMap Nominatim with a Redis caching layer and an offline European metropolitan index fallback.
2. **Geodesic Distance Calculation (`geolib`)**:
   - Distance from departure coordinates to candidate hubs is calculated using the Great-Circle Haversine formula:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
3. **High-Speed Rail (HSR) Connectivity Heuristics**:
   - Real-world travel options are not limited by national borders or road driving alone. Major high-speed rail corridors link cities directly to international mega-hubs:
     - **Southwest Germany / Karlsruhe to Paris (`CDG` / `ORY`)**: Karlsruhe Hauptbahnhof connects directly to Paris Gare de l'Est via TGV / ICE in 2.5 hours. Paris Charles de Gaulle and Orly offer competitive long-haul and Caribbean fares that often undercut domestic hubs like Munich or Frankfurt.
     - **Frankfurt AIRail (`FRA`)**: Direct high-speed train connections terminating directly under the terminal building.
     - **Rhineland to Brussels (`BRU`)**: Direct Eurostar / ICE service in under 1.8 hours.
     - **Lower Rhine to Amsterdam (`AMS`)**: Direct ICE service in approximately 2.2 hours.
   - Airports connected via high-speed rail corridors are tagged with `isHighSpeedRailConnected: true` and displayed with dedicated rail badges.
4. **Flight Corridor & Destination-Aware Airport Recommendations**:
   - When users select target travel destinations (such as Egypt, Bali, Cancun, Dubai, or Thailand), the airport suggestion engine dynamically surfaces major long-haul gateways (`FRA`, `CDG`, `MUC`, `AMS`, `ZRH`) and high-frequency charter departure hubs.
   - Airports offering specialized non-stop routes for the chosen destinations are highlighted with dedicated flight corridor notes (`flightCorridorNote`).
5. **Worldwide Custom Airport Search**:
   - Full in-memory index of 5,600+ IATA airports worldwide via `airport-data`. Users can search and select any commercial airport by city name, airport name, or 3-letter IATA code.

---

## Multi-Destination Architecture & Destination Resolvers

The vacation planner supports flexible multi-destination search configurations:

1. **Multi-Entry Tagging (`src/components/destination/MultiDestinationInput.tsx`)**:
   - Users can select or type multiple target countries, tourist regions, resort corridors, or cities (e.g., "Egypt", "Hurghada & Red Sea", "Turkish Riviera & Antalya", "Mallorca", "Bali", "Canary Islands").
2. **Destination Resolver Engine (`src/lib/optimizer/destinations.ts`)**:
   - Incoming destination tags are parsed against an extensive canonical destination catalog.
   - Tags are dynamically mapped to valid destination airport IATA codes (e.g., "Egypt" maps to `HRG` and `SSH`; "Turkish Riviera" maps to `AYT`; "Bali" maps to `DPS`; "Mallorca" maps to `PMI`).
   - Unrecognized custom tags are matched against global airport IATA records or catalog entries.

---

## Optimization Engine (CSP) & Cost Estimation

The optimization engine (`src/lib/optimizer/engine.ts`) solves candidate windows $[Start\_Date, End\_Date]$:

1. **Flexible Duration Exploration**:
   Evaluates window spans across user-defined duration ranges $[\text{durationDaysMin}, \text{durationDaysMax}]$ (e.g. 10 to 14 days), computing Pareto-optimal configurations.
2. **Multiple Blackout Periods (Sperrzeiten)**:
   Merges persistent profile blackouts with ad-hoc search blackouts:
   $$\text{Blackouts} = \text{ProfileBlackouts} \cup \text{SearchBlackouts}$$
   Any candidate window overlapping any blackout range is pruned.
3. **Dynamic Date-Relative Child Age Calculation**:
   Child ages are computed dynamically relative to the candidate window's departure date:
   $$\text{Age at Trip} = \lfloor(\text{startDate} - \text{birthDate}) / \text{1 year}\rfloor$$
   This prevents age classification errors when a child turns 2 (infant to child) or 6 (mandatory school age) between the search date and the planned trip date.
4. **School Holiday Hard Constraint**:
   If any child is $\ge 6$ years old on the departure date, the candidate window must fall completely inside the home jurisdiction's school break period.
5. **Automatic Age Fare Tier Derivation**:
   - Infant: $< 2$ years ($10\%$ base fare)
   - Child: $2 - 11$ years ($75\%$ base fare)
   - Teen / Adult: $\ge 12$ years ($100\%$ base fare)
6. **Realistic Family Trip Cost Calculation**:
   Aggregates both return flights and duration-scaled family accommodation lodging:
   $$\text{Total Cost} = \text{Flight Cost} + \text{Lodging Cost}$$
   $$\text{Flight Cost} = \text{Base Return Fare} \times \text{Passenger Multiplier} \times (1 - \text{Arbitrage Discount})$$
   $$\text{Lodging Cost} = \text{Nightly Lodging Benchmark} \times (\text{Duration Days} - 1)$$
   $$\text{Price Per Person} = \frac{\text{Total Cost}}{\text{Total Family Members}}$$
7. **Destination Seasonality Warnings**:
   Detects seasonal risks (`src/lib/optimizer/weather.ts`) for target destinations and exposes localized warning messages:
   - `MONSOON`: Tropical downpours and high humidity.
   - `EXTREME_HEAT`: Daytime temperatures exceeding safe family thresholds.
   - `TYPHOON_HURRICANE`: Tropical storm activity windows.
   - `OVERCROWDED_PEAK`: Peak surge crowds and inflated lodging.
8. **Flight Arbitrage Detection**:
   Evaluates departure airports located in neighboring jurisdictions where schools remain in session, factoring a $30\%$ price advantage.
9. **Parental Leave Minimization**:
   Calculates consumed PTO:
   $$\text{PTO\_days} = \text{total\_weekdays} - \text{public\_holidays}$$
10. **Multi-Objective Scoring**:
    $$\text{Score} = (w_1 \cdot \text{Price}) + (w_2 \cdot \text{Weather}) + (w_3 \cdot \text{PTO}) - (w_4 \cdot \text{Friction})$$

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user with email and password |
| `POST` | `/api/auth/[...nextauth]` | NextAuth authentication handler |
| `POST` | `/api/auth/passkeys/register-options` | Generate WebAuthn passkey registration options |
| `POST` | `/api/auth/passkeys/verify-registration` | Verify and save WebAuthn passkey |
| `GET` | `/api/auth/linked-accounts` | List linked authentication methods |
| `POST` | `/api/account/email` | Update user email address with duplicate collision check |
| `POST` | `/api/account/password` | Change account password with current password verification |
| `GET` | `/api/account/passkeys` | List enrolled WebAuthn authenticators |
| `DELETE` | `/api/account/passkeys` | Delete WebAuthn passkey with lockout protection |
| `POST` | `/api/account/unlink` | Unlink OAuth provider with lockout protection |
| `DELETE` | `/api/account` | Cascade delete user account and associated profile (GDPR) |
| `GET` | `/api/family-profile` | Retrieve family profile and member roster |
| `POST` | `/api/family-profile` | Create or update family profile |
| `GET` | `/api/locations/geocode` | Autocomplete and geocode departure location |
| `GET` | `/api/airports/search` | Search airports by query, proximity coordinates, or flight corridor destinations |
| `POST` | `/api/vacations/optimize` | Execute CSP vacation optimization engine |
| `GET` | `/api/health` | Application, database, and Redis health check |
