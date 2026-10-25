# FamVacay — Family Vacation Optimizer

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](docs/dependencies.md)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220.svg)](https://pnpm.io/)
[![Node](https://img.shields.io/badge/Node.js-26_LTS-339933.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.3-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19.3-2D3748.svg)](https://www.prisma.io/)
[![Valkey](https://img.shields.io/badge/Valkey_/_Redis-8_/_7-DC382D.svg)](https://valkey.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Arch-2496ED.svg)](Dockerfile)
[![Coverage](https://img.shields.io/badge/Coverage-92.8%25-brightgreen.svg)](docs/development.md)
[![License](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Planning memorable family vacations shouldn't require juggling multiple spreadsheets, manually checking school calendars, or paying peak-season flight prices.

**FamVacay** is a self-hostable web application designed specifically for parents and families. It mathematically solves the family vacation planning puzzle by harmonizing statutory school holiday calendars, discovering neighboring-state departure savings, evaluating family-friendly weather conditions, and optimizing bridge days so you use fewer paid days off.

Engineered with modern cloud-agnostic standards, FamVacay runs seamlessly on home servers, private clouds, or Kubernetes clusters behind your favorite reverse proxy.

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended for Production / Evaluation)

```bash
# 1. Clone repository and create local environment
git clone https://github.com/NemesisRE/famvacay.git
cd famvacay
cp .env.example .env

# 2. Launch the full stack (PostgreSQL 16, Valkey 8, Migration Job, Web App)
docker compose up -d

# 3. Access the web app
# Visit http://localhost:3000 (local) or https://famvacay.us (production)
```

### Option B: Local Development

```bash
# 1. Prerequisites: Node 26 (LTS), pnpm (via `corepack enable`), PostgreSQL 16, Valkey/Redis
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env

# 2. Initialize Prisma client & database schema
pnpm exec prisma generate
pnpm exec prisma migrate dev

# 3. Start local development server
pnpm dev
```

---

## ✈️ Why FamVacay?

### 1. Smart School Holiday Enforcement

When you have school-aged children, staying strictly within official school breaks is essential. FamVacay automatically references statutory school break schedules from the OpenHolidays API (cached for 30 days) and guarantees that vacation proposals fit within approved school holidays.

### 2. Cross-Border Flight Arbitrage

School holidays in neighboring federal states or countries rarely begin on the same date. FamVacay analyzes departure airports in adjacent jurisdictions (such as flying out of Frankfurt/Hessen while Baden-Württemberg is on summer break) to reveal savings of 25% to 45% compared to home airports in high season.

### 3. PTO & Bridge Day Optimization

Parental leave and vacation days are limited. The optimization engine counts weekdays and public holidays inside candidate windows to minimize consumed vacation days:
$$\text{PTO\_days\_consumed} = \text{total\_weekdays} - \text{public\_holidays}$$
You receive clear suggestions for long getaways that require the lowest number of PTO days from work.

### 4. Family Profile & Child Age Tiers

Every family member is unique. In your dedicated Family Profile, you can:

- Register participating family members and exact birth dates.
- Automatically calculate airline pricing tiers: infants (<2 years at ~10% fare), children (2–11 years at ~75% fare), and teens/adults (12+ years at 100%).
- Set travel comfort settings, including maximum driving radius to departure airports and cabin class preferences.
- Track passport validity dates with automated warnings to prevent airport check-in surprises.

### 5. Multi-User Authentication & Passkeys

Families can safely store their trip plans and profiles with passwordless login options:

- Traditional Email & Password (secured with bcrypt).
- Biometric Passkeys & WebAuthn (Touch ID, Face ID, Windows Hello, YubiKey).
- Social Logins (Google and Apple).
- Account linking to bind multiple authentication methods to one family account.

### 6. Built-in Internationalization (i18n)

FamVacay supports multiple languages with automatic browser language detection and an in-app language switcher:

- English (`en` — default)
- German (`de`)
- French (`fr`)
- Spanish (`es`)
- Italian (`it`)

---

## 📚 Documentation & Developer Guides

Detailed technical guides, deployment blueprints, and dependency strategies are organized in the [`docs/`](docs/) directory:

- [**Setup & Reverse Proxy Guide**](docs/setup.md): Prerequisites, local development, environment variables, and production reverse-proxy configurations (Traefik, Nginx, NPM, Caddy).
- [**System Architecture & Technical Specifications**](docs/architecture.md): Topology diagrams, reverse proxy hardening, data models, authentication flows, and API reference.
- [**Dependency Management & Repository Hygiene**](docs/dependencies.md): Renovate Bot update grouping, CI schema validation, and line-ending normalization rules.
- [**Architecture Decision Records (ADRs)**](docs/adr/): Recorded technical decisions regarding auth, flight pricing, geocoding, and cache engine.

---

## 🗂️ Data Sources

Reference data is generated from open datasets by `src/lib/datasets/generators/`. The JSON
bundled in the repo is only the seed: in production the app **refreshes it by itself in the
background** — on first start and then on a schedule (monthly; climate quarterly, hourly
while rain-duration data is still filling in) — sanity-checks every result (no malformed
records, no source suddenly shrinking) and stores it in Postgres (`GeneratedDataset`), one
replica at a time. No CI/CD is needed for that; set `DATASET_AUTO_REFRESH=false` to stay on
the bundled data. The same generators run manually (`pnpm run generate:*`), and the weekly
[`data-sync`](.github/workflows/data-sync.yml) workflow still refreshes the bundled seed for
new installs via a reviewed PR:

- **Airports:** [airport-data](https://www.npmjs.com/package/airport-data) / [OpenFlights](https://openflights.org/data) (`pnpm run generate:airports-db`)
- **Airline route network:** [OpenFlights route database](https://openflights.org/data), made available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/) (`pnpm run generate:flight-routes`)
- **School holidays (home regions and Europe's big source markets):** [OpenHolidays API](https://www.openholidaysapi.org); markets it does not (fully) cover - United Kingdom, Italy, Spain, and incomplete years for France/Poland - use typical national calendars (`src/lib/holidays/source-markets.ts`)
- **Climate normals (monthly temperature, daily range, rainfall):** [NASA POWER](https://power.larc.nasa.gov) climatology, public domain (`pnpm run generate:climate-normals`)
- **Rain duration (rainy days, hours of rain per rainy day):** [Weather data by Open-Meteo.com](https://open-meteo.com/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (same script). The free Open-Meteo API is for non-commercial use only: with `LEGAL_OPERATION_MODE=commercial`, new data is fetched only with a paid-plan `OPEN_METEO_API_KEY` (customer endpoint, 10 years of history instead of 3); already published data stays in use
- **Localized city names & airport passenger figures:** [Wikidata](https://www.wikidata.org), CC0 (`pnpm run generate:city-names`, `pnpm run generate:airport-traffic`)
- **Holiday appeal (where people actually go on holiday, and what for):** how often [Wikivoyage](https://www.wikivoyage.org) guides (English and German, CC BY-SA 4.0) mention beaches, skiing, nature, sights and family attractions, and how widely they are read ([Wikimedia page views](https://wikimedia.org/api/rest_v1/), CC0). Only counts are stored, no text. Discovery ranks destinations by it instead of airport size (`pnpm run generate:holiday-appeal`)

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) to ensure strong copyleft protection, including network use and hosted services.
