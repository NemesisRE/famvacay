# ADR 0004: Cache Engine Protocol Compatibility & Open Licensing (Valkey vs. Redis)

## Status
Accepted

## Context
FamVacay requires high-performance in-memory caching and distributed rate limiting:
- OpenHolidays and school holiday calendars (30-day TTL).
- Geocoding and places lookups (7-day TTL).
- Flight prices and estimates (12-hour TTL).
- Historical climate assessments (90-day TTL).
- Sliding-window rate limiting on auth, autocomplete, and search execution.

In early 2024, Redis shifted from the open-source BSD license to dual RSALv2 / SSPLv1 source-available licensing. The Linux Foundation subsequently founded **Valkey** as an open-source (BSD-3-Clause) continuation.

## Decision
1. **Client Architecture:** Use standard Redis-protocol clients (`ioredis`), which are 100% wire-compatible with both Redis (versions 6, 7+) and Valkey (versions 7, 8+).
2. **Container Defaults:**
   - Support both `valkey/valkey:8-alpine` and `redis:7-alpine`.
   - Default the container service to `redis:7-alpine` or `valkey/valkey:8-alpine` via standard `REDIS_URL` connection strings (`redis://...`).
3. **Licensing Transparency:**
   - Document the licensing differences in `docs/dependencies.md` and `docs/architecture.md`.
   - Valkey is recommended for users and organizations requiring strict OSI-compliant open-source governance (BSD-3-Clause).

## Update (2026-10-30)
Docker Compose ships `valkey/valkey:9-alpine` (digest-pinned, updated by Renovate); the Kubernetes manifests use the same image. Data persisted by Valkey 8 loads unchanged in Valkey 9. Any Redis-protocol server still works through `VALKEY_URL` / `DRAGONFLY_URL` / `REDIS_URL`.

## Consequences
- Total operational flexibility for self-hosters and enterprise operators.
- Seamless connection string compatibility without code divergence.

