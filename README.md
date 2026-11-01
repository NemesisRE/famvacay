<div align="center">
  <img src="public/icon.svg" width="96" height="96" alt="FamVacay Logo" />
  <h1>FamVacay</h1>
  <p><strong>Family Vacation Optimizer</strong></p>
  <p>Harmonize statutory school holiday calendars, discover departure arbitrage savings, and optimize PTO bridge days.</p>

  <p>
    <a href="https://github.com/NemesisRE/famvacay/releases/latest"><img src="https://img.shields.io/github/v/release/NemesisRE/famvacay?style=for-the-badge&logo=git&logoColor=white&label=version&color=blue" alt="Version" /></a>
    <a href="docs/dependencies.md"><img src="https://img.shields.io/badge/renovate-enabled-brightgreen?style=for-the-badge&logo=renovate&logoColor=white" alt="Renovate" /></a>
    <a href="https://pnpm.io/"><img src="https://img.shields.io/badge/pnpm-12-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-26_LTS-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" /></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/github/package-json/dependency-version/NemesisRE/famvacay/next?style=for-the-badge&logo=next.js&logoColor=white&label=Next.js&color=black" alt="Next.js" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/github/package-json/dependency-version/NemesisRE/famvacay/dev/typescript?style=for-the-badge&logo=typescript&logoColor=white&label=TypeScript&color=blue" alt="TypeScript" /></a>
    <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-16--alpine-336791?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
    <a href="https://www.prisma.io/"><img src="https://img.shields.io/github/package-json/dependency-version/NemesisRE/famvacay/dev/prisma?style=for-the-badge&logo=prisma&logoColor=white&label=Prisma&color=2D3748" alt="Prisma" /></a>
    <a href="https://valkey.io/"><img src="https://img.shields.io/badge/Valkey_/_Redis-9_/_7-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Valkey" /></a>
    <a href="Dockerfile"><img src="https://img.shields.io/badge/Docker-Multi--Arch-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" /></a>
    <a href="docs/development.md"><img src="https://img.shields.io/badge/Coverage-93%25-brightgreen?style=for-the-badge&logo=vitest&logoColor=white" alt="Coverage" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL_v3-blue?style=for-the-badge&logo=gnu&logoColor=white" alt="License" /></a>
  </p>
</div>

---

Planning memorable family vacations shouldn't require juggling multiple spreadsheets, manually checking school calendars, or paying peak-season flight prices.

**FamVacay** is a self-hostable web application designed specifically for parents and families. It mathematically solves the family vacation planning puzzle by harmonizing statutory school holiday calendars, discovering neighboring-state departure savings, evaluating family-friendly weather conditions, and optimizing bridge days so you use fewer paid days off.

Engineered with modern cloud-agnostic standards, FamVacay runs seamlessly on home servers, private clouds, or Kubernetes clusters behind your reverse proxy of choice.

---

## Quick Start

> [!IMPORTANT]
> **Running FamVacay in production?** Follow the [Setup & Deployment Guide](docs/setup.md). A
> public instance needs a TLS reverse proxy, your public `APP_URL`, real database and Umami
> secrets, and the operator details for the imprint and privacy policy. There is deliberately no
> copy-paste shortcut for it - the quick start below is for trying FamVacay on your own machine.

### Option A: Try it locally with Docker Compose

For a look at FamVacay on your own machine - no reverse proxy, no domain, reachable only from this computer:

```bash
# 1. Clone the repository
git clone https://github.com/NemesisRE/famvacay.git
cd famvacay

# 2. Generate the session secret (the app refuses to start without a real one)
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" > .env

# 3. Launch the full stack (PostgreSQL 16, Valkey 9, migrations, web app, Umami)
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# 4. Open http://localhost:3000 (Umami: http://localhost:3001)
```

> [!NOTE]
> `docker-compose.local.yml` publishes the ports on `127.0.0.1` only, serves plain HTTP and lets
> Compose create the network a reverse proxy would otherwise provide. It is **not** a production
> setup, and it uses the default database and Umami passwords from `docker-compose.yml`.

### Option B: Local Development

```bash
# 1. Prerequisites: Node.js 26 (LTS), pnpm (via corepack), PostgreSQL 16, Valkey/Redis
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env

# 2. Initialize Prisma client & database schema
pnpm exec prisma generate
pnpm exec prisma migrate dev

# 3. Start local development server
pnpm dev
```

This needs a PostgreSQL and a Valkey/Redis instance of your own and a few adjusted values in `.env` - see the [Development Guide](docs/development.md).

---

## Key Features

### Smart School Holiday Enforcement

When planning vacations with school-aged children, staying within official school breaks is essential. FamVacay references the statutory school break schedules of each child's school region from the OpenHolidays API (cached for 30 days) and first proposes windows that fit completely inside them. If the trip you want is longer than the break, the best-covering windows are still shown, clearly marked as needing a school exemption.

### Cross-Border Departure Arbitrage

School holidays in neighboring federal states or countries rarely begin on the same date. FamVacay analyzes departure airports in adjacent jurisdictions (such as flying out of Frankfurt/Hessen while Baden-Württemberg is on summer break), where flights are not priced for a holiday rush - the benchmark estimate assumes roughly 28% lower fares than from home airports in high season.

### PTO & Bridge Day Optimization

Parental leave and vacation days are limited. The optimization engine counts weekdays and public holidays inside candidate windows to minimize consumed vacation days:

$$\text{PTO\\_days\\_consumed} = \text{total\\_weekdays} - \text{public\\_holidays}$$

You receive clear suggestions for long getaways that require the lowest number of PTO days from work.

### Family Profiles & Age-Tiered Pricing

Every family is unique. In your dedicated Family Profile, you can:

