# System Architecture & Technical Specifications

This document outlines the architectural patterns, data models, authentication flows, and network configurations powering FamVacay.

---

## High-Level Topology

```
                 +--------------------------------------------------+
                 |  Reverse Proxy (TLS / 443)                       |
                 |  Traefik / Nginx / NPM / Caddy / Pangolin        |
                 +------------+----------------------+--------------+
                              | app domain           | analytics domain (optional)
                              | plain HTTP :3000     | plain HTTP :3000
+-----------------------------|----------------------|------------------------------+
| proxy-network (external)    v                      v                              |
|   +--------------------------------------+   +-------------------------------+   |
|   | famvacay-web (Next.js standalone,    |   | famvacay-umami                |   |
|   | UID 10001, read-only root fs)        |-->| cookieless analytics          |   |
|   |  * Proxy headers (src/lib/proxy/)    |   | (/stats/* proxied first-party |   |
|   |  * NextAuth + passkeys (src/lib/auth)|   |  by the web app)              |   |
|   |  * Optimizer (src/lib/optimizer/)    |   +---------------+---------------+   |
|   |  * Airports, routes, geocoding       |                   |                   |
|   |  * Dataset refresh (src/lib/datasets)|                   |                   |
|   |  * i18n (src/lib/i18n/)              |                   |                   |
|   +------------------+-------------------+                   |                   |
+----------------------|---------------------------------------|-------------------+
                       |                                       |
+----------------------|---------------------------------------|-------------------+
| backend-internal (internal: true - no host ports, no internet)                    |
|                      v                                       v                   |
|   +-------------------+   +-----------------------------------------------+      |
|   | Valkey 9          |   | PostgreSQL 16                                 |      |
|   | cache, rate limits|   |  famvacay_db (app)  +  famvacay_umami (Umami) |      |
|   +-------------------+   +-----------------------------------------------+      |
|                              ^ one-shot on every start:                          |
|                              |  db-init (creates Umami's database if missing)    |
|                              |  migrate (prisma migrate deploy)                  |
+-----------------------------------------------------------------------------------+
```

The web app reaches the internet (holiday calendars, geocoding, routing, dataset sources) through `proxy-network`; `backend-internal` has no outbound access.

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
   - In `docker-compose.yml`, the `backend-internal` network uses `internal: true`. PostgreSQL and Valkey use `expose:` instead of `ports:` to block direct host access.
   - Every service sets `no-new-privileges`; the web app, Umami and `db-init` additionally drop all capabilities and run with a read-only root filesystem.

---

## Authentication & Account Architecture

The multi-user system is implemented via NextAuth with JWT sessions and Prisma Adapter persistence:

- **Email & Password**: Password hashes are salted and hashed using `bcrypt` (cost factor 12).
- **Email Confirmation** (`src/lib/auth/email-verification.ts`, only with SMTP configured): a link after registration and before an address change takes effect (the new address must confirm it). Links are single use, expire after 24 hours and are stored only as SHA-256 hashes in NextAuth's `VerificationToken` table.
- **Provider sign-in on an unconfirmed address**: Google and Apple confirm the address themselves. When they link to an account whose address was never confirmed, that account's password, passkeys and sessions are dropped - otherwise whoever registered someone else's address first would keep access once the real owner signs in with Google/Apple.
- **Session revocation**: sessions are JWTs; `User.sessionVersion` is checked at most once a minute per session, and bumping it ends every older session. The same check keeps a changed address or name current in the session.
- **Passkeys & WebAuthn**: Supported via `@simplewebauthn/server` and `@simplewebauthn/browser`.
  - Registration Options: `POST /api/auth/passkeys/register-options`
  - Verification & Persistence: `POST /api/auth/passkeys/verify-registration`
  - Challenges are stored in the cache (Valkey) with a 5-minute TTL.
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

FamVacay uses a flat, shared family profile: every adult linked to a profile through a `FamilyMembership` has the same rights. The schema itself is the reference (`prisma/schema.prisma`); the models by purpose:

