# Development & Setup Guide

This guide details local environment prerequisites, installation steps, and instructions for running FamVacay on a developer workstation.

---

## Prerequisites

- **Node.js**: `v26.x` or higher (Active LTS recommended)
- **Package Manager**: `pnpm` (enable via `corepack enable`; version is pinned by `packageManager` in `package.json`)
- **Database & Cache**:
  - PostgreSQL 16+
  - Valkey 8+ / Redis 7+
- **Docker & Docker Compose** (Optional for local containerized development)

---

## Local Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/NemesisRE/famvacay.git
cd famvacay
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```

Ensure the following variables are configured for local development:
```env
APP_URL=http://localhost:3000
ALLOWED_ORIGINS=localhost:3000
DATABASE_URL=postgresql://famvacay:famvacay_secure_password@localhost:5432/famvacay_db?schema=public
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=development_secret_key_minimum_32_characters_long
NEXTAUTH_URL=http://localhost:3000
```

### 3. Install Dependencies
```bash
corepack enable
pnpm install --frozen-lockfile
```

### 4. Database Initialization & Migrations
Generate the Prisma Client and run the database migrations:
```bash
pnpm run prisma:generate
pnpm run prisma:migrate
```

---

## Running the Application

### Development Mode
Start the Next.js development server with hot reloading:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Standalone Build
To test the standalone production build locally:
```bash
pnpm run build
pnpm run start
```

---

## Running Tests & Quality Checks

```bash
# Run linting (ESLint 10 flat config)
pnpm run lint

# Perform TypeScript type checking
pnpm run typecheck

# Execute unit and algorithm tests (Vitest)
pnpm test

# Run tests with strict coverage verification (>80% required, scoped to
# src/lib/optimizer and src/lib/proxy — see vitest.config.mts)
pnpm run test:coverage

# Run end-to-end journey tests (Playwright)
pnpm run test:e2e
```

