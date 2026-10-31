<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FamVacay - notes for coding agents

Self-hosted family vacation optimizer: Next.js 16 (App Router), React 19, Prisma 7 / PostgreSQL 16, Valkey, Tailwind 4, Vitest, Playwright. Read `CONTRIBUTING.md` first; architecture and operations live in `docs/` (link to them instead of copying).

## Commands

- Setup: `corepack enable && pnpm install --frozen-lockfile && pnpm exec prisma generate`
- Before every push: `pnpm run lint`, `pnpm run typecheck`, `pnpm test` (all must pass; CI also runs `pnpm audit --prod --audit-level=high`)
- E2E: `pnpm run test:e2e` (needs a database, see `docs/development.md`)
- Deployment files: `docker compose --env-file .env.example config -q` (also with `-f docker-compose.yml -f docker-compose.local.yml`) and `kubectl kustomize k8s/overlays/production`

## Rules that break CI or a review

- **UI text** goes into all five locales in `src/lib/i18n/locales/` (en, de, fr, es, it) plus `types.ts`; `tests/i18n-key-parity.test.ts` compares the keys. German UI text uses "du", the legal texts "Sie".
- **Database changes** need a migration in `prisma/migrations/` (generate the SQL with `prisma migrate diff`, review it, commit it).
- **Personal data:** anything that changes what is processed also updates the privacy policy (`src/components/legal/PrivacyContent.tsx` and the `legal` locale strings).
- **PR titles** are Conventional Commits with a lowercase subject (`fix(geo): use ...`); they become the squash commit and decide the version. `main` only changes through squash-merged PRs.
- **No hardcoded catalogs** of places, airports, countries or holidays: data comes from the generated datasets (`src/lib/datasets/`), ISO 3166 packages and the geocoder.
- **Tests never call live services.** `tests/setup-unit.ts` mocks Nominatim, Photon, OpenHolidays, Open-Meteo and the travel advisories; extend it or stub `fetch` in the test. For database-backed logic, take an injectable `db` (see `src/lib/passport/reminders.ts`) so tests can pass in-memory fakes.
- **Comments explain why**, matching the surrounding code; keep the existing style and naming.

## Code conventions

- Destination lookups go through `getDestinationPoint()` (`src/lib/geo/destination-points.ts`), not `getAirportByIata`: destinations can be overland places without an airport, and overland candidates use `originAirport: 'HOME'` (`OVERLAND_ORIGIN_CODE`) with no flight fields.
- Safety: full travel warnings (Auswärtiges Amt / US level 4) are a hard ban in the engine, even for destinations the user names. Keep `src/lib/safety/advisory-store.ts` free of runtime imports - a failed `require` there once let banned countries through silently.
- New profile preferences that the search only reads go into the `FamilyProfile.scoringWeights` JSON (like `excludedCountries`, `travelDistances`): no migration needed. The optimize cache key hashes the whole request, so new request fields need no cache version bump - only changed output does.
- Route-handler tests mock `@/lib/db/prisma` with an in-memory fake (reuse `tests/helpers/fake-shared-board-prisma.ts`) and call the exported `GET`/`POST` directly; no database is needed.
- Popovers use `src/components/ui/responsive-popover.tsx` (centered overlay on phones); the `animate-in` utilities live in `src/app/globals.css`, there is no animation plugin.

## Traps

- Changing the optimizer's output or selection: bump `OPTIMIZER_CACHE_VERSION` in `src/app/api/vacations/optimize/route.ts`, or cached results from the old code are served for 10 minutes.
- One search briefly needs up to ~1 GB of heap. Keep the run queue (`src/lib/optimizer/run-queue.ts`) and check heavy optimizer changes in Docker with its 2 GB limit, not only on a dev machine without one.
- Geocoding: search-as-you-type goes to Photon (`src/lib/geo/photon.ts`). The public Nominatim server forbids autocomplete - use it only for one-off lookups.
- Dependencies: pnpm rejects packages published less than a day ago (`minimumReleaseAge`), and Renovate waits the same day. Don't bypass that.
- Mail is optional: everything must work without SMTP (`isMailConfigured()`); never log recipients.
- Windows: the standalone build (`pnpm run start`) does not run there - test production builds with Docker. `prisma generate` may fail with EPERM while the dev server runs; the types still regenerate.
- `next dev` rewrites the block at the top of this file; leave it and edit only below it.
- Pull requests are squash-merged. Don't stack PRs on unmerged branches: their full CI only runs once they target `main`, and after the base is squashed they need `git rebase --onto`.
- Release Drafter rewrites the draft release on every merge to `main`; hand-written release notes go in right before publishing.

## Where things are

- `src/lib/optimizer/` - the engine (`engine.ts`), scoring, destinations, seasonal warnings
- `src/lib/datasets/` - generators and background refresh of airports, routes, climate, city names, holiday appeal
- `src/lib/airports/`, `src/lib/geo/`, `src/lib/holidays/`, `src/lib/pricing/` - inputs to the optimizer
- `src/lib/auth/`, `src/lib/mail/`, `src/lib/passport/` - accounts, email confirmation, passport warnings and reminders
- `src/app/api/` - route handlers; `src/app/page.tsx` - search form and results
- `docs/setup.md` (deployment, all environment variables), `docs/architecture.md`, `docs/development.md` (tests, releases), `docs/dependencies.md` (Renovate, blocked upgrades), `docs/adr/`
