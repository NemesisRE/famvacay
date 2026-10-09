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

## Dynamic Departure Coordinates & Unified Airport Service

Departure hubs and distance metrics are managed by a unified airport service (`src/lib/airports/airport-service.ts`) utilized identically by both the Family Profile and Vacation Search:

1. **Exact Coordinate Geocoding & Postal Code Resolution (`src/lib/geo/geocoding.ts`)**:
   - Departure distances are calculated strictly from the user's specific starting coordinates (`departureLat`, `departureLon`), rather than regional capital centroids.
   - The geocoding service resolves postal codes (e.g., "76334" to "76334 Eggenstein-Leopoldshafen") and metropolitan locations via OpenStreetMap Nominatim with a Redis caching layer and an offline European postal code and city index fallback.
   - Strict place verification ensures unverified free-text locations trigger validation warnings before submission.
2. **Geodesic Distance Calculation (`geolib`)**:
   - Distance from departure coordinates to candidate hubs is calculated using the Great-Circle Haversine formula:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
3. **High-Speed Rail (HSR) Connectivity Heuristics**:
   - Real-world travel options account for high-speed rail corridors linking cities directly to international mega-hubs:
     - **Southwest Germany / Karlsruhe to Paris (`CDG` / `ORY`)**: Karlsruhe Hauptbahnhof connects directly to Paris Gare de l'Est via TGV / ICE in 2.5 hours. Paris Charles de Gaulle and Orly offer competitive long-haul and Caribbean fares that often undercut domestic hubs like Munich or Frankfurt.
     - **Frankfurt AIRail (`FRA`)**: Direct high-speed train connections terminating directly under the terminal building.
     - **Rhineland to Brussels (`BRU`)**: Direct Eurostar / ICE service in under 1.8 hours.
     - **Lower Rhine to Amsterdam (`AMS`)**: Direct ICE service in approximately 2.2 hours.
   - Airports connected via high-speed rail corridors are tagged with `isHighSpeedRailConnected: true` and displayed with dedicated rail badges.
4. **Flight Corridor & Destination-Aware Airport Recommendations**:
   - When users select target travel destinations (such as Egypt, Bali, Cancun, Dubai, or Thailand), the airport suggestion engine dynamically surfaces major long-haul gateways (`FRA`, `CDG`, `MUC`, `AMS`, `ZRH`) and high-frequency charter departure hubs.
   - Airports offering specialized non-stop routes for the chosen destinations are highlighted with dedicated flight corridor notes (`flightCorridorNote`).
5. **Harmonized Naming and Localization Across Locales**:
   - Airport names, metropolitan city labels, and regional hubs are fully localized across all 5 supported languages (`en`, `de`, `fr`, `es`, `it`).
   - Binational and regional facilities display accurate nomenclature (for example, `BSL` displays as "EuroAirport Basel-Mulhouse-Freiburg / Basel-Mülhausen" rather than simply "Mulhouse").
   - Batch lookup via `/api/airports/search?codes=...&locale=...` ensures airport chip badges and suggestion lists remain synchronized.
6. **Worldwide Custom Airport Search**:
   - Full in-memory index of 5,600+ IATA airports worldwide via `airport-data`. Users can search and select any commercial airport by city name, airport name, or 3-letter IATA code.

---

## Multi-Destination Architecture & Entity Resolution

The vacation planner enforces structured destination validation, localized entity resolution, and strict search filtering:

1. **Strict Pre-Validation Pipeline (`validateDestinationInput`)**:
   - Destination tags are strictly pre-validated before they can be added as search filters.
   - Inputs are matched against canonical holiday destinations (`CANONICAL_DESTINATIONS`), normalized synonyms across 5 languages, or commercial IATA airport records.
   - Invalid, ambiguous, or fictitious inputs (such as "Mars") that cannot be mapped to a recognized vacation entity or commercial airport corridor are rejected with inline validation feedback.
2. **Resolved Entity Model & Category Metadata**:
   - Every valid destination resolves to a structured entity (`LocalizedDestinationEntity`) with explicit categorization:
     - `country`: Sovereign destination states (e.g., Egypt, Spain, Greece, Turkey, Italy, Portugal).
     - `region`: Tourist resort corridors and archipelagos (e.g., "Hurghada & Red Sea", "Mallorca (Balearic Islands)", "Canary Islands", "Turkish Riviera & Antalya", "Crete & Greek Islands").
     - `city`: Urban and cultural metropolitan destinations (e.g., Barcelona, Rome, Dubai).
     - `airport`: Specific commercial airport hubs.
   - Destination chips clearly render the resolved entity name and category badge (e.g., "Mallorca (Balearen) [Region]", "Ägypten [Land]", "Barcelona [Stadt]").
3. **End-to-End Localization Across Supported Locales**:
   - Destination names, country labels, and entity categories dynamically adjust to the active user locale (`en`, `de`, `fr`, `es`, `it`). For example, selecting the Red Sea corridor displays as "Hurghada & Rotes Meer [Region]" in German, "Hurghada & Red Sea [Region]" in English, and "Hurghada et Mer Rouge [Région]" in French.
