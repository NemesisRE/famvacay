# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Scheduled `data-sync` GitHub Actions workflow that re-runs the `generate:*` reference-data scripts weekly (plus manual dispatch) and opens a reviewable PR with whatever changed, replacing the previous all-manual process.
- `src/instrumentation.ts` / `src/instrumentation-node.ts`: graceful shutdown on `SIGTERM`/`SIGINT`, draining Prisma and the Valkey/Redis connection before exit.
- `generate:airports-db` npm script (the generator script existed but had no way to invoke it besides calling `node` directly).
- Generated canonical commercial passenger airports database (`src/lib/airports/data/airports.json`) containing 4,008 active commercial airports worldwide derived from the OurAirports open aviation dataset and scheduled passenger service validation, featuring official IATA/ICAO codes, municipality, country, ISO 3166-2 subdivisions, physical elevation, and mainline high-speed rail passenger terminal connectivity.
- Build-time aviation database generator script (`scripts/generate-airports-db.js`) maintaining the canonical scheduled passenger airports database.
- Integrated `iso-3166-2`, `i18n-iso-countries`, and `date-holidays` packages for universal administrative subdivisions, multilingual country name resolution (en, de, fr, es, it), and real-time public holiday schedules for any nation or territory on Earth.
- Dynamic global administrative centroid calculator (`REGION_CENTERS`) computing geographic midpoints on demand from `airport-data` and `iso-3166-2` subdivision records.
- Comprehensive Codebase Audit Summary documenting architecture, gaps, and roadmap.
- Dynamic astronomical Computus (`getEasterDate`) calculation determining Gregorian Easter Sunday, Ash Wednesday, Carnival / Mardi Gras, and Spring Break / Holy Week dates dynamically for any calendar year.
- Dynamic per-destination event and overcrowding analyzer (`OVERCROWDED_PEAK`) evaluating Carnival, Spring Break, Cherry Blossom & Golden Week, Songkran Festival, and Oktoberfest with localized event badges and advisories.
- Continuous insolation and atmospheric physics climate engine (`getEstimatedClimate`) incorporating solar declination, noon solar elevation, mountain environmental lapse rate based on airport elevation, and maritime thermal lag.
- RFC 7239 `Forwarded` header parsing and hardened proxy resolution with `TRUST_PROXY` and `TRUSTED_PROXY_HOPS` support.
- Dedicated readiness probe endpoint `GET /api/ready` with sanitized status responses.
- Flat shared family data model with `FamilyMembership` and `FamilyInvite` support.
- Dynamic age category derivation (`INFANT`, `CHILD`, `ADULT`) per travel segment.
- Configurable workweeks (CLDR/custom) and adjacent vacation shift suggestions (±1–3 days) for PTO optimization.
- Provider-agnostic flight pricing interface with resilient benchmark caching.
- Fallback public holiday integration for international regions outside OpenHolidays school break coverage.
- Multi-arch Dockerfile with Node 22 LTS, dedicated `migrator` stage, and curl-free Node healthchecks.
- Complete Kubernetes manifests including Gateway API `HTTPRoute`, `PodDisruptionBudget`, and `NetworkPolicy`.
- Architecture Decision Records (ADR 0001–0004) in `docs/adr/`.
- `SECURITY.md` vulnerability reporting policy and `docs/setup.md`.

