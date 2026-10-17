# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