4. **Destination-Bound Strict Matching & False Positive Elimination**:
   - When user queries specify target destinations, candidate generation is strictly constrained to the corresponding destination airport codes (e.g., searching for "Rotes Meer" resolves strictly to `HRG`, `SSH`, and `RMF`).
   - The engine eliminates arbitrary fallbacks to unrequested destinations (such as `PMI`, `AYT`, or `HER`).
   - If no candidate windows satisfy all duration, budget, or school constraints for the selected destination, the optimizer returns zero candidates, and the interface displays an explicit empty state ("No matching vacation periods found for the selected destination(s)"). Open exploration across all standard holiday hubs occurs solely when no destination filters are active.

---

## Optimization Engine (CSP) & Cost Estimation

The optimization engine (`src/lib/optimizer/engine.ts`) solves candidate windows $[Start\_Date, End\_Date]$:

1. **Flexible Duration Exploration**:
   Evaluates window spans across user-defined duration ranges $[\text{durationDaysMin}, \text{durationDaysMax}]$ (e.g. 10 to 14 days), computing Pareto-optimal configurations.
2. **Multi-Year Holiday Querying & Weekend Expansion**:
   - Holiday querying spans all calendar years intersected by the search window (e.g., spanning 2026 into 2027 for Christmas and New Year breaks).
   - School holidays recorded in Monday-to-Friday schedules are automatically expanded to include the preceding Saturday and trailing Sunday (+4 days), reflecting the true contiguous school break available to families.
3. **Two-Tier School Holiday Constraint & Graceful Fallback**:
   - If a family includes school-aged children ($\ge 6$ years old on departure date), the engine first attempts to identify windows completely enclosed within valid school holidays.
   - When user-specified trip duration exceeds the holiday break length (e.g., a 12-16 day vacation during a 9-day break) or falls outside official dates, the engine does not fail silently. Instead, it activates a fallback tier: candidate windows are scored by school holiday coverage ratio and tagged with `requiresSchoolExemption: true`, providing actionable choices with clear warnings.
4. **Multiple Blackout Periods (Sperrzeiten)**:
   Merges persistent profile blackouts with ad-hoc search blackouts:
   $$\text{Blackouts} = \text{ProfileBlackouts} \cup \text{SearchBlackouts}$$
   Any candidate window overlapping any blackout range is pruned.
5. **Dynamic Date-Relative Child Age & Fare Tier Calculation**:
   Child ages are computed dynamically relative to the candidate window's departure date:
   $$\text{Age at Trip} = \lfloor(\text{startDate} - \text{birthDate}) / \text{1 year}\rfloor$$
   Fare tiers and school attendance requirements adjust dynamically:
   - Infant: $< 2$ years ($10\%$ base fare)
   - Child: $2 - 11$ years ($75\%$ base fare)
   - Teen / Adult: $\ge 12$ years ($100\%$ base fare)
6. **Travel Comfort & Profile Logistics Integration**:
   Preferences defined in the Family Profile are integrated directly into scoring and cost calculation:
   - **Cabin Class Multipliers**: `preferredCabinClass` scales flight base fares (`ECONOMY`: $1.0\times$, `PREMIUM_ECONOMY`: $1.4\times$, `BUSINESS`: $2.4\times$).
   - **Max Driving Radius**: Airport surface distances exceeding `maxDrivingHours` (converted at 85 km/h driving baseline) incur escalating penalties in `travelFrictionIndex`.
   - **Climate Preferences**: User preferences (`TROPICAL_WARM`, `MODERATE`, `MILD_COOL`) adjust the `weatherIndex` score bonus and tolerance curves.
7. **Weather Scoring vs. Hard Rejection**:
   Seasonal weather conditions (temperature, precipitation, hurricane risk) are factored into continuous scoring ($0.0 - 1.0$) rather than dropping valid vacation candidates outright.
8. **Realistic Family Trip Cost Calculation**:
   Aggregates return flights (with cabin class scaling) and duration-scaled family accommodation lodging:
   $$\text{Total Cost} = \text{Flight Cost} + \text{Lodging Cost}$$
   $$\text{Flight Cost} = \text{Base Return Fare} \times \text{Cabin Multiplier} \times \text{Passenger Multiplier} \times (1 - \text{Arbitrage Discount})$$
   $$\text{Lodging Cost} = \text{Nightly Lodging Benchmark} \times (\text{Duration Days} - 1)$$
   $$\text{Price Per Person} = \frac{\text{Total Cost}}{\text{Total Family Members}}$$
9. **Destination Seasonality Warnings**:
   Detects seasonal risks (`src/lib/optimizer/weather.ts`) for target destinations and exposes localized warning messages:
   - `MONSOON`: Tropical downpours and high humidity.
   - `EXTREME_HEAT`: Daytime temperatures exceeding safe family thresholds.
   - `TYPHOON_HURRICANE`: Tropical storm activity windows.
   - `OVERCROWDED_PEAK`: Peak surge crowds and inflated lodging.
10. **Flight Arbitrage Detection**:
    Evaluates departure airports located in neighboring jurisdictions where schools remain in session, factoring a $30\%$ price advantage.
11. **Parental Leave Minimization**:
    Calculates consumed PTO:
    $$\text{PTO\_days} = \text{total\_weekdays} - \text{public\_holidays}$$
12. **Multi-Objective Scoring**:
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
