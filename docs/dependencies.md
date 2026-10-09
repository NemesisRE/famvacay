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
     - Includes: `eslint*`, `@typescript-eslint/*`, `prettier*`, `vitest*`, `@playwright/*`, `typescript`, `tailwindcss`, `postcss`, `autoprefixer`.
     - Group: `development & quality toolchain`
     - Group Slug: `dev-toolchain`
   - Major updates are kept isolated for focused review.

2. **Security Vulnerability Handling**:
   - Vulnerability and CVE alerts trigger immediate pull requests without rate limits (`schedule: ["at any time"]`).
   - Tagged with `security` and `high-priority` labels.

3. **Rate Limits & Schedules**:
   - Routine non-security updates are scheduled outside working hours: `before 5am on Monday`.
   - Limits: 2 PRs per hour, maximum 5 concurrent open PRs.

4. **Supply Chain Security**:
   - GitHub Actions workflows pin immutable commit SHAs with inline release tag comments (`pinDigests: true`).
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
  npx --yes --package renovate renovate-config-validator --strict renovate.json
  ```

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