| Area | Models | Notes |
|---|---|---|
| Accounts | `User`, `Account`, `Session`, `VerificationToken`, `Authenticator` | NextAuth (Prisma adapter) plus WebAuthn passkeys. |
| Family | `FamilyProfile`, `FamilyMembership`, `FamilyMember`, `FamilyAirport`, `BlackoutPeriod` | Home location, school region, preferences (cabin class, overland travel time, scoring weights incl. excluded countries), members with birth dates and per-child school regions, preferred departure airports, recurring blackouts. |
| Invitations | `FamilyInvite` | Schema only - inviting further adults has no UI or API yet. |
| Searches & sharing | `TripSearch`, `TripPlan`, `BlackoutDate`, `SharedTripBoard`, `SharedCandidate` | Shared boards store only derived, non-identifying fields (no address, coordinates or exact birth dates) and expire. |
| Reference data | `Place`, `Airport`, `GeneratedDataset` | `GeneratedDataset` holds the background-refreshed datasets (airports, routes, climate, city names, traffic, holiday appeal, price levels). |

Database changes always come with a migration in `prisma/migrations/`, applied by the `migrate` service (`prisma migrate deploy`).

---

## Regional Subdivisions & International School Calendars

Countries and their subdivisions come from ISO 3166-1/2 (`iso-3166-2`, `i18n-iso-countries`) for all 249 countries (`src/lib/regions/subdivisions.ts`); there is no fixed country list.

