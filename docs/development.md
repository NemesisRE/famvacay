# Development & Setup Guide

This guide details local environment prerequisites, installation steps, and instructions for running FamVacay on a developer workstation.

---

## Prerequisites

- **Node.js**: `v26.x` or higher (Active LTS recommended)
- **Package Manager**: `pnpm` (enable via `corepack enable`; version is pinned by `packageManager` in `package.json`)
- **Database & Cache**:
  - PostgreSQL 16
  - Valkey 8+ / Redis 7+
- **Docker** (optional: the quickest way to get the database and cache, see below)

> [!TIP]
> No PostgreSQL or Valkey installed? Run both in throwaway containers, reachable only from this
> machine and matching the values below:
>
> ```bash
> docker run -d --name famvacay-dev-postgres -p 127.0.0.1:5432:5432 \
>   -e POSTGRES_USER=famvacay -e POSTGRES_PASSWORD=famvacay_secure_password -e POSTGRES_DB=famvacay_db \
>   postgres:16-alpine
> docker run -d --name famvacay-dev-valkey -p 127.0.0.1:6379:6379 valkey/valkey:9-alpine
> ```

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

`.env.example` is written for production. Change these values for local development:
```env
NODE_ENV=development
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
Generate the Prisma Client (into `src/generated/prisma`, gitignored) and apply the database migrations:
```bash
pnpm run prisma:generate
pnpm run prisma:migrate
```

`prisma:migrate` runs `prisma migrate deploy`. When you change `prisma/schema.prisma`, create the migration with `pnpm exec prisma migrate dev --name <change>` and commit it.

> [!NOTE]
> On Windows, `prisma generate` can fail with `EPERM` while the dev server holds the query engine
> open. The types are regenerated anyway; stop the dev server if it keeps failing.

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

> [!WARNING]
> The standalone build currently fails on **Windows** at request time (`e.hasOwnProperty is not a
> function`). Linux, macOS and the Docker image are not affected - on Windows, test the production
> build with Docker (`docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build`).

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


## Pull Requests & Releases

Releases are drafted automatically by [Release Drafter](https://github.com/release-drafter/release-drafter)
(`.github/release-drafter.yml`). Every pull request merged into `main` is added to a draft
release, and its labels decide both the release-notes section and the next version:

| Label | Version bump |
| --- | --- |
| `breaking-change` | major (`1.4.2` → `2.0.0`) |
| `feature`, `enhancement` | minor (`1.4.2` → `1.5.0`) |
| anything else (`fix`, `security`, `dependencies`, `chore`, ...) | patch (`1.4.2` → `1.4.3`) |
| `skip-changelog` | left out of the release notes |

Pull request titles follow [Conventional Commits](https://www.conventionalcommits.org/), and the
labels are set from them automatically: `feat: ...` → `feature`, `fix: ...` → `fix`,
`feat!: ...` or a `BREAKING CHANGE` note in the description → `breaking-change`. Renaming the title
updates the labels; labels can also be set or corrected by hand. Commits pushed directly to `main`
without a pull request do not appear in the release notes.

To release, open the draft under **Releases**, check the notes and the version, and click
**Publish release**. Publishing creates the `vX.Y.Z` tag, and the CI pipeline then builds the
`linux/amd64` and `linux/arm64` images and pushes them to
`ghcr.io/nemesisre/famvacay` as `X.Y.Z`, `X.Y`, `X` and `latest`.

Labels themselves are defined in `.github/labels.yml` and synced by the *Sync Labels* workflow.

## Repository Settings

Settings that cannot live in files (description, squash-only merging, secret scanning, Actions
permissions) and the rulesets in `.github/rulesets/` are applied by
`scripts/github/configure-repository.sh`. It needs a token with admin rights on the repository
and can be run again after changing a ruleset. The `main` ruleset requires pull requests with
passing checks and squash merges; repository admins can still merge a pull request without
waiting for checks, but cannot push to `main` directly. Release tags (`v*`) cannot be moved
or deleted.
