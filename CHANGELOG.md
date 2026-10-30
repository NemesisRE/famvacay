# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

From 1.0.0 on, the notes for every release are drafted automatically from the merged pull
requests and published on the [Releases page](https://github.com/NemesisRE/famvacay/releases);
this file keeps a summary per version.

## [Unreleased]

## [1.0.0] - 2026-10-30

First stable release.

### Added

- **Vacation optimizer:** finds the best travel windows for a family across a date range and a
  flexible trip length - inside every child's school holidays (one school region per child),
  around public holidays and bridge days to save paid leave, outside blackout periods, and scored
  on price, weather, leave efficiency and travel effort.
- **Flexible discovery:** search without a destination and get destinations ranked by holiday
  appeal (Wikivoyage coverage and readership), by vacation style (beach, alpine, city, nature,
  long range), with country exclusions and travel-advisory filtering. The most relevant
  destinations appear first, more are added in the background.
- **Picked destinations:** countries, regions, islands, cities and towns worldwide via
  OpenStreetMap geocoding, with hierarchical containment ("Palma" inside "Mallorca").
- **Travel logistics:** about 4,000 commercial airports (OurAirports), a real route network from
  Wikipedia's airline destination tables (non-stop vs. connecting flights, through flights, ended
  routes, aircraft range), departure airports in neighbouring regions whose schools are still in
  session, and car, train and bus trips with ferry legs.
- **Prices as benchmark estimates:** season, school-holiday demand at home and in Europe's big
  source markets, passenger age on the travel date (infant, child by haul, adult), cabin class -
  clearly labelled as estimates, with deep links to booking portals per market and an affiliate
  transparency notice.
- **Climate and seasons:** measured monthly climate normals (NASA POWER, Open-Meteo rain
  duration), sea temperatures, extreme heat, monsoon/rainy season, tropical storms, and crowded
  peaks such as Carnival, Easter, Golden Week, Songkran and Oktoberfest.
- **Booking timing advisor** per result: when to book the journey and the accommodation.
- **Childcare closure check:** compares windows during daycare closures with the cheapest
  off-peak alternative for families with young children.
- **Results:** destination and timeframe views with paging, sorting (score, price, date,
  country, ...), filters with live counts (destination, style, distance, vehicle, safety,
  seasonal warnings, heat, board type, overland time, stops, school holidays, budget) and a map.
- **Sharing:** shareable result links and trip boards that store only derived, non-identifying
  data and expire automatically.
- **Accounts and family profile:** email and password, passkeys (WebAuthn), Google and Apple
  sign-in, account linking with lockout protection, GDPR data export and deletion; a shared family
  profile with members, school regions, departure airports, blackout periods and preferences.
- **Five languages** (English, German, French, Spanish, Italian), dark mode, installable as a
  progressive web app.
- **Imprint, privacy policy and cookie banner** generated from configuration (§5 DDG,
  Art. 13 GDPR, §25 TDDDG), with optional self-hosted, cookieless Umami analytics proxied
  first-party.
- **Self-updating reference data:** airports, routes, city names, airport traffic, climate
  normals and holiday appeal refresh themselves in the background and are stored in PostgreSQL.

### Operations

- Docker Compose stack with PostgreSQL 16, Valkey 9, a migration job, an idempotent Umami database
  initialization and Umami; hardened containers on an internal network without host ports.
- Local quick start (`docker-compose.local.yml`) and Kubernetes manifests (Kustomize, Gateway API
  or Ingress, NetworkPolicy, PodDisruptionBudget).
- Liveness (`/api/health`) and readiness (`/api/ready`) probes, graceful shutdown, rate limiting,
  reverse-proxy header hardening (`TRUST_PROXY`, `TRUSTED_PROXY_HOPS`, RFC 7239).
- Multi-arch release images (`linux/amd64`, `linux/arm64`) for the app and the database
  migrations on GitHub Container Registry, used by Docker Compose and Kubernetes (no local build);
  release notes drafted from conventional pull request titles; Renovate with digest pinning and a
  one-day minimum release age.

### Known limitations

- Prices are estimates, not live fares (no free flight-pricing API exists for self-hosting).
- Inviting further adults to a family profile exists in the database schema only.
- Passport expiry dates are stored in the profile, but no validity warning is shown yet.
- The standalone production build does not run on Windows (Docker and Linux are fine).

[Unreleased]: https://github.com/NemesisRE/famvacay/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/NemesisRE/famvacay/releases/tag/v1.0.0