- Register participating family members with their birth dates and school regions (names are optional).
- Automatically calculate airline pricing tiers on the travel date: infants (<2 years at ~10% fare), children (2–11 years at ~95% on short and medium haul, ~75% on long haul), and teens/adults (12+ years at 100%).
- Set travel comfort settings, including the maximum overland travel time and cabin class preferences.
- Store recurring blackout periods and your preferred departure airports.
- Switch on the passport check: search results warn when a passport would be valid for less than 6 months after a trip outside the EU, and reminders arrive by email 6 months and 1 month before it expires.
- Share search results as a link with a trip board - without addresses, coordinates or exact birth dates.

### Authentication & Passkeys

Families can safely store their trip plans and profiles with flexible authentication options:

- Traditional Email & Password (secured with bcrypt), with email confirmation when a mail server is configured.
- Biometric Passkeys & WebAuthn (Touch ID, Face ID, Windows Hello, YubiKey).
- Social Logins (Google and Apple).
- Account linking to bind multiple authentication methods to one family account.

### Built-in Internationalization (i18n)

FamVacay supports multiple languages with automatic browser language detection and an in-app language switcher:

- English (`en` — default)
- German (`de`)
- French (`fr`)
- Spanish (`es`)
- Italian (`it`)

---

## Documentation

Detailed technical guides, deployment blueprints, and dependency strategies are organized in the [`docs/`](docs/) directory:

- [**Setup & Deployment Guide**](docs/setup.md): Production deployment with Docker Compose or Kubernetes, all environment variables, reverse-proxy configurations (Pangolin, Traefik, Nginx, NPM, Caddy), updates and backups.
- [**Development & Setup Guide**](docs/development.md): Workstation prerequisites, testing guidelines, and environment setup.
- [**System Architecture & Technical Specifications**](docs/architecture.md): Topology diagrams, reverse proxy hardening, data models, authentication flows, and API reference.
- [**Dependency Management & Repository Hygiene**](docs/dependencies.md): Renovate Bot update grouping, CI schema validation, and line-ending normalization rules.
- [**Architecture Decision Records (ADRs)**](docs/adr/): Recorded technical decisions regarding auth, flight pricing, geocoding, and cache engine.

---

## Data Sources

Reference data is generated from open datasets by `src/lib/datasets/generators/`. The JSON bundled in the repo is only the seed: in production the app **refreshes it by itself in the background** — on first start and then on a schedule (monthly; climate quarterly, hourly while rain-duration data is still filling in) — sanity-checks every result (no malformed records, no source suddenly shrinking) and stores it in Postgres (`GeneratedDataset`), one replica at a time. No CI/CD is needed for that; set `DATASET_AUTO_REFRESH=false` to stay on the bundled data.

> [!NOTE]
> Prices are **benchmark estimates** (distance, season, school-holiday demand, passenger ages and cabin class), not live fares - no free flight-pricing API is available for self-hosted use (see [ADR 0002](docs/adr/0002-flight-price-provider.md)). The booking links open the real offers.

The same generators run manually (`pnpm run generate:*`), and the weekly [`data-sync`](.github/workflows/data-sync.yml) workflow refreshes the bundled seed for new installs via a reviewed PR:

- **Airports:** [OurAirports](https://ourairports.com/data/) (public domain) for the commercial airports with scheduled service, with the city names travellers know from [OpenFlights](https://openflights.org/data) via [airport-data](https://www.npmjs.com/package/airport-data) (`pnpm run generate:airports-db`)
- **Airline route network:** The "Airlines and destinations" tables of [English Wikipedia](https://en.wikipedia.org)'s airport articles (CC BY-SA 4.0; only the routes are stored, matched to IATA codes via Wikidata), which include current seasonal and charter routes. The [OpenFlights route database](https://openflights.org/data) ([Open Database License](https://opendatacommons.org/licenses/odbl/1-0/), last updated 2014) fills in only between airports without a Wikipedia table (`pnpm run generate:flight-routes`).
- **School holidays (home regions and Europe's big source markets):** [OpenHolidays API](https://www.openholidaysapi.org); markets it does not (fully) cover — United Kingdom, Italy, Spain, and incomplete years for France/Poland — use typical national calendars (`src/lib/holidays/source-markets.ts`).
- **Climate normals (monthly temperature, daily range, rainfall):** [NASA POWER](https://power.larc.nasa.gov) climatology, public domain (`pnpm run generate:climate-normals`).
- **Rain duration (rainy days, hours of rain per rainy day):** [Weather data by Open-Meteo.com](https://open-meteo.com/), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (same script). The free Open-Meteo API is for non-commercial use only: with `LEGAL_OPERATION_MODE=commercial`, new data is fetched only with a paid-plan `OPEN_METEO_API_KEY` (customer endpoint, 10 years of history instead of 3); already published data stays in use.
- **Localized city names & airport passenger figures:** [Wikidata](https://www.wikidata.org), CC0 (`pnpm run generate:city-names`, `pnpm run generate:airport-traffic`).
- **Price levels (what meals cost at the destination):** [World Bank Open Data](https://data.worldbank.org), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): the PPP conversion factor for private consumption divided by the official exchange rate, per country. Scales the estimated value of the meals included in the board type (`pnpm run generate:price-levels`).
- **Holiday appeal (where people actually go on holiday, and what for):** How often [Wikivoyage](https://www.wikivoyage.org) guides (English and German, CC BY-SA 4.0) mention beaches, skiing, nature, sights, and family attractions, and how widely they are read ([Wikimedia page views](https://wikimedia.org/api/rest_v1/), CC0). Only counts are stored, no text. Discovery ranks destinations by it instead of airport size (`pnpm run generate:holiday-appeal`).

---

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) to ensure strong copyleft protection, including network use and hosted services.
