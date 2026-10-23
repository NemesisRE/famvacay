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
   - The application expects plain HTTP internally on port `3000` behind an external TLS-terminating reverse proxy (Traefik, Nginx, Nginx Proxy Manager, Caddy, or Kubernetes Ingress/Gateway).
   - Strict `TRUST_PROXY=true` gating: Forwarding headers are only evaluated when explicitly enabled via configuration.
   - Standard RFC 7239 `Forwarded` header parsing is prioritized, with fallback to legacy `X-Forwarded-*` headers (`X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`).
   - Anti-spoofing client IP resolution: Evaluates the forwarding chain from the right-most untrusted entry using `TRUSTED_PROXY_HOPS` (default: 1) to prevent client IP spoofing attacks.
   - Absolute redirects and canonical URLs are derived strictly from the configured public `APP_URL` to prevent internal port leakage (`3000`) or host header poisoning.
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
  - `DELETE /api/account`: Executes multi-user aware deletion. If other adult members remain in the shared family profile, the user's membership is removed without deleting the family profile. If the departing user is the final remaining member, a complete cascading purge is performed pursuant to GDPR requirements.
- **Lockout Prevention Rules**:
  - A user cannot delete their last WebAuthn passkey if no password and no third-party OAuth accounts are connected.
  - A user cannot unlink an OAuth account if doing so would leave them without any valid login mechanism (neither password nor passkey).

---

## Flat Shared Family Data Model (`prisma/schema.prisma`)

FamVacay employs a flat, shared family profile data model where all adult family members hold equal administrative rights:

