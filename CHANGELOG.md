# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive Codebase Audit Summary documenting architecture, gaps, and roadmap.
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
- `GET /api/health` converted to a pure liveness check with zero database or cache dependencies.
- Replaced static `POPULAR_DESTINATIONS`, `DESTINATION_SEASONAL_CONSTRAINTS`, and `FALLBACK_SCHOOL_HOLIDAYS` with dynamic data providers and honest coverage alerts.
- Upgraded container base images to Node 22 Active LTS.
- Removed deprecated `nginx.ingress.kubernetes.io` annotations from Kubernetes ingress configurations.