- **School holidays** are read per subdivision from the [OpenHolidays API](https://www.openholidaysapi.org) wherever it has data (most of Europe, e.g. all 16 German federal states, Austria, Switzerland, Belgium, the Netherlands, Poland). Each child can have their own school region, and windows must fit every child's calendar.
- **Public holidays** come from OpenHolidays, with [Nager.Date](https://date.nager.at) and the bundled `date-holidays` package as fallbacks for countries outside its coverage.
- **Regions without school-holiday data** get an honest coverage notice in the results instead of invented dates.
- **Source markets** (when Europe's big markets such as DE, GB, FR, NL are on holiday - crowds and prices) use OpenHolidays plus typical national calendars for markets it does not fully cover (`src/lib/holidays/source-markets.ts`).

---

## Dynamic Departure Coordinates & Unified Airport Service

Departure hubs and distance metrics are managed by a unified airport service (`src/lib/airports/airport-service.ts`) utilized identically by both the Family Profile and Vacation Search:

1. **Exact Coordinate Geocoding & Postal Code Resolution (`src/lib/geo/geocoding.ts`)**:
   - Departure distances are calculated strictly from the user's specific starting coordinates (`departureLat`, `departureLon`), rather than regional capital centroids.
   - The geocoding service resolves postal codes, municipalities, and metropolitan locations dynamically worldwide via Photon (OpenStreetMap data, search as you type, biased towards the home country chosen in the form) and a 7-day cache. The holiday region is derived from the ISO 3166-2 names of the result. Reverse geocoding for "My location" uses OpenStreetMap Nominatim, once per click.
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
   - In-memory index of about 4,000 commercial passenger airports worldwide (OurAirports, scheduled service only, refreshed in the background - see [Data Sources](../README.md#data-sources)). Users can search and select any of them by city name, airport name, or 3-letter IATA code.
7. **Real Route Network**:
   - Non-stop and connecting flights are resolved over the routes that actually exist (`src/lib/airports/flight-routes.ts`, from Wikipedia's "Airlines and destinations" tables with OpenFlights as fill-in): fewest stops first, then the shortest total distance. Through flights, ended routes and aircraft range are taken into account.

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
   - Queries dynamically resolve destinations worldwide via multi-stage matching across official ISO-3166 datasets, global commercial passenger airports, and Photon geocoding (OpenStreetMap data) with localized names (`en`, `de`, `fr`, `es`, `it`), aliases, and fuzzy tokens, backed by the cache.
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
   - All place resolution, destination autocompletion, entity category classification, and airport corridor mapping are performed dynamically via runtime Photon geocoding (OpenStreetMap data), official ISO-3166-1/2 registries (`i18n-iso-countries`, `iso-3166-2`), and the global commercial passenger airport dataset in `src/lib/airports/airport-service.ts`.
   - Dynamic query results are cached (Valkey) with a 7-day TTL for fast response times and rate-limit compliance.

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

The weather model (`src/lib/optimizer/weather.ts`) combines measured climate normals with a physical model, dynamic per-location event analysis, and seasonal risk evaluation without hardcoded place dictionaries:

0. **Measured Climate Normals (`getClimateNormals`)**:
   - For every destination airport, monthly mean temperature, daily range and precipitation come from [NASA POWER](https://power.larc.nasa.gov) climatology, and rainy days and hours of rain per rainy day from the [Open-Meteo](https://open-meteo.com/) archive (`climate-normals` dataset, refreshed in the background).
   - The physical model below is the fallback for places without measured normals (e.g. picked towns away from an airport).
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
   - Benchmark pricing (`src/lib/pricing/pricing-service.ts`): seasonal market fares from distance and demand (school holidays at home and in Europe's big source markets), passenger age tier multipliers, cabin class factors and departure arbitrage. Prices are estimates and labelled as such; there is no live fare source (ADR 0002).
   - Catering advantage (`src/lib/pricing/meal-plan-value.ts`): what the meals of the board type are worth at the destination - base values per adult and child and night for Mediterranean prices, scaled by the country's price level from the `price-levels` dataset (World Bank PPP for private consumption / exchange rate), dampened because resort meals stay closer to international prices. 75 % of it is credited against the trip price for ranking; the shown price stays the full price.
2. **Actionable UI Integration (`BookingDealsPopover`)**:
   - Result cards include an interactive portal deals popover providing itemized cost breakdowns and one-click direct booking navigation across active providers.

---

## Optimization Engine (CSP) & Cost Estimation

The optimization engine (`src/lib/optimizer/engine.ts`) solves candidate windows $[\text{startDate}, \text{endDate}]$:

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
   Recurring holiday blackouts are the public holidays of the home region (`src/lib/holidays/holiday-periods.ts`, date-holidays rules): Eid al-Fitr and Eid al-Adha in Saudi Arabia, Rosh Hashanah in Israel, the Spring Festival in China, Easter in Germany - never a fixed calendar of Christian feasts. Holidays up to three days apart form one period; each is selected by country and rule (`SA:30 Ramadan P4D`), so the choice holds every year, and the dates for the travel period come from `/api/holidays/blackout-options`.
5. **Dynamic Date-Relative Child Age & Fare Tier Calculation**:
   Child ages are computed dynamically relative to the candidate window's departure date:
   $$\text{Age at Trip} = \lfloor(\text{startDate} - \text{birthDate}) / \text{1 year}\rfloor$$
   Fare tiers and school attendance requirements adjust dynamically:
   - Infant: $< 2$ years ($10\%$ base fare, lap fee)
   - Child: $2 - 11$ years ($95\%$ base fare below 4,500 km, where low-cost and leisure carriers dominate; $75\%$ on long haul)
   - Teen / Adult: $\ge 12$ years ($100\%$ base fare)
   A child who turns 2 during the trip flies out as an infant and back as a child.
6. **Travel Comfort & Profile Logistics Integration**:
   Preferences defined in the Family Profile or the search form are integrated directly into scoring and cost calculation:
   - **Cabin Class Multipliers**: `preferredCabinClass` scales flight base fares (`ECONOMY`: $1.0\times$, `PREMIUM_ECONOMY`: $1.45\times$, `BUSINESS`: $2.4\times$).
   - **Overland Travel Time**: the drive to the departure airport is estimated at 85 km/h (the profile's saved airports additionally get real road distances from OSRM in the background); car, train and bus trips longer than the chosen maximum overland travel time are left out.
   - **Flight Stops**: the maximum number of stops limits the routes considered.
   - **Vacation Style & Travel Distance**: the form asks two separate questions, what the holiday should be like (beach, mountains, city, nature) and how far it may go (short/medium haul up to `LONG_HAUL_KM`, long haul). `toOptimizerStyles` (`src/lib/optimizer/style-selection.ts`) turns them into the engine's request: short/medium haul sends the styles alone (which keeps long-haul places out), long haul sends `LONGRANGE` narrowed by `longRangeStyles`, and any distance sends both. Selections saved before the split (`LONGRANGE` as a style) are converted by `readStyleSelection`.
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
    Evaluates departure airports located in neighboring jurisdictions where schools remain in session, factoring a $\approx 28\%$ price advantage.
11. **Parental Leave Minimization**:
    Calculates consumed PTO:
    $$\text{PTO\\_days\\_consumed} = \text{total\\_weekdays} - \text{public\\_holidays}$$
    PTO counts the usual workweek of the home country as a best guess (`src/lib/holidays/workweek.ts`), from the Unicode CLDR week data built into JavaScript (Monday-Friday, Sunday-Thursday in Saudi Arabia, Saturday-Thursday in Iran...). Travellers in one party may work different weeks, so every window also carries `workweekVariants`, shown next to it in the PTO popover: the six-day weeks next to a five-day week (Monday-Saturday where Sunday is off, both Sunday-Friday and Saturday-Thursday where the weekend is Friday/Saturday) and a five-day week next to a six-day one (Saturday-Wednesday in Iran). School breaks are extended over the weekend of their own region's country, hotel weekend nights follow the destination's weekend and the flight weekday surcharges the travellers' weekend.
12. **Multi-Objective Scoring** (every index is 0-100, higher is better - the friction index is high for an easy trip, so it is added, not subtracted):
    $$\text{Score} = (w_1 \cdot \text{Price}) + (w_2 \cdot \text{Weather}) + (w_3 \cdot \text{PTO}) + (w_4 \cdot \text{Friction})$$

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register user with email and password |
| `POST` | `/api/auth/[...nextauth]` | NextAuth authentication handler |
| `POST` | `/api/auth/passkeys/register-options` | Generate WebAuthn passkey registration options |
| `POST` | `/api/auth/passkeys/verify-registration` | Verify and save WebAuthn passkey |
| `GET` | `/api/auth/linked-accounts` | List linked authentication methods |
| `POST` | `/api/account/email` | Change the email address: with SMTP configured a confirmation link goes to the new address first |
| `POST` | `/api/account/verify-email` | Send the confirmation link for the current address again |
| `GET` | `/api/auth/verify-email` | Target of confirmation links; redirects to the account settings with the outcome |
| `POST` | `/api/account/password` | Change account password with current password verification |
| `GET` | `/api/account/passkeys` | List enrolled WebAuthn authenticators |
| `DELETE` | `/api/account/passkeys` | Delete WebAuthn passkey with lockout protection |
| `POST` | `/api/account/unlink` | Unlink OAuth provider with lockout protection |
| `GET` | `/api/account` | Export GDPR data portability payload for authenticated user |
| `DELETE` | `/api/account` | Multi-user aware account and membership deletion (GDPR) |
| `GET` | `/api/family-profile` | Retrieve shared family profile and member roster |
| `POST` | `/api/family-profile` | Create or update shared family profile |
| `GET` | `/api/locations/geocode` | Autocomplete and geocode departure location |
| `GET` | `/api/locations/reverse` | Town for a coordinate pair (the "My location" button) |
| `GET` | `/api/destinations/search` | Dynamic global destination and place search with entity taxonomy |
| `GET` | `/api/airports/search` | Search airports by query, proximity coordinates, or flight corridor destinations |
| `GET` | `/api/safety/discovery-blocked` | Countries flex search never proposes because of travel advisories |
| `POST` | `/api/vacations/optimize` | Execute the vacation optimization engine (`discoveryScope: "extended"` for the second, background tier; a cached full result is returned directly with `X-Famvac-Scope: extended`) |
| `POST` | `/api/vacations/share` | Store a search as a shared trip board (non-identifying fields only) and return its short code |
| `GET` | `/api/vacations/share` | Load a shared trip board by its short code |
| `GET` | `/api/public-config` | Runtime settings the browser needs (cookie banner mode, Umami website ID) |
| `GET`, `POST` | `/stats/*` | First-party proxy to Umami (tracker script and event collection) |
| `GET` | `/api/health` | Liveness probe: returns HTTP 200 without downstream dependency checks |
| `GET` | `/api/ready` | Readiness probe: validates PostgreSQL and cache connectivity |

Searches are computed one at a time per process (`src/lib/optimizer/run-queue.ts`, `OPTIMIZER_CONCURRENCY`): one search briefly needs up to ~1 GB of heap while it builds and prunes its candidate windows, and the synchronous optimizer gains nothing from running several at once. Interactive searches go before background discovery; identical searches share one computation and results are cached for 10 minutes.

Rate limits (per client, kept in the cache) protect sign-in (per IP and per email), registration, confirmation links, sending confirmation mails, sharing and the optimizer (`src/lib/security/rate-limit.ts`).