### Changed
- Completely eradicated `COASTAL_BEACH_KEYWORDS` and `ALPINE_SKI_KEYWORDS` in `src/lib/optimizer/weather.ts`; replaced keyword-based place and condition heuristics with physical elevation (`altitudeMeters >= 550`), latitude, and continuous climatological modeling (sub-freezing winter temps for ski, ocean surface temperature >= 19°C and ambient warmth >= 22°C for beach).
- Completely eliminated `KNOWN_MAJOR_HUBS`, `AIRPORT_STATE_MAPPING`, `EXCLUDED_NON_COMMERCIAL_AIRPORTS`, `NON_COMMERCIAL_KEYWORDS`, and `INTEGRATED_RAIL_AIRPORT_HUBS` from `src/lib/airports/airport-service.ts`; airport status, subdivisions, major hub classification, and mainline rail connections are now intrinsic database properties matching Prisma `model Airport`.
- Enhanced `fuzzyMatchDestinationEntity` and `isWordMatch` in `src/lib/optimizer/destinations.ts` with generic geographic stop-word filtering, suffix stemming for international language variants, and OurAirports multi-lingual keywords.
- Completely eradicated `MAJOR_CITY_EXONYMS`, hardcoded special region corridors ("Hurghada & Rotes Meer"), and special island checks from `src/lib/optimizer/destinations.ts` in favor of universal word-based Levenshtein matching (`wordLevenshtein`) and runtime geocoding place resolution via `searchGlobalPlaces`.
- Replaced hardcoded destination names for long-haul and charter corridors in `src/lib/airports/airport-service.ts` with dynamic geodesic distance thresholds (>= 3,500 km for intercontinental corridors, 1,500 - 3,500 km for medium-haul charter corridors).
- Eliminated hardcoded country/state fallbacks (`DE-BW`, `['STR', 'FRA']`, `'DE'`) across `engine.ts`, `subdivisions.ts`, `airports-db.ts`, and `portals.ts`.
- Enhanced regional containment detection (`checkRegionalContainment`) and dynamic destination caching (`dynamicDestinationEntityCache`) to support compound travel corridors and airport code subsets without static lookup tables.
- Completely eradicated massive static constants and hardcoded catalogs across the codebase: `GLOBAL_DESTINATION_ENTITIES` (600+ lines), `LOCALIZED_AIRPORT_METADATA` (260+ lines), and static `REGION_CENTERS` dictionaries.
- Replaced the static 6-country list (`COUNTRIES` in `src/lib/regions/subdivisions.ts`) with a dynamic Proxy over all 249 ISO-3166-1/2 countries and subdivisions via `iso-3166-2`.
- Replaced hardcoded intercontinental airport hub corridors (`FRA`, `CDG`, `MUC`) with dynamic passenger hub classification within catchment zones.
- Upgraded `OVERCROWDED_PEAK` in `src/lib/optimizer/weather.ts` to evaluate official public holiday calendars from `date-holidays` (Carnival/Mardi Gras, Songkran, Golden Week) alongside astronomical Computus and thermal beach indices without static destination lists.
- Dynamically localized airport countries in `airport-service.ts` using `Intl.DisplayNames`.
- `GET /api/health` converted to a pure liveness check with zero database or cache dependencies.
- Replaced prompt-example specific branches (`Athen`, `Mars`, `Atlantis`, `Tokyo`, `Dubai`, `Bali`) in `destinations.ts` and `places.ts` with generalized ontological categorization (OSM administrative hierarchy, population/rank thresholds, and universal linguistic descriptors) and resilient multi-destination Levenshtein matching.
- Generalized `resolveCountryCode` to dynamically resolve all 249 ISO-3166-1 alpha-2 countries via `Intl.DisplayNames` and commercial airport catalogs across EN, DE, FR, ES, and IT without static country subsets.
- Generalized `getCountryCodeFromSubdivision` to dynamically extract ISO-2 codes from standard ISO 3166-2 subdivision strings worldwide.
- Eliminated hardcoded regional fallback defaults (`DE-BW`) from `airport-service.ts`.
- Replaced geographic bounding boxes in `weather.ts` with continuous insolation physics and subtropical Hadley cell subsidence models.
- Upgraded `getDestinationSeasonalWarning` to evaluate physical meteorological metrics (`EXTREME_HEAT`, `MONSOON`, `TYPHOON_HURRICANE`) dynamically for any location worldwide without hardcoded place dictionaries.
- Enhanced `DynamicAirport` with physical elevation (`altitude`) data and dynamic ISO country code resolution (`resolveCountryCode`) for seamless regional containment detection.
- Replaced static `POPULAR_DESTINATIONS`, `DESTINATION_SEASONAL_CONSTRAINTS`, and `FALLBACK_SCHOOL_HOLIDAYS` with dynamic data providers and honest coverage alerts.
- Upgraded container base images to Node 22 Active LTS.
- Removed deprecated `nginx.ingress.kubernetes.io` annotations from Kubernetes ingress configurations.
- Migrated the package manager from `npm` to `pnpm` (Dockerfile, CI, and scripts); pinned via `packageManager` in `package.json` and installed through Corepack.
- Upgraded container base images and GitHub Actions runners to Node 26 Active LTS; bumped all GitHub Actions to their latest major version, SHA-pinned.
- Upgraded ESLint 9 -> 10, ioredis 5 -> 6, Zod 3 -> 4, the Vitest ecosystem 2 -> 5, and Tailwind CSS 3 -> 4 (via the official `@tailwindcss/upgrade` codemod: CSS-first `@theme` config, `@tailwindcss/postcss`, deprecated utility renames across 26 files).
- Docker/Compose `web` healthcheck now probes `/api/ready` (checks Postgres + Valkey) instead of the liveness-only `/api/health`, so an outage is actually reflected in container health status.
- `prisma/schema.prisma` pins the Prisma Client generator's `output` path explicitly, since pnpm's isolated `node_modules` otherwise generates the client inside the pnpm store rather than at `node_modules/.prisma/client`, which the Dockerfile's runner stage depends on.
- `src/lib/env.ts`: `DATABASE_URL` is now part of the validated schema (previously injected but unvalidated), and production startup now rejects a missing/short/placeholder `NEXTAUTH_SECRET` instead of silently accepting one.
- `docker-compose.yml`: removed host port publishing for `postgres` and `cache` (previously bound to `127.0.0.1`, now internal-only), marked `backend-internal` as `internal: true`, and fixed an inconsistent `POSTGRES_PASSWORD` fallback between the `migrate` and `web` services.

### Deferred
- TypeScript 7 and Prisma 7: both attempted and reverted after reproducing concrete breakage (see `docs/dependencies.md#known-blocked-major-upgrades`). Currently pinned to the latest release in their prior major (`typescript@^5.9.3`, `prisma@^6.19.3` / `@prisma/client@^6.19.3`).

