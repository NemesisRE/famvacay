# Dependency Management & Repository Hygiene

This document describes the automated dependency update strategy, Renovate configuration, repository standards, and key external geographical libraries integrated into FamVacay.

---

## Automated Dependency Management (Renovate)

To keep packages up to date and reduce manual maintenance overhead, FamVacay uses **Renovate Bot** (`renovate.json`).

### Configuration Highlights

1. **Noise Reduction & PR Grouping**:
   - Production `minor` and `patch` updates are batched together:
     - Group: `production minor and patch updates`
     - Group Slug: `prod-minor-patch`
   - Linters, type checkers, and test frameworks are grouped:
     - Includes: `eslint*`, `@typescript-eslint/*`, `prettier*`, `vitest*`, `@playwright/*`, `typescript`, `tailwindcss`, `postcss`.
     - Group: `development & quality toolchain`
     - Group Slug: `dev-toolchain`
   - Major updates are kept isolated for focused review.
   - `typescript` major updates are suppressed (`allowedVersions: "<7.0.0"`) until upstream ecosystem support matures — see [Known Blocked Major Upgrades](#known-blocked-major-upgrades) below.
   - `postgres` major updates are disabled in Renovate (`matchUpdateTypes: ["major"], enabled: false`) because PostgreSQL major version changes break on-disk volume binary compatibility and require planned manual migration (`pg_dumpall` / `pg_upgrade`).

2. **Security Vulnerability Handling**:
   - Vulnerability and CVE alerts trigger immediate pull requests without rate limits (`schedule: ["at any time"]`).
   - Tagged with `security` and `high-priority` labels.

3. **Rate Limits & Schedules**:
   - Routine non-security updates are scheduled outside working hours: `before 5am on Monday`.
   - Limits: 2 PRs per hour, maximum 5 concurrent open PRs.

4. **Supply Chain Security**:
   - GitHub Actions workflows pin immutable commit SHAs with inline release tag comments (`pinDigests: true`).
   - Releases must be at least one day old before Renovate proposes them (`minimumReleaseAge: "1 day"`, `internalChecksFilter: "strict"`). This matches pnpm's own `minimumReleaseAge` default: `pnpm install --frozen-lockfile` in CI rejects a lockfile with packages younger than a day (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`), so earlier PRs could only fail. Vulnerability fixes are exempt on the Renovate side; if one is younger than a day, add it to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.
   - Pull requests automatically rebase when behind the base branch.

---

## External Geographical Datasets & Services

To eliminate hardcoded airport arrays and fixed coordinates, FamVacay integrates open-source packages and geographical data providers:

### 1. `airport-data`
- Provides an indexed worldwide dataset of 7,100+ airports and 5,600+ valid commercial 3-letter IATA airports.
- Enables instant in-memory lookup by IATA code, city, airport name, or country without third-party rate limits.

### 2. `geolib`
- Performs geodesic distance calculations using the Great-Circle Haversine and Vincenty formulas.
- Used to compute exact straight-line kilometers from user home coordinates to departure airports and between airports.

### 3. OpenStreetMap Nominatim Geocoding
- Provides forward geocoding for departure cities and addresses via `https://nominatim.openstreetmap.org/search`.
- Integrated with Redis caching (24-hour TTL) to comply with Nominatim usage policies and provide sub-millisecond response times for repeated queries.
- Bundles an offline European metropolitan index fallback for reliable operation in isolated or air-gapped environments.

---

## Continuous Integration & Schema Validation

To ensure `renovate.json` syntax and schema remain valid:

- Workflow: `.github/workflows/renovate-validator.yml`
- Runs on every pull request touching Renovate configuration files.
- Command:
  ```bash
  pnpm dlx --package renovate -- renovate-config-validator --strict renovate.json
  ```

---

## Known Blocked Major Upgrades

Majors listed here were held back below Renovate's normal "latest major"
target. Both were attempted and reverted during the pnpm/production-readiness
migration after reproducing concrete breakage; re-attempt either only after
confirming upstream has addressed the issue below.

### TypeScript 7

`typescript@7` is the native (Go) compiler and ships no JavaScript compiler
API: the package's main export is only a version stub. Everything that loads
TypeScript as a library breaks, first of all ESLint (`eslint-config-next` ->
`typescript-eslint`, whose peer range is `>=4.8.4 <6.1.0`) and the type-check
step of `next build`. `tsc --noEmit` itself passes on TS 7 since the Prisma 7
upgrade (the earlier `TS7006` implicit-`any` errors on Prisma `include` results
came from Prisma 6's generated types and are gone).

Pinned to `~6.0.3`, the newest release `typescript-eslint` supports. Re-attempt
once `typescript-eslint` and Next.js support TypeScript 7.

### PostgreSQL Major Versions (17, 18)

PostgreSQL Docker images cannot automatically mount or convert data directories initialized
by an older major version (`postgres_data:/var/lib/postgresql/data`). Upgrading from PostgreSQL 16
to 17 or 18 requires a planned maintenance window with a full logical backup (`pg_dumpall`), volume
recreation, and restore (`psql`). Automated major version updates are therefore suppressed in
`renovate.json` (`matchUpdateTypes: ["major"], enabled: false`).

### Prisma 7 (done)

Upgraded to Prisma 7 once the end-to-end check this needed was possible: the
client is generated by the `prisma-client` generator into `src/generated/prisma`
(gitignored, run `pnpm exec prisma generate`), connects through the
`@prisma/adapter-pg` driver adapter (`src/lib/db/prisma.ts`), and the CLI reads
`DATABASE_URL` from `prisma.config.ts`. `prisma migrate dev` no longer seeds or
generates on its own: run `pnpm run db:seed` / `prisma generate` explicitly.
Verified against a scratch Postgres 16: `migrate deploy` from an empty database
(CLI and the Docker `migrator` image), `db seed`, and real reads/writes through
the standalone build and the Docker `runner` image.

---

## Repository Hygiene Baseline

FamVacay enforces strict cross-platform code formatting and normalization standards:

### 1. `.editorconfig`
- Universal UTF-8 character encoding.
- LF line endings across Unix and Windows environments.
- 2-space indentation with trailing whitespace trimming.
- Exceptions: Batch and PowerShell scripts preserve CRLF for Windows compatibility.

### 2. `.gitattributes`
- `* text=auto eol=lf`: Normalizes line endings to LF upon checkout and commit.
- Binary flags explicitly configured for media formats (`.png`, `.jpg`, `.ico`, `.woff2`).