```prisma
model User {
  id            String             @id @default(uuid())
  name          String?
  email         String?            @unique
  emailVerified DateTime?
  passwordHash  String?
  image         String?
  accounts      Account[]
  sessions      Session[]
  passkeys      Authenticator[]
  memberships   FamilyMembership[]
  sentInvites   FamilyInvite[]     @relation("SentInvites")
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
}

model FamilyProfile {
  id                    String             @id @default(uuid())
  familyName            String?
  homeLocation          String             // Postal code / City / Address
  homeLat               Float?
  homeLon               Float?
  federalState          String             // e.g. "DE-BW"
  originAirports        String[]           // e.g. ["STR", "FKB", "FRA", "CDG"]
  maxDrivingHours       Float?             @default(2.5)
  preferredCabinClass   String?            @default("ECONOMY")
  climatePreference     String?            @default("MODERATE")
  passportCheckRequired Boolean            @default(false)
  travelModes           String[]           @default(["FLIGHT", "CAR"])
  membersCount          Int                @default(1)
  memberships           FamilyMembership[]
  invites               FamilyInvite[]
  members               FamilyMember[]
  blackoutPeriods       BlackoutPeriod[]
  airports              FamilyAirport[]
  searches              TripSearch[]
  createdAt             DateTime           @default(now())
  updatedAt             DateTime           @updatedAt
}

model FamilyMembership {
  id              String        @id @default(uuid())
  userId          String
  familyProfileId String
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)
  role            String        @default("MEMBER") // Equal rights for all adult members
  createdAt       DateTime      @default(now())

  @@unique([userId, familyProfileId])
}

model FamilyInvite {
  id              String        @id @default(uuid())
  familyProfileId String
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)
  email           String
  token           String        @unique
  senderId        String
  sender          User          @relation("SentInvites", fields: [senderId], references: [id], onDelete: Cascade)
  expiresAt       DateTime
  acceptedAt      DateTime?
  createdAt       DateTime      @default(now())
}

model FamilyMember {
  id              String        @id @default(uuid())
  familyProfileId String
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)
  firstName       String?
  role            String        // "PARENT", "CHILD", "INFANT", "OTHER"
  birthDate       DateTime      @db.Date
  schoolRequired  Boolean       @default(false)
}

model BlackoutPeriod {
  id              String        @id @default(uuid())
  familyProfileId String
  familyProfile   FamilyProfile @relation(fields: [familyProfileId], references: [id], onDelete: Cascade)
  startDate       DateTime      @db.Date
  endDate         DateTime      @db.Date
  reason          String?
  recurrence      String?       // "NONE", "YEARLY"
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
   - The geocoding service resolves postal codes, municipalities, and metropolitan locations dynamically worldwide via OpenStreetMap Nominatim with a secondary Photon Komoot API fallback and a Redis caching layer.
   - All static local dictionaries and mock example fixtures have been eliminated, ensuring location resolution handles any postal code, city, or territory dynamically worldwide.
   - Strict place verification ensures unverified free-text locations trigger validation warnings before submission.
2. **Geodesic Distance Calculation (`geolib`)**:
   - Distance from departure coordinates to candidate hubs is calculated using the Great-Circle Haversine formula:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
3. **Generalized Rail & Transit Connectivity Model (`evaluateHighSpeedRailConnectivity`)**:
   - Real-world travel options account for high-speed rail and intercity rail corridors linking origins directly to major international passenger gateways.
   - Airports equipped with integrated on-site mainline or high-speed rail passenger terminals (such as Frankfurt Fernbahnhof, Paris Charles de Gaulle 2, Amsterdam Schiphol, Zurich Airport, and Brussels Airport) are dynamically evaluated based on overland rail catchment radius ($d \le 460\text{ km}$).
   - Connected hubs are modeled as an abstract transit property (`isHighSpeedRailConnected: true`) and rendered with generic rail indicators (`Train` icon) and descriptive notes without carrier or brand-specific assumptions.
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

### Universal Geocoding, Global Places Taxonomy & Dynamic Autocomplete

The vacation planner provides universal global place resolution, entity taxonomy classification, and hierarchical regional containment (`src/lib/geo/places.ts` and `src/lib/optimizer/destinations.ts`):

1. **Global Entity Taxonomy & Categorization (`GlobalPlaceEntity`)**:
   - Entities are structured into an unambiguous geographic taxonomy across all continents:
     - `country`: Sovereign destination nations (e.g., Indonesia, Thailand, Egypt, Spain, Greece, Australia, Japan, United States).
     - `region`: Administrative sub-regions and resort corridors (e.g., Red Sea, Costa del Sol, Queensland, Bavaria).
     - `island`: Distinct islands and archipelagos (e.g., Bali, Ko Samui, Phuket, Mallorca, Ibiza, Tenerife, Santorini, Hawaii, Fiji).
     - `city`: International metropolitan and resort cities (e.g., Denpasar, Bangkok, Tokyo, Sydney, Honolulu, Cancun, Orlando, Palma, Athens, Rome).
     - `airport`: Specific commercial passenger airports.
2. **Dynamic Debounced Typeahead Suggestions (`GET /api/destinations/search`)**:
   - The destination selector replaces static dropdown presets with active debounced typeahead search (250ms debounce threshold, triggering from 2 keystrokes).
   - Queries dynamically resolve destinations worldwide via multi-stage matching across official ISO-3166 datasets, global commercial passenger airports, and OpenStreetMap Nominatim/Photon geocoding with localized names (`en`, `de`, `fr`, `es`, `it`), aliases, and fuzzy tokens, backed by Redis caching.
   - Dynamic geocoding resolves coordinates and automatically maps closest commercial passenger airports within a 350 km radius for any location on Earth.
   - Suggestions render with categorized badge metadata (Island, Country, City, Region, Airport).
3. **Hierarchical Regional Containment Detection (`checkRegionalContainment`)**:
   - When a user adds a destination encompassed by an existing selection (e.g., adding "Denpasar" when "Bali" is selected, "Palma" when "Mallorca" is selected, or "Rome" when "Italy" is selected), containment is identified via explicit parent IDs, airport code subsets, or country inclusion.
   - The system triggers visual feedback (pulse animation on the parent chip) and informative notices rather than redundant tag insertions.
4. **Strict Destination-Bound Corridor Filtering**:
   - When destination filters are active, vacation window generation is strictly constrained to matching airport codes without fallback to unrequested regions.
   - Open discovery hubs are presented only when no destination constraints are supplied.
5. **Complete Elimination of Hardcoded Place & Destination Catalogs**:
   - Massive static constants such as `GLOBAL_DESTINATION_ENTITIES`, `GLOBAL_PLACES_CATALOG`, `CANONICAL_DESTINATIONS`, `DESTINATION_MAPPINGS`, `LOCALIZED_AIRPORT_METADATA`, and `SUPPORTED_ORIGIN_AIRPORTS` have been completely eliminated from the codebase.
   - All place resolution, destination autocompletion, entity category classification, and airport corridor mapping are performed dynamically via runtime OpenStreetMap Nominatim/Photon geocoding, official ISO-3166-1/2 registries (`i18n-iso-countries`, `iso-3166-2`), and the global commercial passenger airport dataset in `src/lib/airports/airport-service.ts`.
   - Dynamic query results are cached in Redis with a 7-day TTL for fast response times and rate-limit compliance.

---

## Universal Airport Catchment Engine & Stale Airport Pruning

The dynamic airport engine (`src/lib/airports/airport-service.ts`) operates globally without regional bias:

1. **Geodesic Catchment Resolution**:
   - Airport proximity is computed using true geodesic distance and transit connectivity from origin coordinates worldwide.
   - Arbitrary country-specific hardcoding is eliminated, enabling consistent recommendations for origins across Australia, North America, Asia, and Europe.
2. **Commercial Passenger Status Filtering**:
   - Airport recommendations are restricted to active commercial passenger hubs handling scheduled commercial flights or leisure charter operations, powered by the OurAirports open aviation dataset with scheduled passenger service validation.
   - Non-commercial military air bases, decommissioned facilities, and general aviation grass strips are pre-filtered at the dataset and database layer.
3. **Stale Airport Pruning (`pruneStaleAirportsForCoordinates`)**:
   - When departure origin coordinates change (e.g., switching from Germany to Sydney, Australia or Tokyo), active airport selections are automatically re-evaluated.
   - Selected airports exceeding the catchment radius (default 450 km) without high-speed rail connectivity are pruned.
   - If the selection becomes empty, the engine automatically populates the closest regional passenger hubs for the new location.

---

## UI Layering, Stacking Context & Popover Portal Architecture

Tooltips, climate popovers, and booking deal drawers are engineered to prevent clipping and stacking context collisions:

1. **Top-Layer React Portal Rendering (`createPortal`)**:
   - `ClimateDetailsPopover` and `BookingDealsPopover` mount directly to `document.body` via React `createPortal`.
   - Elements render in the top-layer stacking context with `position: fixed` and high z-index (`z-index: 9999`), bypassing parent container clipping.
2. **Dynamic Viewport Edge Detection (`getBoundingClientRect`)**:
   - Popover positions are dynamically calculated from the trigger element's bounding rectangle.
   - Vertical collision detection flips the popover above the trigger when downward space is insufficient.
   - Horizontal clamping prevents bleed past viewport edges on both desktop and mobile viewports.
   - Scroll and resize listeners recalculate position in real time while active.
3. **Container Clipping Elimination**:
   - Search result candidate cards avoid `overflow: hidden` boundaries, ensuring non-portal popovers and action menus render cleanly.

---

## Pluggable Travel Portal Provider Registry

The booking portal architecture (`src/lib/pricing/portals.ts`) provides a modular multi-market registry:

1. **Market-Aware Portal Registry**:
   - Supports localized major providers across geographic operating markets:
     - DACH (Germany, Austria, Switzerland): HolidayCheck, CHECK24, ab-in-den-urlaub.
     - Oceania (Australia & New Zealand): Webjet, Wotif.
     - North America (United States & Canada): Expedia, Priceline.
     - Global / Metasearch: Google Flights, Skyscanner, Kayak, Booking.com, Trip.com.
2. **Dynamic Deep Link Parameterization**:
   - Each portal provider defines a URL construction factory receiving origin, destination, travel dates, and passenger counts.
3. **Market-Aware Defaults & User Customization**:
   - Default portal selections are initialized based on the user's residence country.
   - Users can customize active booking portals through an interactive settings panel, persisting preferences in `localStorage`.

---

## Climate & Weather Assessment Architecture

The weather model (`src/lib/optimizer/weather.ts`) provides continuous physical climate estimation, dynamic per-location event analysis, and seasonal risk evaluation without hardcoded place dictionaries:

1. **Continuous Solar & Radiative Climatological Model (`getEstimatedClimate`)**:
   - Calculates solar declination and noon solar elevation angles as continuous functions of day-of-year and latitude.
   - Computes baseline temperature, annual amplitude, and seasonal cycles from insolation physics without arbitrary geographic bounding boxes.
   - Applies environmental lapse rate adjustments for high-altitude alpine and mountain ski destinations based on airport elevation data.
   - Computes sea surface temperature with thermal lag for maritime and island destinations.
   - Models tropical convective precipitation based on Intertropical Convergence Zone (ITCZ) migration and dry desert high-pressure belts.
2. **Climate Metric Schema (`WeatherAssessment`)**:
   - `avgTempC`: Expected mean daytime air temperature (Celsius).
   - `maxTempC`: Expected daytime high temperature.
   - `minTempC`: Expected nighttime low temperature.
   - `waterTempC`: Coastal sea surface temperature for maritime destinations (null for inland destinations).
   - `rainyDays`: Estimated monthly precipitation days.
   - `sunshineHoursPerDay`: Estimated daily sunshine duration derived from astronomical daylength.
   - `precipitationRiskPercent`: Probability of measurable precipitation.
   - `isSuitable`: Boolean flag evaluating family comfort boundaries.
3. **Interactive UI Popover (`ClimateDetailsPopover`)**:
   - Clicking temperature badges opens the portal popover displaying daytime highs/lows, sea water temperature, precipitation frequency, sunshine hours, and suitability rationales.

---

## Modular Travel Pricing Architecture

The pricing engine implements a decoupled provider pattern (`src/lib/pricing/`):

1. **Provider Architecture (`FlightPriceProvider`)**:
   - `FlightPriceProvider`: Defines standard contract for flight quotes, lodging estimates, total cost aggregation, and deep link generation.
   - Decommissioned Amadeus Deprecation (ADR 0002): Legacy Amadeus flight search APIs decommissioned on 17 July 2026 have been eliminated.
   - `BenchmarkFlightProvider`: Dynamic pricing model computing seasonal market fares, passenger age tier multipliers, cabin class factors, and arbitrage differentials with 12-hour Redis caching.
2. **Actionable UI Integration (`BookingDealsPopover`)**:
   - Result cards include an interactive portal deals popover providing itemized cost breakdowns and one-click direct booking navigation across active providers.

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
   Calculated via the modular pricing engine (`getSynchronousTripPricing`):
   $$\text{Total Cost} = \text{Flight Cost} + \text{Lodging Cost}$$
   $$\text{Flight Cost} = \text{Base Return Fare} \times \text{Cabin Multiplier} \times \text{Passenger Multiplier} \times (1 - \text{Arbitrage Discount})$$
   $$\text{Lodging Cost} = \text{Nightly Lodging Benchmark} \times (\text{Duration Days} - 1)$$
   $$\text{Price Per Person} = \frac{\text{Total Cost}}{\text{Total Family Members}}$$
9. **Destination Seasonality Warnings**:
   Detects seasonal risks and overcrowding hyper-peaks (`src/lib/optimizer/weather.ts`) dynamically without static place dictionaries:
   - `EXTREME_HEAT`: Evaluated directly from meteorological temperatures ($\text{maxTempC} \ge 38^\circ\text{C}$ and $\text{precipitationRiskPercent} \le 25\%$) worldwide.
   - `MONSOON`: Evaluated from tropical convective precipitation ($|\text{lat}| \le 26^\circ$, $\text{avgTempC} \ge 24^\circ\text{C}$, and $\text{precipRisk} \ge 45\%$ or $\text{rainyDays} \ge 14$).
   - `TYPHOON_HURRICANE`: Evaluated from warm cyclogenesis sea surface temperatures ($\ge 26^\circ\text{C}$) in active oceanic basins during regional storm windows (North Atlantic/Caribbean, Northwest Pacific, South Pacific).
   - `OVERCROWDED_PEAK`: Evaluated per destination dynamically via astronomical calendar Computus algorithms, the `date-holidays` public holiday engine, and physical climate normals:
     - *Carnival / Mardi Gras*: Computed ~7 weeks prior to Gregorian Easter Sunday and matched against regional pre-Lenten public holidays from `date-holidays`.
     - *Spring Break & Easter / Holy Week*: Dynamically detected around Easter Sunday for warm beach destinations ($T_{\text{avg}} \ge 21^\circ\text{C}$).
     - *Cherry Blossom & Golden Week*: National multi-holiday clusters in spring evaluated via official public holiday calendars.
     - *Songkran Festival*: New Year nationwide water festival evaluated via official public holiday calendars (mid-April).
     - *Oktoberfest*: Regional autumn festival peak evaluated dynamically for administrative subdivisions (e.g. Bavaria `DE-BY`).
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
| `GET` | `/api/account` | Export GDPR data portability payload for authenticated user |
| `DELETE` | `/api/account` | Multi-user aware account and membership deletion (GDPR) |
| `GET` | `/api/family-profile` | Retrieve shared family profile and member roster |
| `POST` | `/api/family-profile` | Create or update shared family profile |
| `GET` | `/api/locations/geocode` | Autocomplete and geocode departure location |
| `GET` | `/api/destinations/search` | Dynamic global destination and place search with entity taxonomy |
| `GET` | `/api/airports/search` | Search airports by query, proximity coordinates, or flight corridor destinations |
| `POST` | `/api/vacations/optimize` | Execute CSP vacation optimization engine |
| `GET` | `/api/health` | Liveness probe: returns HTTP 200 without downstream dependency checks |
| `GET` | `/api/ready` | Readiness probe: validates PostgreSQL and Redis cache connectivity |
