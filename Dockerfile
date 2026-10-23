# ==============================================================================
# Multi-Stage, Multi-Arch Dockerfile for FamVacay
# Target architectures: linux/amd64, linux/arm64
# Base: Node.js 26 Active LTS Alpine (Node 22 is Maintenance LTS)
# Package manager: pnpm, via Corepack (pinned by packageManager in package.json)
# Stages: deps -> builder -> migrator -> runner
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------------------------------------------
FROM node:26-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl
RUN npm install -g corepack && corepack enable

# Fetch into the pnpm content-addressable store first (cached as long as the
# lockfile is unchanged), then install by linking from the store offline.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install
RUN pnpm fetch

COPY prisma ./prisma/
RUN pnpm install --frozen-lockfile --offline

# ------------------------------------------------------------------------------
# Stage 2: Builder
# ------------------------------------------------------------------------------
FROM node:26-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack && corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Generate Prisma Client
RUN pnpm exec prisma generate

# Build Next.js in standalone mode. Next's output file tracing already
# bundles @prisma/client -- symlink into .pnpm plus the real target,
# including the native query engine binaries -- into .next/standalone/
# node_modules on its own; no manual copy step needed (and don't add one:
# an earlier version of this Dockerfile did, and it conflicted with the
# symlink Next had already placed there, breaking the runner stage's COPY).
RUN pnpm run build

# ------------------------------------------------------------------------------
# Stage 3: Migrator (Dedicated one-shot container for database migrations)
# ------------------------------------------------------------------------------
FROM node:26-alpine AS migrator
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat
RUN npm install -g corepack && corepack enable

# Non-root user nextjs (UID/GID 10001) matching runner and k8s securityContext
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 nextjs

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack install && pnpm install --frozen-lockfile --prod --ignore-scripts

# `pnpm add -g` refuses to run until its global bin dir is actually on PATH.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
# Without --allow-build, pnpm skips prisma/@prisma/engines' postinstall (the
# step that downloads the schema/query engine binaries) and prisma tries to
# lazily fetch them on first run instead -- by then we've already dropped to
# the non-root `nextjs` user, who can't write into this global store.
RUN pnpm add -g prisma@6.19.3 --allow-build=prisma --allow-build=@prisma/engines

COPY --chown=nextjs:nodejs prisma ./prisma/

USER nextjs
ENTRYPOINT ["prisma"]
CMD ["migrate", "deploy"]

# ------------------------------------------------------------------------------
# Stage 4: Runner (Target size < 150MB, read-only root compatible)
# ------------------------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /app

# Only openssl required by Prisma client runtime
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user nextjs (UID/GID 10001)
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 nextjs

# Copy standalone build & static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# Curl-free readiness healthcheck using Node.js built-in HTTP client. Hits
# /api/ready (checks Postgres + Valkey connectivity), not /api/health (pure
# liveness, always 200), so this actually reports an outage.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server.js"]
