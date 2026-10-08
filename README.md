# FamVacay — Family Vacation Optimizer

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](package.json)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](docs/dependencies.md)
[![Next.js](https://img.shields.io/badge/Next.js-14.2.18-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16--alpine-336791.svg)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Redis-7--alpine-DC382D.svg)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Multi--Arch-2496ED.svg)](Dockerfile)
[![Coverage](https://img.shields.io/badge/Coverage-96.06%25-brightgreen.svg)](docs/development.md)
[![License](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

Planning memorable family vacations shouldn't require juggling multiple spreadsheets, manually checking school calendars, or paying peak-season flight prices.

**FamVacay** is a self-hostable web application designed specifically for parents and families. It mathematically solves the family vacation planning puzzle by harmonizing statutory school holiday calendars, discovering neighboring-state departure savings, evaluating family-friendly weather conditions, and optimizing bridge days so you use fewer paid days off.

Engineered with modern cloud-agnostic standards, FamVacay runs seamlessly on home servers, private clouds, or Kubernetes clusters behind your favorite reverse proxy.

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

- [**Local Development & Setup Guide**](docs/development.md): Prerequisites, environment configuration, database migrations, and local execution.
- [**System Architecture & Technical Specifications**](docs/architecture.md): Topology diagrams, reverse proxy hardening, data models, authentication flows, and API reference.
- [**Dependency Management & Repository Hygiene**](docs/dependencies.md): Renovate Bot update grouping, CI schema validation, and line-ending normalization rules.

---

## 📄 License
 
This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE) to ensure strong copyleft protection, including network use and hosted services.
